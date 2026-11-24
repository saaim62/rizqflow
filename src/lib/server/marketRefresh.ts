import { DEFAULT_MARKET_RATES } from '@/lib/marketRates';
import { MARKET_SNAPSHOT, DATA_AS_OF, DATA_SOURCES } from '@/data/marketData';
import type { MarketRatesConfig } from '@/types';

/**
 * Server-side market snapshot cache (Amendment 4 to Forgewarden Gate 6).
 *
 * The browser never calls a third party. Instead, this module holds the
 * last stamped snapshot in process memory and refreshes it from a provider
 * URL configured in the server's .env.server (`MARKET_SNAPSHOT_PROVIDER_URL`,
 * optionally guarded by `MARKET_REFRESH_SECRET`). When no provider is
 * configured or a refresh fails, we fall back to the stamped seed in
 * src/data/marketData.ts so the app always has a labelled, dated snapshot.
 *
 * Prices served by /api/market-snapshot are ALWAYS labelled with an as-of
 * stamp; "live"/"real-time" is never claimed (Forgewarden Gate 2).
 */

export interface ServerMarketSnapshot {
  rates: MarketRatesConfig;
  silverPerTolaPkr: number;
  kse100ChangePts: number;
  kse100ChangePct: number;
  dataAsOf: string;
  source: string;
  updatedAt: number; // epoch ms of last successful server sync
  refreshedFromProvider: boolean;
}

const SEED: ServerMarketSnapshot = {
  rates: { ...DEFAULT_MARKET_RATES },
  silverPerTolaPkr: MARKET_SNAPSHOT.silverPerTolaPkr,
  kse100ChangePts: MARKET_SNAPSHOT.kse100ChangePts,
  kse100ChangePct: MARKET_SNAPSHOT.kse100ChangePct,
  dataAsOf: DATA_AS_OF,
  source: 'stamped seed (src/data/marketData.ts)',
  updatedAt: 0,
  refreshedFromProvider: false,
};

// Store in globalThis so the cache is shared across Next.js route-handler
// module instances (each route may get its own module bundle).
const GKEY = '__rizqflow_market_snapshot__';
function getCache(): ServerMarketSnapshot {
  const g = globalThis as unknown as Record<string, ServerMarketSnapshot | undefined>;
  if (!g[GKEY]) g[GKEY] = { ...SEED };
  return g[GKEY] as ServerMarketSnapshot;
}
function setCache(v: ServerMarketSnapshot) {
  const g = globalThis as unknown as Record<string, ServerMarketSnapshot | undefined>;
  g[GKEY] = v;
}

export function getServerMarketSnapshot(): ServerMarketSnapshot {
  return getCache();
}

export function isProviderConfigured(): boolean {
  return Boolean(process.env.MARKET_SNAPSHOT_PROVIDER_URL);
}

function validateRates(raw: unknown): MarketRatesConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (k: keyof MarketRatesConfig, min: number, max: number, fallback: number) => {
    const v = r[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  };
  return {
    petrolPricePerLitre: num('petrolPricePerLitre', 100, 1000, DEFAULT_MARKET_RATES.petrolPricePerLitre),
    goldPerTolaPkr: num('goldPerTolaPkr', 100000, 2000000, DEFAULT_MARKET_RATES.goldPerTolaPkr),
    usdToPkr: num('usdToPkr', 100, 1000, DEFAULT_MARKET_RATES.usdToPkr),
    gridRatePerKwh: num('gridRatePerKwh', 10, 200, DEFAULT_MARKET_RATES.gridRatePerKwh),
    kse100Index: num('kse100Index', 1000, 1000000, DEFAULT_MARKET_RATES.kse100Index),
    solarNetMeteringLegacyRate: num('solarNetMeteringLegacyRate', 1, 100, DEFAULT_MARKET_RATES.solarNetMeteringLegacyRate),
    solarNetBilling2026Rate: num('solarNetBilling2026Rate', 1, 100, DEFAULT_MARKET_RATES.solarNetBilling2026Rate),
    lastUpdated: typeof r.lastUpdated === 'string' ? r.lastUpdated.slice(0, 40) : new Date().toISOString().slice(0, 10),
  };
}

export async function refreshMarketSnapshot(): Promise<{ ok: boolean; error?: string; snapshot: ServerMarketSnapshot }> {
  const url = process.env.MARKET_SNAPSHOT_PROVIDER_URL;
  if (!url) {
    return { ok: false, error: 'No market-data provider configured (set MARKET_SNAPSHOT_PROVIDER_URL).', snapshot: getCache() };
  }
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { ok: false, error: `Provider returned ${res.status}.`, snapshot: getCache() };
    }
    const json = await res.json();
    const rates = validateRates(json?.rates ?? json);
    if (!rates) {
      return { ok: false, error: 'Provider payload failed validation.', snapshot: getCache() };
    }
    const silver =
      typeof json?.silverPerTolaPkr === 'number' && json.silverPerTolaPkr > 0
        ? json.silverPerTolaPkr
        : getCache().silverPerTolaPkr;
    const asOf =
      typeof json?.dataAsOf === 'string' && json.dataAsOf.trim()
        ? json.dataAsOf.trim().slice(0, 120)
        : `Refreshed ${new Date().toISOString().slice(0, 16)} UTC`;
    const source =
      typeof json?.source === 'string' && json.source.trim()
        ? json.source.trim().slice(0, 240)
        : 'configured provider (MARKET_SNAPSHOT_PROVIDER_URL)';
    const next: ServerMarketSnapshot = {
      rates,
      silverPerTolaPkr: silver,
      kse100ChangePts: typeof json?.kse100ChangePts === 'number' ? json.kse100ChangePts : getCache().kse100ChangePts,
      kse100ChangePct: typeof json?.kse100ChangePct === 'number' ? json.kse100ChangePct : getCache().kse100ChangePct,
      dataAsOf: asOf,
      source,
      updatedAt: Date.now(),
      refreshedFromProvider: true,
    };
    setCache(next);
    return { ok: true, snapshot: next };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Refresh failed.', snapshot: getCache() };
  }
}
