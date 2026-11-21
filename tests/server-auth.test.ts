import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  hashToken,
  newId,
} from '@/lib/server/passwords';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { PRESET_PROFILES } from '@/data/marketData';
import type { UserProfile } from '@/types';

describe('server password hashing (scrypt)', () => {
  it('verifies the correct password and rejects a wrong one', () => {
    const stored = hashPassword('hunter2-secret');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('hunter2-secret', stored)).toBe(true);
    expect(verifyPassword('hunter2-WRONG', stored)).toBe(false);
  });

  it('uses a fresh salt every time (same password, different hashes)', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'));
  });

  it('rejects malformed stored values instead of throwing', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$abc$def')).toBe(false);
  });
});

describe('session tokens', () => {
  it('are unique, and only their hash is stable for lookup', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBe(64);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(a);
  });

  it('newId carries the prefix', () => {
    expect(newId('usr').startsWith('usr_')).toBe(true);
    expect(newId('port').startsWith('port_')).toBe(true);
  });
});

describe('car decision ranking (podium vs leaderboard regression)', () => {
  it('returns results ranked by 5-year TCO so results[0] is the true #1', () => {
    const base = (PRESET_PROFILES[0].profile || PRESET_PROFILES[0]) as UserProfile;
    // Current vehicle listed FIRST in the profile is an expensive petrol car;
    // a cheap e-scooty is second. Before the fix the podium crowned the car
    // simply because it was first in the array.
    const profile: UserProfile = {
      ...base,
      dailyCommuteKm: 25,
      vehicles: [
        {
          id: 'expensive-car',
          name: 'Expensive Petrol Car',
          fuelType: 'petrol',
          pricePkr: 8500000,
          isCurrentVehicle: true,
          kmPerLitre: 11,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 120000,
        },
        {
          id: 'cheap-scooty',
          name: 'Cheap E-Scooty',
          fuelType: 'e-scooty',
          pricePkr: 240000,
          kwhPer100Km: 3,
          fiveYearDepreciationPct: 30,
          annualMaintenancePkr: 8000,
        },
      ],
    };
    const decision = evaluateCarDecision(profile);
    expect(decision.results.length).toBe(2);
    expect(decision.results[0].vehicleId).toBe('cheap-scooty');
    expect(decision.cheapestVehicleId).toBe('cheap-scooty');
    expect(decision.results[0].totalFiveYearCostPkr).toBeLessThan(decision.results[1].totalFiveYearCostPkr);
  });
});
