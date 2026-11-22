import {
  AssetBucket,
  HoldingItem,
  LiabilityItem,
  LifeGoal,
  UserProfile,
  VehicleCandidate,
} from '@/types';

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
 * Strict boolean parser: returns true for true/'true', false for false/'false',
 * or fallback for any other/unrecognized value.
 */
function parseStrictBoolean(val: any, fallbackVal: boolean): boolean {
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return fallbackVal;
}

function cleanText(val: any, max: number): string {
  return typeof val === 'string' ? val.slice(0, max) : '';
}

const VALID_BUCKET_IDS: AssetBucket['id'][] = [
  'psx-dividends',
  'gold',
  'real-estate',
  'money-market',
  'cash',
];

function sanitizeAssetBuckets(raw: any, fallback: AssetBucket[]): AssetBucket[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map((b: any, i: number) => {
    const id = VALID_BUCKET_IDS.includes(b?.id)
      ? b.id
      : (VALID_BUCKET_IDS[i % VALID_BUCKET_IDS.length] as AssetBucket['id']);
    return {
      id,
      label: cleanText(b?.label, 120) || id,
      currentValuePkr: clamp(b?.currentValuePkr, 0, 1_000_000_000, 0),
      monthlySplitPct: clamp(b?.monthlySplitPct, 0, 100, 0),
      expectedAnnualReturnPct: clamp(b?.expectedAnnualReturnPct, 0, 100, 0),
    };
  });
}

function sanitizeLifeGoals(raw: any, fallback: LifeGoal[], profileAge: number): LifeGoal[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map((g: any, i: number) => ({
    id: cleanText(g?.id, 64) || `goal-${i}`,
    name: cleanText(g?.name, 120) || 'Life Goal',
    targetAge: clamp(g?.targetAge, profileAge, 100, profileAge + 5),
    costInTodaysPkr: clamp(g?.costInTodaysPkr, 0, 10_000_000_000, 0),
  }));
}

const VALID_FUEL_TYPES: VehicleCandidate['fuelType'][] = ['petrol', 'ev', 'e-scooty'];

function sanitizeVehicles(raw: any, fallback: VehicleCandidate[]): VehicleCandidate[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map((v: any, i: number) => {
    const fuelType: VehicleCandidate['fuelType'] = VALID_FUEL_TYPES.includes(v?.fuelType)
      ? v.fuelType
      : 'petrol';
    const vehicle: VehicleCandidate = {
      id: cleanText(v?.id, 64) || `veh-${i}`,
      name: cleanText(v?.name, 120) || 'Vehicle',
      fuelType,
      pricePkr: clamp(v?.pricePkr, 0, 1_000_000_000, 0),
      fiveYearDepreciationPct: clamp(v?.fiveYearDepreciationPct, 0, 100, 35),
      annualMaintenancePkr: clamp(v?.annualMaintenancePkr, 0, 10_000_000, 30000),
    };

    if (v?.isCurrentVehicle === true || v?.isCurrentVehicle === 'true') {
      vehicle.isCurrentVehicle = true;
    }

    if (fuelType === 'petrol') {
      vehicle.kmPerLitre = clamp(v?.kmPerLitre, 0.1, 200, 14);
    } else {
      vehicle.kwhPer100Km = clamp(
        v?.kwhPer100Km,
        0.1,
        200,
        fuelType === 'e-scooty' ? 3.5 : 14
      );
    }

    if (v?.emiQuote && typeof v.emiQuote === 'object') {
      vehicle.emiQuote = {
        enabled: parseStrictBoolean(v.emiQuote.enabled, false),
        downPaymentPkr: clamp(v.emiQuote.downPaymentPkr, 0, 1_000_000_000, 0),
        monthlyInstallmentPkr: clamp(v.emiQuote.monthlyInstallmentPkr, 0, 100_000_000, 0),
        tenureMonths: clamp(v.emiQuote.tenureMonths, 1, 120, 36),
      };
    }

    return vehicle;
  });
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
    isBreadwinner: parseStrictBoolean(clean.isBreadwinner, fallback.isBreadwinner),
    monthlyIncomePkr: clamp(clean.monthlyIncomePkr, 0, 100_000_000, fallback.monthlyIncomePkr),
    annualSalaryRaisePct: clamp(clean.annualSalaryRaisePct, 0, 50, fallback.annualSalaryRaisePct),
    lumpSumPkr: clamp(clean.lumpSumPkr, 0, 1_000_000_000, fallback.lumpSumPkr),
    monthlyInvestPkr: clamp(clean.monthlyInvestPkr, 0, 100_000_000, fallback.monthlyInvestPkr),
    currentCashReservePkr: clamp(
      clean.currentCashReservePkr,
      -1_000_000_000,
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
    shariahOnly: parseStrictBoolean(clean.shariahOnly, fallback.shariahOnly),
    includeZakat: parseStrictBoolean(clean.includeZakat, fallback.includeZakat),
    reinvestDividends: parseStrictBoolean(clean.reinvestDividends, fallback.reinvestDividends),
    inflationAdjusted: parseStrictBoolean(clean.inflationAdjusted, fallback.inflationAdjusted),
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
    assetBuckets: sanitizeAssetBuckets(clean.assetBuckets, fallback.assetBuckets),
    lifeGoals: sanitizeLifeGoals(clean.lifeGoals, fallback.lifeGoals, age),
    vehicles: sanitizeVehicles(clean.vehicles, fallback.vehicles),
    holdings: sanitizeHoldings(clean.holdings),
    liabilities: sanitizeLiabilities(clean.liabilities),
    appliedCarSwapKey:
      typeof clean.appliedCarSwapKey === 'string'
        ? cleanText(clean.appliedCarSwapKey, 128)
        : undefined,
    currentVehicleType:
      typeof clean.currentVehicleType === 'string'
        ? cleanText(clean.currentVehicleType, 32)
        : undefined,
    currentVehicleResalePkr:
      typeof clean.currentVehicleResalePkr === 'number'
        ? clamp(clean.currentVehicleResalePkr, 0, 1_000_000_000, 0)
        : undefined,
  };
}

const HOLDING_KINDS = ['gold', 'fund', 'real-estate', 'bank', 'stock', 'other'];

/** Item-level holdings (NOTES #23): validate shape, clamp amounts. */
function sanitizeHoldings(raw: any): HoldingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((h: any, i: number) => ({
    id: typeof h?.id === 'string' && h.id ? h.id.slice(0, 64) : `holding-${i}`,
    kind: HOLDING_KINDS.includes(h?.kind) ? h.kind : 'other',
    label: cleanText(h?.label, 120) || 'Item',
    valuePkr: clamp(h?.valuePkr, 0, 1_000_000_000, 0),
    quantity:
      typeof h?.quantity === 'number' && h.quantity > 0 ? Math.min(h.quantity, 1_000_000_000) : undefined,
    unitLabel: cleanText(h?.unitLabel, 16) || undefined,
    unitPricePkr:
      typeof h?.unitPricePkr === 'number' && h.unitPricePkr > 0
        ? Math.min(h.unitPricePkr, 1_000_000_000)
        : undefined,
    purityKarat:
      typeof h?.purityKarat === 'number' && h.purityKarat > 0 ? Math.min(h.purityKarat, 24) : undefined,
    details: cleanText(h?.details, 300) || undefined,
  }));
}

const LIABILITY_CATEGORIES = [
  'mortgage',
  'vehicle-loan',
  'education-loan',
  'personal-loan',
  'credit-card',
  'bnpl',
  'medical',
  'tax',
  'family-loan',
  'other',
];
const LIABILITY_KINDS = ['amortizing', 'revolving', 'balloon'];

/** Optional clamped number: undefined unless a finite number was supplied. */
function clampOptional(val: any, min: number, max: number): number | undefined {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.min(Math.max(val, min), max)
    : undefined;
}

function cleanDueDate(val: any): string | undefined {
  if (typeof val !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
  if (!m) return undefined;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return val.slice(0, 10);
}

/**
 * Declared liabilities (NOTES #23; scheduled shape NOTES #45): validate
 * shape, deep-clamp amounts, reject unknown category/kind values.
 * The canonical scheduled fields (`name`, `balancePkr`) and the legacy
 * mirrors (`label`, `amountPkr`) are synced from whichever side supplied
 * a value, so old and new consumers read the same numbers. An entry with
 * an unknown kind keeps its balance as a position but loses the kind —
 * it is never scheduled on a guessed basis. No NaN/Infinity survives:
 * every numeric field passes through clamp/clampOptional.
 */
function sanitizeLiabilities(raw: any): LiabilityItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((l: any, i: number) => {
    const name = cleanText(l?.name, 120) || cleanText(l?.label, 120) || 'Liability';
    const balanceRaw =
      typeof l?.balancePkr === 'number' && Number.isFinite(l.balancePkr)
        ? l.balancePkr
        : l?.amountPkr;
    const balance = clamp(balanceRaw, 0, 1_000_000_000, 0);
    const kind = LIABILITY_KINDS.includes(l?.kind) ? l.kind : undefined;
    const item: LiabilityItem = {
      id: typeof l?.id === 'string' && l.id ? l.id.slice(0, 64) : `liability-${i}`,
      name,
      label: name,
      balancePkr: balance,
      amountPkr: balance,
      category: LIABILITY_CATEGORIES.includes(l?.category) ? l.category : undefined,
      kind,
      // A schedule only exists with a valid kind; kind-specific fields are
      // kept only for the kind they belong to.
      aprPct: kind ? clamp(l?.aprPct, 0, 100, 0) : clampOptional(l?.aprPct, 0, 100),
      monthlyPaymentPkr:
        kind === 'amortizing' ? clampOptional(l?.monthlyPaymentPkr, 0, 100_000_000) : undefined,
      minPaymentPctOfBalance:
        kind === 'revolving' ? clampOptional(l?.minPaymentPctOfBalance, 0, 100) : undefined,
      dueDateISO:
        kind === 'balloon' || kind === 'amortizing' ? cleanDueDate(l?.dueDateISO) : undefined,
      details: cleanText(l?.details, 300) || undefined,
    };
    return item;
  });
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
