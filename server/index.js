import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { config } from 'dotenv';
import { startRecognition, pushAudioData, stopRecognition } from './azure-speech.js';
import { translate, generateOutline } from './deepseek.js';

config();

const PORT = process.env.PORT || 8080;

// HTTP 健康检查 + 唤醒端点
const httpServer = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('ok');
  }
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

  function startOutline() {
    outlineInterval = setInterval(async () => {
      if (transcriptBuffer.length === 0) return;
      try {
        console.log(`大纲批处理: ${transcriptBuffer.length} 条`);
        const outline = await generateOutline(transcriptBuffer);
        ws.send(JSON.stringify({ type: 'outline_update', outline }));
      } catch (err) {
        console.error('大纲失败:', err.message);
      }
    }, 30000);
  }

  ws.on('message', async (data) => {
    // 先尝试 JSON
    const text = data.toString();
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      // 二进制音频 → 推送 Azure（暂停时跳过）
      if (Buffer.isBuffer(data)) {
        if (!isPaused) pushAudioData(data);
      }
      return;
    }

    switch (message.type) {
      case 'start_session':
        console.log('会话开始，启动 Azure ASR...');
        transcriptBuffer = [];

        try {
          await startRecognition(ws, async (text, timestamp) => {
            transcriptBuffer.push({ text, timestamp });

            // 异步翻译（不阻塞英文显示）
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

        if (transcriptBuffer.length > 0) {
          try {
            const outline = await generateOutline(transcriptBuffer);
            ws.send(JSON.stringify({ type: 'outline_update', outline }));
          } catch (e) { /* ignore */ }
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
