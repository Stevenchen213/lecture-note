/**
 * 导出工具：Word 文档 + PDF 打印
 * 将大纲（含富文本 HTML）+ 双语字幕生成格式文档
 */

/**
 * 将富文本 HTML 转为 Word 兼容的 HTML
 * 保留高亮（backColor）、加粗、斜体、下划线、标题层级
 */
function wrapHtml({ outline, subtitles }) {
  const now = new Date().toLocaleString('zh-CN');

  // 构建字幕部分
  const subtitleRows = subtitles
    .map(
      (s) =>
        `<tr><td style="color:#64748b;padding:4px 8px;border-bottom:1px solid #f1f5f9">${s.original}</td><td style="color:#1e293b;padding:4px 8px;border-bottom:1px solid #f1f5f9">${s.translated || ''}</td></tr>`
    )
    .join('');

  const sectionsHtml = (outline?.sections || [])
    .map(
      (sec) => `
      <div style="margin-left:12px;margin-bottom:12px;border-left:2px solid #e2e8f0;padding-left:12px;">
        <h3 style="margin:8px 0 4px;color:#334155;font-size:16px;">${sec.heading || ''}</h3>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 8px;">${sec.headingEn || ''}</p>
        <ul style="margin:0;padding-left:18px;">
          ${(sec.items || []).map((it) => `<li style="margin-bottom:4px;font-size:14px;line-height:1.8;color:#334155;">${it.text || it.textEn || ''}</li>`).join('')}
        </ul>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${outline?.title || '课程笔记'}</title>
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .meta { text-align: center; color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
  @media print {
    body { margin: 0; padding: 20px; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${outline?.title || '课程笔记'}</h1>
  <p class="meta">${outline?.titleEn || ''} · 导出时间：${now}</p>

  <h2>📝 课程大纲</h2>
  ${sectionsHtml || '<p style="color:#94a3b8;">（无大纲数据）</p>'}

  <h2>🎙️ 课堂字幕记录</h2>
  ${subtitleRows
    ? `<table>${subtitleRows}</table>`
    : '<p style="color:#94a3b8;">（无字幕记录）</p>'}

  <p style="text-align:center;color:#cbd5e1;font-size:12px;margin-top:40px;">由 LectureNote Agent 自动生成</p>
</body>
</html>`;
}

/**
 * 导出 Word 文档（.doc）
 * Word 可以直接打开 HTML 文件并保留所有格式
 */
export function downloadWord(outline, subtitles) {
  const html = wrapHtml({ outline, subtitles });
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${outline?.title || '课程笔记'}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出 PDF（通过浏览器打印）
 */
export function downloadPDF(outline, subtitles) {
  const html = wrapHtml({ outline, subtitles });
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) {
    alert('弹窗被拦截，请允许本站弹窗后重试');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    w.print();
  };
  // 兜底：如果 onload 不触发，延迟打印
  setTimeout(() => w.print(), 500);
}

/**
 * 复制大纲纯文本到剪贴板
 */
export async function copyOutlineText(outline) {
  const stripHtml = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  let text = `${outline?.title || '课程笔记'}\n${outline?.titleEn || ''}\n\n`;
  for (const sec of outline?.sections || []) {
    text += `## ${stripHtml(sec.heading)}\n`;
    if (sec.headingEn) text += `   ${sec.headingEn}\n`;
    for (const item of sec.items || []) {
      text += `  • ${stripHtml(item.text)}\n`;
    }
    text += '\n';
  }
  await navigator.clipboard.writeText(text);
}
