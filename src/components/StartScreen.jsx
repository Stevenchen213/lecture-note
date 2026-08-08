export default function StartScreen({ onStart, error }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="text-center px-6">
        <div className="text-6xl mb-6">🎓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">LectureNote</h1>
        <p className="text-gray-500 mb-2">课堂实时同传 · 双语笔记助手</p>
        <p className="text-sm text-gray-400 mb-8">支持印度英语 · 实时生成结构化大纲</p>
        <button
          onClick={onStart}
          className="px-8 py-4 bg-indigo-600 text-white text-lg font-medium rounded-2xl
                     hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
        >
          🎙️ 开始听课
        </button>
        {error && (
          <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">需要麦克风权限</p>
      </div>
    </div>
  );
}
