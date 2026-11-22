import { describe, expect, it } from 'vitest';
import {
  areProfilesEqual,
  createAllPortfoliosExportEnvelope,
  createNativeExportEnvelope,
  getDefaultFallbackProfile,
  isAllPortfoliosEnvelope,
  isNativePortfolioEnvelope,
  isSinglePortfolioEnvelope,
  mapForeignPayloadHeuristic,
  parseCleanNumber,
  parseCsvRows,
  parseCsvToRecord,
  parseNativeExport,
  sanitizeDeep,
} from '@/lib/portfolioTransfer';
import { PRESET_PROFILES } from '@/data/marketData';
import { UserProfile } from '@/types';
import { sanitizeProfile } from '@/lib/stateUrl';

describe('Portfolio Transfer & AI Mapping Suite', () => {
  const fallback = getDefaultFallbackProfile();

  // -------------------------------------------------------------------------
  // 1. Golden Fixture Native Export -> Parse -> Equality Round-Trip
  // -------------------------------------------------------------------------
  describe('Golden Fixture Native Export Round-Trip', () => {
    it('round-trips single portfolio envelope with 100% fidelity', () => {
      const originalProfile = PRESET_PROFILES[0].profile as UserProfile;
      const envelope = createNativeExportEnvelope({
        name: 'Junior Software Engineer Alpha',
        profile: originalProfile,
      });

      expect(envelope.app).toBe('RizqFlow');
      expect(envelope.kind).toBe('portfolio-export');
      expect(envelope.formatVersion).toBe(1);
      expect(typeof envelope.exportedAt).toBe('string');
      expect(isNativePortfolioEnvelope(envelope)).toBe(true);
      expect(isSinglePortfolioEnvelope(envelope)).toBe(true);
      expect(isAllPortfoliosEnvelope(envelope)).toBe(false);

      const jsonStr = JSON.stringify(envelope);
      const parsed = parseNativeExport(jsonStr, fallback);

      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      expect(parsed.portfolios).toHaveLength(1);
      expect(parsed.portfolios[0].name).toBe('Junior Software Engineer Alpha');
      expect(areProfilesEqual(parsed.portfolios[0].profile, originalProfile)).toBe(true);
    });

    it('round-trips multi-portfolio envelope containing all 3 presets', () => {
      const p1 = PRESET_PROFILES[0].profile as UserProfile;
      const p2 = PRESET_PROFILES[1].profile as UserProfile;
      const p3 = PRESET_PROFILES[2].profile as UserProfile;

      const envelope = createAllPortfoliosExportEnvelope([
        { name: 'Portfolio 1 - Dev', profile: p1 },
        { name: 'Portfolio 2 - Rs 30 Lac', profile: p2 },
        { name: 'Portfolio 3 - Solar Commuter', profile: p3 },
      ]);

      expect(isNativePortfolioEnvelope(envelope)).toBe(true);
      expect(isSinglePortfolioEnvelope(envelope)).toBe(false);
      expect(isAllPortfoliosEnvelope(envelope)).toBe(true);

      const jsonStr = JSON.stringify(envelope);
      const parsed = parseNativeExport(jsonStr, fallback);

      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      expect(parsed.portfolios).toHaveLength(3);
      expect(parsed.portfolios[0].name).toBe('Portfolio 1 - Dev');
      expect(areProfilesEqual(parsed.portfolios[0].profile, p1)).toBe(true);
      expect(parsed.portfolios[1].name).toBe('Portfolio 2 - Rs 30 Lac');
      expect(areProfilesEqual(parsed.portfolios[1].profile, p2)).toBe(true);
      expect(parsed.portfolios[2].name).toBe('Portfolio 3 - Solar Commuter');
      expect(areProfilesEqual(parsed.portfolios[2].profile, p3)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. CSV Parser & Number Cleaning
  // -------------------------------------------------------------------------
  describe('CSV Parser & Number Cleaning', () => {
    it('cleans various number formats with commas, currency prefixes, and Lac/Crore/k units', () => {
      expect(parseCleanNumber(250000)).toBe(250000);
      expect(parseCleanNumber('250000')).toBe(250000);
      expect(parseCleanNumber('250,000')).toBe(250000);
      expect(parseCleanNumber('Rs 379,836')).toBe(379836);
      expect(parseCleanNumber('PKR 1,500,000')).toBe(1500000);
      expect(parseCleanNumber('$12,500')).toBe(12500);
      expect(parseCleanNumber('30 Lac')).toBe(3000000);
      expect(parseCleanNumber('3.5 Lacs')).toBe(350000);
      expect(parseCleanNumber('1.2 Crore')).toBe(12000000);
      expect(parseCleanNumber('2.5 Cr')).toBe(25000000);
      expect(parseCleanNumber('150k')).toBe(150000);
      expect(parseCleanNumber('-25,000')).toBe(-25000);
      expect(parseCleanNumber('(15,000)')).toBe(-15000);
      expect(parseCleanNumber('8.5%')).toBe(8.5);
      expect(parseCleanNumber('invalid string')).toBeNull();
      expect(parseCleanNumber(null)).toBeNull();
      expect(parseCleanNumber(undefined)).toBeNull();
    });

    it('parses CSV lines respecting commas in quotes and escaped quotes', () => {
      const csv = `Name,Location,Amount,Notes\n"Asif, Ibtisam","Karachi, Pakistan","Rs 30 Lac","Prefers ""Halal"" assets"`;
      const rows = parseCsvRows(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]['Name']).toBe('Asif, Ibtisam');
      expect(rows[0]['Location']).toBe('Karachi, Pakistan');
      expect(rows[0]['Amount']).toBe('Rs 30 Lac');
      expect(rows[0]['Notes']).toBe('Prefers "Halal" assets');
    });

    it('converts vertical 2-column CSV to flat record', () => {
      const csv = `Parameter,Value\nAge,29\nMonthly Salary,Rs 3.5 Lac\nCity,Lahore`;
      const record = parseCsvToRecord(csv);
      expect(record['Age']).toBe('29');
      expect(record['Monthly Salary']).toBe('Rs 3.5 Lac');
      expect(record['City']).toBe('Lahore');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Foreign Mapping on 2 Synthetic Fixtures
  // -------------------------------------------------------------------------
  describe('Foreign Mapping on Synthetic Fixtures', () => {
    it('(a) Maps "Wealthsimple-style" nested JSON with currency strings', () => {
      const foreignPayload = {
        user_info: {
          age: '28',
          occupation: 'salaried',
          gender: 'male',
          marital_status: 'unmarried',
          dependents: '2',
        },
        financials: {
          salary: '$250,000',
          savings: '$1,500,000',
          monthly_savings: '$100,000',
          emergency_fund: '$500,000',
        },
        monthly_expenses: {
          rent: '$50,000',
          groceries: '$40,000',
          utilities: '$25,000',
          transport: '$20,000',
          misc: '$15,000',
        },
        arbitrary_unmapped_note: 'Imported from Canadian export',
      };

      const result = mapForeignPayloadHeuristic(foreignPayload, fallback);
      const { profile, mapping, unmapped } = result;

      expect(profile.age).toBe(28);
      expect(profile.role).toBe('salaried');
      expect(profile.gender).toBe('male');
      expect(profile.maritalStatus).toBe('unmarried');
      expect(profile.familyMembers).toBe(2);

      expect(profile.monthlyIncomePkr).toBe(250000);
      expect(profile.lumpSumPkr).toBe(1500000);
      expect(profile.monthlyInvestPkr).toBe(100000);
      expect(profile.currentCashReservePkr).toBe(500000);

      expect(profile.expenses.rentOrHousing).toBe(50000);
      expect(profile.expenses.groceriesAndFood).toBe(40000);
      expect(profile.expenses.utilitiesAndInternet).toBe(25000);
      expect(profile.expenses.fuelAndCommute).toBe(20000);
      expect(profile.expenses.familyAndOther).toBe(15000);

      expect(mapping.length).toBeGreaterThan(8);
      expect(unmapped).toContain('arbitrary_unmapped_note');
    });

    it('(b) Maps flat CSV with Lac-denominated Pakistani values', () => {
      const csv = `Field,Value
Age,32
Employment Status,business
Monthly Income,3.5 Lac
Lump Sum Savings,30 Lac
Monthly Investment,1.2 Lac
Cash Reserve,8 Lac
Rent Expense,40,000
Food & Groceries,50,000
Utilities,30,000
Commute Fuel,25,000
Family Support,15,000
Daily Commute,35 km
Solar System,10 kW
Unmapped Field Test,Random Data Value`;

      const record = parseCsvToRecord(csv);
      const result = mapForeignPayloadHeuristic(record, fallback);
      const { profile, unmapped } = result;

      expect(profile.age).toBe(32);
      expect(profile.role).toBe('business');
      expect(profile.monthlyIncomePkr).toBe(350000); // 3.5 Lac
      expect(profile.lumpSumPkr).toBe(3000000); // 30 Lac
      expect(profile.monthlyInvestPkr).toBe(120000); // 1.2 Lac
      expect(profile.currentCashReservePkr).toBe(800000); // 8 Lac

      expect(profile.expenses.rentOrHousing).toBe(40000);
      expect(profile.expenses.groceriesAndFood).toBe(50000);
      expect(profile.expenses.utilitiesAndInternet).toBe(30000);
      expect(profile.expenses.fuelAndCommute).toBe(25000);
      expect(profile.expenses.familyAndOther).toBe(15000);

      expect(profile.dailyCommuteKm).toBe(35);
      expect(profile.solarKw).toBe(10);
      expect(unmapped).toContain('Unmapped Field Test');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Hostile Input Handling & Security Protection
  // -------------------------------------------------------------------------
  describe('Hostile Input Handling & Security Defense', () => {
    it('safely handles malformed JSON without crashing', () => {
      const malformed = '{ "app": "RizqFlow", "kind": "portfolio-export", broken... ';
      const result = parseNativeExport(malformed, fallback);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Malformed JSON payload');
      }
    });

    it('rejects tampered envelope signatures and invalid versions', () => {
      const wrongApp = parseNativeExport(
        JSON.stringify({ app: 'FraudulentApp', kind: 'portfolio-export', formatVersion: 1 }),
        fallback
      );
      expect(wrongApp.success).toBe(false);
      if (!wrongApp.success) {
        expect(wrongApp.error).toContain('Invalid app signature');
      }

      const wrongKind = parseNativeExport(
        JSON.stringify({ app: 'RizqFlow', kind: 'wrong-kind', formatVersion: 1 }),
        fallback
      );
      expect(wrongKind.success).toBe(false);
      if (!wrongKind.success) {
        expect(wrongKind.error).toContain('Invalid export kind');
      }

      const wrongVersion = parseNativeExport(
        JSON.stringify({ app: 'RizqFlow', kind: 'portfolio-export', formatVersion: 99 }),
        fallback
      );
      expect(wrongVersion.success).toBe(false);
      if (!wrongVersion.success) {
        expect(wrongVersion.error).toContain('Unsupported format version');
      }
    });

    it('strips prototype pollution keys (__proto__, constructor, prototype) completely', () => {
      const maliciousPayload = JSON.parse(
        '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"injected":"yes"}},"age":30,"salary":"200000"}'
      );

      // Verify Object.prototype is pristine before
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).injected).toBeUndefined();

      const sanitized = sanitizeDeep(maliciousPayload);
      expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(false);
      expect((sanitized as any).polluted).toBeUndefined();
      expect((sanitized as any).injected).toBeUndefined();

      const mapped = mapForeignPayloadHeuristic(maliciousPayload, fallback);
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).injected).toBeUndefined();
      expect(mapped.profile.age).toBe(30);
      expect(mapped.profile.monthlyIncomePkr).toBe(200000);
    });

    it('clamps negative, NaN, and absurd values through sanitizeProfile()', () => {
      const absurdInput = {
        age: -50,
        retirementAge: 10000,
        monthlyIncomePkr: -999999,
        annualSalaryRaisePct: 500,
        currentCashReservePkr: -50000, // Negative should clamp to 0 in sanitizeProfile
        annualInflationPct: 999,
        familyMembers: 100,
      };

      const sanitized = sanitizeProfile(absurdInput, fallback);

      expect(sanitized.age).toBe(16); // clamped to min age
      expect(sanitized.retirementAge).toBe(95); // clamped to max retirement age
      expect(sanitized.monthlyIncomePkr).toBe(0); // clamped to min 0
      expect(sanitized.annualSalaryRaisePct).toBe(50); // clamped to max raise 50%
      expect(sanitized.currentCashReservePkr).toBe(0);
      expect(sanitized.annualInflationPct).toBe(40); // clamped to max inflation 40%
      expect(sanitized.familyMembers).toBe(30); // clamped to max 30
    });

    it('safely rejects oversized payloads (> 15 MB) in parseNativeExport', () => {
      // Create a 16 MB dummy string
      const bigString = 'a'.repeat(16 * 1024 * 1024);
      const res = parseNativeExport(bigString, fallback);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Payload exceeds maximum allowed size');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 5. Verification of areProfilesEqual utility
  // -------------------------------------------------------------------------
  describe('areProfilesEqual Utility', () => {
    it('returns true for identical profiles', () => {
      const p1 = PRESET_PROFILES[0].profile as UserProfile;
      const p2 = JSON.parse(JSON.stringify(p1)) as UserProfile;
      expect(areProfilesEqual(p1, p2)).toBe(true);
    });

    it('returns false when any critical field differs', () => {
      const p1 = PRESET_PROFILES[0].profile as UserProfile;
      const p2 = { ...p1, monthlyIncomePkr: p1.monthlyIncomePkr + 1000 };
      expect(areProfilesEqual(p1, p2)).toBe(false);

      const p3 = { ...p1, age: p1.age + 1 };
      expect(areProfilesEqual(p1, p3)).toBe(false);

      const p4 = { ...p1, expenses: { ...p1.expenses, fuelAndCommute: p1.expenses.fuelAndCommute + 500 } };
      expect(areProfilesEqual(p1, p4)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Server API Route (/api/ai/map-portfolio) Tests
  // -------------------------------------------------------------------------
  describe('Server API Route (/api/ai/map-portfolio)', () => {
    it('GET returns status indicating if AI is configured', async () => {
      const { GET } = await import('@/app/api/ai/map-portfolio/route');
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(typeof json.available).toBe('boolean');
    });

    it('POST rejects payloads exceeding 30 KB with HTTP 400 and payload_too_large error', async () => {
      const { POST } = await import('@/app/api/ai/map-portfolio/route');
      const bigPayload = 'x'.repeat(35 * 1024);
      const req = new Request('http://localhost:3000/api/ai/map-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: bigPayload }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('payload_too_large');
      expect(json.message).toContain('30 KB limit');
    });

    it('POST rejects empty payload with HTTP 400', async () => {
      const { POST } = await import('@/app/api/ai/map-portfolio/route');
      const req = new Request('http://localhost:3000/api/ai/map-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: '   ' }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('empty_payload');
    });
  });
});
