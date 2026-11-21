'use client';

import React from 'react';
import { VehicleTcoResult } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { SpatialCard3D } from '@/components/ui/SpatialCard3D';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Trophy, Zap, Fuel, Bike, Car, Sparkles, CheckCircle2 } from 'lucide-react';

interface CarPodium3DProps {
  cheapest: VehicleTcoResult;
  runnerUp?: VehicleTcoResult;
}

export function CarPodium3D({ cheapest, runnerUp }: CarPodium3DProps) {
  const { formatPkrMasked, formatCompactPkrMasked, hideAmounts } = useProfile();

  const isEv = cheapest.fuelType === 'ev';
  const isBike = cheapest.fuelType === 'e-scooty';
  const fiveYearDiff = runnerUp
    ? runnerUp.totalFiveYearCostPkr - cheapest.totalFiveYearCostPkr
    : 0;

  return (
    <SpatialCard3D
      spotlightColor="rgba(212, 175, 55, 0.18)"
      className="p-6 sm:p-8 bg-gradient-to-br from-[#17122B] via-[#2A1E52] to-[#0D0A1A] border border-purple-400/30"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-extrabold shadow-lg shadow-amber-500/30">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300 font-mono">
                  #1 Lowest 5-Year True TCO
                </span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                  PODIUM WINNER
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {cheapest.name}
              </h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
            By factoring in fuel, charging tariffs, 35% depreciation, and 10% equity opportunity cost, this vehicle delivers the lowest true monthly economic drain on your household.
          </p>

          {fiveYearDiff > 0 && runnerUp && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Saves <strong className="text-white">{formatCompactPkrMasked(fiveYearDiff)}</strong> over 5 years vs {runnerUp.name}!
              </span>
            </div>
          )}
        </div>

        {/* Right Podium Display Column */}
        <div className="p-5 rounded-2xl bg-black/[0.05] border border-white/10 flex flex-col justify-between space-y-4 min-w-[240px]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-semibold">
              True Economic Drain
            </span>
            <div className="text-3xl sm:text-4xl font-mono font-extrabold text-emerald-400 tabular-nums mt-1">
              {hideAmounts ? (
                'Rs •••••'
              ) : (
                <AnimatedNumber
                  value={cheapest.realCostPerMonthPkr}
                  prefix="Rs "
                  suffix=" / mo"
                />
              )}
            </div>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              5-Year Total: {formatCompactPkrMasked(cheapest.totalFiveYearCostPkr)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 font-mono text-xs">
            <div>
              <span className="text-zinc-500 text-[10px] block">Fuel / Charging</span>
              <span className="font-bold text-white text-xs">
                {formatCompactPkrMasked(cheapest.fiveYearFuelOrChargePkr)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] block">Depreciation</span>
              <span className="font-bold text-white text-xs">
                {formatCompactPkrMasked(cheapest.fiveYearDepreciationPkr)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SpatialCard3D>
  );
}
