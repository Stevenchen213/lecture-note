export default function StartScreen({ onStart, error }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* 主内容 */}
      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-8 animate-fade-up">
          <span className="text-4xl">🎓</span>
        </div>

        {/* 标题 */}
        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight animate-fade-up">
          Lecture<span className="text-indigo-400">Note</span>
        </h1>

        <p className="text-lg text-indigo-200/80 mb-1 font-medium animate-fade-up">
          课堂实时同传 · 双语笔记助手
        </p>
        <p className="text-sm text-slate-400 mb-10 animate-fade-up">
          支持印度英语 · AI 实时翻译 · 自动生成结构化大纲
        </p>

        {/* 特性卡片 */}
        <div className="grid grid-cols-3 gap-3 mb-10 animate-fade-up">
          {[
            { icon: '🎙️', label: '实时识别', desc: '印度英语优化' },
            { icon: '🌐', label: '同传翻译', desc: '英→中即时' },
            { icon: '📝', label: '智能大纲', desc: '结构化笔记' },
          ].map((f) => (
            <div
              key={f.label}
              className="glass-dark rounded-xl px-3 py-4 text-center backdrop-blur-sm"
            >
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-xs font-semibold text-white/90 mb-0.5">{f.label}</div>
              <div className="text-[10px] text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* 开始按钮 */}
        <button
          onClick={onStart}
          className="group relative px-10 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-lg font-semibold rounded-2xl
                     hover:from-indigo-400 hover:to-purple-500 active:scale-[0.97] transition-all duration-200
                     shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 animate-fade-up"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span className="group-hover:animate-bounce">🎙️</span>
            开始听课
          </span>
        </button>

        {/* 错误提示 */}
        {error && (
          <div className="mt-6 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl backdrop-blur-sm animate-fade-in">
            ⚠️ {error}
          </div>
        )}

        <p className="text-xs text-slate-600 mt-6">需要麦克风权限 · 数据安全加密</p>
      </div>
    </div>
  );
}
