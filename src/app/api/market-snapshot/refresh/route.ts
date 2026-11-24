import { NextResponse, connection } from 'next/server';
import { refreshMarketSnapshot, isProviderConfigured } from '@/lib/server/marketRefresh';

// Server-side refresh of the stamped market snapshot (Amendment 4 to
// Forgewarden Gate 6). The browser never calls a third party; this route
// is the only place external fetching happens, and only when a provider URL
// is configured in the server's .env.server. Guarded by an optional shared
// secret (MARKET_REFRESH_SECRET) so a public deployment isn't spammed.
export async function POST(req: Request) {
  const secret = process.env.MARKET_REFRESH_SECRET;
  if (secret) {
    const provided = req.headers.get('x-refresh-secret') || new URL(req.url).searchParams.get('secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  if (!isProviderConfigured()) {
    return NextResponse.json(
      { error: 'No market-data provider configured. Set MARKET_SNAPSHOT_PROVIDER_URL in .env.server.', configured: false },
      { status: 503 }
    );
  }

  const result = await refreshMarketSnapshot();
  if (!result.ok) {
    return NextResponse.json({ error: result.error, configured: true }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    dataAsOf: result.snapshot.dataAsOf,
    source: result.snapshot.source,
    updatedAt: result.snapshot.updatedAt,
  });
}

export async function GET() {
  await connection();
  return NextResponse.json({
    configured: isProviderConfigured(),
    updatedAt: (await import('@/lib/server/marketRefresh')).getServerMarketSnapshot().updatedAt,
  });
}
