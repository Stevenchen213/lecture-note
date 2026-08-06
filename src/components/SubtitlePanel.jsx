import { useEffect, useRef } from 'react';

export default function SubtitlePanel({ subtitles, isRecording, onStop }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isRecording && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecording ? 'bg-red-500' : 'bg-gray-300'}`}></span>
          </span>
          <span className="text-sm font-medium text-gray-700">实时字幕</span>
        </div>
        <button
          onClick={onStop}
          className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors"
        >
          结束
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {subtitles.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">🎤</div>
              <p className="text-sm">正在收听...</p>
            </div>
          </div>
        )}
        {subtitles.map((sub, i) => (
          <div key={i} className={`space-y-1 ${sub.isNew ? 'opacity-100' : 'opacity-60'}`}>
            <p className="text-sm text-gray-500 leading-relaxed">{sub.original}</p>
            <p className="text-sm text-gray-900 leading-relaxed">{sub.translated}</p>
          </div>
        ))}
        {isRecording && subtitles.length > 0 && (
          <div className="flex items-center gap-1 text-indigo-500 text-sm">
            <span className="animate-pulse">●</span>
            <span>识别中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
