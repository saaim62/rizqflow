'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import { DEFAULT_MARKET_RATES, saveCustomMarketRates } from '@/lib/marketRates';
import { AmountWords } from '@/components/ui/AmountWords';
import { useMarketSnapshot } from '@/lib/useMarketSnapshot';
import { METAL_ASSETS } from '@/data/marketData';
import { SlidersHorizontal, X, RotateCcw, Check, Sun, Fuel, DollarSign, Coins } from 'lucide-react';

export function MarketPulseBar() {
  const { profile, updateProfile, showToast, hideAmounts } = useProfile();
  const snap = useMarketSnapshot();
  const [isOpen, setIsOpen] = useState(false);

  // Derive gold and silver streaks from snapshot history
  const goldAsset = METAL_ASSETS.find((m) => m.id === 'gold-24k');
  const silverAsset = METAL_ASSETS.find((m) => m.id === 'silver-24k');
  const goldStreak = goldAsset?.streak?.currentStreak ?? 0;
  const silverStreak = silverAsset?.streak?.currentStreak ?? 0;

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
    const g = Number(goldRate);
    const u = Number(usdRate);
    const p = Number(petrolRate);
    const gr = Number(gridRate);

    if (
      !Number.isFinite(g) || g <= 0 ||
      !Number.isFinite(u) || u <= 0 ||
      !Number.isFinite(p) || p <= 0 ||
      !Number.isFinite(gr) || gr <= 0
    ) {
      showToast('All rates must be positive finite numbers.');
      return;
    }

    updateProfile({
      goldPerTolaPkr: g,
      usdToPkr: u,
      petrolPricePerLitre: p,
      gridRatePerKwh: gr,
    });
    saveCustomMarketRates({
      goldPerTolaPkr: g,
      usdToPkr: u,
      petrolPricePerLitre: p,
      gridRatePerKwh: gr,
    });
    snap.refresh();
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
      <div className="w-full bg-[#050505] border-b border-white/[0.06] text-[11px] font-mono text-zinc-400 py-1.5 px-4 sm:px-6">
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
                {hideAmounts ? '•••••' : `Rs ${snap.rates.goldPerTolaPkr.toLocaleString('en-PK')}`}
              </span>
              {goldStreak !== 0 && (
                <span className={`${goldStreak < 0 ? 'text-rose-400' : 'text-emerald-400'} text-[10px]`}>
                  {goldStreak < 0 ? `▼ ${Math.abs(goldStreak)}d` : `▲ ${goldStreak}d`}
                </span>
              )}
            </div>

            {/* Silver */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">SILVER:</span>
              <span className="font-bold text-slate-300">
                {hideAmounts ? '•••••' : `Rs ${snap.silverPerTolaPkr.toLocaleString('en-PK')}`}
              </span>
              {silverStreak !== 0 && (
                <span className={`${silverStreak < 0 ? 'text-rose-400' : 'text-emerald-400'} text-[10px]`}>
                  {silverStreak < 0 ? `▼ ${Math.abs(silverStreak)}d` : `▲ ${silverStreak}d`}
                </span>
              )}
            </div>

            {/* USD */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">USD/PKR:</span>
              <span className="font-bold text-emerald-400">
                Rs {snap.rates.usdToPkr}
              </span>
            </div>

            {/* Petrol */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-zinc-500">PETROL:</span>
              <span className="font-bold text-white">
                Rs {snap.rates.petrolPricePerLitre}/L
              </span>
            </div>

            {/* Grid */}
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-zinc-500">GRID:</span>
              <span className="font-bold text-white">
                Rs {snap.rates.gridRatePerKwh}/kWh
              </span>
            </div>
          </div>

          {/* Hourly sync stamp + manual refresh */}
          <button
            onClick={() => snap.refresh()}
            title="Rates re-sync automatically every hour — tap to refresh now"
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{snap.updatedAt ? `Synced ${new Date(snap.updatedAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}` : 'Hourly sync'}</span>
          </button>

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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-rates-title"
            className="relative w-full max-w-md bg-[#0C0C0F] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <h3 id="market-rates-title" className="font-bold text-base text-white">Adjust Market Benchmark Rates</h3>
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
                <AmountWords value={goldRate} />
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
