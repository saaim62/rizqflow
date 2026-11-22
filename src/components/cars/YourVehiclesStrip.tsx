'use client';

import React from 'react';
import { CarDecisionSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { BadgeCheck, Bike, Car, KeyRound, Zap } from 'lucide-react';

/**
 * YourVehiclesStrip — the owner's own vehicles, shown at the very top
 * of the Cars page (NOTES #33, owner request). Until now the
 * isCurrentVehicle flag existed only in the data: the swap banner's
 * math used it, but nothing on screen said which vehicle was yours.
 * This strip makes ownership the first thing a user sees, supports
 * more than one owned vehicle, and points at the "I own this"
 * checkbox on each vehicle card when nothing is marked yet.
 */

interface YourVehiclesStripProps {
  decision: CarDecisionSummary;
  profile: UserProfile;
}

export function YourVehiclesStrip({ decision, profile }: YourVehiclesStripProps) {
  const { formatPkrMasked } = useProfile();
  const owned = (profile.vehicles || []).filter((v) => v.isCurrentVehicle);

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-amber-400/30 p-5 sm:p-6 shadow-xl space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-400" />
        <h3 className="font-bold text-base text-white">Your Vehicles</h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold">
          {owned.length} OWNED
        </span>
      </div>

      {owned.length === 0 ? (
        <p className="text-xs text-zinc-400 leading-relaxed">
          No vehicle is marked as yours yet. Tick <strong className="text-zinc-200">“I own this”</strong> on
          any vehicle card below and it will appear here — you can own more than one.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {owned.map((v) => {
            const result = decision.results.find((r) => r.vehicleId === v.id);
            return (
              <div
                key={v.id}
                className="rounded-xl bg-amber-400/[0.06] border border-amber-400/40 px-4 py-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  {v.fuelType === 'e-scooty' ? (
                    <Bike className="w-4 h-4" />
                  ) : v.fuelType === 'ev' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Car className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate">{v.name}</span>
                    <BadgeCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {formatPkrMasked(v.pricePkr)}
                    {result
                      ? ` · ${formatPkrMasked(Math.round(result.realCostPerMonthPkr))}/mo true cost`
                      : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
