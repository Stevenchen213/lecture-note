import { useCallback } from 'react';
import RichTextEditor from './RichTextEditor';

function SourceTag({ source }) {
  if (source === 'user') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium ml-1.5 align-middle border border-amber-200/50" title="手动添加">
        👤
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-full font-medium ml-1.5 align-middle border border-indigo-200/50" title="AI 生成">
      AI
    </span>
  );
}

export default function OutlinePanel({ outline, setOutline, subtitles = [], questions = null }) {
  const hasContent = outline && (outline.title || (outline.sections && outline.sections.length > 0));

  const updateTitle = useCallback(
    (html) => setOutline((prev) => ({ ...prev, title: html, source: 'user' })),
    [setOutline]
  );

  const updateHeading = useCallback(
    (secId, html) =>
      setOutline((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === secId ? { ...s, heading: html, source: 'user' } : s
        ),
      })),
    [setOutline]
  );

  const updateItemText = useCallback(
    (secId, itemId, html) =>
      setOutline((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === secId
            ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, text: html, source: 'user' } : it)) }
            : s
        ),
      })),
    [setOutline]
  );

  const deleteSection = useCallback(
    (secId) => setOutline((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== secId) })),
    [setOutline]
  );

  const deleteItem = useCallback(
    (secId, itemId) =>
      setOutline((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === secId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
        ),
      })),
    [setOutline]
  );

  const addSection = useCallback(
    () =>
      setOutline((prev) => ({
        ...prev,
        sections: [...prev.sections, { id: `u${Date.now()}`, heading: '', headingEn: '', source: 'user', items: [] }],
      })),
    [setOutline]
  );

  const addItem = useCallback(
    (secId) =>
      setOutline((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === secId
            ? { ...s, items: [...s.items, { id: `u${Date.now()}`, text: '', textEn: '', source: 'user' }] }
            : s
        ),
      })),
    [setOutline]
  );

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-slate-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <span className="text-sm">📝</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">课程大纲</h2>
            <p className="text-[11px] text-slate-400">AI 自动生成 · 可手动编辑</p>
          </div>
        </div>
        <span className="text-[11px] text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
          选中文字弹出工具栏
        </span>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!hasContent && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <p className="text-sm font-medium text-slate-400">大纲生成中…</p>
              <p className="text-xs text-slate-300 mt-1">开始讲话后约 30 秒自动出现</p>

              {/* 骨架屏 */}
              <div className="mt-5 space-y-3 w-64 mx-auto">
                <div className="h-4 rounded-lg animate-shimmer w-3/4 mx-auto" />
                <div className="h-3 rounded-lg animate-shimmer w-full" />
                <div className="h-3 rounded-lg animate-shimmer w-5/6" />
                <div className="h-3 rounded-lg animate-shimmer w-2/3" />
              </div>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="space-y-5 pb-8">
            {/* 课程标题 */}
            <div className="flex items-center gap-1.5 pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800 leading-snug flex-1">
                <RichTextEditor
                  value={outline.title}
                  onChange={updateTitle}
                  placeholder="课程名称"
                  className="font-bold text-slate-800"
                />
              </h2>
              <SourceTag source={outline.source} />
            </div>

            {/* 章节 */}
            {outline.sections.map((sec, idx) => (
              <div key={sec.id} className="animate-fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                {/* Section 标题 */}
                <div className="flex items-center gap-1.5 mb-2 group">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <h3 className="font-semibold text-slate-700 flex-1">
                    <RichTextEditor
                      value={sec.heading}
                      onChange={(h) => updateHeading(sec.id, h)}
                      placeholder="新章节"
                      className="font-semibold text-slate-700"
                    />
                  </h3>
                  <SourceTag source={sec.source} />
                  <button
                    onClick={() => deleteSection(sec.id)}
                    className="text-slate-300 hover:text-rose-500 text-xs opacity-0 group-hover:opacity-100 transition-all ml-1 p-1 hover:bg-rose-50 rounded"
                    title="删除章节"
                  >
                    ✕
                  </button>
                </div>

                {/* 知识点 */}
                <ul className="space-y-1.5 ml-5">
                  {sec.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-1.5 group text-sm animate-fade-in">
                      <span className="text-indigo-300 mt-[5px] text-[10px] flex-shrink-0">●</span>
                      <span className="flex-1 text-slate-600 leading-relaxed">
                        <RichTextEditor
                          value={item.text}
                          onChange={(h) => updateItemText(sec.id, item.id, h)}
                          placeholder="知识点"
                          className="text-slate-600"
                        />
                      </span>
                      <SourceTag source={item.source} />
                      <button
                        onClick={() => deleteItem(sec.id, item.id)}
                        className="text-slate-300 hover:text-rose-500 text-xs opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-rose-50 rounded flex-shrink-0"
                        title="删除"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                {/* 新增按钮 */}
                <button
                  onClick={() => addItem(sec.id)}
                  className="ml-5 mt-1.5 text-xs text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1 font-medium"
                >
                  <span>+</span> 添加知识点
                </button>
              </div>
            ))}

            {/* 新增章节 */}
            <button
              onClick={addSection}
              className="w-full py-2.5 text-sm text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-all duration-200 font-medium"
            >
              + 添加新章节
            </button>
          </div>
        )}

        {/* 练习题 */}
        {questions && questions.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 animate-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
                <span className="text-sm">✏️</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-700">课后练习题</h3>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">AI 生成</span>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="px-4 py-3 bg-amber-50/30 border border-amber-100/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded">
                      {q.type}
                    </span>
                    <span className="text-[10px] text-slate-400">第 {i + 1} 题</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">{q.question}</p>
                  {q.questionEn && (
                    <p className="text-xs text-slate-400 mb-2">{q.questionEn}</p>
                  )}
                  {q.options && q.options.length > 0 && (
                    <div className="space-y-0.5 mb-2 ml-1">
                      {q.options.map((opt, j) => (
                        <p key={j} className="text-sm text-slate-600">{opt}</p>
                      ))}
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-800 font-medium">查看答案</summary>
                    <p className="text-sm text-amber-900 mt-1.5 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                      {q.answer}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
