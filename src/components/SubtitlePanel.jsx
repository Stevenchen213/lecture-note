import { useEffect, useRef } from 'react';

export default function SubtitlePanel({ subtitles, isRecording, isPaused, onPause, onResume, onStop, serverError }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles]);

  const statusColor = isPaused ? 'bg-yellow-500' : isRecording ? 'bg-red-500' : 'bg-gray-300';
  const statusPing = isRecording && !isPaused ? 'bg-red-400' : isPaused ? 'bg-yellow-400' : '';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isRecording && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusPing} opacity-75`}></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColor}`}></span>
          </span>
          <span className="text-sm font-medium text-gray-700">
            {isPaused ? '⏸️ 已暂停' : '实时字幕'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 暂停 / 继续按钮 */}
          {isRecording && !isPaused && (
            <button
              onClick={onPause}
              className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-sm rounded-lg hover:bg-yellow-100 transition-colors"
            >
              暂停
            </button>
          )}
          {isPaused && (
            <button
              onClick={onResume}
              className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors"
            >
              继续
            </button>
          )}

          {/* 结束按钮 */}
          <button
            onClick={onStop}
            className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors"
          >
            结束
          </button>
        </div>
      </div>

      {/* 暂停提示 */}
      {isPaused && (
        <div className="mx-4 mt-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          ⏸️ 已暂停 — 点击「继续」接着听
        </div>
      )}

      {/* 服务器错误 */}
      {serverError && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          ⚠️ {serverError}
        </div>
      )}

      {/* 字幕列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {subtitles.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">{isPaused ? '⏸️' : '🎤'}</div>
              <p className="text-sm">{isPaused ? '已暂停' : '正在收听...'}</p>
            </div>
          </div>
        )}

        {subtitles.map((sub, i) => (
          <div key={i} className={`space-y-1 ${sub.isNew ? 'opacity-100' : 'opacity-60'}`}>
            <p className="text-sm text-gray-500 leading-relaxed">{sub.original}</p>
            <p className={`text-sm leading-relaxed ${sub.translated === '...' ? 'text-gray-300 italic text-xs' : 'text-gray-900'}`}>
              {sub.translated === '...' ? '⟳ 翻译中...' : sub.translated}
            </p>
          </div>
        ))}

        {isRecording && !isPaused && subtitles.length > 0 && (
          <div className="flex items-center gap-1 text-indigo-500 text-sm">
            <span className="animate-pulse">●</span>
            <span>识别中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
