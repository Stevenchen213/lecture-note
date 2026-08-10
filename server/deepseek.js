/**
 * DeepSeek API 集成（OpenAI 兼容接口）
 * 功能：英→中实时翻译 + 结构化双语大纲 + 练习题生成
 */

const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

function key() {
  const k = process.env.DEEPSEEK_API_KEY;
  if (!k) throw new Error('缺少 DEEPSEEK_API_KEY');
  return k;
}

let callCount = 0;
let failCount = 0;

async function chat(messages, opts = {}) {
  const { temperature = 0.3, maxTokens = 2048 } = opts;
  const reqId = ++callCount;

  console.log(`[DeepSeek #${reqId}] 发起请求… (已成功${reqId - failCount - 1}, 已失败${failCount})`);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    failCount++;
    const text = await res.text();
    console.error(`[DeepSeek #${reqId}] 失败! HTTP ${res.status}`);
    console.error(`[DeepSeek #${reqId}] 响应头: ${JSON.stringify(Object.fromEntries(res.headers))}`);
    console.error(`[DeepSeek #${reqId}] 响应体: ${text.slice(0, 500)}`);
    throw new Error(`DeepSeek API ${res.status}: ${text}`);
  }

  const data = await res.json();
  console.log(`[DeepSeek #${reqId}] 成功 (${data.usage?.total_tokens || '?'} tokens)`);
  return data.choices[0].message.content;
}

/**
 * 实时英译中——课堂同传翻译
 */
export async function translate(text) {
  const result = await chat(
    [
      {
        role: 'system',
        content:
          '你是课堂实时翻译助手。将英文授课翻译成中文，要求：准确传达学术含义，口语化自然，只输出中文译文。数学公式和代码保持原样不翻译。',
      },
      { role: 'user', content: text },
    ],
    { temperature: 0.1, maxTokens: 512 }
  );
  return result.trim();
}

/**
 * 从累积转录文本生成结构化大纲
 * @param transcripts - [{ text, timestamp }]
 * @param pptContext - 可选，PPT 提取的文字内容
 * @returns {{ title, titleEn, sections: [{ heading, headingEn, items: [{ text, textEn }] }] }}
 */
export async function generateOutline(transcripts, pptContext = '') {
  const fullText = transcripts.map((t) => t.text).join('\n');

  const pptHint = pptContext
    ? `\n\n参考 PPT 内容（用于了解课程主题和结构）：\n${pptContext.slice(0, 3000)}`
    : '';

  const result = await chat(
    [
      {
        role: 'system',
        content: `你是大学课堂笔记助手。根据英文授课内容生成中英双语结构化大纲。

规则：
1. 识别课程主题和章节结构
2. 提取关键知识点作为列表项
3. heading 是中文章节名，headingEn 是英文
4. 每个知识点 text（中文）和 textEn（英文）
5. 如果内容不足以形成完整章节，返回已有部分即可${pptHint}

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
    { temperature: 0.3, maxTokens: 2048 }
  );

  let json = result.trim();
  if (json.startsWith('```json')) json = json.slice(7);
  if (json.startsWith('```')) json = json.slice(3);
  if (json.endsWith('```')) json = json.slice(0, -3);
  json = json.trim();

  try {
    return JSON.parse(json);
  } catch {
    console.error('大纲 JSON 解析失败:\n', result);
    return {
      title: '课程笔记',
      titleEn: 'Lecture Notes',
      sections: [
        {
          heading: '自动生成',
          headingEn: 'Auto Generated',
          items: [{ text: result.trim(), textEn: transcripts.slice(-3).map((t) => t.text).join(' ') }],
        },
      ],
    };
  }
}

/**
 * 课后生成练习题
 * @returns {{ questions: [{ type: string, question: string, questionEn: string, answer: string }] }}
 */
export async function generateQuestions(transcripts, outline) {
  const fullText = transcripts.map((t) => t.text).join('\n');
  const outlineText = outline?.title
    ? `课程主题：${outline.titleEn || outline.title}\n${(outline.sections || []).map((s) => `- ${s.headingEn || s.heading}`).join('\n')}`
    : '';

  const result = await chat(
    [
      {
        role: 'system',
        content: `你是大学课程助教。根据课堂内容生成 3-5 道练习题，帮助复习巩固。

规则：
1. 题型多样：选择题、简答题、判断题混合
2. 每道题包含中文题目(question)、英文题目(questionEn)、中文答案(answer)
3. 难度适中，覆盖课程要点
4. 选择题选项用 A/B/C/D 标记

严格输出 JSON（不要 markdown 代码块）：
{
  "questions": [
    {
      "type": "选择题",
      "question": "中文题目…",
      "questionEn": "English question...",
      "options": ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
      "answer": "正确答案"
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `课堂内容：\n\n${fullText.slice(0, 5000)}\n\n${outlineText}`,
      },
    ],
    { temperature: 0.5, maxTokens: 2048 }
  );

  let json = result.trim();
  if (json.startsWith('```json')) json = json.slice(7);
  if (json.startsWith('```')) json = json.slice(3);
  if (json.endsWith('```')) json = json.slice(0, -3);
  json = json.trim();

  try {
    return JSON.parse(json);
  } catch {
    console.error('练习题 JSON 解析失败:\n', result);
    return {
      questions: [
        {
          type: '简答题',
          question: '请总结本节课的主要内容',
          questionEn: 'Please summarize the main content of this lecture',
          answer: result.trim(),
        },
      ],
    };
  }
}
