export default function OutlinePanel({ outline }) {
  const hasContent = outline && (outline.title || outline.heading || (outline.children && outline.children.length > 0));

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">📝 课程大纲</span>
        <span className="text-xs text-gray-400">自动生成中 · 可随时编辑</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasContent && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-sm">大纲生成中...</p>
              <p className="text-xs mt-1">开始讲话后约30秒出现</p>
            </div>
          </div>
        )}
        {hasContent && (
          <div className="text-sm text-gray-500">大纲数据已加载（编辑功能后续任务实现）</div>
        )}
      </div>
    </div>
  );
}
