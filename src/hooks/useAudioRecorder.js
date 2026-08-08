import { useRef, useState, useCallback } from 'react';

/**
 * 浏览器麦克风录音 Hook
 * 输出 16kHz 16bit 单声道 PCM 数据，直接对接 Azure Speech push stream
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const onDataRef = useRef(null);

  const start = useCallback(async (onAudioData) => {
    try {
      onDataRef.current = onAudioData;

      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 创建 AudioContext（目标 16kHz 以匹配 Azure ASR 格式）
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // ScriptProcessor 捕获原始 PCM
      // bufferSize=4096 → 在 16kHz 下约 256ms 一帧
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!onDataRef.current) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        onDataRef.current(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination); // 必须连 destination 才会触发 onaudioprocess

      setIsRecording(true);
      setError(null);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风'
        : `麦克风启动失败: ${err.message}`;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const stop = useCallback(() => {
    onDataRef.current = null;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  return { isRecording, error, start, stop };
}
