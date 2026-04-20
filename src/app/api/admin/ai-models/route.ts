/**
 * /api/admin/ai-models
 *
 * Lấy danh sách model từ provider AI — chỉ admin.
 * POST { provider, apiKey, baseUrl } → { models: string[] }
 *
 * Hỗ trợ:
 *  - OpenAI-compatible: GET {baseUrl}/v1/models  (Bearer auth)
 *  - Google Gemini:     GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 *
 * Lưu ý: nếu apiKey từ body chứa '••••' (bị mask) thì đọc key thật từ CaiDat DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// Model Gemini thực sự dùng được cho chat/vision (loại bỏ embedding, aqa, legacy)
const GEMINI_SKIP = /embedding|aqa|vision(?!-pro)|imagen|tts|audio|whisper/i;

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  const url = `${base || 'https://api.openai.com'}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  const items: { id: string }[] = data.data ?? data.models ?? [];
  return items.map(m => m.id).sort();
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Trả lỗi rõ ràng hơn cho API key sai
    if (res.status === 400 || res.status === 403) throw new Error(`API key không hợp lệ (${res.status})`);
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const data = await res.json();
  const items: { name: string; supportedGenerationMethods?: string[]; displayName?: string }[] = data.models ?? [];
  return items
    .filter(m =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      !GEMINI_SKIP.test(m.name),
    )
    .map(m => m.name.replace('models/', ''))
    // Ưu tiên hiện các model gemini-* trước, rồi các model khác
    .sort((a, b) => {
      const aG = a.startsWith('gemini') ? 0 : 1;
      const bG = b.startsWith('gemini') ? 0 : 1;
      return aG - bG || a.localeCompare(b);
    });
}

/** Đọc API key thật từ DB (bỏ qua nếu frontend gửi lên key đã bị mask) */
async function resolveApiKey(fromBody: string | undefined): Promise<string> {
  if (fromBody && !fromBody.includes('•')) return fromBody;
  const row = await prisma.caiDat.findFirst({ where: { khoa: 'ai_api_key' } });
  return row?.giaTri ?? '';
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { provider: bodyProvider, apiKey: bodyKey, baseUrl: bodyBase } = body as {
    provider?: string; apiKey?: string; baseUrl?: string;
  };

  // Đọc từ DB làm fallback cho mọi field chưa có / bị mask
  const rows = await prisma.caiDat.findMany({
    where: { khoa: { in: ['ai_provider', 'ai_api_key', 'ai_base_url'] } },
  });
  const db: Record<string, string> = {};
  for (const r of rows) db[r.khoa] = r.giaTri ?? '';

  const provider = bodyProvider || db['ai_provider'] || 'none';
  const baseUrl  = bodyBase    || db['ai_base_url']  || '';
  // Key: body có priority nhưng nếu bị mask thì lấy từ DB
  const apiKey   = await resolveApiKey(bodyKey || db['ai_api_key']);

  if (provider === 'none' || !apiKey) {
    return NextResponse.json({ error: 'Chưa có API key hoặc chưa chọn provider' }, { status: 400 });
  }

  try {
    const models = provider === 'gemini'
      ? await fetchGeminiModels(apiKey)
      : await fetchOpenAIModels(apiKey, baseUrl);
    return NextResponse.json({ success: true, models });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Không lấy được model: ${msg}` }, { status: 502 });
  }
}
