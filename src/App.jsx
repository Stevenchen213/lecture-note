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
  const [questions, setQuestions] = useState(null);
  const [startError, setStartError] = useState(null);
  const [serverError, setServerError] = useState(null);

  // ref 同步最新值，避免在 setState 函数式更新器里做副作用（saveSession）
  const subtitlesRef = useRef(subtitles);
  const outlineRef = useRef(outline);
  const questionsRef = useRef(questions);
  subtitlesRef.current = subtitles;
  outlineRef.current = outline;
  questionsRef.current = questions;

  // recordingPhase: 'idle' (进入页面但未开始) | 'active' | 'paused'
  const [recordingPhase, setRecordingPhase] = useState('idle');
  const [wakingUp, setWakingUp] = useState(false);
  const [pptContext, setPptContext] = useState('');

  const { error: micError, start: startMic, stop: stopMic } = useAudioRecorder();
  const { error: wsError, connect: wsConnect, disconnect: wsDisconnect, send, sendAudio, on } = useWebSocket();

  useEffect(() => {
    fetch(`${HTTP_URL}/health`).catch(() => {});
  }, []);

  // 从首页进入课堂——仅连接WS，不开始录音
  const handleEnterRoom = useCallback(async (pptText) => {
    try {
      setStartError(null);
      setWakingUp(true);
      setPptContext(pptText);
      setQuestions(null);
      setSubtitles([]);
      setOutline(null);

      let retries = 0;
      const maxRetries = 12;
      while (retries < maxRetries) {
        try {
          await wsConnect();
          break;
        } catch {
          retries++;
          if (retries >= maxRetries) throw new Error('服务器唤醒超时，请刷新页面重试');
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      setWakingUp(false);
      setRecordingPhase('idle');
      setScreen('recording');
    } catch (err) {
      setWakingUp(false);
      console.error('进入课堂失败:', err.message);
      setStartError(err.message);
    }
  }, [wsConnect]);

  // 开始录音
  const handleStartRecording = useCallback(async () => {
    try {
      setServerError(null);
      send({ type: 'start_session', pptContext: pptContext || '' });
      await startMic((pcmBuffer) => {
        sendAudio(pcmBuffer);
      });
      setRecordingPhase('active');
    } catch (err) {
      console.error('启动录音失败:', err.message);
      setServerError(err.message);
    }
  }, [send, startMic, sendAudio, pptContext]);

  // 暂停
  const handlePause = useCallback(() => {
    setRecordingPhase('paused');
    send({ type: 'pause' });
  }, [send]);

  // 继续
  const handleResume = useCallback(() => {
    setRecordingPhase('active');
    send({ type: 'resume' });
  }, [send]);

  const stopTimeoutRef = useRef(null);
  const isStoppingRef = useRef(false);

  // 结束——等服务端完成收尾（大纲+练习题）后再断开
  const handleStop = useCallback(() => {
    if (isStoppingRef.current) return;  // 防止重复点击/重复调用
    if (recordingPhase !== 'idle') {
      isStoppingRef.current = true;
      stopMic();
      send({ type: 'stop_session' });

      // fallback：如果 15 秒内没收到 session_stopped，强制断开
      stopTimeoutRef.current = setTimeout(() => {
        console.warn('未收到 session_stopped，强制断开');
        const s = subtitlesRef.current;
        const o = outlineRef.current;
        const q = questionsRef.current;
        if (s.length > 0) {
          saveSession({ subtitles: s, outline: o, questions: q });
        }
        wsDisconnect();
        setScreen('home');
      }, 15000);
    } else {
      // 空闲态直接返回首页（没有 stop_session 可发）
      wsDisconnect();
      setScreen('home');
    }
  }, [recordingPhase, stopMic, send, wsDisconnect]);

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
        // 保留上一次的翻译结果，不要每次清空
        const prevPartial = prev.find((s) => s.id === '__partial__');
        return [...filtered, { id: '__partial__', original: msg.text, translated: prevPartial?.translated || '', isNew: true, isPartial: true }];
      });
    });

    on('final_transcript', (msg) => {
      setSubtitles((prev) => {
        const filtered = prev.filter((s) => s.id !== '__partial__');
        // 保留 partial 阶段的翻译结果，避免空白闪烁
        const prevPartial = prev.find((s) => s.id === '__partial__');
        const newSub = {
          id: ++subtitleId,
          original: msg.text,
          translated: prevPartial?.translated || '...',
          isNew: true,
          isPartial: false,
        };
        return [...filtered.map((s) => ({ ...s, isNew: false })), newSub];
      });
    });

    on('translation', (msg) => {
      setSubtitles((prev) => {
        // 部分翻译：更新 __partial__ 条目，原文在不断增长但翻译始终在同一行
        if (!msg.isFinal) {
          return prev.map((s) =>
            s.id === '__partial__' ? { ...s, translated: msg.text } : s
          );
        }
        // 最终翻译：按原文精确匹配
        return prev.map((s) =>
          s.original === msg.original ? { ...s, translated: msg.text } : s
        );
      });
    });

    on('translation_error', (msg) => {
      // 翻译失败时标红显示，不回退到 "..." 状态
      setSubtitles((prev) =>
        prev.map((s) => (s.original === msg.original ? { ...s, translated: '⚠️ 翻译失败' } : s))
      );
    });

    on('outline_update', (msg) => {
      setOutline((prev) => {
        const merged = mergeOutline(prev, msg.outline);
        outlineRef.current = merged;  // 同步 ref
        return merged;
      });
    });

    on('practice_questions', (msg) => {
      console.log('[前端] 收到练习题:', msg.questions?.length || 0, '道, 原始消息keys:', Object.keys(msg));
      if (msg.questions && msg.questions.length > 0) {
        questionsRef.current = msg.questions;  // 先同步 ref，不等 React 渲染
        setQuestions(msg.questions);
        console.log('[前端] 练习题已设置到 state 和 ref');
      } else {
        console.warn('[前端] 练习题为空，未设置');
      }
    });

    on('session_stopped', () => {
      // 清除 fallback 超时
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      // 用 ref 直接读取最新值保存，避免在 setState 更新器里做副作用
      const s = subtitlesRef.current;
      const o = outlineRef.current;
      const q = questionsRef.current;
      console.log('[前端] session_stopped 保存: 字幕', s.length, '条, 大纲', !!o, ', 练习题', q?.length || 0, '道');

      if (s.length > 0) {
        saveSession({ subtitles: s, outline: o, questions: q });
      }

      wsDisconnect();
      setScreen('home');
    });

    on('error', (msg) => {
      console.error('服务器错误:', msg.message);
      setServerError(msg.message);
    });

    on('paused', () => setRecordingPhase('paused'));
    on('resumed', () => setRecordingPhase('active'));
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
        onStart={handleEnterRoom}
        onViewHistory={handleViewHistory}
        error={displayError}
        wakingUp={wakingUp}
      />
    );
  }

  // screen === 'recording'
  const isActive = recordingPhase === 'active';
  const isPaused = recordingPhase === 'paused';
  const isIdle = recordingPhase === 'idle';

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
          <span className={`flex items-center gap-1.5 ${isPaused ? 'text-amber-500' : isActive ? 'text-emerald-500' : 'text-slate-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            {isPaused ? '已暂停' : isActive ? '录制中' : '待开始'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-md:flex-col">
        <div className="w-2/5 max-md:w-full max-md:h-[45vh] border-r border-slate-100 max-md:border-r-0 max-md:border-b overflow-hidden">
          <SubtitlePanel
            subtitles={subtitles}
            recordingPhase={recordingPhase}
            onStart={handleStartRecording}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            serverError={serverError}
          />
        </div>
        <div className="w-3/5 max-md:w-full max-md:h-[55vh] overflow-hidden">
          <OutlinePanel
            outline={outline}
            setOutline={setOutline}
            subtitles={subtitles}
            isStopped={false}
            questions={questions}
          />
        </div>
      </div>
    </div>
  );
}
