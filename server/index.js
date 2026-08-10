import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import AdmZip from 'adm-zip';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { startRecognition, pushAudioData, stopRecognition } from './azure-speech.js';
import { translate, generateOutline, generateQuestions } from './deepseek.js';
import { extractPdfText, warmupOcr } from './pdf-utils.js';

config();

const PORT = process.env.PORT || 8080;

// 常见英文功能词——如果一句话里一个都没有，大概率不是英语
const ENGLISH_WORDS = /\b(the|is|are|was|were|a|an|of|in|to|and|that|it|we|you|this|will|can|for|on|with|be|have|do|not|but|or|all|if|so|at|by|from|about|which|when|who|what|how|has|been|they|them|their|our|also|very|some|more|than)\b/i;

/**
 * 检测文本是否为非英语语音（中文汉字 / 拼音 / 其他语言）
 * 返回 true 表示应该跳过
 */
function isNotEnglish(text) {
  if (!text || text.length < 2) return false;

  // 1) 中文字符占比 > 30%
  let cjkCount = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x20000 && code <= 0x2A6DF) ||
      (code >= 0xFF01 && code <= 0xFF5E) ||
      (code >= 0x3000 && code <= 0x303F)
    ) {
      cjkCount++;
    }
  }
  if (cjkCount / text.length > 0.3) return true;

  // 2) 如果完全没有常见英文功能词（如 the/is/and），大概率是拼音或其他语言
  if (!ENGLISH_WORDS.test(text)) return true;

  return false;
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

          if (!filename.toLowerCase().endsWith('.pptx')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '只支持 .pptx 文件' }));
            return;
          }

          // 写入临时文件
          const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.pptx`);
          fs.writeFileSync(tmpPath, fileBuffer);

          // 提取文字
          const text = extractPptxText(tmpPath);

          // 清理临时文件
          try { fs.unlinkSync(tmpPath); } catch {}

          console.log(`PPT 上传成功: ${filename}, 提取 ${text.length} 字符`);
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

  // PDF 上传端点
  if (req.method === 'POST' && req.url === '/upload-pdf') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '需要 multipart/form-data' }));
      return;
    }

    const boundary = '--' + contentType.split('boundary=')[1];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const str = buffer.toString('binary');
        const parts = str.split(boundary);

        for (const part of parts) {
          if (!part.includes('Content-Disposition') || !part.includes('filename=')) continue;

          const filenameMatch = part.match(/filename="([^"]*)"/);
          const filename = filenameMatch ? filenameMatch[1] : 'upload.pdf';

          const bodyStart = part.indexOf('\r\n\r\n');
          if (bodyStart === -1) continue;
          let body = part.slice(bodyStart + 4);
          if (body.endsWith('\r\n')) body = body.slice(0, -2);

          const fileBuffer = Buffer.from(body, 'binary');

          if (!filename.toLowerCase().endsWith('.pdf')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '只支持 .pdf 文件' }));
            return;
          }

          const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.pdf`);
          fs.writeFileSync(tmpPath, fileBuffer);

          let text;
          try {
            text = await extractPdfText(tmpPath);
          } catch (err) {
            console.error('PDF 提取失败:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `PDF 解析失败: ${err.message}` }));
            try { fs.unlinkSync(tmpPath); } catch {}
            return;
          }

          try { fs.unlinkSync(tmpPath); } catch {}

          console.log(`PDF 上传成功: ${filename}, 提取 ${text.length} 字符`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, filename, text }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '未找到文件' }));
      } catch (err) {
        console.error('PDF 上传处理失败:', err);
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
  // 预热 OCR 引擎（后台下载语言包，不阻塞服务）
  warmupOcr().catch((e) => console.error('OCR 预热失败:', e.message));
});

wss.on('connection', (ws) => {
  console.log('客户端已连接');

  let transcriptBuffer = [];
  let outlineInterval = null;
  let isPaused = false;
  let pptContext = '';
  let translateQueue = [];
  let runningTranslations = 0;
  const MAX_CONCURRENT = 5;
  let totalRecognized = 0;
  let totalFiltered = 0;
  let totalTranslated = 0;
  let lastPartialText = '';
  let lastPartialTime = 0;

  function processTranslateQueue() {
    while (runningTranslations < MAX_CONCURRENT && translateQueue.length > 0) {
      const task = translateQueue.shift();
      runningTranslations++;
      task()
        .catch(() => {})
        .finally(() => {
          runningTranslations--;
          processTranslateQueue();
        });
    }
  }

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
          await startRecognition(
            ws,
            // onTranscript (final) — 完整句子
            async (text, timestamp, isTooShort) => {
              totalRecognized++;
              if (isNotEnglish(text)) {
                totalFiltered++;
                console.log(`[识别 #${totalRecognized}] 过滤: "${text.slice(0, 60)}"`);
                return;
              }

              // 太短的填充词只存缓冲给大纲用，不翻译不展示
              if (isTooShort) {
                console.log(`[识别 #${totalRecognized}] 跳过: "${text}" (填充词)`);
                transcriptBuffer.push({ text, timestamp });
                return;
              }

              console.log(`[识别 #${totalRecognized}] 通过: "${text.slice(0, 60)}" → 排队翻译`);
              transcriptBuffer.push({ text, timestamp });
              lastPartialText = ''; // 重置，准备下一句

              // 加入翻译队列
              translateQueue.push(async () => {
                try {
                  const zh = await translate(text);
                  totalTranslated++;
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'translation', text: zh, original: text, timestamp, isFinal: true }));
                  }
                } catch (e) {
                  console.error(`[翻译失败] 原文: "${text.slice(0, 50)}" 错误: ${e.message}`);
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'translation_error', original: text, error: e.message }));
                  }
                }
              });
              processTranslateQueue();
            },
            // onPartial — 实时片段翻译，低延迟同传体验
            (partialText, timestamp) => {
              if (isNotEnglish(partialText)) return;

              // 去重：和上次比至少多 10 个字符才重新翻译
              if (partialText === lastPartialText) return;
              if (partialText.length - lastPartialText.length < 10) return;

              // 节流：每个句子最多每秒翻译一次
              const now = Date.now();
              if (now - lastPartialTime < 1000) return;

              lastPartialText = partialText;
              lastPartialTime = now;

              // 加入翻译队列（用较低的优先级，让完整句子的翻译优先）
              translateQueue.push(async () => {
                try {
                  const zh = await translate(partialText);
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'translation', text: zh, original: partialText, timestamp, isFinal: false }));
                  }
                } catch (e) {
                  // partial 翻译失败不通知前端，等 final 翻译即可
                  console.error(`[部分翻译失败] "${partialText.slice(0, 40)}" ${e.message}`);
                }
              });
              processTranslateQueue();
            }
          );

          startOutline();
          ws.send(JSON.stringify({ type: 'session_started' }));
        } catch (err) {
          console.error('启动 ASR 失败:', err);
          ws.send(JSON.stringify({ type: 'error', message: `ASR 启动失败: ${err.message}` }));
        }
        break;

      case 'stop_session':
        console.log('会话结束');
        console.log(`[统计] 识别${totalRecognized}句, 过滤${totalFiltered}句, 翻译成功${totalTranslated}句`);
        await stopRecognition();
        if (outlineInterval) { clearInterval(outlineInterval); outlineInterval = null; }

        // 生成最终大纲
        let finalOutline = null;
        if (transcriptBuffer.length > 0) {
          try {
            finalOutline = await generateOutline(transcriptBuffer, pptContext);
            console.log(`最终大纲已生成: ${finalOutline?.title || '(无标题)'}, ${finalOutline?.sections?.length || 0} 章节`);
            ws.send(JSON.stringify({ type: 'outline_update', outline: finalOutline }));
          } catch (e) {
            console.error('最终大纲生成失败:', e.message, e.stack?.slice(0, 200));
          }
        }

        // 生成练习题（复用上面的大纲，不再重复生成）
        if (transcriptBuffer.length > 3 && finalOutline) {
          try {
            console.log(`生成练习题… (基于${transcriptBuffer.length}条记录)`);
            const questions = await generateQuestions(transcriptBuffer, finalOutline);
            console.log(`练习题已生成: ${questions?.questions?.length || 0} 道`);
            ws.send(JSON.stringify({ type: 'practice_questions', ...questions }));
          } catch (e) {
            console.error('练习题生成失败:', e.message);
            console.error('完整错误:', e.stack?.slice(0, 300));
            // 通知前端练习题生成失败
            ws.send(JSON.stringify({ type: 'error', message: `练习题生成失败: ${e.message}` }));
          }
        } else {
          console.log(`跳过练习题: buffer=${transcriptBuffer.length}, outline=${!!finalOutline}`);
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
