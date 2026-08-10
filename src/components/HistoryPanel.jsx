import { useState, useEffect } from 'react';
import { loadSessions, deleteSession } from '../utils/sessionStore';

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return d.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(subtitles) {
  if (!subtitles || subtitles.length === 0) return '无内容';
  const count = subtitles.length;
  if (count < 5) return `${count} 句字幕`;
  if (count < 20) return `${count} 句字幕`;
  return `${count} 句字幕`;
}

export default function HistoryPanel({ onViewSession, onBack }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (!confirm('确定要删除这条记录吗？')) return;
    deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">📚 历史课程</h1>
            <p className="text-sm text-slate-400">已保存的听课记录</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white text-sm font-medium rounded-xl hover:bg-white/10 hover:border-white/20 transition-all"
          >
            ← 返回首页
          </button>
        </div>

        {/* 列表 */}
        {sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <span className="text-3xl">📭</span>
            </div>
            <p className="text-slate-400 font-medium">暂无历史记录</p>
            <p className="text-sm text-slate-500 mt-1">结束听课后会自动保存</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewSession(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewSession(s.id); } }}
                className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-200 group animate-fade-up focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg truncate mb-1">
                      {s.title || '未命名课程'}
                    </h3>
                    {s.titleEn && s.titleEn !== s.title && (
                      <p className="text-slate-400 text-sm truncate mb-2">{s.titleEn}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">🕐 {formatDate(s.date)}</span>
                      <span className="flex items-center gap-1">💬 {formatDuration(s.subtitles)}</span>
                      {s.outline?.sections && (
                        <span className="flex items-center gap-1">📝 {s.outline.sections.length} 章节</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => handleDelete(s.id, e)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="删除"
                    >
                      🗑️
                    </button>
                    <span className="text-slate-400 text-lg">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
