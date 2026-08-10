import { useState, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const HTTP_URL = WS_URL.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

export default function StartScreen({ onStart, onViewHistory, error, wakingUp }) {
  const [pptText, setPptText] = useState('');
  const [pptName, setPptName] = useState('');
  const [pptUploading, setPptUploading] = useState(false);
  const [pptError, setPptError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef(null);

  const handlePptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setPptError('只支持 .pptx 格式');
      return;
    }

    setPptError('');
    setPptUploading(true);
    setPptName(file.name);

    try {
      const formData = new FormData();
      formData.append('ppt', file);

      const res = await fetch(`${HTTP_URL}/upload-ppt`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');

      setPptText(data.text);
    } catch (err) {
      setPptError(err.message);
      setPptName('');
    } finally {
      setPptUploading(false);
    }
  };

  const handleRemovePpt = () => {
    setPptText('');
    setPptName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-lg w-full">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-8 animate-fade-up">
          <span className="text-4xl">🎓</span>
        </div>

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight animate-fade-up">
          Lecture<span className="text-indigo-400">Note</span>
        </h1>
        <p className="text-lg text-indigo-200/80 mb-1 font-medium animate-fade-up">
          课堂实时同传 · 双语笔记助手
        </p>
        <p className="text-sm text-slate-300 mb-6 animate-fade-up">
          支持印度英语 · AI 实时翻译 · 自动生成结构化大纲
        </p>

        {/* PPT 上传 */}
        <div className="mb-6 animate-fade-up">
          {!pptText ? (
            <label className={`flex items-center justify-center gap-2 px-4 py-3 border border-white/10 rounded-xl cursor-pointer transition-all duration-200 bg-white/5 ${pptUploading ? 'opacity-60 pointer-events-none' : 'hover:bg-white/10 hover:border-white/20'}`}>
              {pptUploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-300">正在解析 PPT…</span>
                </>
              ) : (
                <>
                  <span className="text-lg">📎</span>
                  <span className="text-sm text-slate-300">上传 PPT 辅助生成大纲（可选）</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx"
                onChange={handlePptUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl animate-fade-in">
              <div className="flex items-center gap-2 text-left min-w-0">
                <span className="text-lg flex-shrink-0">📄</span>
                <div className="min-w-0">
                  <p className="text-sm text-emerald-300 font-medium truncate">{pptName}</p>
                  <p className="text-[11px] text-emerald-400/70">已提取 {pptText.length} 字符</p>
                </div>
              </div>
              <button
                onClick={handleRemovePpt}
                className="text-slate-400 hover:text-rose-400 text-sm p-1 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {pptError && (
            <p className="text-xs text-red-400 mt-1.5">{pptError}</p>
          )}
        </div>

        {/* 特性卡片 */}
        <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
          {[
            { icon: '🎙️', label: '实时识别', desc: '印度英语优化', color: 'indigo' },
            { icon: '🌐', label: '同传翻译', desc: '英→中即时', color: 'violet' },
            { icon: '📝', label: '智能大纲', desc: '结构化笔记', color: 'emerald' },
          ].map((f) => (
            <div
              key={f.label}
              className="group relative rounded-2xl p-4 text-center
                         bg-white/[0.06] border border-white/[0.08]
                         hover:bg-white/[0.10] hover:border-white/[0.14]
                         hover:-translate-y-0.5
                         transition-all duration-300"
            >
              {/* 图标 */}
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2.5
                              ${f.color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400' : ''}
                              ${f.color === 'violet' ? 'bg-violet-500/20 text-violet-400' : ''}
                              ${f.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : ''}
                              ring-1 ring-inset
                              ${f.color === 'indigo' ? 'ring-indigo-500/20' : ''}
                              ${f.color === 'violet' ? 'ring-violet-500/20' : ''}
                              ${f.color === 'emerald' ? 'ring-emerald-500/20' : ''}
                              group-hover:scale-110 transition-transform duration-300`}>
                <span className="text-lg">{f.icon}</span>
              </div>
              <div className="text-[13px] font-semibold text-white/95 mb-1">{f.label}</div>
              <div className={`text-[11px] font-medium
                              ${f.color === 'indigo' ? 'text-indigo-300/70' : ''}
                              ${f.color === 'violet' ? 'text-violet-300/70' : ''}
                              ${f.color === 'emerald' ? 'text-emerald-300/70' : ''}`}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* 唤醒提示 */}
        {wakingUp && (
          <div className="mb-4 px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm rounded-xl animate-fade-in flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            服务器休眠中，正在唤醒… 约需 30 秒
          </div>
        )}

        {/* 开始按钮 */}
        <button
          onClick={() => onStart(pptText)}
          disabled={wakingUp}
          className="group relative px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-lg font-semibold rounded-2xl
                     hover:from-indigo-400 hover:to-purple-500 active:scale-[0.97] transition-all duration-200
                     shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 animate-fade-up w-full
                     disabled:opacity-60 disabled:cursor-wait"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {wakingUp ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                正在唤醒服务器…
              </>
            ) : (
              <>
                <span className="group-hover:animate-bounce">🎙️</span>
                开始听课
              </>
            )}
          </span>
        </button>

        {/* 历史记录 */}
        <button
          onClick={onViewHistory}
          className="mt-4 px-8 py-3 rounded-xl text-sm font-medium
                     bg-white/5 border border-white/10 text-slate-300
                     hover:text-white hover:bg-white/10 hover:border-white/20
                     transition-all duration-200 animate-fade-up"
        >
          📚 历史课程
        </button>

        {error && (
          <div className="mt-6 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl backdrop-blur-sm animate-fade-in">
            ⚠️ {error}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-6">需要麦克风权限 · 数据安全加密</p>
      </div>
    </div>
  );
}
