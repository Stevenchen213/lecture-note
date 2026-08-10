import { useEffect, useRef } from 'react';

export default function SubtitlePanel({ subtitles, recordingPhase, onStart, onPause, onResume, onStop, serverError }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles]);

  const isIdle = recordingPhase === 'idle';
  const isActive = recordingPhase === 'active';
  const isPaused = recordingPhase === 'paused';

  const statusColor = isIdle ? 'bg-slate-300' : isPaused ? 'bg-amber-400' : 'bg-emerald-400';
  const statusBg = isIdle
    ? 'bg-slate-50 border-slate-200'
    : isPaused
    ? 'bg-amber-50 border-amber-200'
    : 'bg-emerald-50 border-emerald-200';

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl ${statusBg} border flex items-center justify-center`}>
              <span className={`w-2.5 h-2.5 rounded-full ${statusColor} ${isActive ? 'animate-pulse-ring' : isPaused ? 'animate-pulse-ring-yellow' : ''}`} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {isIdle ? '准备就绪' : isPaused ? '⏸️ 已暂停' : '实时字幕'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {isIdle ? '点击开始启动识别' : isPaused ? '点击继续恢复识别' : 'AI 同传翻译中'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 空闲态：返回 + 开始按钮 */}
          {isIdle && (
            <>
              <button
                onClick={onStop}
                className="px-3 py-2 text-slate-400 text-sm rounded-xl hover:bg-slate-100 transition-all duration-200"
                aria-label="返回首页"
              >
                ← 返回
              </button>
              <button
                onClick={onStart}
                className="px-5 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl
                           hover:bg-emerald-100 border border-emerald-200/50 transition-all duration-200
                           shadow-sm shadow-emerald-100"
                aria-label="开始录音"
              >
                ▶️ 开始
              </button>
            </>
          )}

          {/* 活跃态：暂停按钮 */}
          {isActive && (
            <button
              onClick={onPause}
              aria-label="暂停录音"
              className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl
                         hover:bg-amber-100 border border-amber-200/50 transition-all duration-200"
            >
              ⏸️ 暂停
            </button>
          )}

          {/* 暂停态：继续按钮 */}
          {isPaused && (
            <button
              onClick={onResume}
              aria-label="继续录音"
              className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl
                         hover:bg-emerald-100 border border-emerald-200/50 transition-all duration-200"
            >
              ▶️ 继续
            </button>
          )}

          {/* 结束按钮（任何非空闲态都显示） */}
          {!isIdle && (
            <button
              onClick={onStop}
              aria-label="结束课程"
              className="px-4 py-2 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl
                         hover:bg-rose-100 border border-rose-200/50 transition-all duration-200"
            >
              结束
            </button>
          )}
        </div>
      </div>

      {/* 暂停横幅 */}
      {isPaused && (
        <div className="mx-4 mt-3 px-4 py-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-700 text-sm flex items-center gap-2 animate-fade-in backdrop-blur-sm">
          <span className="text-base">⏸️</span>
          <span>录音已暂停 — 点击「继续」恢复识别</span>
        </div>
      )}

      {/* 错误横幅 */}
      {serverError && (
        <div className="mx-4 mt-3 px-4 py-3 bg-rose-50/80 border border-rose-200/80 rounded-xl text-rose-600 text-sm flex items-center gap-2 animate-fade-in backdrop-blur-sm">
          <span className="text-base">⚠️</span>
          <span>{serverError}</span>
        </div>
      )}

      {/* 字幕区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {subtitles.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                <span className="text-3xl">{isIdle ? '🎤' : isPaused ? '⏸️' : '🎤'}</span>
              </div>
              <p className="text-sm font-medium text-slate-400">
                {isIdle ? '点击「开始」启动识别' : isPaused ? '录音已暂停' : '正在收听中...'}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                {isIdle ? '' : isPaused ? '' : '开始讲话即可看到实时字幕'}
              </p>
            </div>
          </div>
        )}

        {subtitles.map((sub, i) => (
          <div
            key={i}
            className={`group px-4 py-3 rounded-xl transition-all duration-300 border ${
              sub.isNew
                ? 'bg-white border-slate-200/80 shadow-sm animate-fade-up'
                : 'bg-transparent border-transparent opacity-50 hover:opacity-70'
            }`}
          >
            <p className="text-sm text-slate-500 leading-relaxed mb-1.5">
              {sub.original}
            </p>
            <p
              className={`text-sm leading-relaxed ${
                sub.translated === '...'
                  ? 'text-slate-300 italic text-xs'
                  : 'text-slate-800 font-medium'
              }`}
            >
              {sub.translated === '...' ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-400 rounded-full animate-spin" />
                  翻译中…
                </span>
              ) : (
                sub.translated
              )}
            </p>
          </div>
        ))}

        {/* 录制中指示 */}
        {isActive && subtitles.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span className="text-xs text-indigo-400 font-medium">识别中…</span>
          </div>
        )}
      </div>
    </div>
  );
}
