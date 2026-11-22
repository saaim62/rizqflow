import {
  AssetBucket,
  FieldMappingEntry,
  ForeignMappingResult,
  HoldingItem,
  LiabilityItem,
  LifeGoal,
  MappingConfidence,
  PortfolioExportAll,
  PortfolioExportEnvelope,
  PortfolioExportSingle,
  UserProfile,
  VehicleCandidate,
} from '@/types';
import { sanitizeProfile } from '@/lib/stateUrl';
import { PRESET_PROFILES } from '@/data/marketData';

/**
 * Returns a safe default UserProfile (Junior Software Engineer preset).
 */
export function getDefaultFallbackProfile(): UserProfile {
  const p = PRESET_PROFILES[0];
  return (p?.profile || p) as UserProfile;
}

/**
 * Remove dangerous prototype pollution keys recursively.
 */
export function sanitizeDeep<T>(obj: any): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeDeep(item)) as unknown as T;
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = sanitizeDeep(obj[key]);
  }
  return clean as T;
}

// ---------------------------------------------------------------------------
// 1. Native Envelope Building & Parsing
// ---------------------------------------------------------------------------

/**
 * Creates a native single-portfolio export envelope.
 */
export function createNativeExportEnvelope(portfolio: {
  name: string;
  profile: UserProfile;
}): PortfolioExportSingle {
  return {
    app: 'RizqFlow',
    kind: 'portfolio-export',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    name: portfolio.name,
    profile: sanitizeDeep<UserProfile>(portfolio.profile),
  };
}

/**
 * Creates a native all-portfolios export envelope.
 */
export function createAllPortfoliosExportEnvelope(
  portfolios: { name: string; profile: UserProfile }[]
): PortfolioExportAll {
  return {
    app: 'RizqFlow',
    kind: 'portfolio-export',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    portfolios: portfolios.map((p) => ({
      name: p.name,
      profile: sanitizeDeep<UserProfile>(p.profile),
    })),
  };
}

/**
 * Type guard: checks if raw data matches either single or multi portfolio envelope structure.
 */
export function isNativePortfolioEnvelope(data: unknown): data is PortfolioExportEnvelope {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, any>;
  if (d.app !== 'RizqFlow' || d.kind !== 'portfolio-export' || d.formatVersion !== 1) {
    return false;
  }
  const isSingle = typeof d.name === 'string' && d.profile && typeof d.profile === 'object';
  const isAll = Array.isArray(d.portfolios);
  return isSingle || isAll;
}

export function isSinglePortfolioEnvelope(data: unknown): data is PortfolioExportSingle {
  return isNativePortfolioEnvelope(data) && typeof (data as any).name === 'string';
}

export function isAllPortfoliosEnvelope(data: unknown): data is PortfolioExportAll {
  return isNativePortfolioEnvelope(data) && Array.isArray((data as any).portfolios);
}

/**
 * Parses and validates native portfolio export JSON (string or object).
 * Sanitizes all profiles using sanitizeProfile() and strips prototype pollution.
 */
export function parseNativeExport(
  content: string | unknown,
  fallbackProfile: UserProfile = getDefaultFallbackProfile()
): { success: true; portfolios: { name: string; profile: UserProfile }[] } | { success: false; error: string } {
  let parsed: unknown;
  if (typeof content === 'string') {
    // Basic length guard: prevent parsing unreasonably huge payloads client-side (> 15 MB)
    if (content.length > 15 * 1024 * 1024) {
      return { success: false, error: 'Payload exceeds maximum allowed size (15 MB)' };
    }
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'Malformed JSON payload' };
    }
  } else {
    parsed = content;
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Invalid payload: expected JSON object' };
  }

  const clean = sanitizeDeep<Record<string, any>>(parsed);

  if (clean.app !== 'RizqFlow') {
    return { success: false, error: 'Invalid app signature: expected RizqFlow export' };
  }
  if (clean.kind !== 'portfolio-export') {
    return { success: false, error: 'Invalid export kind: expected portfolio-export' };
  }
  if (clean.formatVersion !== 1) {
    return { success: false, error: `Unsupported format version: ${clean.formatVersion}` };
  }

  const results: { name: string; profile: UserProfile }[] = [];

  // Single envelope
  if (typeof clean.name === 'string' && clean.profile && typeof clean.profile === 'object') {
    const portfolioName = clean.name.trim() || 'Imported Portfolio';
    const profile = sanitizeProfile(clean.profile, fallbackProfile);
    results.push({ name: portfolioName, profile });
    return { success: true, portfolios: results };
  }

  // All portfolios envelope
  if (Array.isArray(clean.portfolios)) {
    for (let i = 0; i < clean.portfolios.length; i++) {
      const item = clean.portfolios[i];
      if (!item || typeof item !== 'object') continue;
      const portfolioName =
        typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : `Imported Portfolio ${i + 1}`;
      const profile = sanitizeProfile(item.profile, fallbackProfile);
      results.push({ name: portfolioName, profile });
    }

    if (results.length === 0) {
      return { success: false, error: 'No valid portfolios found in export envelope' };
    }
    return { success: true, portfolios: results };
  }

  return { success: false, error: 'Envelope missing portfolio payload' };
}

// ---------------------------------------------------------------------------
// 2. Client-side CSV Parser & Numeric Cleaner
// ---------------------------------------------------------------------------

/**
 * Cleans string numbers, handling commas, currency symbols, and Pakistani Lac/Crore units.
 * Examples:
 *   "Rs 30 Lac" -> 3,000,000
 *   "1.5 Crore" -> 15,000,000
 *   "250k" -> 250,000
 *   "$50,000" -> 50,000
 *   "-15,000" or "(15,000)" -> -15,000
 *   "8.5%" -> 8.5
 */
export function parseCleanNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? null : val;
  }
  if (typeof val !== 'string') return null;

  let s = val.trim();
  if (!s) return null;

  let isNegative = false;

  const cleanSign = () => {
    let changed = true;
    while (changed) {
      changed = false;
      s = s.trim();
      if (s.startsWith('(') && s.endsWith(')')) {
        isNegative = true;
        s = s.slice(1, -1).trim();
        changed = true;
      }
      if (s.startsWith('-')) {
        isNegative = true;
        s = s.slice(1).trim();
        changed = true;
      }
      if (s.startsWith('+')) {
        s = s.slice(1).trim();
        changed = true;
      }
    }
  };

  // Strip leading minus, plus, or accounting parentheses before currency prefix
  cleanSign();

  // Strip currency prefixes
  s = s.replace(/^(?:Rs\.?|PKR|\$|USD)\s*/i, '').trim();

  // Strip minus, plus, or accounting parentheses after currency prefix (e.g. 'Rs. -30 Lac')
  cleanSign();

  s = s.replace(/,/g, '').trim();

  // Strip trailing non-numeric units like km, kw, tolas, etc.
  s = s.replace(/\s*(?:km|kw|tolas?|sqft|yr|years?)$/i, '').trim();

  // Handle Lac / Lakh / Lacs
  const lacMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:lacs?|lakhs?)$/i);
  if (lacMatch) {
    const num = parseFloat(lacMatch[1]) * 100_000;
    return isNegative ? -num : num;
  }

  // Handle Crore / Cr
  const croreMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(?:crores?|cr)$/i);
  if (croreMatch) {
    const num = parseFloat(croreMatch[1]) * 10_000_000;
    return isNegative ? -num : num;
  }

  // Handle Thousands: 'k' or 'kilo'
  const kMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*k$/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1]) * 1_000;
    return isNegative ? -num : num;
  }

  // Handle Percentage: '8.5%' -> 8.5
  const pctMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    return isNegative ? -num : num;
  }

  const parsed = parseFloat(s);
  if (isNaN(parsed) || !isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

/**
 * Tokenizes a single CSV line, respecting double quotes, commas within quotes, and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses raw CSV text into an array of row objects keyed by the header row.
 */
export function parseCsvRows(csvText: string): Record<string, string>[] {
  if (!csvText || typeof csvText !== 'string') return [];

  // Split by CRLF or LF
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.replace(/^["']|["']$/g, '').trim()
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    let values = parseCsvLine(lines[i]);

    // In 2-column key-value CSVs, join remainder if value had unquoted commas (e.g. "Rent,40,000")
    if (headers.length === 2 && values.length > 2) {
      values = [values[0], values.slice(1).join(',')];
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        row[header] = values[j] !== undefined ? values[j].replace(/^["']|["']$/g, '').trim() : '';
      }
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Intelligently converts CSV text into a flat Record<string, any>.
 * Supports:
 *  1. Two-column Key/Value format (e.g. "Field,Value" or "Parameter,Amount")
 *  2. Single data row table with multiple column headers
 *  3. Multiple category rows (e.g. "Category,Amount") flattened by category
 */
export function parseCsvToRecord(csvText: string): Record<string, any> {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return {};

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  // If exactly 2 columns, it might be a vertical Key-Value list
  if (keys.length === 2) {
    const keyCol = keys[0];
    const valCol = keys[1];
    const record: Record<string, any> = {};
    for (const r of rows) {
      const k = r[keyCol]?.trim();
      const v = r[valCol]?.trim();
      if (k) {
        record[k] = v;
      }
    }
    return record;
  }

  // If 1 data row, return its key-value map directly
  if (rows.length === 1) {
    return { ...firstRow };
  }

  // If multiple data rows with multiple columns, combine them into a merged record
  const merged: Record<string, any> = {};
  for (let i = 0; i < rows.length; i++) {
    for (const k of keys) {
      const v = rows[i][k];
      if (v) {
        const fullKey = rows.length > 1 ? `${k}_${i + 1}` : k;
        merged[fullKey] = v;
      }
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// 3. Foreign Schema Descriptor (Single Source of Truth)
// ---------------------------------------------------------------------------

export interface FieldDescriptor {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'enum';
  description: string;
  allowedEnums?: string[];
  min?: number;
  max?: number;
  default: any;
}

export const PROFILE_SCHEMA_DESCRIPTOR: FieldDescriptor[] = [
  {
    key: 'role',
    type: 'enum',
    description: 'Employment role',
    allowedEnums: ['student', 'salaried', 'business', 'freelancer'],
    default: 'salaried',
  },
  {
    key: 'gender',
    type: 'enum',
    description: 'Gender of user',
    allowedEnums: ['male', 'female'],
    default: 'male',
  },
  {
    key: 'age',
    type: 'number',
    description: 'Current age in years',
    min: 16,
    max: 85,
    default: 28,
  },
  {
    key: 'retirementAge',
    type: 'number',
    description: 'Target retirement age',
    min: 25,
    max: 95,
    default: 55,
  },
  {
    key: 'maritalStatus',
    type: 'enum',
    description: 'Marital status',
    allowedEnums: ['unmarried', 'married'],
    default: 'unmarried',
  },
  {
    key: 'familyMembers',
    type: 'number',
    description: 'Number of family members / dependents',
    min: 1,
    max: 30,
    default: 1,
  },
  {
    key: 'isBreadwinner',
    type: 'boolean',
    description: 'Whether user is primary earner / breadwinner',
    default: true,
  },
  {
    key: 'monthlyIncomePkr',
    type: 'number',
    description: 'Monthly take-home income in PKR',
    min: 0,
    max: 100_000_000,
    default: 200_000,
  },
  {
    key: 'annualSalaryRaisePct',
    type: 'number',
    description: 'Expected annual income raise %',
    min: 0,
    max: 50,
    default: 10,
  },
  {
    key: 'lumpSumPkr',
    type: 'number',
    description: 'Existing lump sum capital available to invest in PKR',
    min: 0,
    max: 1_000_000_000,
    default: 0,
  },
  {
    key: 'monthlyInvestPkr',
    type: 'number',
    description: 'Monthly SIP / amount invested each month in PKR',
    min: 0,
    max: 100_000_000,
    default: 50_000,
  },
  {
    key: 'currentCashReservePkr',
    type: 'number',
    description: 'Emergency fund / liquid cash reserves in PKR (negative if net debt)',
    min: 0,
    max: 1_000_000_000,
    default: 200_000,
  },
  {
    key: 'expenses.fuelAndCommute',
    type: 'number',
    description: 'Monthly fuel, petrol, and commute expense in PKR',
    min: 0,
    max: 50_000_000,
    default: 15_000,
  },
  {
    key: 'expenses.utilitiesAndInternet',
    type: 'number',
    description: 'Monthly electricity, gas, water, internet bills in PKR',
    min: 0,
    max: 50_000_000,
    default: 20_000,
  },
  {
    key: 'expenses.groceriesAndFood',
    type: 'number',
    description: 'Monthly groceries and food expense in PKR',
    min: 0,
    max: 50_000_000,
    default: 30_000,
  },
  {
    key: 'expenses.rentOrHousing',
    type: 'number',
    description: 'Monthly rent or housing expense in PKR',
    min: 0,
    max: 50_000_000,
    default: 15_000,
  },
  {
    key: 'expenses.familyAndOther',
    type: 'number',
    description: 'Monthly family support, entertainment, and misc expenses in PKR',
    min: 0,
    max: 50_000_000,
    default: 10_000,
  },
  {
    key: 'taxStatus',
    type: 'enum',
    description: 'FBR tax filer status in Pakistan',
    allowedEnums: ['filer', 'non-filer'],
    default: 'filer',
  },
  {
    key: 'shariahOnly',
    type: 'boolean',
    description: 'Strict Islamic Shariah-compliant investments only',
    default: true,
  },
  {
    key: 'includeZakat',
    type: 'boolean',
    description: 'Deduct 2.5% annual Zakat on wealth',
    default: false,
  },
  {
    key: 'reinvestDividends',
    type: 'boolean',
    description: 'Automatically reinvest dividend earnings',
    default: true,
  },
  {
    key: 'inflationAdjusted',
    type: 'boolean',
    description: 'Show results adjusted for inflation in today’s purchasing power',
    default: true,
  },
  {
    key: 'annualInflationPct',
    type: 'number',
    description: 'Expected annual inflation % in Pakistan',
    min: 0,
    max: 40,
    default: 8,
  },
  {
    key: 'dividendGrowthPct',
    type: 'number',
    description: 'Expected annual dividend growth rate %',
    min: 0,
    max: 40,
    default: 10,
  },
  {
    key: 'opportunityCostReturnPct',
    type: 'number',
    description: 'Benchmark hurdle rate for capital opportunity cost %',
    min: 0,
    max: 30,
    default: 10,
  },
  {
    key: 'dailyCommuteKm',
    type: 'number',
    description: 'Daily round-trip commute distance in kilometers',
    min: 0,
    max: 500,
    default: 25,
  },
  {
    key: 'solarKw',
    type: 'number',
    description: 'Rooftop solar system installed capacity in kW',
    min: 0,
    max: 100,
    default: 0,
  },
  {
    key: 'solarTariffMode',
    type: 'enum',
    description: 'NEPRA solar export billing mode',
    allowedEnums: ['none', 'net-billing-2026', 'net-metering-legacy'],
    default: 'none',
  },
];

/**
 * Returns schema description text suitable for inclusion in LLM prompt.
 */
export function getProfileSchemaPromptString(): string {
  return PROFILE_SCHEMA_DESCRIPTOR.map((f) => {
    let extra = '';
    if (f.allowedEnums) extra = ` Allowed values: [${f.allowedEnums.map((e) => `"${e}"`).join(', ')}]`;
    if (f.min !== undefined && f.max !== undefined) extra += ` Range: ${f.min} to ${f.max}`;
    return `- ${f.key} (${f.type}): ${f.description}.${extra}`;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// 4. Heuristic Fallback Field Mapper (Pure Function)
// ---------------------------------------------------------------------------

/**
 * Flattens nested JSON object into key-value pairs with dotted paths and leaf names.
 */
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const val = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(flattened, flattenObject(val, path));
    } else {
      flattened[path] = val;
      // Also index by simple leaf name if not already set
      if (!flattened[key]) {
        flattened[key] = val;
      }
    }
  }

  return flattened;
}

/**
 * Normalizes a key for fuzzy comparison: lowercases, strips underscores, dashes, spaces.
 */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps arbitrary foreign key-value pairs to RizqFlow UserProfile fields using pure heuristics.
 * Returns the mapped profile, mapping table with confidence badges, and list of unmapped keys.
 */
export function mapForeignPayloadHeuristic(
  payload: Record<string, any>,
  fallbackProfile: UserProfile = getDefaultFallbackProfile()
): ForeignMappingResult {
  const sanitizedInput = sanitizeDeep<Record<string, any>>(payload);
  const flat = flattenObject(sanitizedInput);

  const cleanProfile: any = JSON.parse(JSON.stringify(fallbackProfile));
  const mapping: FieldMappingEntry[] = [];
  const matchedForeignKeys = new Set<string>();

  // Map of normalized key alias -> target profile field path
  const ALIAS_MAP: { [alias: string]: { target: string; confidence: MappingConfidence; note: string } } = {
    // Income
    salary: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Mapped salary to monthly income' },
    monthlyincome: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Exact match for monthly income' },
    monthlyincomepkr: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Exact match' },
    monthlysalary: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Monthly salary to income' },
    takehome: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Take home pay mapped to income' },
    takehomepay: { target: 'monthlyIncomePkr', confidence: 'high', note: 'Take home pay mapped to income' },
    income: { target: 'monthlyIncomePkr', confidence: 'medium', note: 'Mapped income to monthly income' },
    earnings: { target: 'monthlyIncomePkr', confidence: 'medium', note: 'Mapped earnings to monthly income' },
    pay: { target: 'monthlyIncomePkr', confidence: 'medium', note: 'Mapped pay to monthly income' },

    // Lump Sum / Savings
    lumpsumpkr: { target: 'lumpSumPkr', confidence: 'high', note: 'Exact match' },
    lumpsum: { target: 'lumpSumPkr', confidence: 'high', note: 'Mapped lump sum' },
    lumpsumsavings: { target: 'lumpSumPkr', confidence: 'high', note: 'Lump sum savings mapped' },
    currentsavings: { target: 'lumpSumPkr', confidence: 'high', note: 'Current savings mapped to lump sum' },
    savings: { target: 'lumpSumPkr', confidence: 'medium', note: 'Savings mapped to lump sum' },
    totalsavings: { target: 'lumpSumPkr', confidence: 'high', note: 'Total savings mapped to lump sum' },
    investablecash: { target: 'lumpSumPkr', confidence: 'high', note: 'Investable cash mapped to lump sum' },
    capital: { target: 'lumpSumPkr', confidence: 'medium', note: 'Capital mapped to lump sum' },
    networth: { target: 'lumpSumPkr', confidence: 'low', note: 'Total net worth used as lump sum' },

    // Monthly Investment / SIP
    monthlyinvestpkr: { target: 'monthlyInvestPkr', confidence: 'high', note: 'Exact match' },
    monthlyinvest: { target: 'monthlyInvestPkr', confidence: 'high', note: 'Mapped monthly investment' },
    monthlyinvestment: { target: 'monthlyInvestPkr', confidence: 'high', note: 'Mapped monthly investment' },
    sip: { target: 'monthlyInvestPkr', confidence: 'high', note: 'SIP mapped to monthly investment' },
    monthlysip: { target: 'monthlyInvestPkr', confidence: 'high', note: 'Monthly SIP mapped to monthly investment' },
    monthlysavings: { target: 'monthlyInvestPkr', confidence: 'medium', note: 'Monthly savings mapped to SIP' },
    investment: { target: 'monthlyInvestPkr', confidence: 'low', note: 'Investment mapped to monthly SIP' },

    // Emergency Fund / Cash Reserve
    currentcashreservepkr: { target: 'currentCashReservePkr', confidence: 'high', note: 'Exact match' },
    currentcashreserve: { target: 'currentCashReservePkr', confidence: 'high', note: 'Cash reserve' },
    cashreserve: { target: 'currentCashReservePkr', confidence: 'high', note: 'Cash reserve' },
    emergencyfund: { target: 'currentCashReservePkr', confidence: 'high', note: 'Emergency fund to cash reserve' },
    cash: { target: 'currentCashReservePkr', confidence: 'medium', note: 'Cash mapped to reserve' },
    bankbalance: { target: 'currentCashReservePkr', confidence: 'high', note: 'Bank balance mapped to cash reserve' },
    liquidcash: { target: 'currentCashReservePkr', confidence: 'high', note: 'Liquid cash mapped to reserve' },

    // Demographics
    age: { target: 'age', confidence: 'high', note: 'User age' },
    currentage: { target: 'age', confidence: 'high', note: 'User age' },
    retirementage: { target: 'retirementAge', confidence: 'high', note: 'Retirement age' },
    targetretirement: { target: 'retirementAge', confidence: 'high', note: 'Target retirement age' },
    targetretirementage: { target: 'retirementAge', confidence: 'high', note: 'Target retirement age' },
    gender: { target: 'gender', confidence: 'high', note: 'Gender' },
    sex: { target: 'gender', confidence: 'high', note: 'Gender' },
    maritalstatus: { target: 'maritalStatus', confidence: 'high', note: 'Marital status' },
    role: { target: 'role', confidence: 'high', note: 'Employment role' },
    occupation: { target: 'role', confidence: 'high', note: 'Occupation mapped to role' },
    employment: { target: 'role', confidence: 'high', note: 'Employment mapped to role' },
    employmentstatus: { target: 'role', confidence: 'high', note: 'Employment status mapped to role' },
    familymembers: { target: 'familyMembers', confidence: 'high', note: 'Family size / dependents' },
    dependents: { target: 'familyMembers', confidence: 'high', note: 'Dependents mapped to family size' },
    familysize: { target: 'familyMembers', confidence: 'high', note: 'Family size' },
    householdsize: { target: 'familyMembers', confidence: 'high', note: 'Household size' },
    isbreadwinner: { target: 'isBreadwinner', confidence: 'high', note: 'Breadwinner flag' },
    breadwinner: { target: 'isBreadwinner', confidence: 'high', note: 'Breadwinner flag' },

    // Expenses: Fuel & Commute
    expensesfuelandcommute: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Exact fuel expense' },
    fuelandcommute: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Fuel & commute' },
    fuel: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Fuel expense' },
    petrolexpense: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Petrol expense' },
    commutefuel: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Commute fuel expense' },
    fuelcommute: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Fuel & commute' },
    petrol: { target: 'expenses.fuelAndCommute', confidence: 'medium', note: 'Petrol' },
    commute: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Commute expense' },
    transport: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Transport expense' },
    transportation: { target: 'expenses.fuelAndCommute', confidence: 'high', note: 'Transport expense' },

    // Expenses: Utilities
    expensesutilitiesandinternet: { target: 'expenses.utilitiesAndInternet', confidence: 'high', note: 'Exact utilities' },
    utilitiesandinternet: { target: 'expenses.utilitiesAndInternet', confidence: 'high', note: 'Utilities & internet' },
    utilities: { target: 'expenses.utilitiesAndInternet', confidence: 'high', note: 'Utilities' },
    utilitiesexpense: { target: 'expenses.utilitiesAndInternet', confidence: 'high', note: 'Utilities expense' },
    electricity: { target: 'expenses.utilitiesAndInternet', confidence: 'high', note: 'Electricity bills' },
    bills: { target: 'expenses.utilitiesAndInternet', confidence: 'medium', note: 'Bills mapped to utilities' },
    internet: { target: 'expenses.utilitiesAndInternet', confidence: 'medium', note: 'Internet mapped to utilities' },

    // Expenses: Groceries & Food
    expensesgroceriesandfood: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Exact groceries & food' },
    groceriesandfood: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Groceries & food' },
    foodgroceries: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Food & groceries' },
    groceries: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Groceries' },
    food: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Food' },
    dining: { target: 'expenses.groceriesAndFood', confidence: 'medium', note: 'Dining expense' },
    foodandgroceries: { target: 'expenses.groceriesAndFood', confidence: 'high', note: 'Food & groceries' },

    // Expenses: Rent & Housing
    expensesrentorhousing: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Exact rent or housing' },
    rentorhousing: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Rent or housing' },
    rent: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Rent' },
    rentexpense: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Rent expense' },
    housing: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Housing' },
    housingexpense: { target: 'expenses.rentOrHousing', confidence: 'high', note: 'Housing expense' },
    mortgage: { target: 'expenses.rentOrHousing', confidence: 'medium', note: 'Mortgage mapped to rent/housing' },

    // Expenses: Family & Other
    expensesfamilyandother: { target: 'expenses.familyAndOther', confidence: 'high', note: 'Exact family & other' },
    familyandother: { target: 'expenses.familyAndOther', confidence: 'high', note: 'Family & other' },
    familysupport: { target: 'expenses.familyAndOther', confidence: 'high', note: 'Family support' },
    familyexpenses: { target: 'expenses.familyAndOther', confidence: 'high', note: 'Family expenses' },
    other: { target: 'expenses.familyAndOther', confidence: 'medium', note: 'Other expenses' },
    otherexpenses: { target: 'expenses.familyAndOther', confidence: 'high', note: 'Other expenses' },
    misc: { target: 'expenses.familyAndOther', confidence: 'medium', note: 'Misc expenses' },
    miscellaneous: { target: 'expenses.familyAndOther', confidence: 'medium', note: 'Miscellaneous' },

    // Tax & Shariah
    taxstatus: { target: 'taxStatus', confidence: 'high', note: 'Tax filer status' },
    filer: { target: 'taxStatus', confidence: 'high', note: 'Filer status' },
    taxfiler: { target: 'taxStatus', confidence: 'high', note: 'Tax filer' },
    shariahonly: { target: 'shariahOnly', confidence: 'high', note: 'Shariah compliance' },
    shariah: { target: 'shariahOnly', confidence: 'high', note: 'Shariah compliance' },
    islamic: { target: 'shariahOnly', confidence: 'high', note: 'Islamic finance' },
    halal: { target: 'shariahOnly', confidence: 'high', note: 'Halal investment preference' },
    includezakat: { target: 'includeZakat', confidence: 'high', note: 'Zakat preference' },
    zakat: { target: 'includeZakat', confidence: 'high', note: 'Zakat' },

    // Growth & Inflation
    annualsalaryraisepct: { target: 'annualSalaryRaisePct', confidence: 'high', note: 'Salary raise %' },
    salaryraise: { target: 'annualSalaryRaisePct', confidence: 'high', note: 'Salary raise' },
    annualinflationpct: { target: 'annualInflationPct', confidence: 'high', note: 'Inflation %' },
    inflationrate: { target: 'annualInflationPct', confidence: 'high', note: 'Inflation rate' },
    annualinflation: { target: 'annualInflationPct', confidence: 'high', note: 'Annual inflation' },
    dailycommutekm: { target: 'dailyCommuteKm', confidence: 'high', note: 'Daily commute km' },
    commutedistance: { target: 'dailyCommuteKm', confidence: 'high', note: 'Commute distance' },
    dailycommute: { target: 'dailyCommuteKm', confidence: 'high', note: 'Daily commute' },
    solarkw: { target: 'solarKw', confidence: 'high', note: 'Solar capacity kW' },
    solarsystem: { target: 'solarKw', confidence: 'high', note: 'Solar capacity' },
    solarpower: { target: 'solarKw', confidence: 'high', note: 'Solar capacity' },
  };

  // Iterate over all foreign keys
  for (const rawKey of Object.keys(flat)) {
    const rawVal = flat[rawKey];
    if (rawVal === undefined || rawVal === null) continue;

    const norm = normalizeKey(rawKey);
    const alias = ALIAS_MAP[norm];

    if (alias) {
      const target = alias.target;
      matchedForeignKeys.add(rawKey);

      // Handle nested property like 'expenses.fuelAndCommute'
      const isNestedExpense = target.startsWith('expenses.');
      const expenseKey = isNestedExpense ? target.split('.')[1] : null;

      if (target === 'role') {
        const strVal = String(rawVal).toLowerCase();
        let role = 'salaried';
        if (strVal.includes('student')) role = 'student';
        else if (strVal.includes('business') || strVal.includes('self')) role = 'business';
        else if (strVal.includes('freelanc') || strVal.includes('contract')) role = 'freelancer';
        cleanProfile.role = role;
      } else if (target === 'gender') {
        const strVal = String(rawVal).toLowerCase();
        cleanProfile.gender = strVal.startsWith('f') ? 'female' : 'male';
      } else if (target === 'maritalStatus') {
        const strVal = String(rawVal).toLowerCase();
        cleanProfile.maritalStatus = strVal.startsWith('m') ? 'married' : 'unmarried';
      } else if (target === 'taxStatus') {
        const strVal = String(rawVal).toLowerCase();
        cleanProfile.taxStatus =
          strVal === 'non-filer' || strVal === 'nonfiler' || strVal === 'false' || strVal === 'no'
            ? 'non-filer'
            : 'filer';
      } else if (
        target === 'isBreadwinner' ||
        target === 'shariahOnly' ||
        target === 'includeZakat' ||
        target === 'reinvestDividends' ||
        target === 'inflationAdjusted'
      ) {
        if (typeof rawVal === 'boolean') {
          cleanProfile[target] = rawVal;
        } else {
          const strVal = String(rawVal).toLowerCase().trim();
          cleanProfile[target] = ['true', 'yes', '1', 'y'].includes(strVal);
        }
      } else if (isNestedExpense && expenseKey) {
        const num = parseCleanNumber(rawVal);
        if (num !== null) {
          if (!cleanProfile.expenses) cleanProfile.expenses = {};
          cleanProfile.expenses[expenseKey] = num;
        }
      } else {
        const num = parseCleanNumber(rawVal);
        if (num !== null) {
          cleanProfile[target] = num;
        }
      }

      mapping.push({
        source: rawKey,
        target,
        confidence: alias.confidence,
        note: alias.note,
      });
    }
  }

  // Find all unmapped keys
  const unmapped: string[] = [];
  for (const rawKey of Object.keys(flat)) {
    if (!matchedForeignKeys.has(rawKey)) {
      // Ignore root objects if their children were mapped
      const hasChildMapped = Array.from(matchedForeignKeys).some((m) => m.startsWith(`${rawKey}.`));
      if (!hasChildMapped) {
        unmapped.push(rawKey);
      }
    }
  }

  // Ensure output is strictly sanitized and clamped
  const finalProfile = sanitizeProfile(cleanProfile, fallbackProfile);

  return {
    profile: finalProfile,
    mapping,
    unmapped,
  };
}

// ---------------------------------------------------------------------------
// 5. Profile Equality Checker (Golden Fixture Round-Trip)
// ---------------------------------------------------------------------------

/**
 * Compares two numbers for equality with floating point tolerance.
 */
function numbersEqual(a: number, b: number, tol = 1e-4): boolean {
  if (isNaN(a) && isNaN(b)) return true;
  return Math.abs(a - b) <= tol;
}

/**
 * Deep equality checker between two UserProfiles.
 * Ignores trivial floating point differences (< 1e-4) and verifies all nested arrays & objects.
 */
export function areProfilesEqual(a: UserProfile, b: UserProfile): boolean {
  if (!a || !b) return false;

  // Scalar fields
  if (a.role !== b.role) return false;
  if (a.gender !== b.gender) return false;
  if (!numbersEqual(a.age, b.age)) return false;
  if (!numbersEqual(a.retirementAge, b.retirementAge)) return false;
  if (a.maritalStatus !== b.maritalStatus) return false;
  if (!numbersEqual(a.familyMembers, b.familyMembers)) return false;
  if (a.isBreadwinner !== b.isBreadwinner) return false;
  if (!numbersEqual(a.monthlyIncomePkr, b.monthlyIncomePkr)) return false;
  if (!numbersEqual(a.annualSalaryRaisePct, b.annualSalaryRaisePct)) return false;
  if (!numbersEqual(a.lumpSumPkr, b.lumpSumPkr)) return false;
  if (!numbersEqual(a.monthlyInvestPkr, b.monthlyInvestPkr)) return false;
  if (!numbersEqual(a.currentCashReservePkr, b.currentCashReservePkr)) return false;

  // Expenses
  const expA = a.expenses || {};
  const expB = b.expenses || {};
  if (!numbersEqual(expA.fuelAndCommute, expB.fuelAndCommute)) return false;
  if (!numbersEqual(expA.utilitiesAndInternet, expB.utilitiesAndInternet)) return false;
  if (!numbersEqual(expA.groceriesAndFood, expB.groceriesAndFood)) return false;
  if (!numbersEqual(expA.rentOrHousing, expB.rentOrHousing)) return false;
  if (!numbersEqual(expA.familyAndOther, expB.familyAndOther)) return false;

  // Toggles & Flags
  if (a.taxStatus !== b.taxStatus) return false;
  if (a.shariahOnly !== b.shariahOnly) return false;
  if (a.includeZakat !== b.includeZakat) return false;
  if (a.reinvestDividends !== b.reinvestDividends) return false;
  if (a.inflationAdjusted !== b.inflationAdjusted) return false;
  if (!numbersEqual(a.annualInflationPct, b.annualInflationPct)) return false;
  if (!numbersEqual(a.dividendGrowthPct, b.dividendGrowthPct)) return false;
  if (!numbersEqual(a.opportunityCostReturnPct, b.opportunityCostReturnPct)) return false;

  // Tariffs & Commute
  if (!numbersEqual(a.usdToPkr, b.usdToPkr)) return false;
  if (!numbersEqual(a.goldPerTolaPkr, b.goldPerTolaPkr)) return false;
  if (!numbersEqual(a.petrolPricePerLitre, b.petrolPricePerLitre)) return false;
  if (!numbersEqual(a.gridRatePerKwh, b.gridRatePerKwh)) return false;
  if (!numbersEqual(a.solarKw, b.solarKw)) return false;
  if (a.solarTariffMode !== b.solarTariffMode) return false;
  if (!numbersEqual(a.dailyCommuteKm, b.dailyCommuteKm)) return false;

  // Asset Buckets
  const bA = a.assetBuckets || [];
  const bB = b.assetBuckets || [];
  if (bA.length !== bB.length) return false;
  for (let i = 0; i < bA.length; i++) {
    if (bA[i].id !== bB[i].id) return false;
    if (!numbersEqual(bA[i].currentValuePkr, bB[i].currentValuePkr)) return false;
    if (!numbersEqual(bA[i].monthlySplitPct, bB[i].monthlySplitPct)) return false;
    if (!numbersEqual(bA[i].expectedAnnualReturnPct, bB[i].expectedAnnualReturnPct)) return false;
  }

  // Life Goals
  const gA = a.lifeGoals || [];
  const gB = b.lifeGoals || [];
  if (gA.length !== gB.length) return false;
  for (let i = 0; i < gA.length; i++) {
    if (gA[i].id !== gB[i].id) return false;
    if (!numbersEqual(gA[i].targetAge, gB[i].targetAge)) return false;
    if (!numbersEqual(gA[i].costInTodaysPkr, gB[i].costInTodaysPkr)) return false;
  }

  // Vehicles
  const vA = a.vehicles || [];
  const vB = b.vehicles || [];
  if (vA.length !== vB.length) return false;
  for (let i = 0; i < vA.length; i++) {
    if (vA[i].id !== vB[i].id) return false;
    if (vA[i].fuelType !== vB[i].fuelType) return false;
    if (!numbersEqual(vA[i].pricePkr, vB[i].pricePkr)) return false;
  }

  // Holdings
  const hA = a.holdings || [];
  const hB = b.holdings || [];
  if (hA.length !== hB.length) return false;
  for (let i = 0; i < hA.length; i++) {
    if (hA[i].id !== hB[i].id) return false;
    if (hA[i].kind !== hB[i].kind) return false;
    if (!numbersEqual(hA[i].valuePkr, hB[i].valuePkr)) return false;
  }

  // Liabilities
  const lA = a.liabilities || [];
  const lB = b.liabilities || [];
  if (lA.length !== lB.length) return false;
  for (let i = 0; i < lA.length; i++) {
    if (lA[i].id !== lB[i].id) return false;
    if (!numbersEqual(lA[i].amountPkr, lB[i].amountPkr)) return false;
  }

  return true;
}
