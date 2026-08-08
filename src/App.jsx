import { useState, useCallback, useRef, useEffect } from 'react';
import StartScreen from './components/StartScreen';
import SubtitlePanel from './components/SubtitlePanel';
import OutlinePanel from './components/OutlinePanel';
import HistoryPanel from './components/HistoryPanel';
import ReplayView from './components/ReplayView';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useWebSocket } from './hooks/useWebSocket';
import { mergeOutline } from './utils/outlineMerge';
import { saveSession } from './utils/sessionStore';

let subtitleId = 0;

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const HTTP_URL = WS_URL.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

export default function App() {
  const [screen, setScreen] = useState('home');
  const [replayId, setReplayId] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [outline, setOutline] = useState(null);
  const [startError, setStartError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);

  const { isRecording, error: micError, start: startMic, stop: stopMic } = useAudioRecorder();
  const { isConnected, error: wsError, connect: wsConnect, disconnect: wsDisconnect, send, sendAudio, on } = useWebSocket();

  // 页面加载时自动唤醒后端（Render 免费版会休眠）
  useEffect(() => {
    fetch(`${HTTP_URL}/health`).catch(() => {});
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setStartError(null);
      setWakingUp(true);

      // 连接 WebSocket（如果后端在休眠，多试几次）
      let retries = 0;
      const maxRetries = 12;
      while (retries < maxRetries) {
        try {
          await wsConnect();
          break;
        } catch {
          retries++;
          if (retries >= maxRetries) {
            throw new Error('服务器唤醒超时，请刷新页面重试');
          }
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      setWakingUp(false);
      send({ type: 'start_session' });
      await startMic((pcmBuffer) => {
        sendAudio(pcmBuffer);
      });
      setScreen('recording');
    } catch (err) {
      setWakingUp(false);
      console.error('启动失败:', err.message);
      setStartError(err.message);
    }
  }, [wsConnect, send, startMic, sendAudio]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    send({ type: 'pause' });
  }, [send]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    send({ type: 'resume' });
  }, [send]);

  const handleStop = useCallback(() => {
    stopMic();
    setIsPaused(false);
    send({ type: 'stop_session' });

    setTimeout(() => {
      wsDisconnect();

      setSubtitles((currentSubtitles) => {
        setOutline((currentOutline) => {
          if (currentSubtitles.length > 0) {
            saveSession({ subtitles: currentSubtitles, outline: currentOutline });
          }
          return currentOutline;
        });
        return currentSubtitles;
      });

      setScreen('home');
    }, 1500);
  }, [stopMic, send, wsDisconnect]);

  const handleViewHistory = useCallback(() => {
    setScreen('history');
    setStartError(null);
  }, []);

  const handleViewSession = useCallback((id) => {
    setReplayId(id);
    setScreen('replay');
  }, []);

  const handleBackToHome = useCallback(() => {
    setScreen('home');
    setReplayId(null);
  }, []);

  const handlersRef = useRef(false);
  if (!handlersRef.current) {
    handlersRef.current = true;

    on('partial_transcript', (msg) => {
      setSubtitles((prev) => {
        const filtered = prev.filter((s) => s.id !== '__partial__');
        return [...filtered, { id: '__partial__', original: msg.text, translated: '', isNew: true, isPartial: true }];
      });
    });

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

    on('paused', () => setIsPaused(true));
    on('resumed', () => setIsPaused(false));
  }

  const displayError = startError || micError || wsError;

  if (screen === 'history') {
    return <HistoryPanel onViewSession={handleViewSession} onBack={handleBackToHome} />;
  }

  if (screen === 'replay' && replayId) {
    return <ReplayView sessionId={replayId} onBack={handleBackToHome} />;
  }

  if (screen === 'home') {
    return (
      <StartScreen
        onStart={handleStart}
        onViewHistory={handleViewHistory}
        error={displayError}
        wakingUp={wakingUp}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100/80 flex-shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm shadow-indigo-200">
            <span className="text-xs">🎓</span>
          </div>
          <span className="text-sm font-bold text-slate-700 tracking-tight">
            Lecture<span className="text-indigo-500">Note</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className={`flex items-center gap-1.5 ${isPaused ? 'text-amber-500' : isRecording ? 'text-emerald-500' : 'text-slate-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : isRecording ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            {isPaused ? '已暂停' : isRecording ? '录制中' : '已结束'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/5 border-r border-slate-100 overflow-hidden">
          <SubtitlePanel
            subtitles={subtitles}
            isRecording={true}
            isPaused={isPaused}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            serverError={serverError}
          />
        </div>
        <div className="w-3/5 overflow-hidden">
          <OutlinePanel
            outline={outline}
            setOutline={setOutline}
            subtitles={subtitles}
            isStopped={false}
          />
        </div>
      </div>
    </div>
  );
}
