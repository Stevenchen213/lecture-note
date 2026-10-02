/**
 * LectureNote 评估主脚本 —— 回应里程碑 1 反馈的三项修正：
 *   1. 基线：纯转写本身的覆盖率（trivial winner 检验）
 *   2. 双指标：coverage（关键点覆盖）+ precision（大纲条目纯度）
 *   3. 限长：对比「不限长大纲」与「限长 ≤15% 大纲」
 *
 * 系统被测对象：产品真实的 generateOutline（server/deepseek.js），不改产品代码。
 * 评审方式：LLM-as-judge（DeepSeek），每次判定输出 JSON。
 *
 * 用法: node evals/run_evals.mjs
 * 输出: evals/results/results.csv, evals/results/RESULTS.md, evals/results/raw/segNN/*.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatRetry } from './lib/deepseek.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SEG_DIR = path.join(ROOT, 'data', 'segments');
const KP_DIR = path.join(ROOT, 'data', 'keypoints');
const RES_DIR = path.join(ROOT, 'evals', 'results');
const RAW_DIR = path.join(RES_DIR, 'raw');

// 先加载 env，再动态 import 产品代码（产品代码在 import 时读 process.env）
const { generateOutline } = await import(path.join(ROOT, 'server', 'deepseek.js'));

const LENGTH_CAP_RATIO = 0.15; // 限长组：大纲词数 ≤ 转写词数 15%

/** 把长转写切成若干块，模拟产品里 transcriptBuffer 的形态 */
function toTranscriptChunks(text, nChunks = 8) {
  const words = text.split(/\s+/);
  const size = Math.ceil(words.length / nChunks);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push({ text: words.slice(i, i + size).join(' '), timestamp: Date.now() });
  }
  return chunks;
}

/** 限长版大纲：复刻产品 prompt + 追加长度硬约束（不动 server/deepseek.js） */
async function generateOutlineCapped(transcripts, capWords) {
  const fullText = transcripts.map((t) => t.text).join('\n');
  const { content } = await chatRetry(
    [
      {
        role: 'system',
        content: `你是大学课堂笔记助手。根据英文授课内容生成中英双语结构化大纲。

规则：
1. 识别课程主题和章节结构，章节划分要细致，覆盖完整课程脉络
2. 提取关键知识点作为列表项，尽量保留具体细节：数字、公式、定义、人名、案例、数据、专业术语、老师原话
3. 老师强调/重复/说"记住""会考""重要"的内容要重点列出，不要遗漏
4. heading 是中文章节名，headingEn 是英文
5. 每个知识点 text（中文）和 textEn（英文），内容要具体、有信息量，避免泛泛而谈
6. 【长度硬约束】所有 items 的 textEn 合计不得超过 ${capWords} 个英文单词。超出则优先保留老师强调的重点，舍弃次要内容

严格输出 JSON（不要 markdown 代码块）：
{
  "title": "中文主题",
  "titleEn": "English Topic",
  "sections": [
    {
      "heading": "中文章节",
      "headingEn": "English Section",
      "items": [
        { "text": "中文知识点", "textEn": "English point" }
      ]
    }
  ]
}`,
      },
      { role: 'user', content: `课堂录音文字：\n\n${fullText}` },
    ],
    { temperature: 0.3, maxTokens: 2048, jsonMode: true }
  );
  return JSON.parse(content);
}

/** 大纲 → 扁平英文条目列表 + 全文 */
function flattenOutline(outline) {
  const items = [];
  for (const sec of outline.sections || []) {
    for (const it of sec.items || []) {
      if (it.textEn) items.push(it.textEn);
    }
  }
  return items;
}

/** LLM 评审：关键点 coverage。返回 {coveredIds: Set, total} */
async function judgeCoverage(keypoints, textName, text) {
  const list = keypoints.map((k, i) => `[${i}] ${k}`).join('\n');
  const { content } = await chatRetry(
    [
      {
        role: 'system',
        content: `You are a strict but fair evaluator. Given a list of ground-truth KEY POINTS from a lecture and a TEXT (transcript or generated outline), decide for each key point whether the TEXT conveys that fact. Paraphrase counts; the same fact in different words or another language counts. Vague similarity does not count — the specific fact/number/definition must be present.

Output strict JSON: { "results": [ {"id": 0, "covered": true}, ... ] } with one entry per key point id.`,
      },
      { role: 'user', content: `KEY POINTS:\n${list}\n\n${textName}:\n${text}` },
    ],
    { temperature: 0, maxTokens: 1500, jsonMode: true }
  );
  const parsed = JSON.parse(content);
  const covered = new Set(parsed.results.filter((r) => r.covered).map((r) => r.id));
  return { covered, total: keypoints.length };
}

/** LLM 评审：大纲条目 precision（每条是否命中某个关键点） */
async function judgePrecision(outlineItems, keypoints) {
  const items = outlineItems.map((t, i) => `[${i}] ${t}`).join('\n');
  const kps = keypoints.map((k, i) => `[${i}] ${k}`).join('\n');
  const { content } = await chatRetry(
    [
      {
        role: 'system',
        content: `You are a strict evaluator. Given OUTLINE ITEMS from a generated lecture outline and ground-truth KEY POINTS, decide for each outline item whether it matches (conveys the same specific fact as) at least one key point. Paraphrase counts. Items that are correct but NOT one of the labeled key points count as not matched.

Output strict JSON: { "results": [ {"id": 0, "matched": true}, ... ] } with one entry per outline item id.`,
      },
      { role: 'user', content: `OUTLINE ITEMS:\n${items}\n\nKEY POINTS:\n${kps}` },
    ],
    { temperature: 0, maxTokens: 2000, jsonMode: true }
  );
  const parsed = JSON.parse(content);
  const matched = new Set(parsed.results.filter((r) => r.matched).map((r) => r.id));
  return { matched, total: outlineItems.length };
}

const wc = (s) => s.split(/\s+/).filter(Boolean).length;

async function evalSegment(segId) {
  const transcript = fs.readFileSync(path.join(SEG_DIR, `${segId}.txt`), 'utf-8');
  const kpData = JSON.parse(fs.readFileSync(path.join(KP_DIR, `${segId}.keypoints.json`), 'utf-8'));
  const keypoints = kpData.keypoints;
  const transcriptWords = wc(transcript);
  const outDir = path.join(RAW_DIR, segId);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${segId}（${transcriptWords} 词, ${keypoints.length} 关键点）===`);

  // 1) 基线：纯转写 coverage
  console.log('  [1/5] 基线：纯转写 coverage…');
  const base = await judgeCoverage(keypoints, 'RAW TRANSCRIPT', transcript);
  const baselineCov = base.covered.size / base.total;
  console.log(`        ${base.covered.size}/${base.total} = ${(baselineCov * 100).toFixed(1)}%`);

  // 2) 不限长大纲（产品真实 generateOutline）
  console.log('  [2/5] 生成不限长大纲（产品 generateOutline）…');
  const chunks = toTranscriptChunks(transcript);
  const uncapped = await generateOutline(chunks, '');
  fs.writeFileSync(path.join(outDir, 'outline_uncapped.json'), JSON.stringify(uncapped, null, 2));
  const uncappedItems = flattenOutline(uncapped);
  const uncappedWords = uncappedItems.join(' ').split(/\s+/).filter(Boolean).length;

  // 3) 限长大纲
  const capWords = Math.round(transcriptWords * LENGTH_CAP_RATIO);
  console.log(`  [3/5] 生成限长大纲（≤${capWords} 词）…`);
  const capped = await generateOutlineCapped(chunks, capWords);
  fs.writeFileSync(path.join(outDir, 'outline_capped.json'), JSON.stringify(capped, null, 2));
  const cappedItems = flattenOutline(capped);
  const cappedWords = cappedItems.join(' ').split(/\s+/).filter(Boolean).length;

  // 4) coverage 评审（两个大纲）
  console.log('  [4/5] coverage 评审…');
  const uncCov = await judgeCoverage(keypoints, 'GENERATED OUTLINE', uncappedItems.join('\n'));
  const capCov = await judgeCoverage(keypoints, 'GENERATED OUTLINE', cappedItems.join('\n'));

  // 5) precision 评审（两个大纲）
  console.log('  [5/5] precision 评审…');
  const uncPrec = await judgePrecision(uncappedItems, keypoints);
  const capPrec = await judgePrecision(cappedItems, keypoints);

  const row = {
    segment: segId,
    transcript_words: transcriptWords,
    keypoints: keypoints.length,
    baseline_coverage: +(baselineCov * 100).toFixed(1),
    uncapped_words: uncappedWords,
    uncapped_ratio: +(uncappedWords / transcriptWords).toFixed(3),
    uncapped_coverage: +((uncCov.covered.size / uncCov.total) * 100).toFixed(1),
    uncapped_precision: +((uncPrec.matched.size / Math.max(uncPrec.total, 1)) * 100).toFixed(1),
    capped_words: cappedWords,
    capped_ratio: +(cappedWords / transcriptWords).toFixed(3),
    capped_coverage: +((capCov.covered.size / capCov.total) * 100).toFixed(1),
    capped_precision: +((capPrec.matched.size / Math.max(capPrec.total, 1)) * 100).toFixed(1),
  };
  console.log(`  结果: 基线 ${row.baseline_coverage}% | 不限长 ${row.uncapped_coverage}%/${row.uncapped_precision}% (${(row.uncapped_ratio * 100).toFixed(0)}%长) | 限长 ${row.capped_coverage}%/${row.capped_precision}% (${(row.capped_ratio * 100).toFixed(0)}%长)`);
  return row;
}

const segIds = fs.readdirSync(SEG_DIR).filter((f) => f.endsWith('.txt')).map((f) => f.replace('.txt', '')).sort();
console.log(`评估 ${segIds.length} 个段落: ${segIds.join(', ')}`);

const rows = [];
for (const id of segIds) {
  try {
    rows.push(await evalSegment(id));
  } catch (err) {
    console.error(`${id} 失败: ${err.message}`);
  }
}

// CSV
fs.mkdirSync(RES_DIR, { recursive: true });
const header = Object.keys(rows[0]).join(',');
const csv = [header, ...rows.map((r) => Object.values(r).join(','))].join('\n');
fs.writeFileSync(path.join(RES_DIR, 'results.csv'), csv);

// 汇总均值
const avg = (k) => +(rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
const summary = {
  baseline_coverage: avg('baseline_coverage'),
  uncapped_coverage: avg('uncapped_coverage'),
  uncapped_precision: avg('uncapped_precision'),
  uncapped_ratio: +(rows.reduce((s, r) => s + r.uncapped_ratio, 0) / rows.length).toFixed(3),
  capped_coverage: avg('capped_coverage'),
  capped_precision: avg('capped_precision'),
  capped_ratio: +(rows.reduce((s, r) => s + r.capped_ratio, 0) / rows.length).toFixed(3),
};

// Markdown 报告
let md = `# LectureNote 评估结果（${rows.length} 段）\n\n`;
md += `| 段落 | 转写词数 | 关键点 | 基线覆盖 | 不限长 覆盖/精确 (长度比) | 限长≤15% 覆盖/精确 (长度比) |\n`;
md += `|---|---|---|---|---|---|\n`;
for (const r of rows) {
  md += `| ${r.segment} | ${r.transcript_words} | ${r.keypoints} | ${r.baseline_coverage}% | ${r.uncapped_coverage}% / ${r.uncapped_precision}% (${(r.uncapped_ratio * 100).toFixed(0)}%) | ${r.capped_coverage}% / ${r.capped_precision}% (${(r.capped_ratio * 100).toFixed(0)}%) |\n`;
}
md += `\n## 平均\n\n`;
md += `| 方案 | Coverage | Precision | 长度比 |\n|---|---|---|---|\n`;
md += `| 纯转写（基线） | ${summary.baseline_coverage}% | — | 100% |\n`;
md += `| 不限长大纲 | ${summary.uncapped_coverage}% | ${summary.uncapped_precision}% | ${(summary.uncapped_ratio * 100).toFixed(0)}% |\n`;
md += `| 限长大纲（≤15%） | ${summary.capped_coverage}% | ${summary.capped_precision}% | ${(summary.capped_ratio * 100).toFixed(0)}% |\n`;
fs.writeFileSync(path.join(RES_DIR, 'RESULTS.md'), md);

console.log('\n===== 平均 =====');
console.log(JSON.stringify(summary, null, 2));
console.log(`\n输出: ${path.join(RES_DIR, 'results.csv')} 和 RESULTS.md`);
