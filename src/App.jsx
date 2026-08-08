import { useState, useCallback, useRef } from 'react';
import StartScreen from './components/StartScreen';
import SubtitlePanel from './components/SubtitlePanel';
import OutlinePanel from './components/OutlinePanel';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useWebSocket } from './hooks/useWebSocket';
import { mergeOutline } from './utils/outlineMerge';

let subtitleId = 0;

export default function App() {
  const [sessionState, setSessionState] = useState('idle'); // idle | recording | stopped
  const [subtitles, setSubtitles] = useState([]);
  const [outline, setOutline] = useState(null);
  const [startError, setStartError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  const { isRecording, error: micError, start: startMic, stop: stopMic } = useAudioRecorder();
  const { isConnected, error: wsError, connect: wsConnect, disconnect: wsDisconnect, send, sendAudio, on } = useWebSocket();

  // 开始听课
  const handleStart = useCallback(async () => {
    try {
      setStartError(null);
      await wsConnect();
      send({ type: 'start_session' });
      await startMic((pcmBuffer) => {
        sendAudio(pcmBuffer);
      });
      setSessionState('recording');
    } catch (err) {
      console.error('启动失败:', err.message);
      setStartError(err.message);
    }
  }, [wsConnect, send, startMic, sendAudio]);

  // 暂停
  const handlePause = useCallback(() => {
    setIsPaused(true);
    send({ type: 'pause' });
  }, [send]);

  // 继续
  const handleResume = useCallback(() => {
    setIsPaused(false);
    send({ type: 'resume' });
  }, [send]);

  // 结束听课
  const handleStop = useCallback(() => {
    stopMic();
    setIsPaused(false);
    send({ type: 'stop_session' });
    setTimeout(() => wsDisconnect(), 200);
    setSessionState('stopped');
  }, [stopMic, send, wsDisconnect]);

  // 注册 WebSocket 消息处理
  const handlersRef = useRef(false);
  if (!handlersRef.current) {
    handlersRef.current = true;

    on('partial_transcript', (msg) => {
      setSubtitles((prev) => {
        const filtered = prev.filter((s) => s.id !== '__partial__');
        return [...filtered, { id: '__partial__', original: msg.text, translated: '', isNew: true, isPartial: true }];
      });
    });

    // 最终结果（英文即刻显示，中文稍后更新）
    on('final_transcript', (msg) => {
      setSubtitles((prev) => {
        const filtered = prev.filter((s) => s.id !== '__partial__');
        const newSub = {
          id: ++subtitleId,
          original: msg.text,
          translated: '...',
          isNew: true,
          isPartial: false,
        };
        return [...filtered.map((s) => ({ ...s, isNew: false })), newSub];
      });
    });

    // 兼容旧版：单独的翻译消息仍可更新已显示的字幕
    on('translation', (msg) => {
      setSubtitles((prev) =>
        prev.map((s) => (s.original === msg.original ? { ...s, translated: msg.text } : s))
      );
    });

    on('outline_update', (msg) => {
      setOutline((prev) => mergeOutline(prev, msg.outline));
    });

    on('error', (msg) => {
      console.error('服务器错误:', msg.message);
      setServerError(msg.message);
    });

    // 暂停/恢复确认
    on('paused', () => setIsPaused(true));
    on('resumed', () => setIsPaused(false));
  }

  const displayError = startError || micError || wsError;

  if (sessionState === 'idle') {
    return <StartScreen onStart={handleStart} error={displayError} />;
  }

  return (
    <div className="flex h-screen">
      <div className="w-2/5 border-r border-gray-200 overflow-hidden">
        <SubtitlePanel
          subtitles={subtitles}
          isRecording={sessionState === 'recording'}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          serverError={serverError}
        />
      </div>
      <div className="w-3/5 overflow-hidden">
        <OutlinePanel outline={outline} setOutline={setOutline} subtitles={subtitles} isStopped={sessionState === 'stopped'} />
      </div>
    </div>
  );
}
