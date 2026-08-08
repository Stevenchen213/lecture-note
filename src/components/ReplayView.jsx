import { useState, useEffect } from 'react';
import { getSession } from '../utils/sessionStore';
import { downloadWord, downloadPDF, copyOutlineText } from '../utils/export';

export default function ReplayView({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('outline'); // outline | subtitles

  useEffect(() => {
    setSession(getSession(sessionId));
  }, [sessionId]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">加载中…</p>
        </div>
      </div>
    );
  }

  const dateStr = new Date(session.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            title="返回"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-700 truncate">
              {session.title || '未命名课程'}
            </h1>
            <p className="text-[11px] text-slate-400">{dateStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => downloadWord(session.outline, session.subtitles)}
            className="px-3 py-1.5 text-[11px] font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors"
          >
            📄 Word
          </button>
          <button
            onClick={() => downloadPDF(session.outline, session.subtitles)}
            className="px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            🖨️ PDF
          </button>
        </div>
      </header>

      {/* 标签切换 */}
      <div className="flex border-b border-slate-100 bg-white px-5 flex-shrink-0">
        {[
          { key: 'outline', label: '📝 课程大纲' },
          { key: 'subtitles', label: '💬 双语字幕' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'outline' ? (
          <OutlineContent outline={session.outline} subtitles={session.subtitles} />
        ) : (
          <SubtitlesContent subtitles={session.subtitles} />
        )}
      </div>
    </div>
  );
}

function OutlineContent({ outline, subtitles }) {
  if (!outline || !outline.title) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center">
          <span className="text-3xl block mb-2">📝</span>
          <p className="text-sm">暂无大纲内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
      {/* 标题 */}
      <div className="pb-3 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">{outline.title}</h2>
        {outline.titleEn && outline.titleEn !== outline.title && (
          <p className="text-sm text-slate-400 mt-1">{outline.titleEn}</p>
        )}
      </div>

      {/* 章节 */}
      {outline.sections?.map((sec, i) => (
        <div key={sec.id || i} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
            <h3 className="font-semibold text-slate-700">{sec.heading}</h3>
            {sec.headingEn && sec.headingEn !== sec.heading && (
              <span className="text-xs text-slate-400 ml-1">{sec.headingEn}</span>
            )}
          </div>
          <ul className="space-y-1.5 ml-5">
            {sec.items?.map((item, j) => (
              <li key={item.id || j} className="flex items-start gap-1.5 text-sm text-slate-600">
                <span className="text-indigo-300 mt-[5px] text-[10px] flex-shrink-0">●</span>
                <span className="leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {(!outline.sections || outline.sections.length === 0) && (
        <p className="text-sm text-slate-400 text-center py-10">暂无章节内容</p>
      )}
    </div>
  );
}

function SubtitlesContent({ subtitles }) {
  if (!subtitles || subtitles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center">
          <span className="text-3xl block mb-2">💬</span>
          <p className="text-sm">暂无字幕内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
      {subtitles.map((sub, i) => (
        <div key={i} className="px-4 py-3 bg-white rounded-xl border border-slate-100 shadow-sm animate-fade-up" style={{ animationDelay: `${Math.min(i * 15, 500)}ms` }}>
          <p className="text-sm text-slate-500 leading-relaxed mb-1.5">{sub.original}</p>
          <p className="text-sm text-slate-800 leading-relaxed font-medium">
            {sub.translated || '（未翻译）'}
          </p>
        </div>
      ))}
    </div>
  );
}
