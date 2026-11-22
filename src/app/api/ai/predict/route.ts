import { NextRequest, NextResponse } from 'next/server';
import { isPredictionType } from '@/lib/aiPredictions';
import { getAiConfig, predictWithAi } from '@/lib/server/ai';

/**
 * AI Assist endpoint (NOTES #27 — Gate 6 Amendment 3).
 * GET  -> { available } so the client can show/hide AI controls.
 * POST -> { type, context } in, a validated prediction out. The Groq
 * key never leaves the server; the browser only ever sees this route.
 */

export async function GET() {
  return NextResponse.json({ available: getAiConfig() !== null });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { type, context } = (body ?? {}) as {
    type?: unknown;
    context?: unknown;
  };
  if (!isPredictionType(type)) {
    return NextResponse.json({ error: 'unknown_prediction_type' }, { status: 400 });
  }
  if (typeof context !== 'object' || context === null || Array.isArray(context)) {
    return NextResponse.json({ error: 'invalid_context' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const outcome = await predictWithAi(type, context as Record<string, unknown>, ip);

  if (!outcome.ok) {
    const status = outcome.reason === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: outcome.reason }, { status });
  }
  return NextResponse.json({ ...outcome.result, cached: outcome.cached });
}
