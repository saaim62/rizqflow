import { UserProfile } from '@/types';

const STORAGE_KEY = 'rizqflow_user_profile_v2';

/**
 * Remove dangerous prototype pollution keys recursively.
 */
function sanitizeObjectDeep<T>(obj: any): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectDeep(item)) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = sanitizeObjectDeep(obj[key]);
  }
  return clean as T;
}

/**
 * Clamps a number within [min, max].
 */
function clamp(val: any, min: number, max: number, defaultVal: number): number {
  const n = typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : defaultVal;
  return Math.min(Math.max(n, min), max);
}

/**
 * Validates and clamps a raw parsed profile object against standard boundaries.
 */
export function sanitizeProfile(raw: any, fallback: UserProfile): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const clean = sanitizeObjectDeep<Record<string, any>>(raw);

  const age = clamp(clean.age, 16, 85, fallback.age);
  const retirementAge = clamp(clean.retirementAge, age + 1, 95, fallback.retirementAge);

  const expenses = clean.expenses && typeof clean.expenses === 'object' ? clean.expenses : {};

  return {
    role: ['student', 'salaried', 'business', 'freelancer'].includes(clean.role)
      ? clean.role
      : fallback.role,
    gender: clean.gender === 'female' ? 'female' : 'male',
    age,
    retirementAge,
    maritalStatus: clean.maritalStatus === 'married' ? 'married' : 'unmarried',
    familyMembers: clamp(clean.familyMembers, 1, 30, fallback.familyMembers),
    isBreadwinner: Boolean(clean.isBreadwinner ?? fallback.isBreadwinner),
    monthlyIncomePkr: clamp(clean.monthlyIncomePkr, 0, 100_000_000, fallback.monthlyIncomePkr),
    annualSalaryRaisePct: clamp(clean.annualSalaryRaisePct, 0, 50, fallback.annualSalaryRaisePct),
    lumpSumPkr: clamp(clean.lumpSumPkr, 0, 1_000_000_000, fallback.lumpSumPkr),
    monthlyInvestPkr: clamp(clean.monthlyInvestPkr, 0, 100_000_000, fallback.monthlyInvestPkr),
    currentCashReservePkr: clamp(
      clean.currentCashReservePkr,
      0,
      1_000_000_000,
      fallback.currentCashReservePkr
    ),
    expenses: {
      fuelAndCommute: clamp(expenses.fuelAndCommute, 0, 50_000_000, fallback.expenses.fuelAndCommute),
      utilitiesAndInternet: clamp(
        expenses.utilitiesAndInternet,
        0,
        50_000_000,
        fallback.expenses.utilitiesAndInternet
      ),
      groceriesAndFood: clamp(
        expenses.groceriesAndFood,
        0,
        50_000_000,
        fallback.expenses.groceriesAndFood
      ),
      rentOrHousing: clamp(expenses.rentOrHousing, 0, 50_000_000, fallback.expenses.rentOrHousing),
      familyAndOther: clamp(expenses.familyAndOther, 0, 50_000_000, fallback.expenses.familyAndOther),
    },
    taxStatus: clean.taxStatus === 'non-filer' ? 'non-filer' : 'filer',
    shariahOnly: Boolean(clean.shariahOnly ?? fallback.shariahOnly),
    includeZakat: Boolean(clean.includeZakat ?? fallback.includeZakat),
    reinvestDividends: Boolean(clean.reinvestDividends ?? fallback.reinvestDividends),
    inflationAdjusted: Boolean(clean.inflationAdjusted ?? fallback.inflationAdjusted),
    annualInflationPct: clamp(clean.annualInflationPct, 0, 40, fallback.annualInflationPct),
    dividendGrowthPct: clamp(clean.dividendGrowthPct, 0, 40, fallback.dividendGrowthPct),
    opportunityCostReturnPct: clamp(
      clean.opportunityCostReturnPct,
      0,
      30,
      fallback.opportunityCostReturnPct
    ),
    usdToPkr: clamp(clean.usdToPkr, 100, 1000, fallback.usdToPkr),
    goldPerTolaPkr: clamp(clean.goldPerTolaPkr, 100000, 2000000, fallback.goldPerTolaPkr),
    petrolPricePerLitre: clamp(clean.petrolPricePerLitre, 100, 1000, fallback.petrolPricePerLitre),
    gridRatePerKwh: clamp(clean.gridRatePerKwh, 10, 200, fallback.gridRatePerKwh),
    solarKw: clamp(clean.solarKw, 0, 100, fallback.solarKw),
    solarTariffMode: ['none', 'net-billing-2026', 'net-metering-legacy'].includes(clean.solarTariffMode)
      ? clean.solarTariffMode
      : fallback.solarTariffMode,
    dailyCommuteKm: clamp(clean.dailyCommuteKm, 0, 500, fallback.dailyCommuteKm),
    assetBuckets: Array.isArray(clean.assetBuckets) ? clean.assetBuckets : fallback.assetBuckets,
    lifeGoals: Array.isArray(clean.lifeGoals) ? clean.lifeGoals : fallback.lifeGoals,
    vehicles: Array.isArray(clean.vehicles) ? clean.vehicles : fallback.vehicles,
  };
}

/**
 * Save user profile to client localStorage.
 */
export function saveProfileToStorage(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(profile);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.error('Failed to save profile to localStorage', err);
  }
}

/**
 * Load user profile from client localStorage.
 */
export function loadProfileFromStorage(fallback: UserProfile): UserProfile {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return sanitizeProfile(parsed, fallback);
  } catch (err) {
    console.error('Failed to load profile from localStorage', err);
    return fallback;
  }
}

/**
 * Encodes a user profile into a safe URL hash string.
 */
export function encodeProfileToHash(profile: UserProfile): string {
  try {
    const json = JSON.stringify(profile);
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      const b64 = window.btoa(encodeURIComponent(json));
      return `#plan=${b64}`;
    }
    const b64 = Buffer.from(encodeURIComponent(json)).toString('base64');
    return `#plan=${b64}`;
  } catch (err) {
    console.error('Failed to encode profile to hash', err);
    return '';
  }
}

/**
 * Decodes a user profile from a URL hash string.
 * Protected against prototype pollution and invalid schemas.
 */
export function decodeProfileFromHash(
  hash: string,
  fallback: UserProfile
): UserProfile | null {
  if (!hash) return null;
  try {
    const cleanHash = hash.replace(/^#/, '');
    const match = cleanHash.match(/(?:^|&)plan=([^&]+)/);
    const b64 = match ? match[1] : cleanHash;
    if (!b64) return null;

    let json = '';
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      json = decodeURIComponent(window.atob(b64));
    } else {
      json = decodeURIComponent(Buffer.from(b64, 'base64').toString('utf-8'));
    }

    const parsed = JSON.parse(json);
    return sanitizeProfile(parsed, fallback);
  } catch (err) {
    console.error('Failed to decode profile from hash', err);
    return null;
  }
}
