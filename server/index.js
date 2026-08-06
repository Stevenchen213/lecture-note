import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { startRecognition, pushAudioData, stopRecognition } from './azure-speech.js';

config();

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket 服务器运行在端口 ${PORT}`);

wss.on('connection', (ws) => {
  console.log('客户端已连接');

  ws.on('message', async (data) => {
    // 二进制数据 = 音频流
    if (Buffer.isBuffer(data)) {
      pushAudioData(data);
      return;
    }

    // 文本消息 = JSON 控制指令
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }

    switch (message.type) {
      case 'start_session':
        console.log('会话开始，启动语音识别...');
        try {
          await startRecognition(ws);
          ws.send(JSON.stringify({ type: 'session_started' }));
        } catch (err) {
          console.error('启动识别失败:', err);
          ws.send(JSON.stringify({
            type: 'error',
            message: `语音识别启动失败: ${err.message}`,
          }));
        }
        break;

      case 'stop_session':
        console.log('会话结束');
        await stopRecognition();
        ws.send(JSON.stringify({ type: 'session_stopped' }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        console.log('未知消息类型:', message.type);
    }
  });

  ws.on('close', async () => {
    console.log('客户端断开连接');
    await stopRecognition();
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err);
  });
});
