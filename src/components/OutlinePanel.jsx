import { useCallback } from 'react';
import RichTextEditor from './RichTextEditor';
import { downloadWord, downloadPDF, copyOutlineText } from '../utils/export';

function SourceTag({ source }) {
  if (source === 'user') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium ml-1.5 align-middle">
        👤
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full font-medium ml-1.5 align-middle">
      AI
    </span>
  );
}

/**
 * 大纲面板 — 渲染结构化大纲，支持富文本编辑、删除、新增
 */
export default function OutlinePanel({ outline, setOutline, subtitles = [], isStopped = false }) {
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">📝 课程大纲</span>
        <span className="text-xs text-gray-400">选中文字弹出工具栏 · 自动合并</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasContent && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-sm">大纲生成中...</p>
              <p className="text-xs mt-1">开始讲话后约 30 秒出现</p>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="space-y-4 pb-8">
            {/* 课程标题 */}
            <div className="flex items-center gap-1">
              <h2 className="text-lg font-bold text-gray-900">
                <RichTextEditor value={outline.title} onChange={updateTitle} placeholder="课程名称" className="font-bold text-gray-900" />
              </h2>
              <SourceTag source={outline.source} />
            </div>

            {/* 章节列表 */}
            {outline.sections.map((sec) => (
              <div key={sec.id} className="ml-2 border-l-2 border-gray-100 pl-3">
                {/* Section heading */}
                <div className="flex items-center gap-1 mb-1 group">
                  <h3 className="font-semibold text-gray-800">
                    <RichTextEditor value={sec.heading} onChange={(h) => updateHeading(sec.id, h)} placeholder="新章节" className="font-semibold text-gray-800" />
                  </h3>
                  <SourceTag source={sec.source} />
                  <button
                    onClick={() => deleteSection(sec.id)}
                    className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all ml-1"
                    title="删除章节"
                  >
                    ✕
                  </button>
                </div>

                {/* Items */}
                <ul className="space-y-1 ml-4">
                  {sec.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-1 group text-sm">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span className="flex-1 text-gray-700 leading-relaxed">
                        <RichTextEditor value={item.text} onChange={(h) => updateItemText(sec.id, item.id, h)} placeholder="知识点" className="text-gray-700" />
                      </span>
                      <SourceTag source={item.source} />
                      <button
                        onClick={() => deleteItem(sec.id, item.id)}
                        className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all"
                        title="删除"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                <button onClick={() => addItem(sec.id)} className="ml-4 mt-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                  + 添加知识点
                </button>
              </div>
            ))}

            <button onClick={addSection} className="ml-2 text-sm text-gray-400 hover:text-indigo-500 transition-colors">
              + 添加新章节
            </button>
          </div>
        )}

        {/* 导出栏——停课后显示 */}
        {isStopped && hasContent && (
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">📥 导出笔记</p>
            <div className="flex gap-2">
              <button
                onClick={() => downloadWord(outline, subtitles)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
              >
                📄 Word 文档 (.doc)
              </button>
              <button
                onClick={() => downloadPDF(outline, subtitles)}
                className="flex-1 px-4 py-2 bg-white text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                🖨️ PDF 打印
              </button>
              <button
                onClick={async () => {
                  await copyOutlineText(outline);
                  alert('大纲已复制到剪贴板');
                }}
                className="px-4 py-2 bg-white text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                title="复制纯文本大纲"
              >
                📋
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
