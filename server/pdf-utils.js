/**
 * PDF 文字提取 — 基于 pdfjs-dist
 * - 文字型 PDF → getTextContent() 直接提取（快速准确）
 * - 图片型 PDF → 渲染页面 + Tesseract OCR 识别
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createCanvas } from 'canvas';

let pdfjsLib = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * 从 PDF 提取文字
 * @param {string} filePath
 * @returns {string}
 */
export async function extractPdfText(filePath) {
  console.log('===== PDF 处理开始 =====');

  const buffer = fs.readFileSync(filePath);
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`文件大小: ${fileSizeMB} MB`);

  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data }).promise;

  const numPages = pdf.numPages;
  console.log(`共 ${numPages} 页`);

  // ---- 第一步：尝试文本提取 ----
  let fullText = '';
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        fullText += pageText + '\n';
      }
    } catch (err) {
      console.error(`第 ${i} 页文本提取失败:`, err.message);
    }
    if (i % 10 === 0) {
      console.log(`文本提取进度: ${i}/${numPages} 页 (${fullText.length} 字符)`);
    }
  }

  fullText = fullText.trim();
  console.log(`文本提取完成: ${fullText.length} 字符`);

  // 每页平均 < 20 字符 → 图片型 PDF，走 OCR
  const avgCharsPerPage = fullText.length / Math.max(numPages, 1);
  if (avgCharsPerPage < 20 || fullText.length < 100) {
    console.log(`文字量偏低 (${avgCharsPerPage.toFixed(1)} 字符/页)，启用 OCR`);
    return await ocrPdf(filePath);
  }

  return fullText;
}

/**
 * OCR 降级方案 — 逐页渲染为图片，Tesseract 识别
 */
async function ocrPdf(filePath) {
  // 动态导入 tesseract (只用 OCR 时才加载)
  let worker;
  try {
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker('eng');
  } catch (err) {
    console.error('Tesseract 初始化失败:', err.message);
    throw new Error('OCR 引擎不可用，请上传文字版 PDF');
  }

  const buffer = fs.readFileSync(filePath);
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  console.log(`OCR 模式: 共 ${numPages} 页`);

  const allText = [];
  let totalChars = 0;
  const MAX_PAGES = 50;

  for (let i = 1; i <= Math.min(numPages, MAX_PAGES); i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 写临时 PNG 文件
      const tmpImg = path.join(os.tmpdir(), `ocr_p${i}_${Date.now()}.png`);
      const pngBuf = canvas.toBuffer('image/png');
      console.log(`第 ${i} 页渲染完成: ${viewport.width}x${viewport.height}, PNG ${pngBuf.length} 字节`);
      fs.writeFileSync(tmpImg, pngBuf);

      // 验证文件存在
      if (!fs.existsSync(tmpImg)) {
        console.error(`临时文件未创建: ${tmpImg}`);
        continue;
      }

      const fileStats = fs.statSync(tmpImg);
      console.log(`临时文件已创建: ${tmpImg} (${fileStats.size} 字节)`);

      // 用文件路径调用 OCR
      const { data: result } = await worker.recognize(tmpImg);
      const pageText = (result.text || '').trim();

      try { fs.unlinkSync(tmpImg); } catch {}

      if (pageText) {
        allText.push(pageText);
        totalChars += pageText.length;
        console.log(`OCR 第 ${i}/${numPages} 页: ${pageText.length} 字符`);
      } else {
        console.log(`OCR 第 ${i}/${numPages} 页: 无文字`);
      }
    } catch (err) {
      console.error(`OCR 第 ${i} 页失败:`, err.message, err.stack?.slice(0, 200));
    }
  }

  await worker.terminate();

  const finalText = allText.join('\n');
  console.log(`OCR 完成: ${totalChars} 字符 / ${Math.min(numPages, MAX_PAGES)} 页`);
  return finalText;
}

/**
 * 服务启动时预热 Tesseract（下载 eng 语言包）
 */
export async function warmupOcr() {
  try {
    const { createWorker } = await import('tesseract.js');
    const w = await createWorker('eng');
    await w.terminate();
    console.log('Tesseract 已预热 (eng)');
  } catch (err) {
    console.error('Tesseract 预热失败:', err.message);
  }
}
