'use client';

import React, { useMemo, Suspense } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { VerdictBanner } from '@/components/cars/VerdictBanner';
import { CarPodium3D } from '@/components/cars/CarPodium3D';
import { ApplyCarSwapBanner } from '@/components/cars/ApplyCarSwapBanner';
import { CarControls } from '@/components/cars/CarControls';
import { RealCostLeaderboard } from '@/components/cars/RealCostLeaderboard';
import { DistanceCrossoverChart } from '@/components/cars/DistanceCrossoverChart';
import { VehicleCardList } from '@/components/cars/VehicleCardList';
import { UnderTheHood } from '@/components/cars/UnderTheHood';
import { VehicleCandidate } from '@/types';
import { Car, Zap, Trophy, ShieldCheck, Sparkles, RotateCcw } from 'lucide-react';

const DEFAULT_CARS: VehicleCandidate[] = [
  {
    id: 'alsvin-petrol',
    name: 'Changan Alsvin 1.3L Petrol',
    fuelType: 'petrol',
    pricePkr: 3800000,
    kmPerLitre: 14,
    fiveYearDepreciationPct: 35,
    annualMaintenancePkr: 60000,
  },
  {
    id: 'honri-ve-2',
    name: 'Honri Ve 2.0 (200km EV)',
    fuelType: 'ev',
    pricePkr: 3999000,
    kwhPer100Km: 13,
    fiveYearDepreciationPct: 30,
    annualMaintenancePkr: 25000,
  },
  {
    id: 'nissan-leaf',
    name: 'Nissan Leaf 40kWh EV',
    fuelType: 'ev',
    pricePkr: 4800000,
    kwhPer100Km: 15,
    fiveYearDepreciationPct: 40,
    annualMaintenancePkr: 35000,
  },
  {
    id: 'yadea-m3',
    name: 'Yadea M3 E-Scooty',
    fuelType: 'e-scooty',
    pricePkr: 250000, // Rs 2.5 Lac
    kwhPer100Km: 3.5,
    fiveYearDepreciationPct: 25,
    annualMaintenancePkr: 12000,
  },
  {
    id: 'cd70-petrol',
    name: 'Honda CD70 Petrol Bike',
    fuelType: 'petrol',
    pricePkr: 160000,
    kmPerLitre: 50,
    fiveYearDepreciationPct: 20,
    annualMaintenancePkr: 15000,
  },
];

function CarDecisionContent() {
  const { profile, updateProfile, showToast } = useProfile();

  // If profile vehicles are empty, default to standard fleet
  const activeVehicles = useMemo(() => {
    if (profile.vehicles && profile.vehicles.length > 0) {
      return profile.vehicles;
    }
    return DEFAULT_CARS;
  }, [profile.vehicles]);

  const activeProfile = useMemo(() => {
    return {
      ...profile,
      vehicles: activeVehicles,
    };
  }, [profile, activeVehicles]);

  const decision = useMemo(() => {
    return evaluateCarDecision(activeProfile);
  }, [activeProfile]);

  const handleResetVehicles = () => {
    updateProfile({ vehicles: DEFAULT_CARS });
    showToast('Reset vehicles to default market contenders');
  };

  return (
    <div className="min-h-screen py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Car className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Car Decision Map: 5-Year Total Cost of Ownership
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-semibold">
              Pakistan Arbitrage Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Compare true 5-year running costs of Petrol vs EV vs E-Scooty with real solar export opportunity costs, depreciation, maintenance, and bank interest
          </p>
        </div>

        <button
          onClick={handleResetVehicles}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-semibold transition-all self-start md:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
          <span>Reset Cars Fleet</span>
        </button>
      </div>

      {/* 1. Bold Verdict Banner */}
      <VerdictBanner decision={decision} />

      {/* 1b. 3D Podium for #1 Lowest Cost Vehicle */}
      {decision.results.length > 0 && (
        <CarPodium3D cheapest={decision.results[0]} runnerUp={decision.results[1]} />
      )}

      {/* 1c. Car-to-Wealth Arbitrage Bridge */}
      <ApplyCarSwapBanner decision={decision} profile={activeProfile} />

      {/* 2. Controls & Tariff Adjuster */}
      <CarControls profile={activeProfile} onChange={updateProfile} />

      {/* 3. Editable Vehicle Contenders & Bank Financing — directly under
          the driving/economic parameters and above the leaderboard, so the
          user edits the fleet first and reads the ranking second
          (owner instruction, 22 Nov 2026, NOTES #26) */}
      <VehicleCardList
        vehicles={activeVehicles}
        onChange={(updated) => updateProfile({ vehicles: updated })}
      />

      {/* 4. Real Cost Leaderboard (Ranked + 5-step "See Why" waterfall) */}
      <RealCostLeaderboard decision={decision} />

      {/* 5. Distance Crossover LineChart */}
      <DistanceCrossoverChart
        decision={decision}
        vehicles={activeVehicles}
        currentDailyKm={activeProfile.dailyCommuteKm || 30}
      />

      {/* 6. Under The Hood Disclosures */}
      <UnderTheHood />
    </div>
  );
}

export default function CarsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-zinc-500 font-mono">
          Loading Car Decision Engine...
        </div>
      }
    >
      <CarDecisionContent />
    </Suspense>
  );
}
