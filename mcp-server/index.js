/**
 * LectureNote MCP Server
 *
 * 提供课堂相关的 AI 工具：翻译、大纲生成、出题
 * 基于 MCP Streamable HTTP 协议 (v2, 2026-era)
 *
 * 部署到 Render 后，MCP 端点地址为：
 *   https://<your-render-host>.onrender.com/mcp
 */

import { config } from 'dotenv';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import * as z from 'zod';
import { existsSync } from 'fs';

// 本地开发时加载 .env，Render 上直接读环境变量
const envPaths = ['../server/.env', '.env'];
for (const p of envPaths) {
  if (existsSync(p)) { config({ path: p }); break; }
}

// ====== DeepSeek API ======
const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

function apiKey() {
  const k = process.env.DEEPSEEK_API_KEY;
  if (!k) throw new Error('缺少 DEEPSEEK_API_KEY');
  return k;
}

let callCount = 0;

async function chat(messages, opts = {}) {
  const { temperature = 0.3, maxTokens = 2048 } = opts;
  const reqId = ++callCount;
  console.log(`[MCP-DeepSeek #${reqId}] 请求…`);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[MCP-DeepSeek #${reqId}] 失败 HTTP ${res.status}: ${text.slice(0, 300)}`);
    throw new Error(`DeepSeek API ${res.status}`);
  }

  const data = await res.json();
  console.log(`[MCP-DeepSeek #${reqId}] 成功 (${data.usage?.total_tokens || '?'} tokens)`);
  return data.choices[0].message.content;
}

// ====== MCP 工具定义 ======

function createServer() {
  const server = new McpServer({
    name: 'lecturenote-mcp',
    version: '1.0.0',
  });

  // --- 工具 1：实时翻译 ---
  server.registerTool('translate', {
    title: '英中同传翻译',
    description: '将英文文本实时翻译为简体中文，专为课堂场景优化（学术术语+口语表达兼顾）。用于同声传译场景，支持短句和段落翻译。',
    inputSchema: z.object({
      text: z.string().describe('需要翻译的英文文本'),
    }),
  }, async ({ text }) => {
    if (!text || text.trim().length === 0) {
      return { content: [{ type: 'text', text: '(empty input)' }] };
    }

    const result = await chat([
      { role: 'system', content: 'You are a professional simultaneous interpreter. Output ONLY the Chinese translation with no explanation.' },
      { role: 'user', content: `Translate this English lecture speech into natural, fluent Simplified Chinese. Keep academic terminology accurate. Keep it concise like spoken Chinese, not written essay. Output ONLY the Chinese translation:\n\n${text}` },
    ], { temperature: 0.2, maxTokens: 1024 });

    return { content: [{ type: 'text', text: result.trim() }] };
  });

  // --- 工具 2：生成大纲 ---
  server.registerTool('generate_outline', {
    title: '生成课程大纲',
    description: '根据课堂中英文字幕或转录文本，自动生成结构化的双语课程大纲。识别课程章节、关键概念和逻辑结构，输出层级化笔记。',
    inputSchema: z.object({
      transcript: z.string().describe('课堂转录文本，英文原文、中文翻译或双语混合均可'),
      context: z.string().optional().describe('可选的课件/教材文本，帮助 AI 更准确地识别课程结构和术语'),
    }),
  }, async ({ transcript, context }) => {
    if (!transcript || transcript.trim().length === 0) {
      return { content: [{ type: 'text', text: JSON.stringify({ title: '(无内容)', sections: [] }, null, 2) }] };
    }

    const ctxHint = context
      ? `\n\n课程课件内容参考（用于校准术语和结构）：\n${context.slice(0, 3000)}`
      : '';

    const prompt = `你是一位专业的课堂笔记助手。请根据以下课堂录音内容，生成一份结构化的双语大纲。

要求：
1. 识别课程主题并生成中英双语标题
2. 提取关键章节（sections），每个章节包含中英双语标题
3. 每个章节下列出要点（bullets），双语
4. 只输出 JSON 结构，不要解释

输出格式（只输出 JSON）：
{
  "title": "中文标题",
  "titleEn": "English Title",
  "sections": [
    { "title": "中文", "titleEn": "English", "bullets": ["中文要点", "English bullet"] }
  ]
}

课堂内容：${transcript.slice(0, 10000)}${ctxHint}`;

    const result = await chat([
      { role: 'system', content: '你是一位专业的课堂笔记助手。只输出 JSON，不要其他内容。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 2048 });

    try {
      const json = result.match(/\{[\s\S]*\}/)?.[0];
      if (json) {
        JSON.parse(json);
        return { content: [{ type: 'text', text: json }] };
      }
    } catch {}

    return { content: [{ type: 'text', text: result.trim() }] };
  });

  // --- 工具 3：生成练习题 ---
  server.registerTool('generate_questions', {
    title: '生成练习题',
    description: '根据课堂内容和课程大纲，生成15道核心考试题（选择题/简答题/判断题），优先覆盖老师暗示的考点。每题含答案和解析。',
    inputSchema: z.object({
      transcript: z.string().describe('课堂转录文本，完整课程内容'),
      outline: z.string().optional().describe('已生成的结构化大纲 JSON，用于定位重点章节'),
    }),
  }, async ({ transcript, outline }) => {
    if (!transcript || transcript.trim().length < 50) {
      return { content: [{ type: 'text', text: JSON.stringify({
        error: '内容太短，至少50字符', questions: []
      }, null, 2) }] };
    }

    const outlineHint = outline
      ? `\n\n课程大纲参考：\n${outline.slice(0, 3000)}`
      : '';

    const prompt = `你是一位大学考试出题专家。根据以下课堂内容生成15道核心练习题。

要求：
1. 覆盖课程最核心知识点，甄选最有考试价值的15道题
2. 老师暗示/强调过的考点优先
3. 10道选择题(4选1) + 3道简答题 + 2道判断题
4. 每题附带正确答案和解析

输出 JSON（只输出 JSON）：
{
  "questions": [
    { "type": "choice", "question": "题目", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "B", "explanation": "解析" },
    { "type": "short_answer", "question": "简答", "answer": "参考答案", "explanation": "解析" },
    { "type": "true_false", "question": "判断", "answer": "正确", "explanation": "解析" }
  ]
}

课堂内容：${transcript.slice(0, 15000)}${outlineHint}`;

    const result = await chat([
      { role: 'system', content: '你是一位大学考试出题专家。只输出 JSON，不要其他内容。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.4, maxTokens: 4096 });

    try {
      const json = result.match(/\{[\s\S]*\}/)?.[0];
      if (json) {
        JSON.parse(json);
        return { content: [{ type: 'text', text: json }] };
      }
    } catch {}

    return { content: [{ type: 'text', text: result.trim() }] };
  });

  // --- 工具 4：健康检查 ---
  server.registerTool('health', {
    title: '服务健康检查',
    description: '检查 MCP 服务是否正常运行，返回服务状态和调用统计。',
    inputSchema: z.object({}),
  }, async () => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'healthy',
          service: 'lecturenote-mcp',
          version: '1.0.0',
          model: MODEL,
          totalCalls: callCount,
        }, null, 2),
      }],
    };
  });

  return server;
}

// ====== HTTP 服务 ======

const PORT = process.env.PORT || process.env.MCP_PORT || 3000;
const HOST = '0.0.0.0';

const app = createMcpExpressApp({
  host: HOST,
  jsonLimit: '2mb',
});

// 创建 MCP handler（每次请求通过工厂函数创建新 server，符合 v2 无状态设计）
const mcpHandler = createMcpHandler(() => createServer(), {
  onerror: (err) => console.error('MCP 内部错误:', err.message),
});

// MCP Streamable HTTP 端点（POST + GET）
app.all('/mcp', async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    const webRes = await mcpHandler.fetch(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((value, key) => res.set(key, value));
    const body = await webRes.text();
    res.send(body);
  } catch (err) {
    console.error('MCP 请求处理失败:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP error' });
    }
  }
});

// 根路径 + 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'lecturenote-mcp', version: '1.0.0', endpoint: '/mcp' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'lecturenote-mcp', version: '1.0.0' });
});

app.listen(PORT, HOST, () => {
  console.log(`🔌 LectureNote MCP Server 已启动`);
  console.log(`   MCP 端点: http://${HOST}:${PORT}/mcp`);
  console.log(`   健康检查: http://${HOST}:${PORT}/health`);
  console.log(`   模型: ${MODEL}`);
});
