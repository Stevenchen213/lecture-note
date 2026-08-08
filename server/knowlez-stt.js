/**
 * Knowlez STT API 集成
 * 将 PCM 音频转为 WAV base64，调用 REST 接口做语音识别
 */

const API_URL = 'https://api-stt.knowlez.com/v1/stt/transcribe';

function key() {
  const k = process.env.KNOWLEZ_STT_KEY || process.env.AZURE_SPEECH_KEY;
  if (!k) throw new Error('缺少 KNOWLEZ_STT_KEY / AZURE_SPEECH_KEY');
  return k;
}

/**
 * 给原始 PCM 数据加上 WAV 文件头
 * PCM: 16kHz, 16-bit, mono
 */
function pcmToWav(pcmBuffer) {
  const numChannels = 1;
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 36);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

/**
 * 发送音频到 Knowlez 做识别
 * @param {Buffer} pcmBuffer 原始 PCM 数据
 * @returns {{ text: string }}
 */
export async function recognize(pcmBuffer) {
  if (pcmBuffer.length < 1600) {
    // 少于 100ms 的音频，跳过（太短无法识别）
    return { text: '' };
  }

  const wavBuffer = pcmToWav(pcmBuffer);
  const base64 = wavBuffer.toString('base64');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key(),
    },
    body: JSON.stringify({ audio_base64: base64 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Knowlez STT ${res.status}: ${err}`);
  }

  const data = await res.json();
  // 可能的响应格式：{ text: "..." } 或 { transcription: "..." }
  return { text: (data.text || data.transcript || data.transcription || '').trim() };
}
