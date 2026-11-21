'use client';

import React, { useState } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import { DEFAULT_MARKET_RATES } from '@/lib/marketRates';
import { SlidersHorizontal, X, RotateCcw, Check, Sun, Fuel, DollarSign, Coins } from 'lucide-react';

export function MarketPulseBar() {
  const { profile, updateProfile, showToast, hideAmounts } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  // Temporary local edit state for modal
  const [goldRate, setGoldRate] = useState<number>(profile.goldPerTolaPkr || DEFAULT_MARKET_RATES.goldPerTolaPkr);
  const [usdRate, setUsdRate] = useState<number>(profile.usdToPkr || DEFAULT_MARKET_RATES.usdToPkr);
  const [petrolRate, setPetrolRate] = useState<number>(profile.petrolPricePerLitre || DEFAULT_MARKET_RATES.petrolPricePerLitre);
  const [gridRate, setGridRate] = useState<number>(profile.gridRatePerKwh || DEFAULT_MARKET_RATES.gridRatePerKwh);

  const handleOpen = () => {
    setGoldRate(profile.goldPerTolaPkr || DEFAULT_MARKET_RATES.goldPerTolaPkr);
    setUsdRate(profile.usdToPkr || DEFAULT_MARKET_RATES.usdToPkr);
    setPetrolRate(profile.petrolPricePerLitre || DEFAULT_MARKET_RATES.petrolPricePerLitre);
    setGridRate(profile.gridRatePerKwh || DEFAULT_MARKET_RATES.gridRatePerKwh);
    setIsOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      goldPerTolaPkr: Number(goldRate),
      usdToPkr: Number(usdRate),
      petrolPricePerLitre: Number(petrolRate),
      gridRatePerKwh: Number(gridRate),
    });
    setIsOpen(false);
    showToast('Market benchmark rates updated!');
  };

  const handleReset = () => {
    setGoldRate(DEFAULT_MARKET_RATES.goldPerTolaPkr);
    setUsdRate(DEFAULT_MARKET_RATES.usdToPkr);
    setPetrolRate(DEFAULT_MARKET_RATES.petrolPricePerLitre);
    setGridRate(DEFAULT_MARKET_RATES.gridRatePerKwh);
  };

  return (
    <>
      {/* Top Pulse Bar */}
      <div className="w-full bg-[#F6F1E7] border-b border-white/[0.06] text-[11px] font-mono text-zinc-400 py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="tracking-wide">MARKET PULSE</span>
            </div>

            {/* Gold */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">24K GOLD:</span>
              <span className="font-bold text-amber-300">
                {hideAmounts ? '•••••' : `Rs ${(profile.goldPerTolaPkr || 379836).toLocaleString('en-PK')}`}
              </span>
              <span className="text-rose-400 text-[10px]">▼ 5d</span>
            </div>

            {/* Silver */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">SILVER:</span>
              <span className="font-bold text-slate-300">
                {hideAmounts ? '•••••' : 'Rs 4,708'}
              </span>
              <span className="text-rose-400 text-[10px]">▼ 3d</span>
            </div>

            {/* USD */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">USD/PKR:</span>
              <span className="font-bold text-emerald-400">
                Rs {profile.usdToPkr || DEFAULT_MARKET_RATES.usdToPkr}
              </span>
            </div>

            {/* Petrol */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-zinc-500">PETROL:</span>
              <span className="font-bold text-white">
                Rs {profile.petrolPricePerLitre || DEFAULT_MARKET_RATES.petrolPricePerLitre}/L
              </span>
            </div>

            {/* Grid */}
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-zinc-500">GRID:</span>
              <span className="font-bold text-white">
                Rs {profile.gridRatePerKwh || DEFAULT_MARKET_RATES.gridRatePerKwh}/kWh
              </span>
            </div>
          </div>

          {/* Adjust Rates Button */}
          <button
            onClick={handleOpen}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors shrink-0"
          >
            <SlidersHorizontal className="w-3 h-3 text-amber-400" />
            <span>Adjust Rates</span>
          </button>
        </div>
      </div>

      {/* Adjust Rates Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#FBF8F0] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-base text-white">Adjust Market Benchmark Rates</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  24K Gold Price per Tola (PKR)
                </label>
                <input
                  type="number"
                  step={1000}
                  value={goldRate}
                  onChange={(e) => setGoldRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 font-mono text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  USD to PKR Exchange Rate
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={usdRate}
                  onChange={(e) => setUsdRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 font-mono text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-rose-400" />
                  Petrol Price (PKR / Litre)
                </label>
                <input
                  type="number"
                  step={1}
                  value={petrolRate}
                  onChange={(e) => setPetrolRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 font-mono text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-yellow-400" />
                  Grid Electricity Rate (PKR / kWh)
                </label>
                <input
                  type="number"
                  step={1}
                  value={gridRate}
                  onChange={(e) => setGridRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-white/10 font-mono text-white text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1 text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Defaults</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                  >
                    Apply Overrides
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
