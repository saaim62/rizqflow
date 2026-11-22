/**
 * Wizard draft serialise / deserialise (NOTES #44).
 *
 * Single source of truth for how the 6-step onboarding wizard reads a
 * profile into its draft state (`buildWizardDraft`) and writes a finished
 * draft back into a profile (`compileWizardProfile`). The wizard component
 * and the round-trip tests both use these exact functions, so a save→reopen
 * cycle can never drift between two representations again.
 *
 * Step 5 current-vehicle contract: the PROFILE-LEVEL fields
 * `currentVehicleType` / `currentVehicleResalePkr` are authoritative for
 * the wizard (they are also what the wealth engine's car-swap math reads).
 * Saving ALSO mirrors them into the `vehicles[]` entry flagged
 * `isCurrentVehicle` (fuelType + pricePkr), which the Cars pages consume.
 * Loading prefers the profile-level fields and falls back to deriving
 * from the flagged vehicles[] entry for legacy profiles that predate
 * the fields being written.
 */

import type {
  LifeGoal,
  SolarTariffMode,
  TaxStatus,
  UserProfile,
  UserRole,
  VehicleCandidate,
} from '@/types';

export type WizardVehicleType = 'none' | 'petrol-bike' | 'petrol-car' | 'ev-car';

export interface WizardDraft {
  // Step 1 — persona & household
  age: number;
  retirementAge: number;
  role: UserRole;
  gender: 'male' | 'female';
  isBreadwinner: boolean;
  maritalStatus: 'unmarried' | 'married';
  familyMembers: number;
  // Step 2 — tax & Shariah
  taxStatus: TaxStatus;
  shariahOnly: boolean;
  includeZakat: boolean;
  // Step 3 — income & investments
  monthlyIncomePkr: number;
  monthlyInvestPkr: number;
  annualSalaryRaisePct: number;
  lumpSumPkr: number;
  currentCashReservePkr: number;
  // Step 4 — expenses
  fuelAndCommute: number;
  utilitiesAndInternet: number;
  groceriesAndFood: number;
  rentOrHousing: number;
  familyAndOther: number;
  // Step 5 — vehicle & solar
  dailyCommuteKm: number;
  currentVehicleType: WizardVehicleType;
  currentVehicleResalePkr: number;
  solarKw: number;
  solarTariffMode: SolarTariffMode;
  // Step 6 — life goals (wedding + house are the two goals the wizard edits)
  weddingAge: number;
  weddingCost: number;
  houseAge: number;
  houseCost: number;
  /** Ids of the existing lifeGoals the wizard's wedding/house fields were
   *  loaded from, so saving replaces those goals in place instead of
   *  duplicating them or dropping unrelated goals. Null = none existed. */
  weddingGoalId: string | null;
  houseGoalId: string | null;
}

export const WIZARD_WEDDING_GOAL_ID = 'goal-wedding-custom';
export const WIZARD_HOUSE_GOAL_ID = 'goal-house-custom';
export const WIZARD_DEFAULT_VEHICLE_TYPE: WizardVehicleType = 'petrol-car';
export const WIZARD_DEFAULT_VEHICLE_RESALE_PKR = 2800000;

const WIZARD_VEHICLE_TYPES: WizardVehicleType[] = ['none', 'petrol-bike', 'petrol-car', 'ev-car'];

function isWizardVehicleType(v: unknown): v is WizardVehicleType {
  return typeof v === 'string' && (WIZARD_VEHICLE_TYPES as string[]).includes(v);
}

/** Derive the wizard vehicle type from a flagged current vehicles[] entry
 *  (legacy profiles saved before the profile-level fields were written). */
function deriveVehicleTypeFromEntry(v: VehicleCandidate): WizardVehicleType {
  if (v.fuelType === 'ev' || v.fuelType === 'e-scooty') return 'ev-car';
  // petrol: bike vs car was encoded only via consumption + name on save
  if ((v.kmPerLitre ?? 0) >= 30 || /bike/i.test(v.name)) return 'petrol-bike';
  return 'petrol-car';
}

function findGoal(goals: LifeGoal[] | undefined, wizardId: string, namePattern: RegExp): LifeGoal | undefined {
  if (!goals) return undefined;
  return goals.find((g) => g.id === wizardId) ?? goals.find((g) => namePattern.test(g.name));
}

/** LOAD: build the wizard draft from a profile. Pure; used on wizard open. */
export function buildWizardDraft(profile: UserProfile): WizardDraft {
  // Step 5 vehicle: profile-level fields win; vehicles[] entry is the
  // legacy fallback; hard-coded defaults only when neither exists.
  const currentEntry = profile.vehicles?.find((v) => v.isCurrentVehicle);
  let currentVehicleType: WizardVehicleType;
  let currentVehicleResalePkr: number;
  if (isWizardVehicleType(profile.currentVehicleType)) {
    currentVehicleType = profile.currentVehicleType;
    currentVehicleResalePkr =
      profile.currentVehicleResalePkr ?? currentEntry?.pricePkr ?? WIZARD_DEFAULT_VEHICLE_RESALE_PKR;
  } else if (currentEntry) {
    currentVehicleType = deriveVehicleTypeFromEntry(currentEntry);
    currentVehicleResalePkr = profile.currentVehicleResalePkr ?? currentEntry.pricePkr;
  } else if (profile.vehicles) {
    // A fleet exists but nothing is flagged current (e.g. a prior
    // 'none' save) — the user has no current vehicle.
    currentVehicleType = 'none';
    currentVehicleResalePkr = profile.currentVehicleResalePkr ?? WIZARD_DEFAULT_VEHICLE_RESALE_PKR;
  } else {
    currentVehicleType = WIZARD_DEFAULT_VEHICLE_TYPE;
    currentVehicleResalePkr = profile.currentVehicleResalePkr ?? WIZARD_DEFAULT_VEHICLE_RESALE_PKR;
  }

  // Step 6 goals: read the actual saved goals, not constants.
  const wedding = findGoal(profile.lifeGoals, WIZARD_WEDDING_GOAL_ID, /wedding/i);
  const house = findGoal(profile.lifeGoals, WIZARD_HOUSE_GOAL_ID, /home|house/i);

  return {
    age: profile.age ?? 28,
    retirementAge: profile.retirementAge ?? 55,
    role: profile.role ?? 'salaried',
    gender: profile.gender ?? 'male',
    isBreadwinner: profile.isBreadwinner ?? true,
    maritalStatus: profile.maritalStatus ?? 'unmarried',
    familyMembers: profile.familyMembers ?? 1,

    taxStatus: profile.taxStatus ?? 'filer',
    shariahOnly: profile.shariahOnly ?? true,
    includeZakat: profile.includeZakat ?? false,

    monthlyIncomePkr: profile.monthlyIncomePkr ?? 250000,
    monthlyInvestPkr: profile.monthlyInvestPkr ?? 100000,
    annualSalaryRaisePct: profile.annualSalaryRaisePct ?? 10,
    lumpSumPkr: profile.lumpSumPkr ?? 1500000,
    currentCashReservePkr: profile.currentCashReservePkr ?? 400000,

    fuelAndCommute: profile.expenses?.fuelAndCommute ?? 20000,
    utilitiesAndInternet: profile.expenses?.utilitiesAndInternet ?? 25000,
    groceriesAndFood: profile.expenses?.groceriesAndFood ?? 35000,
    rentOrHousing: profile.expenses?.rentOrHousing ?? 20000,
    familyAndOther: profile.expenses?.familyAndOther ?? 15000,

    dailyCommuteKm: profile.dailyCommuteKm ?? 35,
    currentVehicleType,
    currentVehicleResalePkr,
    solarKw: profile.solarKw ?? 10,
    solarTariffMode: profile.solarTariffMode ?? 'net-metering-legacy',

    weddingAge: wedding?.targetAge ?? (profile.maritalStatus === 'unmarried' ? 29 : 0),
    weddingCost: wedding?.costInTodaysPkr ?? 2500000,
    weddingGoalId: wedding?.id ?? null,
    houseAge: house?.targetAge ?? 33,
    houseCost: house?.costInTodaysPkr ?? 15000000,
    houseGoalId: house?.id ?? null,
  };
}

/** Merge one wizard-edited goal into a goals list: replace the goal it was
 *  loaded from (or the wizard-id goal) in place, append if new, drop it if
 *  its target age is no longer in the future. All other goals untouched. */
function mergeWizardGoal(
  goals: LifeGoal[],
  sourceId: string | null,
  wizardId: string,
  name: string,
  targetAge: number,
  costInTodaysPkr: number,
  currentAge: number
): LifeGoal[] {
  const matchId = sourceId ?? wizardId;
  const idx = goals.findIndex((g) => g.id === matchId || g.id === wizardId);
  if (targetAge <= currentAge) {
    return idx >= 0 ? goals.filter((_, i) => i !== idx) : goals;
  }
  const goal: LifeGoal = { id: idx >= 0 ? goals[idx].id : wizardId, name, targetAge, costInTodaysPkr };
  if (idx >= 0) {
    const next = [...goals];
    next[idx] = goal;
    return next;
  }
  return [...goals, goal];
}

/** SAVE: compile a finished wizard draft into a profile. Pure.
 *  `mode` is accepted for call-site clarity; since NOTES #44 both modes
 *  use the same merge — recalibrating must not silently discard Step 6. */
export function compileWizardProfile(
  profile: UserProfile,
  draft: WizardDraft,
  mode: 'create' | 'update' = 'create'
): UserProfile {
  void mode;
  const { currentVehicleType, currentVehicleResalePkr } = draft;

  const compiledVehicles: VehicleCandidate[] = (() => {
    if (currentVehicleType === 'none') {
      if (profile.vehicles && profile.vehicles.length > 0) {
        return profile.vehicles.map((v) => ({ ...v, isCurrentVehicle: false }));
      }
      return [
        {
          id: 'honri-ve2',
          name: 'Honri Ve 2.0 EV',
          fuelType: 'ev' as const,
          pricePkr: 3599000,
          kwhPer100Km: 14.0,
          fiveYearDepreciationPct: 30,
          annualMaintenancePkr: 20000,
        },
      ];
    }

    const ownedVehicle: VehicleCandidate = {
      id: 'current-user-vehicle',
      name:
        currentVehicleType === 'petrol-bike'
          ? 'Existing 70cc Bike'
          : currentVehicleType === 'ev-car'
          ? 'Existing EV Car'
          : 'Existing Petrol Car',
      fuelType: currentVehicleType === 'ev-car' ? 'ev' : 'petrol',
      pricePkr: currentVehicleResalePkr,
      isCurrentVehicle: true,
      ...(currentVehicleType === 'ev-car'
        ? { kwhPer100Km: 16.5 }
        : { kmPerLitre: currentVehicleType === 'petrol-bike' ? 45 : 13 }),
      fiveYearDepreciationPct: 35,
      annualMaintenancePkr:
        currentVehicleType === 'petrol-bike' ? 25000 : currentVehicleType === 'ev-car' ? 35000 : 60000,
    };

    if (profile.vehicles && profile.vehicles.length > 0) {
      const existingIndex = profile.vehicles.findIndex((v) => v.isCurrentVehicle);
      if (existingIndex >= 0) {
        return profile.vehicles.map((v, i) =>
          i === existingIndex
            ? {
                ...v,
                name: v.name.includes('Existing') ? ownedVehicle.name : v.name,
                pricePkr: currentVehicleResalePkr,
                fuelType: (currentVehicleType === 'ev-car' ? 'ev' : 'petrol') as 'ev' | 'petrol',
                ...(currentVehicleType === 'ev-car'
                  ? { kwhPer100Km: v.kwhPer100Km ?? 16.5, kmPerLitre: undefined }
                  : { kmPerLitre: v.kmPerLitre ?? (currentVehicleType === 'petrol-bike' ? 45 : 13), kwhPer100Km: undefined }),
                isCurrentVehicle: true,
              }
            : { ...v, isCurrentVehicle: false }
        );
      }
      return [ownedVehicle, ...profile.vehicles.map((v) => ({ ...v, isCurrentVehicle: false }))];
    }

    return [
      ownedVehicle,
      {
        id: 'honri-ve2',
        name: 'Honri Ve 2.0 EV',
        fuelType: 'ev' as const,
        pricePkr: 3599000,
        kwhPer100Km: 14.0,
        fiveYearDepreciationPct: 30,
        annualMaintenancePkr: 20000,
      },
    ];
  })();

  let lifeGoals: LifeGoal[] = [...(profile.lifeGoals ?? [])];
  lifeGoals = mergeWizardGoal(
    lifeGoals, draft.weddingGoalId, WIZARD_WEDDING_GOAL_ID,
    'Wedding Ceremony', draft.weddingAge, draft.weddingCost, draft.age
  );
  lifeGoals = mergeWizardGoal(
    lifeGoals, draft.houseGoalId, WIZARD_HOUSE_GOAL_ID,
    'Home Construction / Downpayment', draft.houseAge, draft.houseCost, draft.age
  );

  return {
    ...profile,
    role: draft.role,
    gender: draft.gender,
    isBreadwinner: draft.isBreadwinner,
    age: draft.age,
    retirementAge: draft.retirementAge,
    maritalStatus: draft.maritalStatus,
    familyMembers: draft.familyMembers,
    taxStatus: draft.taxStatus,
    shariahOnly: draft.shariahOnly,
    includeZakat: draft.includeZakat,
    monthlyIncomePkr: draft.monthlyIncomePkr,
    monthlyInvestPkr: draft.monthlyInvestPkr,
    annualSalaryRaisePct: draft.annualSalaryRaisePct,
    lumpSumPkr: draft.lumpSumPkr,
    currentCashReservePkr: draft.currentCashReservePkr,
    expenses: {
      fuelAndCommute: draft.fuelAndCommute,
      utilitiesAndInternet: draft.utilitiesAndInternet,
      groceriesAndFood: draft.groceriesAndFood,
      rentOrHousing: draft.rentOrHousing,
      familyAndOther: draft.familyAndOther,
    },
    dailyCommuteKm: draft.dailyCommuteKm,
    // Single source of truth for Step 5 (NOTES #44): the profile-level
    // fields are written on EVERY save, alongside the vehicles[] mirror.
    currentVehicleType,
    currentVehicleResalePkr,
    solarKw: draft.solarKw,
    solarTariffMode: draft.solarTariffMode,
    vehicles: compiledVehicles,
    lifeGoals,
  };
}
