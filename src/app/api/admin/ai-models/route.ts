/**
 * /api/admin/ai-models
 *
 * Lấy danh sách model từ provider AI đã cấu hình — chỉ admin.
 * POST { provider, apiKey, baseUrl } → { models: string[] }
 *
 * Hỗ trợ:
 *  - OpenAI-compatible: GET {baseUrl}/v1/models  (Bearer auth)
 *  - Google Gemini:     GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  const url = `${base || 'https://api.openai.com'}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const items: { id: string }[] = data.data ?? data.models ?? [];
  return items.map(m => m.id).sort();
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const items: { name: string; supportedGenerationMethods?: string[] }[] = data.models ?? [];
  return items
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .sort();
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Ưu tiên dùng giá trị từ body (admin đang nhập nhưng chưa lưu)
  // Fallback: đọc từ CaiDat
  const body = await req.json().catch(() => ({}));
  let { provider, apiKey, baseUrl } = body as {
    provider?: string; apiKey?: string; baseUrl?: string;
  };

  if (!provider || !apiKey) {
    const rows = await prisma.caiDat.findMany({
      where: { khoa: { in: ['ai_provider', 'ai_api_key', 'ai_base_url'] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.khoa] = r.giaTri ?? '';
    provider  = provider  || map['ai_provider']  || 'none';
    apiKey    = apiKey    || map['ai_api_key']   || '';
    baseUrl   = baseUrl   || map['ai_base_url']  || '';
  }

  if (!apiKey || provider === 'none') {
    return NextResponse.json({ error: 'Chưa có API key hoặc provider' }, { status: 400 });
  }

  try {
    let models: string[];
    if (provider === 'gemini') {
      models = await fetchGeminiModels(apiKey);
    } else {
      models = await fetchOpenAIModels(apiKey, baseUrl ?? '');
    }
    return NextResponse.json({ success: true, models });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Không lấy được model: ${msg}` }, { status: 502 });
  }
}
