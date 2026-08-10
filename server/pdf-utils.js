/**
 * PDF 文字提取 — 文字型 PDF 直接提取，图片型 PDF 转 OCR
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createCanvas } from 'canvas';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const _pdfParse = require('pdf-parse');
// pdf-parse 可能导出 { default: fn } 或直接导出 fn
const pdfParse = typeof _pdfParse === 'function' ? _pdfParse : _pdfParse?.default;
if (typeof pdfParse !== 'function') {
  console.error('pdf-parse 导入异常:', typeof pdfParse, Object.keys(_pdfParse || {}));
}

let pdfjsLib = null;
let tesseractWorker = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    // pdfjs-dist v4+ 用 legacy build 兼容 Node.js
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

async function getTesseractWorker() {
  if (!tesseractWorker) {
    const { createWorker } = await import('tesseract.js');
    tesseractWorker = await createWorker('eng');
  }
  return tesseractWorker;
}

/**
 * 从 PDF 提取文字
 * - 文字型 PDF → pdf-parse 直接提取
 * - 图片型 PDF（文字量 < 100 字符）→ OCR
 *
 * @param {string} filePath - PDF 文件路径
 * @returns {string} 提取的文字
 */
export async function extractPdfText(filePath) {
  console.log('===== PDF 处理开始 =====');

  const buffer = fs.readFileSync(filePath);
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`文件大小: ${fileSizeMB} MB`);

  // ---- 第一步：尝试直接提取文字 ----
  let data;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    console.error('pdf-parse 解析失败:', err.message);
    console.log('回退到 OCR 模式…');
    return await ocrPdf(filePath);
  }

  const text = data.text.trim();
  const pageCount = data.numpages;
  console.log(`pdf-parse 完成: ${text.length} 字符, ${pageCount} 页`);

  // 每页平均 < 20 个字符 → 很可能是图片型 PDF
  const avgCharsPerPage = text.length / Math.max(pageCount, 1);

  if (avgCharsPerPage < 20 || text.length < 100) {
    console.log(
      `文字量偏低 (${text.length} 字符 / ${pageCount} 页 = ${avgCharsPerPage.toFixed(1)} 字符/页)，启用 OCR`
    );
    return await ocrPdf(filePath);
  }

  console.log(`PDF 文字提取成功 (${text.length} 字符)`);
  return text;
}

/**
 * OCR 模式：逐页渲染为图片，用 Tesseract 识别
 */
async function ocrPdf(filePath) {
  let worker;
  try {
    worker = await getTesseractWorker();
  } catch (err) {
    console.error('Tesseract 初始化失败:', err.message);
    throw new Error('OCR 引擎不可用，请上传文字版 PDF');
  }

  const buffer = fs.readFileSync(filePath);
  const pdfjs = await getPdfjs();

  // Uint8Array 给 pdfjs
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  console.log(`OCR 模式: 共 ${numPages} 页`);

  const allText = [];
  let totalChars = 0;
  const MAX_PAGES = 50; // 防止超长 PDF 拖死服务器

  for (let i = 1; i <= Math.min(numPages, MAX_PAGES); i++) {
    try {
      const page = await pdf.getPage(i);
      // 2x 缩放提升 OCR 准确率
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 先写临时 PNG 文件，tesseract.js 在 Node 下需要文件路径
      const tmpImg = path.join(os.tmpdir(), `ocr_p${i}_${Date.now()}.png`);
      fs.writeFileSync(tmpImg, canvas.toBuffer('image/png'));

      const {
        data: { text: pageText },
      } = await worker.recognize(tmpImg);

      try { fs.unlinkSync(tmpImg); } catch {}
      const cleanText = pageText.trim();

      if (cleanText) {
        allText.push(cleanText);
        totalChars += cleanText.length;
      }

      if (i % 5 === 0 || i === numPages) {
        console.log(`OCR 进度: ${i}/${numPages} 页 (${totalChars} 字符)`);
      }
    } catch (err) {
      console.error(`OCR 第 ${i} 页失败:`, err.message);
    }
  }

  await worker.terminate();
  tesseractWorker = null; // 每次用完释放

  const finalText = allText.join('\n');
  console.log(`OCR 完成: ${totalChars} 字符 / ${Math.min(numPages, MAX_PAGES)} 页`);
  return finalText;
}

/**
 * 在服务启动时预热 Tesseract（下载语言包）
 * 这样第一次 OCR 不用等下载
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
