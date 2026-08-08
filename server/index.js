import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import AdmZip from 'adm-zip';
import zlib from 'zlib';
import { startRecognition, pushAudioData, stopRecognition } from './azure-speech.js';
import { translate, generateOutline, generateQuestions } from './deepseek.js';

config();

const PORT = process.env.PORT || 8080;

/**
 * 检测文本是否主要为中文（用于过滤中文语音识别结果）
 * 如果中文字符占比 > 40%，视为中文内容，返回 true
 */
function isMainlyChinese(text) {
  if (!text || text.length === 0) return false;
  let cjkCount = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    // CJK 统一表意文字范围 + 中文标点
    if (
      (code >= 0x4E00 && code <= 0x9FFF) || // 基本汉字
      (code >= 0x3400 && code <= 0x4DBF) || // 扩展A
      (code >= 0x20000 && code <= 0x2A6DF) || // 扩展B
      (code >= 0xFF01 && code <= 0xFF5E) || // 全角标点
      (code >= 0x3000 && code <= 0x303F) // CJK 标点
    ) {
      cjkCount++;
    }
  }
  return cjkCount / text.length > 0.4;
}

/**
 * 提取 PDF 中的文本（内置解析，无需外部依赖）
 * 处理未压缩和 FlateDecode 压缩的文本流
 */
function extractPdfText(fileBuffer) {
  try {
    const text = fileBuffer.toString('latin1');
    const texts = [];

    // 尝试解压 FlateDecode 流中的所有文字
    const streamRegex = /\/Filter\s*\/FlateDecode[\s\S]*?stream\s*\r?\n?([\s\S]*?)\r?\n?endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(text)) !== null) {
      try {
        const compressed = Buffer.from(streamMatch[1], 'latin1');
        const decompressed = zlib.inflateSync(compressed).toString('utf8');
        texts.push(decompressed);
      } catch { /* skip unparseable stream */ }
    }

    // 也处理未压缩的流
    const rawStreamRegex = /stream\s*\r?\n?([\s\S]*?)\r?\n?endstream/g;
    let rawMatch;
    while ((rawMatch = rawStreamRegex.exec(text)) !== null) {
      const content = rawMatch[1];
      if (!texts.some(t => content.includes(t.slice(0, 100)))) {
        texts.push(content);
      }
    }

    // 从文本块中提取括号内的文字（Tj/TJ 操作符）
    const result = [];
    for (const block of texts) {
      // Tj: (text) Tj
      for (const m of block.matchAll(/\(([^)]*)\)\s*Tj/g)) {
        if (m[1]) result.push(m[1]);
      }
      // TJ: [(text) ...] TJ
      for (const m of block.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
        for (const inner of m[1].matchAll(/\(([^)]*)\)/g)) {
          if (inner[1]) result.push(inner[1]);
        }
      }
      // 也匹配 ' 和 " 操作符
      for (const m of block.matchAll(/\(([^)]*)\)\s*'/g)) {
        if (m[1]) result.push(m[1]);
      }
    }

    // 如果解压流没找到文字，直接在原始文本中找 BT/ET 块
    if (result.length === 0) {
      const btRegex = /BT\s*([\s\S]*?)\s*ET/g;
      let btMatch;
      while ((btMatch = btRegex.exec(text)) !== null) {
        const block = btMatch[1];
        for (const m of block.matchAll(/\(([^)]*)\)\s*Tj/g)) {
          if (m[1]) result.push(m[1]);
        }
      }
    }

    // 解码 PDF 转义字符
    const decoded = result
      .map(s => s
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\(\d{3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)))
      )
      .join(' ');

    return decoded || '（无法提取 PDF 文字，请确认文件包含可选择文本）';
  } catch (err) {
    console.error('PDF 解析失败:', err.message);
    return '';
  }
}

/**
 * 提取 PPTX 中的文本（PPTX 是 ZIP 文件，文字在 slide XML 的 <a:t> 标签中）
 */
function extractPptxText(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const texts = [];

    for (const entry of entries) {
      // 只处理 slide XML 文件
      if (entry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/)) {
        const xml = entry.getData().toString('utf8');
        // 提取所有 <a:t> 标签中的文字
        const matches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
        for (const m of matches) {
          const text = m[1].trim();
          if (text) texts.push(text);
        }
      }
    }

    return texts.join('\n');
  } catch (err) {
    console.error('PPTX 解析失败:', err.message);
    return '';
  }
}

// HTTP 服务器
const httpServer = createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // PPT 上传端点
  if (req.method === 'POST' && req.url === '/upload-ppt') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '需要 multipart/form-data' }));
      return;
    }

    // 解析 multipart body
    const boundary = '--' + contentType.split('boundary=')[1];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const str = buffer.toString('binary');
        const parts = str.split(boundary);

        for (const part of parts) {
          if (!part.includes('Content-Disposition') || !part.includes('filename=')) continue;

          // 提取文件名
          const filenameMatch = part.match(/filename="([^"]*)"/);
          const filename = filenameMatch ? filenameMatch[1] : 'upload.pptx';

          // 提取文件体
          const bodyStart = part.indexOf('\r\n\r\n');
          if (bodyStart === -1) continue;
          let body = part.slice(bodyStart + 4);
          // 去掉尾部 \r\n
          if (body.endsWith('\r\n')) body = body.slice(0, -2);

          const fileBuffer = Buffer.from(body, 'binary');

          const ext = filename.toLowerCase().split('.').pop();
          if (!['pptx', 'pdf'].includes(ext)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '只支持 .pptx 和 .pdf 文件' }));
            return;
          }

          // 写入临时文件
          const os = require('os');
          const path = require('path');
          const fs = require('fs');
          const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.${ext}`);
          fs.writeFileSync(tmpPath, fileBuffer);

          // 提取文字
          let text = '';
          if (ext === 'pptx') {
            text = extractPptxText(tmpPath);
          } else if (ext === 'pdf') {
            text = extractPdfText(fileBuffer);
          }

          // 清理临时文件
          try { fs.unlinkSync(tmpPath); } catch {}

          console.log(`文件上传成功: ${filename} (.${ext}), 提取 ${text.length} 字符`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, filename, text }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '未找到文件' }));
      } catch (err) {
        console.error('PPT 上传处理失败:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT} (Azure: ${process.env.AZURE_SPEECH_REGION})`);
});

wss.on('connection', (ws) => {
  console.log('客户端已连接');

  let transcriptBuffer = [];
  let outlineInterval = null;
  let isPaused = false;
  let pptContext = '';

  function startOutline() {
    outlineInterval = setInterval(async () => {
      if (transcriptBuffer.length === 0) return;
      try {
        console.log(`大纲批处理: ${transcriptBuffer.length} 条`);
        const outline = await generateOutline(transcriptBuffer, pptContext);
        ws.send(JSON.stringify({ type: 'outline_update', outline }));
      } catch (err) {
        console.error('大纲失败:', err.message);
      }
    }, 30000);
  }

  ws.on('message', async (data) => {
    const text = data.toString();
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      if (Buffer.isBuffer(data)) {
        if (!isPaused) pushAudioData(data);
      }
      return;
    }

    switch (message.type) {
      case 'start_session':
        console.log('会话开始...');
        if (message.pptContext) {
          pptContext = message.pptContext;
          console.log(`PPT 上下文: ${pptContext.length} 字符`);
        }
        transcriptBuffer = [];

        try {
          await startRecognition(ws, async (text, timestamp) => {
            // 过滤中文语音
            if (isMainlyChinese(text)) {
              console.log(`过滤中文: ${text.slice(0, 50)}...`);
              return;
            }

            transcriptBuffer.push({ text, timestamp });

            // 异步翻译
            try {
              const zh = await translate(text);
              ws.send(JSON.stringify({ type: 'translation', text: zh, original: text, timestamp }));
            } catch (e) {
              console.error('翻译失败:', e.message);
            }
          });

          startOutline();
          ws.send(JSON.stringify({ type: 'session_started' }));
        } catch (err) {
          console.error('启动 ASR 失败:', err);
          ws.send(JSON.stringify({ type: 'error', message: `ASR 启动失败: ${err.message}` }));
        }
        break;

      case 'stop_session':
        console.log('会话结束');
        await stopRecognition();
        if (outlineInterval) { clearInterval(outlineInterval); outlineInterval = null; }

        // 生成最终大纲
        if (transcriptBuffer.length > 0) {
          try {
            const outline = await generateOutline(transcriptBuffer, pptContext);
            ws.send(JSON.stringify({ type: 'outline_update', outline }));
          } catch (e) { /* ignore */ }
        }

        // 生成练习题
        if (transcriptBuffer.length > 3) {
          try {
            console.log('生成练习题...');
            // 先拿到当前大纲数据给练习题生成用
            const finalOutline = await generateOutline(transcriptBuffer, pptContext);
            const questions = await generateQuestions(transcriptBuffer, finalOutline);
            ws.send(JSON.stringify({ type: 'practice_questions', ...questions }));
          } catch (e) {
            console.error('练习题生成失败:', e.message);
          }
        }

        ws.send(JSON.stringify({ type: 'session_stopped' }));
        break;

      case 'pause':
        isPaused = true;
        console.log('会话暂停');
        ws.send(JSON.stringify({ type: 'paused' }));
        break;

      case 'resume':
        isPaused = false;
        console.log('会话恢复');
        ws.send(JSON.stringify({ type: 'resumed' }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  });

  ws.on('close', async () => {
    console.log('客户端断开');
    if (outlineInterval) clearInterval(outlineInterval);
    await stopRecognition();
  });

  ws.on('error', (err) => console.error('WS 错误:', err));
});
