'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, Info, HelpCircle } from 'lucide-react';

export function WhatThisCantTellYou() {
  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 space-y-4 text-xs text-zinc-400">
      <div className="flex items-center gap-2 text-white font-bold text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span>What This Model Can't Tell You: Institutional Realities of Pakistan</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Currency & Inflation Shocks</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            While we model an 8% annual inflation baseline, Pakistan historically experiences burst inflation cycles (20%–38%) triggered by IMF tariff adjustments and PKR devaluation. Holding physical 24K gold alongside PSX equities acts as your foreign exchange anchor.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-amber-400 font-semibold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Quarterly Lumpy Dry Spells</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            PSX dividends do not arrive like a monthly salary cheque on the 1st of the month. They cluster in March, May, August, and November. In dry months like January or July, your <strong>4-month emergency buffer</strong> prevents forced share liquidations.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>FBR Tax Policy Drift</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            Withholding tax rates under Section 150 (currently 15% for filers and 30% for non-filers) and Super Tax thresholds are subject to annual Federal Budget amendments. Filers consistently retain substantially superior compounding power.
          </p>
        </div>
      </div>
    </div>
  );
}
