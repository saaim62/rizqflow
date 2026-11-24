import { NextResponse, connection } from 'next/server';
import { getServerMarketSnapshot } from '@/lib/server/marketRefresh';

// The single server-side source for every market indicator in the app.
// Serves the stamped seed by default; when a provider is configured and
// /api/market-snapshot/refresh has run, serves the refreshed snapshot.
// Prices are always labelled with their as-of stamp (Forgewarden Gate 2);
// "live"/"real-time" is never claimed.
export async function GET() {
  await connection();
  const snap = getServerMarketSnapshot();
  return NextResponse.json(
    {
      rates: { ...snap.rates },
      silverPerTolaPkr: snap.silverPerTolaPkr,
      kse100ChangePts: snap.kse100ChangePts,
      kse100ChangePct: snap.kse100ChangePct,
      dataAsOf: snap.dataAsOf,
      source: snap.source,
      updatedAt: snap.updatedAt,
      refreshedFromProvider: snap.refreshedFromProvider,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
