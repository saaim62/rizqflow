import { NextResponse } from 'next/server';
import { DEFAULT_MARKET_RATES } from '@/lib/marketRates';
import { DATA_AS_OF, MARKET_SNAPSHOT } from '@/data/marketData';

// The single server-side source for every market indicator in the app.
// Clients poll this hourly (see useMarketSnapshot). PSX closes, Sarafa gold
// and OGRA petrol are DAILY-published official figures — this endpoint
// serves the latest verified snapshot with its as-of stamp rather than
// pretending to be a live feed (Forgewarden Gate 2).
export async function GET() {
  return NextResponse.json({
    rates: { ...DEFAULT_MARKET_RATES },
    silverPerTolaPkr: MARKET_SNAPSHOT.silverPerTolaPkr,
    kse100ChangePts: MARKET_SNAPSHOT.kse100ChangePts,
    kse100ChangePct: MARKET_SNAPSHOT.kse100ChangePct,
    dataAsOf: DATA_AS_OF,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
