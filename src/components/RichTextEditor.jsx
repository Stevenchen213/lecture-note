import { useState, useRef, useCallback, useEffect } from 'react';

const HIGHLIGHTS = [
  { color: '#FEF08A', label: '重点', ring: 'ring-yellow-300' },
  { color: '#A7F3D0', label: '理解', ring: 'ring-emerald-300' },
  { color: '#FECACA', label: '考点', ring: 'ring-red-300' },
  { color: '#BFDBFE', label: '公式', ring: 'ring-blue-300' },
];

const HEADINGS = [
  { level: 'h1', label: 'H1', desc: '大标题' },
  { level: 'h2', label: 'H2', desc: '中标题' },
  { level: 'h3', label: 'H3', desc: '小标题' },
];

function FloatingToolbar({ x, y, visible, onHighlight, onBold, onItalic, onUnderline, onHeading }) {
  if (!visible) return null;

  return (
    <div
      style={{ position: 'fixed', left: x, top: y - 50, zIndex: 9999 }}
      className="flex items-center gap-1 glass rounded-xl shadow-xl px-2 py-1.5 border-gray-200/60 animate-fade-in"
    >
      {/* 标题 */}
      {HEADINGS.map((h) => (
        <button
          key={h.level}
          onMouseDown={(e) => { e.preventDefault(); onHeading(h.level); }}
          className="px-2 py-1.5 text-[11px] font-mono text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
          title={h.desc}
        >
          {h.label}
        </button>
      ))}

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 高亮色 */}
      {HIGHLIGHTS.map((h) => (
        <button
          key={h.color}
          onMouseDown={(e) => { e.preventDefault(); onHighlight(h.color); }}
          className={`w-5 h-5 rounded-full border-2 border-white hover:scale-110 hover:ring-2 ${h.ring} transition-all duration-150 shadow-sm`}
          style={{ backgroundColor: h.color }}
          title={h.label}
        />
      ))}

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* 格式按钮 */}
      <button
        onMouseDown={(e) => { e.preventDefault(); onBold(); }}
        className="w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
        title="加粗"
      >
        <strong>B</strong>
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onItalic(); }}
        className="w-7 h-7 flex items-center justify-center text-sm italic text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
        title="斜体"
      >
        <em>I</em>
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onUnderline(); }}
        className="w-7 h-7 flex items-center justify-center text-sm underline text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
        title="下划线"
      >
        <span className="underline">U</span>
      </button>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, className = '' }) {
  const editorRef = useRef(null);
  const [toolbar, setToolbar] = useState({ visible: false, x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      if (!editorRef.current?.contains(sel.anchorNode)) {
        setToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setToolbar({ visible: true, x: rect.left + rect.width / 2 - 160, y: rect.top + window.scrollY });
    }, 0);
  }, []);

  useEffect(() => {
    const hide = (e) => {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setTimeout(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    }, 100);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

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
        onFocus={handleFocus}
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        className={`outline-none rounded-md px-1.5 py-0.5 -mx-1.5 min-h-[1.6em] transition-all duration-150
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300
          ${isFocused ? 'ring-2 ring-indigo-200 bg-indigo-50/30' : 'hover:bg-slate-50'}
          ${className}`}
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
