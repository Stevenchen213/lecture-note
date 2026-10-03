/**
 * DeepSeek API 轻量客户端（评估脚本专用，独立于产品代码）。
 * 读取 server/.env 中的 DEEPSEEK_API_KEY。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// 手动解析 server/.env（避免依赖 dotenv）
function loadEnv() {
  const envPath = path.join(ROOT, 'server', '.env');
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.trim().match(/^([A-Z_]+)=(.*)$/); // trim 去掉 CRLF 的 \r
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

// 默认 DeepSeek；可用环境变量切换到任何 OpenAI 兼容服务（如 Kimi/Moonshot）
// 在 server/.env 中设置: LLM_BASE_URL / LLM_MODEL / LLM_API_KEY
const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';

function apiKey() {
  const k = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!k) throw new Error('缺少 LLM_API_KEY 或 DEEPSEEK_API_KEY（检查 server/.env）');
  return k;
}

export async function chat(messages, opts = {}) {
  const { temperature = 0.3, maxTokens = 2048, jsonMode = false } = opts;
  const customProvider = process.env.LLM_MODEL || process.env.LLM_BASE_URL;
  // 推理型模型（如 kimi-for-coding）的 reasoning 会占用 max_tokens，给 3 倍余量防截断
  const effectiveMaxTokens = customProvider ? maxTokens * 3 : maxTokens;
  const body = { model: MODEL, messages, max_tokens: effectiveMaxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };
  // Kimi k2.6/k3 等新模型 temperature 被锁定，显式传参会报错——自定义供应商时默认不传
  if (!customProvider) body.temperature = temperature;
  else if (process.env.LLM_TEMPERATURE) body.temperature = Number(process.env.LLM_TEMPERATURE);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return { content: data.choices[0].message.content, usage: data.usage };
}

/** 带重试的 chat（应对限流；Kimi Tier0 仅 3 RPM，429 需要长退避） */
export async function chatRetry(messages, opts = {}, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chat(messages, opts);
    } catch (err) {
      if (i === retries - 1) throw err;
      const is429 = err.message.includes('429');
      const wait = is429 ? 65000 : 2000 * (i + 1); // 429 → 等 65s 跨过 RPM 窗口
      console.warn(`  重试 ${i + 1}/${retries}（${err.message.slice(0, 80)}），等待 ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
