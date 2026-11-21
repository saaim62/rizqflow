import { MarketRatesConfig, UserProfile } from '@/types';

const STORAGE_KEY = 'rizqflow_custom_market_rates';

/**
 * Pakistan economic defaults — seeded reference values as of November 21, 2026 (see DATA_AS_OF in src/data/marketData.ts).
 */
export const DEFAULT_MARKET_RATES: MarketRatesConfig = {
  petrolPricePerLitre: 322,
  goldPerTolaPkr: 379836,
  usdToPkr: 276.51,
  gridRatePerKwh: 55,
  kse100Index: 177382,
  solarNetMeteringLegacyRate: 26,
  solarNetBilling2026Rate: 11,
  lastUpdated: '2026-11-21',
};

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
    return {
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
  } catch {
    return getDefaultMarketRates();
  }
}

/**
 * Save customized market rates to client localStorage.
 */
export function saveCustomMarketRates(overrides: Partial<MarketRatesConfig>): MarketRatesConfig {
  const current = loadCustomMarketRates();
  const updated: MarketRatesConfig = {
    ...current,
    ...overrides,
    lastUpdated: new Date().toISOString().slice(0, 10),
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
