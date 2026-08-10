import { WebSocketServer } from 'ws';
import express from 'express';
import { config } from 'dotenv';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import * as z from 'zod';
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

// ====== Express App ======
const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  next();
});

// 健康检查
app.get(['/', '/health'], (req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// PPT 上传端点
app.post('/upload-ppt', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: '需要 multipart/form-data' });
    return;
  }

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

        const filenameMatch = part.match(/filename="([^"]*)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'upload.pptx';

        const bodyStart = part.indexOf('\r\n\r\n');
        if (bodyStart === -1) continue;
        let body = part.slice(bodyStart + 4);
        if (body.endsWith('\r\n')) body = body.slice(0, -2);

        const fileBuffer = Buffer.from(body, 'binary');

        if (!filename.toLowerCase().endsWith('.pptx')) {
          res.status(400).json({ error: '只支持 .pptx 文件' });
          return;
        }

        const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.pptx`);
        fs.writeFileSync(tmpPath, fileBuffer);
        const text = extractPptxText(tmpPath);
        try { fs.unlinkSync(tmpPath); } catch {}

        console.log(`PPT 上传成功: ${filename}, 提取 ${text.length} 字符`);
        res.json({ success: true, filename, text });
        return;
      }

      res.status(400).json({ error: '未找到文件' });
    } catch (err) {
      console.error('PPT 上传处理失败:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// PDF 上传端点
app.post('/upload-pdf', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: '需要 multipart/form-data' });
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
          res.status(400).json({ error: '只支持 .pdf 文件' });
          return;
        }

        const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.pdf`);
        fs.writeFileSync(tmpPath, fileBuffer);

        let text;
        try {
          text = await extractPdfText(tmpPath);
        } catch (err) {
          console.error('PDF 提取失败:', err);
          res.status(500).json({ error: `PDF 解析失败: ${err.message}` });
          try { fs.unlinkSync(tmpPath); } catch {}
          return;
        }

        try { fs.unlinkSync(tmpPath); } catch {}

        console.log(`PDF 上传成功: ${filename}, 提取 ${text.length} 字符`);
        res.json({ success: true, filename, text });
        return;
      }

      res.status(400).json({ error: '未找到文件' });
    } catch (err) {
      console.error('PDF 上传处理失败:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// ====== MCP Server ======

let mcpCallCount = 0;

function createMcpServer() {
  const server = new McpServer({
    name: 'lecturenote-mcp',
    version: '1.0.0',
  });

  server.registerTool('translate', {
    title: '英中同传翻译',
    description: '将英文文本实时翻译为简体中文，专为课堂场景优化（学术术语+口语表达兼顾）。用于同声传译场景。',
    inputSchema: z.object({
      text: z.string().describe('需要翻译的英文文本'),
    }),
  }, async ({ text }) => {
    if (!text || text.trim().length === 0) {
      return { content: [{ type: 'text', text: '(empty input)' }] };
    }
    try {
      const result = await translate(text);
      return { content: [{ type: 'text', text: result.trim() }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Translation failed: ${e.message}` }] };
    }
  });

  server.registerTool('generate_outline', {
    title: '生成课程大纲',
    description: '根据课堂转录文本，自动生成结构化的双语课程大纲。识别课程章节、关键概念和逻辑结构。',
    inputSchema: z.object({
      transcript: z.string().describe('课堂转录文本'),
      context: z.string().optional().describe('可选的课件文本'),
    }),
  }, async ({ transcript, context }) => {
    if (!transcript || transcript.trim().length === 0) {
      return { content: [{ type: 'text', text: JSON.stringify({ title: '(无内容)', sections: [] }) }] };
    }
    try {
      const buffer = [{ text: transcript, timestamp: Date.now() }];
      const outline = await generateOutline(buffer, context || '');
      return { content: [{ type: 'text', text: JSON.stringify(outline, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Outline generation failed: ${e.message}` }] };
    }
  });

  server.registerTool('generate_questions', {
    title: '生成练习题',
    description: '根据课堂内容和课程大纲，生成15道核心考试题（选择题/简答题/判断题），优先覆盖考点。每题含答案和解析。',
    inputSchema: z.object({
      transcript: z.string().describe('课堂转录文本'),
      outline: z.string().optional().describe('已生成的大纲 JSON'),
    }),
  }, async ({ transcript, outline }) => {
    if (!transcript || transcript.trim().length < 50) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: '内容太短', questions: [] }) }] };
    }
    try {
      const buffer = [{ text: transcript, timestamp: Date.now() }];
      const outlineObj = outline ? JSON.parse(outline) : null;
      const result = await generateQuestions(buffer, outlineObj);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Question generation failed: ${e.message}` }] };
    }
  });

  server.registerTool('health', {
    title: '服务健康检查',
    description: '检查 MCP 服务是否正常运行，返回服务状态和调用统计。',
    inputSchema: z.object({}),
  }, async () => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'healthy',
          service: 'lecturenote-mcp',
          version: '1.0.0',
          model: 'deepseek-chat',
          totalMCPCalls: ++mcpCallCount,
        }),
      }],
    };
  });

  return server;
}

const mcpHandler = createMcpHandler(() => createMcpServer(), {
  onerror: (err) => console.error('MCP 错误:', err.message),
});

// MCP Streamable HTTP 端点
app.all('/mcp', async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    const webRes = await mcpHandler.fetch(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((value, key) => res.set(key, value));
    const body = await webRes.text();
    res.send(body);
  } catch (err) {
    console.error('MCP 请求失败:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP error' });
    }
  }
});

// 404
app.use((req, res) => { res.status(404).end('Not Found'); });

// ====== Start Server ======
const httpServer = app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT} (Azure: ${process.env.AZURE_SPEECH_REGION})`);
  console.log(`MCP 端点: /mcp`);
  warmupOcr().catch((e) => console.error('OCR 预热失败:', e.message));
});

const wss = new WebSocketServer({ server: httpServer });

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
  let isStopping = false;

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
          // session_started 仅用于前端确认会话已就绪（当前前端不监听此事件）
        } catch (err) {
          console.error('启动 ASR 失败:', err);
          ws.send(JSON.stringify({ type: 'error', message: `ASR 启动失败: ${err.message}` }));
        }
        break;

      case 'stop_session':
        if (isStopping) { console.log('已在处理结束流程，忽略'); return; }
        isStopping = true;
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
