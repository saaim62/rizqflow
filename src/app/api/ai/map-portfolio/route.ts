import { NextRequest, NextResponse } from 'next/server';
import { getAiConfig, mapPortfolioWithAi } from '@/lib/server/ai';

const MAX_PAYLOAD_BYTES = 30 * 1024; // 30 KB cap (security and denial-of-service guard)

/**
 * AI Portfolio Field Mapping endpoint.
 * GET  -> { available: boolean }
 * POST -> { payload: string | object } -> mapped { profile, mapping, unmapped, model, cached }
 */

export async function GET() {
  return NextResponse.json({ available: getAiConfig() !== null });
}

export async function POST(req: NextRequest) {
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Failed to read request body' }, { status: 400 });
  }

  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'payload_too_large', message: 'Payload exceeds 30 KB limit' },
      { status: 400 }
    );
  }

  let payloadStr = '';
  try {
    const json = JSON.parse(bodyText);
    if (json && typeof json === 'object') {
      if (typeof json.payload === 'string') {
        payloadStr = json.payload.trim();
      } else if (json.payload && typeof json.payload === 'object') {
        payloadStr = JSON.stringify(json.payload);
      } else {
        payloadStr = JSON.stringify(json);
      }
    } else {
      payloadStr = bodyText.trim();
    }
  } catch {
    // If not JSON, treat raw bodyText as CSV or plain text
    payloadStr = bodyText.trim();
  }

  if (!payloadStr) {
    return NextResponse.json(
      { error: 'empty_payload', message: 'Payload cannot be empty' },
      { status: 400 }
    );
  }

  if (payloadStr.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'payload_too_large', message: 'Payload exceeds 30 KB limit' },
      { status: 400 }
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const outcome = await mapPortfolioWithAi(payloadStr, ip);

  if (!outcome.ok) {
    const status = outcome.reason === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: outcome.reason }, { status });
  }

  return NextResponse.json({ ...outcome.result, cached: outcome.cached });
}
