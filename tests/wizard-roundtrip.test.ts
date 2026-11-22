import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '@/data/marketData';
import type { UserProfile } from '@/types';
import {
  buildWizardDraft,
  compileWizardProfile,
  type WizardDraft,
} from '@/lib/wizardDraft';

/**
 * NOTES #44 — Wizard save→reopen round-trip.
 *
 * These tests exercise the EXACT functions the wizard uses:
 * buildWizardDraft (load, on open) and compileWizardProfile (save, on
 * finish). Before #44 the wizard saved Step 5's vehicle only into
 * vehicles[] and loaded it from hard-coded constants ('petrol-car',
 * 2800000), so EV + Rs 4,800,000 reverted on every reopen; Step 6's
 * goals were discarded on save in update mode and never read on load.
 */

function baseProfile(): UserProfile {
  const raw = PRESET_PROFILES['junior-engineer'].profile as UserProfile;
  return JSON.parse(JSON.stringify(raw)) as UserProfile;
}

/** A draft where EVERY wizard field (all 6 steps) is a non-default value,
 *  built the way the wizard builds it: load the base profile, then edit. */
function nonDefaultDraft(base: UserProfile): WizardDraft {
  const loaded = buildWizardDraft(base);
  return {
    ...loaded,
    // Step 1
    age: 31,
    retirementAge: 47,
    role: 'freelancer',
    gender: 'female',
    isBreadwinner: false,
    maritalStatus: 'married',
    familyMembers: 6,
    // Step 2
    taxStatus: 'non-filer',
    shariahOnly: false,
    includeZakat: true,
    // Step 3
    monthlyIncomePkr: 437000,
    monthlyInvestPkr: 123000,
    annualSalaryRaisePct: 7,
    lumpSumPkr: 765000,
    currentCashReservePkr: -321000,
    // Step 4
    fuelAndCommute: 11111,
    utilitiesAndInternet: 22222,
    groceriesAndFood: 33333,
    rentOrHousing: 44444,
    familyAndOther: 5555,
    // Step 5
    dailyCommuteKm: 42,
    currentVehicleType: 'ev-car',
    currentVehicleResalePkr: 4800000,
    solarKw: 7,
    solarTariffMode: 'net-billing-2026',
    // Step 6 (ages must stay > age or the goal is intentionally dropped)
    weddingAge: 34,
    weddingCost: 3100000,
    houseAge: 41,
    houseCost: 21700000,
  };
}

describe('Wizard round-trip (NOTES #44)', () => {
  it('every field across all 6 steps survives finish → reopen identical (update mode)', () => {
    const base = baseProfile();
    const draft = nonDefaultDraft(base);

    const saved = compileWizardProfile(base, draft, 'update');
    const reopened = buildWizardDraft(saved);

    expect(reopened).toEqual(draft);
  });

  it('every field across all 6 steps survives finish → reopen identical (create mode)', () => {
    const base = baseProfile();
    const draft = nonDefaultDraft(base);

    const saved = compileWizardProfile(base, draft, 'create');
    const reopened = buildWizardDraft(saved);

    expect(reopened).toEqual(draft);
  });

  it('round-trip is idempotent: a second finish → reopen cycle changes nothing', () => {
    const base = baseProfile();
    const draft = nonDefaultDraft(base);

    const once = buildWizardDraft(compileWizardProfile(base, draft, 'update'));
    const twice = buildWizardDraft(compileWizardProfile(compileWizardProfile(base, once, 'update'), once, 'update'));

    expect(twice).toEqual(once);
  });

  it('REGRESSION (owner case): Step 5 EV + Rs 4,800,000 survive Recalibrate → reopen', () => {
    const base = baseProfile();
    const draft = { ...buildWizardDraft(base), currentVehicleType: 'ev-car' as const, currentVehicleResalePkr: 4800000 };

    const saved = compileWizardProfile(base, draft, 'update');

    // Single source of truth: profile-level fields carry the values…
    expect(saved.currentVehicleType).toBe('ev-car');
    expect(saved.currentVehicleResalePkr).toBe(4800000);
    // …and the vehicles[] mirror agrees.
    const current = saved.vehicles.find((v) => v.isCurrentVehicle);
    expect(current?.fuelType).toBe('ev');
    expect(current?.pricePkr).toBe(4800000);

    const reopened = buildWizardDraft(saved);
    expect(reopened.currentVehicleType).toBe('ev-car');
    expect(reopened.currentVehicleResalePkr).toBe(4800000);
    // Explicitly NOT the old hard-coded defaults that caused the bug.
    expect(reopened.currentVehicleType).not.toBe('petrol-car');
    expect(reopened.currentVehicleResalePkr).not.toBe(2800000);
  });

  it("Step 5 'none' + a stored resale value also round-trip (no current vehicle)", () => {
    const base = baseProfile();
    const draft = { ...buildWizardDraft(base), currentVehicleType: 'none' as const, currentVehicleResalePkr: 1234567 };

    const saved = compileWizardProfile(base, draft, 'update');
    expect(saved.vehicles.every((v) => !v.isCurrentVehicle)).toBe(true);

    const reopened = buildWizardDraft(saved);
    expect(reopened.currentVehicleType).toBe('none');
    expect(reopened.currentVehicleResalePkr).toBe(1234567);
  });

  it('deliberate zero values round-trip (lump 0, rent 0, raise 0, solar 0, commute 0)', () => {
    const base = baseProfile();
    const draft = {
      ...buildWizardDraft(base),
      lumpSumPkr: 0,
      rentOrHousing: 0,
      annualSalaryRaisePct: 0,
      solarKw: 0,
      dailyCommuteKm: 0,
    };

    const reopened = buildWizardDraft(compileWizardProfile(base, draft, 'update'));

    expect(reopened.lumpSumPkr).toBe(0);
    expect(reopened.rentOrHousing).toBe(0);
    expect(reopened.annualSalaryRaisePct).toBe(0);
    expect(reopened.solarKw).toBe(0);
    expect(reopened.dailyCommuteKm).toBe(0);
  });

  it('Step 6 in update mode: wizard goals are saved, non-wizard goals are preserved untouched', () => {
    const base = baseProfile();
    const debtGoal = { id: 'goal-debt-2027', name: 'Debt Clearance (installments, due 2027)', targetAge: 32, costInTodaysPkr: 750000 };
    base.lifeGoals = [...base.lifeGoals, debtGoal];
    const goalCount = base.lifeGoals.length;

    const draft = { ...buildWizardDraft(base), weddingAge: 35, weddingCost: 2900000, houseAge: 44, houseCost: 19900000 };
    const saved = compileWizardProfile(base, draft, 'update');

    // No goals added or dropped; wedding/house replaced in place.
    expect(saved.lifeGoals).toHaveLength(goalCount);
    expect(saved.lifeGoals.find((g) => g.id === debtGoal.id)).toEqual(debtGoal);

    const reopened = buildWizardDraft(saved);
    expect(reopened.weddingAge).toBe(35);
    expect(reopened.weddingCost).toBe(2900000);
    expect(reopened.houseAge).toBe(44);
    expect(reopened.houseCost).toBe(19900000);
  });

  it('legacy profiles (no profile-level vehicle fields) load Step 5 from the flagged vehicles[] entry', () => {
    const evBase = baseProfile();
    delete evBase.currentVehicleType;
    delete evBase.currentVehicleResalePkr;
    evBase.vehicles = evBase.vehicles.map((v) =>
      v.isCurrentVehicle ? { ...v, fuelType: 'ev' as const, pricePkr: 4800000, kwhPer100Km: 16.5, kmPerLitre: undefined } : v
    );
    const evDraft = buildWizardDraft(evBase);
    expect(evDraft.currentVehicleType).toBe('ev-car');
    expect(evDraft.currentVehicleResalePkr).toBe(4800000);

    const bikeBase = baseProfile(); // junior preset: current = petrol bike, 45 km/L
    delete bikeBase.currentVehicleType;
    delete bikeBase.currentVehicleResalePkr;
    const bikeDraft = buildWizardDraft(bikeBase);
    expect(bikeDraft.currentVehicleType).toBe('petrol-bike');
    expect(bikeDraft.currentVehicleResalePkr).toBe(150000);
  });
});
