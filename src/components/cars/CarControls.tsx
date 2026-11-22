'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, SolarTariffMode } from '@/types';
import { Sun, Gauge, Percent, Fuel, Zap } from 'lucide-react';

interface CarControlsProps {
  profile: UserProfile;
  onChange: (updated: Partial<UserProfile>) => void;
}

export function CarControls({ profile, onChange }: CarControlsProps) {
  const solarTariff = profile.solarTariffMode ?? 'net-billing-2026';
  const dailyKm = profile.dailyCommuteKm ?? 30;
  const oppCost = profile.opportunityCostReturnPct ?? 10;
  const petrolPrice = profile.petrolPricePerLitre ?? 322;
  const [rawPetrolPrice, setRawPetrolPrice] = useState<string>(String(profile.petrolPricePerLitre ?? 322));

  useEffect(() => {
    setRawPetrolPrice(String(profile.petrolPricePerLitre ?? 322));
  }, [profile.petrolPricePerLitre]);

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Economic Parameters & Driving Profile</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Customize solar export tariffs, daily distance, and capital opportunity cost
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Solar Tariff 3-Way Toggle */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Solar Charging Opportunity Cost
            </span>
          </label>

          <div className="grid grid-cols-1 gap-1.5 bg-[#0C0C0F] p-1 rounded-xl border border-white/5 text-xs">
            <button
              onClick={() => onChange({ solarTariffMode: 'net-metering-legacy' })}
              className={`p-2 rounded-lg text-left transition-all ${
                solarTariff === 'net-metering-legacy'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>Legacy Net Metering</span>
                <span className="font-mono font-bold">Rs 26 / kWh</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                Old 1:1 units or historic NEPRA export rate
              </span>
            </button>

            <button
              onClick={() => onChange({ solarTariffMode: 'net-billing-2026' })}
              className={`p-2 rounded-lg text-left transition-all ${
                solarTariff === 'net-billing-2026'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>2026 Gross Billing (Current)</span>
                <span className="font-mono font-bold">Rs 11 / kWh</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                DISCO buyback benchmark (cheapest EV charging)
              </span>
            </button>

            <button
              onClick={() => onChange({ solarTariffMode: 'none' })}
              className={`p-2 rounded-lg text-left transition-all ${
                solarTariff === 'none'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>No Solar (Grid Tariff)</span>
                <span className="font-mono font-bold">Rs 55 / kWh</span>
              </div>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                Standard peak/off-peak grid electricity
              </span>
            </button>
          </div>
        </div>

        {/* 2. Daily Commute Slider */}
        <div className="space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                Daily Round-Trip Commute
              </label>
              <span className="text-sm font-bold font-mono text-white tabular-nums">
                {dailyKm} km / day
              </span>
            </div>

            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={dailyKm}
              onChange={(e) => onChange({ dailyCommuteKm: Number(e.target.value) })}
              className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-white/10"
            />

            <div className="relative text-[10px] font-mono text-zinc-500 mt-1 h-4">
              <span className="absolute left-0">5 km</span>
              <span className="absolute -translate-x-1/2" style={{ left: '26.3%' }}>30 km (Avg)</span>
              <span className="absolute -translate-x-1/2" style={{ left: '57.9%' }}>60 km</span>
              <span className="absolute right-0">100 km</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5 space-y-1 text-xs">
            <span className="text-zinc-400 block text-[11px]">5-Year Total Distance:</span>
            <div className="font-mono font-bold text-white text-sm">
              {(dailyKm * 365 * 5).toLocaleString('en-PK')} km
            </div>
            <span className="text-[10px] text-zinc-500 block">
              ~{(dailyKm * 30).toLocaleString('en-PK')} km / month
            </span>
          </div>
        </div>

        {/* 3. Opportunity Cost & Petrol Price */}
        <div className="space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
                Capital Opportunity Cost
              </label>
              <span className="text-sm font-bold font-mono text-white tabular-nums">
                {oppCost}% p.a.
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={oppCost}
              onChange={(e) => onChange({ opportunityCostReturnPct: Number(e.target.value) })}
              className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-white/10"
            />
            <div className="relative text-[10px] font-mono text-zinc-500 mt-1 h-4">
              <span className="absolute left-0">0%</span>
              <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>10% (PSX avg)</span>
              <span className="absolute right-0">20%</span>
            </div>
            <span className="text-[10px] text-zinc-400 block mt-1">
              Alternative return if cash was kept in PSX Grade-A dividends or money market funds.
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Fuel className="w-3.5 h-3.5 text-rose-400" />
                Petrol Price (PKR / Litre)
              </label>
              <span className="text-sm font-bold font-mono text-white tabular-nums">
                Rs {rawPetrolPrice || '0'}
              </span>
            </div>
            <input
              type="number"
              min={150}
              max={500}
              step={5}
              value={rawPetrolPrice}
              onChange={(e) => {
                const val = e.target.value;
                setRawPetrolPrice(val);
                if (val !== '') {
                  onChange({ petrolPricePerLitre: Number(val) });
                }
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
