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
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

export async function chat(messages, opts = {}) {
  const { temperature = 0.3, maxTokens = 2048, jsonMode = false } = opts;
  const body = { model: MODEL, messages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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

/** 带重试的 chat（应对限流） */
export async function chatRetry(messages, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chat(messages, opts);
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = 2000 * (i + 1);
      console.warn(`  重试 ${i + 1}/${retries}（${err.message.slice(0, 80)}），等待 ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
