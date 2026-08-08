const STORAGE_KEY = 'lecturenote_sessions';

/**
 * 保存一场听课记录到 localStorage
 */
export function saveSession({ subtitles, outline }) {
  const sessions = loadSessions();

  const session = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    title: outline?.title || '未命名课程',
    titleEn: outline?.titleEn || 'Untitled Lecture',
    subtitles: subtitles
      .filter((s) => !s.isPartial && s.id !== '__partial__')
      .map((s) => ({ original: s.original, translated: s.translated || '' })),
    outline: outline ? JSON.parse(JSON.stringify(outline)) : null,
  };

  sessions.unshift(session);

  // 最多保存 20 条
  if (sessions.length > 20) {
    sessions.length = 20;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('保存失败（可能是存储空间不足）:', e.message);
  }

  return session;
}

/**
 * 加载所有历史记录
 */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 按 ID 获取单条记录
 */
export function getSession(id) {
  return loadSessions().find((s) => s.id === id) || null;
}

/**
 * 删除一条记录
 */
export function deleteSession(id) {
  const sessions = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
