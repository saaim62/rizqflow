import { MarketRatesConfig, UserProfile } from '@/types';

const STORAGE_KEY = 'rizqflow_custom_market_rates';

/**
 * Pakistan economic defaults — seeded reference values as of November 27, 2026 (see DATA_AS_OF in src/data/marketData.ts).
 */
export const DEFAULT_MARKET_RATES: MarketRatesConfig = {
  petrolPricePerLitre: 313,
  goldPerTolaPkr: 390136,
  usdToPkr: 276.42,
  gridRatePerKwh: 55,
  kse100Index: 177664,
  solarNetMeteringLegacyRate: 26,
  solarNetBilling2026Rate: 11,
  lastUpdated: '2026-11-27',
};

// ---------------------------------------------------------------------------
// Stale-seed migration (Forgewarden NOTES #13): profiles and custom rates
// saved by older builds carry the pre-fix seed values below. An EXACT match
// with a known stale seed is healed to the current verified default on load;
// any other value is treated as a deliberate user choice and left untouched.
// ---------------------------------------------------------------------------
const STALE_SEED_VALUES: Partial<Record<keyof MarketRatesConfig, number[]>> = {
  petrolPricePerLitre: [265, 322, 319, 318, 314],
  goldPerTolaPkr: [385000, 379836, 376336, 384136, 385436, 373936, 378636],
  usdToPkr: [276.28, 276.51, 276.47, 276.46, 276.45],
};

export function migrateStaleSeedValues<T extends object>(obj: T): T {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  (Object.keys(STALE_SEED_VALUES) as (keyof MarketRatesConfig)[]).forEach((k) => {
    const v = out[k as string];
    if (typeof v === 'number' && STALE_SEED_VALUES[k]?.includes(v)) {
      out[k as string] = DEFAULT_MARKET_RATES[k];
    }
  });
  return out as T;
}

const CUSTOM_KEYS_STORAGE = 'rizqflow_custom_rate_keys';

export function getCustomRateKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_KEYS_STORAGE) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function recordCustomRateKeys(keys: string[]) {
  if (typeof window === 'undefined' || keys.length === 0) return;
  try {
    const merged = Array.from(new Set([...getCustomRateKeys(), ...keys]));
    window.localStorage.setItem(CUSTOM_KEYS_STORAGE, JSON.stringify(merged));
  } catch {}
}

/**
 * Returns default baseline market rates.
 */
export function getDefaultMarketRates(): MarketRatesConfig {
  return { ...DEFAULT_MARKET_RATES };
}

/**
 * Load user-customized market rates from localStorage, falling back to defaults.
 */
export function loadCustomMarketRates(): MarketRatesConfig {
  if (typeof window === 'undefined') {
    return getDefaultMarketRates();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultMarketRates();
    const parsed = JSON.parse(raw);
    const merged: MarketRatesConfig = {
      petrolPricePerLitre:
        typeof parsed.petrolPricePerLitre === 'number' && parsed.petrolPricePerLitre > 0
          ? parsed.petrolPricePerLitre
          : DEFAULT_MARKET_RATES.petrolPricePerLitre,
      goldPerTolaPkr:
        typeof parsed.goldPerTolaPkr === 'number' && parsed.goldPerTolaPkr > 0
          ? parsed.goldPerTolaPkr
          : DEFAULT_MARKET_RATES.goldPerTolaPkr,
      usdToPkr:
        typeof parsed.usdToPkr === 'number' && parsed.usdToPkr > 0
          ? parsed.usdToPkr
          : DEFAULT_MARKET_RATES.usdToPkr,
      gridRatePerKwh:
        typeof parsed.gridRatePerKwh === 'number' && parsed.gridRatePerKwh > 0
          ? parsed.gridRatePerKwh
          : DEFAULT_MARKET_RATES.gridRatePerKwh,
      kse100Index:
        typeof parsed.kse100Index === 'number' && parsed.kse100Index > 0
          ? parsed.kse100Index
          : DEFAULT_MARKET_RATES.kse100Index,
      solarNetMeteringLegacyRate:
        typeof parsed.solarNetMeteringLegacyRate === 'number' && parsed.solarNetMeteringLegacyRate > 0
          ? parsed.solarNetMeteringLegacyRate
          : DEFAULT_MARKET_RATES.solarNetMeteringLegacyRate,
      solarNetBilling2026Rate:
        typeof parsed.solarNetBilling2026Rate === 'number' && parsed.solarNetBilling2026Rate > 0
          ? parsed.solarNetBilling2026Rate
          : DEFAULT_MARKET_RATES.solarNetBilling2026Rate,
      lastUpdated: parsed.lastUpdated || DEFAULT_MARKET_RATES.lastUpdated,
    };
    return migrateStaleSeedValues(merged);
  } catch {
    return getDefaultMarketRates();
  }
}

/**
 * Save customized market rates to client localStorage.
 */
export function saveCustomMarketRates(overrides: Partial<MarketRatesConfig>): MarketRatesConfig {
  recordCustomRateKeys(Object.keys(overrides));
  const current = loadCustomMarketRates();
  const updated: MarketRatesConfig = {
    ...current,
    ...overrides,
    lastUpdated: DEFAULT_MARKET_RATES.lastUpdated,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save custom market rates to localStorage', err);
    }
  }
  return updated;
}

/**
 * Reset market rates to official defaults.
 */
export function resetMarketRates(): MarketRatesConfig {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(CUSTOM_KEYS_STORAGE);
    } catch {}
  }
  return getDefaultMarketRates();
}

/**
 * Applies configured live market rates into a UserProfile.
 */
export function applyRatesToProfile(
  profile: UserProfile,
  rates: MarketRatesConfig = loadCustomMarketRates()
): UserProfile {
  return {
    ...profile,
    petrolPricePerLitre: rates.petrolPricePerLitre,
    goldPerTolaPkr: rates.goldPerTolaPkr,
    usdToPkr: rates.usdToPkr,
    gridRatePerKwh: rates.gridRatePerKwh,
  };
}
