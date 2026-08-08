import { useState, useRef, useCallback, useEffect } from 'react';

const HIGHLIGHTS = [
  { color: '#FEF08A', label: '重点' },
  { color: '#A7F3D0', label: '理解' },
  { color: '#FECACA', label: '考点' },
  { color: '#BFDBFE', label: '公式' },
];

const HEADINGS = [
  { level: 'h1', label: 'H1' },
  { level: 'h2', label: 'H2' },
  { level: 'h3', label: 'H3' },
];

/**
 * 浮动格式工具栏
 */
function FloatingToolbar({ x, y, visible, onHighlight, onBold, onItalic, onUnderline, onHeading }) {
  if (!visible) return null;

  return (
    <div
      style={{ position: 'fixed', left: x, top: y - 44, zIndex: 9999 }}
      className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-1.5 py-1"
    >
      {HEADINGS.map((h) => (
        <button
          key={h.level}
          onMouseDown={(e) => { e.preventDefault(); onHeading(h.level); }}
          className="px-1.5 py-1 text-xs font-mono text-gray-500 hover:bg-gray-100 rounded"
          title={h.label}
        >
          {h.label}
        </button>
      ))}

      <span className="w-px h-4 bg-gray-200 mx-0.5" />

      {HIGHLIGHTS.map((h) => (
        <button
          key={h.color}
          onMouseDown={(e) => { e.preventDefault(); onHighlight(h.color); }}
          className="w-5 h-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
          style={{ backgroundColor: h.color }}
          title={h.label}
        />
      ))}

      <span className="w-px h-4 bg-gray-200 mx-0.5" />

      <button onMouseDown={(e) => { e.preventDefault(); onBold(); }} className="px-1.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded" title="加粗">B</button>
      <button onMouseDown={(e) => { e.preventDefault(); onItalic(); }} className="px-1.5 py-1 text-xs italic text-gray-600 hover:bg-gray-100 rounded" title="斜体">I</button>
      <button onMouseDown={(e) => { e.preventDefault(); onUnderline(); }} className="px-1.5 py-1 text-xs underline text-gray-600 hover:bg-gray-100 rounded" title="下划线">U</button>
    </div>
  );
}

/**
 * 富文本编辑区 — contentEditable + 浮动工具栏
 */
export default function RichTextEditor({ value, onChange, placeholder, className = '' }) {
  const editorRef = useRef(null);
  const [toolbar, setToolbar] = useState({ visible: false, x: 0, y: 0 });

  // 初始化内容
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setToolbar((prev) => ({ ...prev, visible: false }));
        return;
      }
      if (!editorRef.current?.contains(sel.anchorNode)) {
        setToolbar((prev) => ({ ...prev, visible: false }));
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setToolbar({ visible: true, x: rect.left + rect.width / 2 - 150, y: rect.top + window.scrollY });
    }, 0);
  }, []);

  useEffect(() => {
    const hide = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setToolbar((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    }, 100);
  }, [onChange]);

  const exec = useCallback((cmd, val) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleHighlight = useCallback((color) => {
    editorRef.current?.focus();
    document.execCommand('backColor', false, color);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleHeading = useCallback((level) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, level);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onMouseUp={handleMouseUp}
        onBlur={handleBlur}
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        className={`outline-none focus:ring-1 focus:ring-indigo-300 focus:bg-white rounded px-1 -mx-1 min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 ${className}`}
        data-placeholder={placeholder || '输入...'}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      <FloatingToolbar
        x={toolbar.x}
        y={toolbar.y}
        visible={toolbar.visible}
        onHighlight={handleHighlight}
        onBold={() => exec('bold')}
        onItalic={() => exec('italic')}
        onUnderline={() => exec('underline')}
        onHeading={handleHeading}
      />
    </div>
  );
}
