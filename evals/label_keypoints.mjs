/**
 * 关键点预标注脚本：为每个讲座段落生成 15 个关键点草稿。
 * 输出到 data/keypoints/segNN.keypoints.json，供人工校对后作为评估 ground truth。
 *
 * 用法: node evals/label_keypoints.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatRetry } from './lib/deepseek.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEG_DIR = path.join(__dirname, '..', 'data', 'segments');
const KP_DIR = path.join(__dirname, '..', 'data', 'keypoints');

const segments = fs.readdirSync(SEG_DIR).filter((f) => f.endsWith('.txt')).sort();
console.log(`共 ${segments.length} 个段落待标注`);

for (const file of segments) {
  const id = file.replace('.txt', '');
  const outPath = path.join(KP_DIR, `${id}.keypoints.json`);
  if (fs.existsSync(outPath)) {
    console.log(`${id}: 已存在，跳过`);
    continue;
  }
  const transcript = fs.readFileSync(path.join(SEG_DIR, file), 'utf-8');
  console.log(`${id}: 标注中（${transcript.split(/\s+/).length} 词）…`);

  const { content } = await chatRetry(
    [
      {
        role: 'system',
        content: `You are labeling ground-truth key points for evaluating a lecture-note-taking AI.

Given an excerpt from a real university lecture transcript, extract exactly 15 KEY POINTS — the specific facts a diligent student must capture:

RULES:
1. Each key point is ONE atomic, checkable fact: a definition, formula, number, named concept, example, claim, or cause-effect relationship stated by the instructor.
2. Be specific, not generic. BAD: "The lecture covers linear equations". GOOD: "Two equations in two unknowns can be viewed row-wise (line intersections) or column-wise (vector linear combinations)".
3. Prefer content the instructor emphasizes, repeats, or flags as important.
4. Include concrete numbers, formulas, and examples wherever they appear (e.g. "A 3x3 system has a unique solution when the three column vectors are not coplanar").
5. Write each key point in English, one sentence, self-contained (understandable without the transcript).
6. Order by importance (most exam-worthy first).

Output strict JSON: { "keypoints": ["point 1", "point 2", ...] }`,
      },
      { role: 'user', content: `Lecture transcript excerpt:\n\n${transcript}` },
    ],
    { temperature: 0.2, maxTokens: 3000, jsonMode: true }
  );

  const parsed = JSON.parse(content);
  const kp = { segment: id, source_words: transcript.split(/\s+/).length, auto_labeled: true, human_verified: false, keypoints: parsed.keypoints };
  fs.writeFileSync(outPath, JSON.stringify(kp, null, 2), 'utf-8');
  console.log(`${id}: ${parsed.keypoints.length} 个关键点已保存`);
}
console.log('全部完成。请人工校对 data/keypoints/*.json 后将 human_verified 改为 true。');
