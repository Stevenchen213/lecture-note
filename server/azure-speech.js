import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let speechConfig = null;
let recognizer = null;
let pushStream = null;
let sdkModule = null;

async function getSdk() {
  if (!sdkModule) {
    sdkModule = await import('microsoft-cognitiveservices-speech-sdk');
  }
  return sdkModule;
}

export async function initializeSpeech() {
  const subscriptionKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'southeastasia';

  if (!subscriptionKey) {
    throw new Error('缺少 AZURE_SPEECH_KEY 环境变量');
  }

  const sdk = await getSdk();

  speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
  // 使用印度英语模型，针对口音优化
  speechConfig.speechRecognitionLanguage = 'en-IN';
  speechConfig.enableDictation();
  speechConfig.setProfanity(sdk.ProfanityOption.Raw);

  // PCM 16kHz 16-bit 单声道（匹配浏览器 MediaRecorder）
  const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  console.log('Azure Speech 初始化完成 (en-IN, 16kHz PCM)');
  return recognizer;
}

export async function startRecognition(ws, onTranscript, onPartial) {
  if (!recognizer) {
    await initializeSpeech();
  }

  recognizer.recognizing = (s, e) => {
    // 中间结果——实时推送到前端 + 触发实时翻译
    if (e.result.text && e.result.text.trim()) {
      const partialText = e.result.text.trim();
      ws.send(JSON.stringify({
        type: 'partial_transcript',
        text: partialText,
        timestamp: Date.now(),
      }));
      if (onPartial) {
        onPartial(partialText, Date.now());
      }
    }
  };

  recognizer.recognized = (s, e) => {
    // 最终识别结果 → 立即推送英文，翻译异步处理
    if (e.result.text && e.result.text.trim()) {
      const text = e.result.text.trim();
      ws.send(JSON.stringify({
        type: 'final_transcript',
        text,
        timestamp: Date.now(),
      }));
      if (onTranscript) {
        onTranscript(text, Date.now());
      }
    }
  };

  recognizer.canceled = (s, e) => {
    console.error('语音识别被取消:', e.errorDetails);
    ws.send(JSON.stringify({
      type: 'error',
      message: `语音识别错误: ${e.errorDetails}`,
    }));
  };

  recognizer.sessionStopped = () => {
    console.log('语音识别会话结束');
  };

  return new Promise((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log('持续识别已启动');
        resolve();
      },
      (err) => {
        console.error('启动识别失败:', err);
        reject(err);
      }
    );
  });
}

export function pushAudioData(audioBuffer) {
  if (pushStream) {
    pushStream.write(audioBuffer);
  }
}

export async function stopRecognition() {
  if (!recognizer) return;

  return new Promise((resolve) => {
    recognizer.stopContinuousRecognitionAsync(
      () => {
        console.log('识别已停止');
        try { pushStream?.close(); } catch (e) { /* ignore */ }
        try { recognizer?.close(); } catch (e) { /* ignore */ }
        recognizer = null;
        pushStream = null;
        resolve();
      },
      (err) => {
        console.error('停止识别失败:', err);
        resolve();
      }
    );
  });
}
