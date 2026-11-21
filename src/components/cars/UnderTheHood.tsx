'use client';

import React from 'react';
import { ShieldCheck, Sun, Coins, Landmark, AlertCircle } from 'lucide-react';

export function UnderTheHood() {
  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 space-y-4 text-xs text-zinc-400">
      <div className="flex items-center gap-2 text-white font-bold text-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Under the Hood: Institutional Pakistani Vehicle TCO Assumptions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-amber-400 font-semibold flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5" />
            <span>Solar Charging is Never Rs 0</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            Many dealers falsely market EV charging as "100% free with solar". In reality, every kilowatt-hour sent to your car is a unit you could have exported to DISCO at <strong>Rs 11 (2026 gross billing)</strong> or <strong>Rs 26 (legacy net metering)</strong>. RizqFlow honestly models this foregone revenue.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" />
            <span>10% Capital Opportunity Cost</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            Tying up Rs 40–80 Lac in a depreciating vehicle prevents that money from earning <strong>10%–14% compounding</strong> in PSX Grade-A blue-chip dividend machines or sovereign money-market funds. We factor in 5-year foregone compound interest.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
          <div className="text-blue-400 font-semibold flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5" />
            <span>Exact Bank Quote Validation</span>
          </div>
          <p className="leading-relaxed text-[11px] text-zinc-400">
            Rather than relying on misleading "flat interest rate" advertisements, RizqFlow takes the real bank quote (Down Payment + Installments × Tenure) and calculates the exact net interest drained from your household.
          </p>
        </div>
      </div>
    </div>
  );
}
