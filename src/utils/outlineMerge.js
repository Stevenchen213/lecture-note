/**
 * 大纲合并逻辑
 * 核心原则：用户编辑过的节点不被 AI 覆盖，用户删除的节点不被 AI 复活
 */

let nodeId = 0;
function uid() {
  return `n${++nodeId}`;
}

/**
 * 给 AI 大纲加上 id 和 source 标记
 */
function stampOutline(outline) {
  return {
    id: uid(),
    title: outline.title || '课程笔记',
    titleEn: outline.titleEn || 'Lecture Notes',
    source: 'ai',
    sections: (outline.sections || []).map((sec) => ({
      id: uid(),
      heading: sec.heading || '',
      headingEn: sec.headingEn || '',
      source: 'ai',
      items: (sec.items || []).map((item) => ({
        id: uid(),
        text: item.text || '',
        textEn: item.textEn || '',
        source: 'ai',
      })),
    })),
  };
}

/**
 * 合并已有大纲（含用户编辑）和新的 AI 大纲
 * - 用户编辑过 / 新增的 section → 保留
 * - 用户编辑过 / 新增的 item → 保留
 * - AI 新增的 section/item → 添加
 * - 用户删除的 → 不复活
 */
export function mergeOutline(existing, newAi) {
  if (!existing) return stampOutline(newAi);

  const stamped = stampOutline(newAi);
  const userSections = existing.sections.filter((s) => s.source === 'user');

  // 遍历 AI sections，合并用户编辑
  const mergedSections = stamped.sections.map((aiSec) => {
    const match = existing.sections.find(
      (es) => es.headingEn === aiSec.headingEn && es.id !== 'deleted'
    );
    if (!match) return aiSec; // 新章节，直接用 AI 的

    // 用户编辑过 heading → 保留用户版本
    if (match.source === 'user') {
      return { ...match };
    }

    // 合并 items
    const userItems = (match.items || []).filter((i) => i.source === 'user');
    const mergedItems = aiSec.items.map((aiItem) => {
      const itemMatch = (match.items || []).find(
        (ei) => ei.textEn === aiItem.textEn
      );
      if (!itemMatch) return aiItem;
      // 用户编辑过 → 保留用户版本
      if (itemMatch.source === 'user') return { ...itemMatch };
      return aiItem;
    });

    // 追加用户自己新增的 items（不在 AI 结果里的）
    for (const ui of userItems) {
      const exists = mergedItems.find((mi) => mi.textEn === ui.textEn);
      if (!exists) mergedItems.push({ ...ui });
    }

    return { ...aiSec, items: mergedItems, source: match.source };
  });

  // 追加用户完全自己新增的 sections（不在 AI 结果里的）
  for (const us of userSections) {
    const exists = mergedSections.find((ms) => ms.headingEn === us.headingEn);
    if (!exists) mergedSections.push({ ...us });
  }

  return { ...stamped, sections: mergedSections, title: existing.source === 'user' ? existing.title : stamped.title };
}
