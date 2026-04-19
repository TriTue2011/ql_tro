/**
 * ai-chat.ts
 *
 * Unified AI chat interface — hỗ trợ OpenAI (gpt-4o-mini) và Google Gemini.
 * Provider và API key lấy từ CaiDat: ai_provider, ai_api_key, ai_model, ai_base_url.
 *
 * Dùng để:
 *  - Phân loại ý định tin nhắn (intent classification)
 *  - Tạo phản hồi tự nhiên cho chatbot Zalo
 *  - Chat AI trong dashboard (route /api/ai/chat)
 */

import prisma from '@/lib/prisma';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiConfig {
  provider: 'openai' | 'gemini' | 'none';
  apiKey: string;
  model: string;
  /** Custom base URL cho OpenAI-compatible APIs (bỏ trailing slash và /v1) */
  baseUrl: string;
}

async function getAiConfig(): Promise<AiConfig> {
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.khoa] = r.giaTri ?? '';

  const provider = (map['ai_provider'] ?? 'none') as AiConfig['provider'];
  const apiKey = map['ai_api_key'] ?? '';
  const model = map['ai_model'] ?? '';
  const baseUrl = (map['ai_base_url'] ?? '').replace(/\/$/, '');

  return { provider, apiKey, model, baseUrl };
}

/** Gọi OpenAI Chat Completion (hỗ trợ custom base URL) */
async function callOpenAI(
  messages: AiMessage[],
  model: string,
  apiKey: string,
  baseUrl?: string,
  maxTokens = 600,
): Promise<string> {
  const endpoint = baseUrl
    ? `${baseUrl.replace(/\/v1$/, '')}/v1/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/** Gọi Google Gemini generateContent */
async function callGemini(messages: AiMessage[], model: string, apiKey: string): Promise<string> {
  const geminiModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  // Chuyển messages sang Gemini format
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  const contents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, any> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

/**
 * Gọi AI để tạo phản hồi.
 * @param messages  Danh sách tin nhắn (system + lịch sử + user)
 * @returns         Văn bản phản hồi, hoặc null nếu AI chưa cấu hình / lỗi
 */
export async function askAI(messages: AiMessage[], maxTokens = 600): Promise<string | null> {
  try {
    const cfg = await getAiConfig();
    if (cfg.provider === 'none' || !cfg.apiKey) return null;

    if (cfg.provider === 'openai')
      return await callOpenAI(messages, cfg.model, cfg.apiKey, cfg.baseUrl || undefined, maxTokens);
    if (cfg.provider === 'gemini')
      return await callGemini(messages, cfg.model, cfg.apiKey);
    return null;
  } catch (e) {
    console.error('[ai-chat] error:', e);
    return null;
  }
}

/**
 * Phân loại ý định tin nhắn bằng AI.
 * Trả về: 'incident' | 'invoice' | 'contract' | 'rental' | 'other'
 */
export async function classifyIntent(text: string): Promise<string | null> {
  const result = await askAI([
    {
      role: 'system',
      content:
        'Bạn là bộ phân loại ý định cho hệ thống quản lý nhà trọ. ' +
        'Phân loại tin nhắn sau vào một trong các nhãn: ' +
        '"incident" (báo sự cố, hỏng hóc, mất điện/nước), ' +
        '"invoice" (hỏi hóa đơn, tiền điện/nước, tiền phòng), ' +
        '"contract" (hỏi hợp đồng, gia hạn, hết hạn), ' +
        '"rental" (tìm phòng, thuê phòng, hỏi phòng trống), ' +
        '"other" (các trường hợp khác). ' +
        'Chỉ trả về đúng 1 từ, không giải thích.',
    },
    { role: 'user', content: text },
  ]);
  const cleaned = result?.toLowerCase().trim();
  if (['incident', 'invoice', 'contract', 'rental', 'other'].includes(cleaned ?? '')) {
    return cleaned ?? null;
  }
  return null;
}
