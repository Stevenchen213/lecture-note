/**
 * 端到端冒烟测试：模拟浏览器客户端，把真实讲座 PCM 音频流给本地后端。
 * 验证完整链路：WS → Azure ASR → Kimi 翻译/大纲/练习题。
 * 用法: node test/e2e_smoke.mjs   （需 server 已在 :8080 运行）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PCM = path.join(__dirname, 'lecture_test.pcm');
const WS_URL = process.argv[2] || 'ws://localhost:8080';
const ws = new WebSocket(WS_URL);
console.log('[test] 目标:', WS_URL);

const stats = { partial: 0, final: 0, translation: 0, outline: 0, questions: 0, errors: [] };
const finals = [];
const translations = [];

ws.on('open', () => {
  console.log('[test] WS 已连接，发送 start_session');
  ws.send(JSON.stringify({ type: 'start_session', pptContext: '' }));

  // 以实时速率推送音频（100ms = 3200 字节 @16kHz 16bit mono）
  const pcm = fs.readFileSync(PCM);
  const CHUNK = 3200;
  let offset = 0;
  const timer = setInterval(() => {
    if (offset >= pcm.length) {
      clearInterval(timer);
      console.log('[test] 音频推完，发送 stop_session');
      ws.send(JSON.stringify({ type: 'stop_session' }));
      return;
    }
    ws.send(pcm.subarray(offset, offset + CHUNK));
    offset += CHUNK;
  }, 100);
});

ws.on('message', (data) => {
  let msg;
  try { msg = JSON.parse(data.toString()); } catch { return; }
  switch (msg.type) {
    case 'partial_transcript': stats.partial++; break;
    case 'final_transcript':
      stats.final++;
      finals.push(msg.text);
      console.log(`[final] ${msg.text.slice(0, 80)}`);
      break;
    case 'translation':
      if (msg.isFinal) {
        stats.translation++;
        translations.push(msg.text);
        console.log(`[翻译] ${msg.text.slice(0, 60)}`);
      }
      break;
    case 'outline_update':
      stats.outline++;
      console.log(`[大纲更新] ${msg.outline?.title || ''} / 章节数 ${msg.outline?.sections?.length}`);
      break;
    case 'practice_questions':
      stats.questions = msg.questions?.length || 0;
      console.log(`[练习题] 收到 ${stats.questions} 道`);
      break;
    case 'session_stopped':
      console.log('[test] session_stopped 收到');
      summarize(); process.exit(0);
      break;
    case 'error':
      stats.errors.push(msg.message);
      console.error(`[服务器错误] ${msg.message}`);
      break;
  }
});

ws.on('error', (e) => { console.error('[test] WS 错误:', e.message); process.exit(1); });

function summarize() {
  console.log('\n===== 冒烟测试汇总 =====');
  console.log(`partial: ${stats.partial}, final: ${stats.final}, 翻译: ${stats.translation}, 大纲更新: ${stats.outline}, 练习题: ${stats.questions}`);
  console.log(`错误: ${stats.errors.length ? stats.errors.join(' | ') : '无'}`);
  const pass = stats.final > 0 && stats.translation > 0;
  console.log(pass ? '✅ 链路通畅（识别+翻译正常）' : '❌ 链路异常');
}

// 总超时 5 分钟（2 分钟音频 + 大纲/练习题生成）
setTimeout(() => { console.log('\n[test] 超时退出'); summarize(); process.exit(0); }, 300000);
