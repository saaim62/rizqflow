'use client';

import React, { useState } from 'react';
import { VehicleCandidate, BankEmiQuote } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Car, 
  Bike, 
  Zap, 
  Fuel, 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Landmark, 
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface VehicleCardListProps {
  vehicles: VehicleCandidate[];
  onChange: (updatedVehicles: VehicleCandidate[]) => void;
}

export function VehicleCardList({ vehicles, onChange }: VehicleCardListProps) {
  const { formatPkrMasked } = useProfile();
  const [openEmiId, setOpenEmiId] = useState<string | null>(null);

  const toggleEmi = (id: string) => {
    setOpenEmiId(openEmiId === id ? null : id);
  };

  const updateVehicle = (id: string, updates: Partial<VehicleCandidate>) => {
    const updated = vehicles.map((v) => (v.id === id ? { ...v, ...updates } : v));
    onChange(updated);
  };

  const updateEmiQuote = (id: string, emiUpdates: Partial<BankEmiQuote>) => {
    const updated = vehicles.map((v) => {
      if (v.id !== id) return v;
      const currentQuote: BankEmiQuote = v.emiQuote || {
        enabled: false,
        downPaymentPkr: 0,
        monthlyInstallmentPkr: 0,
        tenureMonths: 36,
      };
      return {
        ...v,
        emiQuote: {
          ...currentQuote,
          ...emiUpdates,
        },
      };
    });
    onChange(updated);
  };

  const removeVehicle = (id: string) => {
    onChange(vehicles.filter((v) => v.id !== id));
  };

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-amber-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Vehicle Contenders & Bank Financing Quotes
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Compare purchase prices, fuel economy, maintenance budgets, and real bank financing quotes
          </p>
        </div>

        <span className="text-xs font-mono text-zinc-400">
          {vehicles.length} Candidates Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => {
          const isBike = v.fuelType === 'e-scooty';
          const isEv = v.fuelType === 'ev';
          const isEmiOpen = openEmiId === v.id;
          const hasEmi = v.emiQuote && v.emiQuote.enabled;
          const isQuoteIncomplete =
            hasEmi &&
            (!v.emiQuote?.downPaymentPkr ||
              !v.emiQuote?.monthlyInstallmentPkr ||
              !v.emiQuote?.tenureMonths ||
              v.emiQuote.downPaymentPkr <= 0 ||
              v.emiQuote.monthlyInstallmentPkr <= 0);

          return (
            <div
              key={v.id}
              className="rounded-xl bg-[#FDFBF6] border border-white/[0.08] p-4 flex flex-col justify-between space-y-4 hover:border-white/15 transition-all"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isEv
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isBike
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}
                    >
                      {isBike ? <Bike className="w-4 h-4" /> : isEv ? <Zap className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{v.name}</h4>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase">
                        {v.fuelType}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeVehicle(v.id)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Remove vehicle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Price and Efficiency Inputs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">
                      Price / Resale (PKR)
                    </label>
                    <input
                      type="number"
                      step={50000}
                      value={v.pricePkr}
                      onChange={(e) => updateVehicle(v.id, { pricePkr: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FDFBF6] border border-white/10 font-mono text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">
                      {v.fuelType === 'petrol' ? 'Mileage (km/L)' : 'kWh / 100km'}
                    </label>
                    {v.fuelType === 'petrol' ? (
                      <input
                        type="number"
                        step={0.5}
                        value={v.kmPerLitre || 14}
                        onChange={(e) =>
                          updateVehicle(v.id, { kmPerLitre: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FDFBF6] border border-white/10 font-mono text-white text-xs"
                      />
                    ) : (
                      <input
                        type="number"
                        step={0.5}
                        value={v.kwhPer100Km || (isBike ? 3.5 : 14)}
                        onChange={(e) =>
                          updateVehicle(v.id, { kwhPer100Km: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#FDFBF6] border border-white/10 font-mono text-white text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">
                      5-Yr Deprec. (%)
                    </label>
                    <input
                      type="number"
                      step={5}
                      min={0}
                      max={100}
                      value={v.fiveYearDepreciationPct}
                      onChange={(e) =>
                        updateVehicle(v.id, { fiveYearDepreciationPct: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FDFBF6] border border-white/10 font-mono text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">
                      Maint / Year (PKR)
                    </label>
                    <input
                      type="number"
                      step={5000}
                      value={v.annualMaintenancePkr}
                      onChange={(e) =>
                        updateVehicle(v.id, { annualMaintenancePkr: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#FDFBF6] border border-white/10 font-mono text-white text-xs"
                    />
                  </div>
                </div>

                {/* Bank EMI Financing Quote Accordion */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    onClick={() => toggleEmi(v.id)}
                    className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-white py-1"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                      <Landmark className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bank Financing / EMI Quote</span>
                      {hasEmi && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                          Active
                        </span>
                      )}
                    </span>
                    {isEmiOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isEmiOpen && (
                    <div className="mt-2 p-3 rounded-lg bg-black/[0.05] border border-white/10 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-zinc-300">Enable Bank EMI Quote</label>
                        <input
                          type="checkbox"
                          checked={v.emiQuote?.enabled || false}
                          onChange={(e) => updateEmiQuote(v.id, { enabled: e.target.checked })}
                          className="accent-emerald-400 rounded"
                        />
                      </div>

                      {v.emiQuote?.enabled && (
                        <div className="space-y-2 pt-1 border-t border-white/5">
                          {isQuoteIncomplete && (
                            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              <span>Quote incomplete: Down payment or monthly installment missing.</span>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">
                              Down Payment (PKR)
                            </label>
                            <input
                              type="number"
                              step={50000}
                              placeholder="e.g. 500000"
                              value={v.emiQuote?.downPaymentPkr || ''}
                              onChange={(e) =>
                                updateEmiQuote(v.id, { downPaymentPkr: Number(e.target.value) })
                              }
                              className="w-full px-2 py-1 rounded bg-black border border-white/10 font-mono text-white text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                Monthly Installment
                              </label>
                              <input
                                type="number"
                                step={5000}
                                placeholder="e.g. 45000"
                                value={v.emiQuote?.monthlyInstallmentPkr || ''}
                                onChange={(e) =>
                                  updateEmiQuote(v.id, {
                                    monthlyInstallmentPkr: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1 rounded bg-black border border-white/10 font-mono text-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-0.5">
                                Tenure (Months)
                              </label>
                              <select
                                value={v.emiQuote?.tenureMonths || 36}
                                onChange={(e) =>
                                  updateEmiQuote(v.id, { tenureMonths: Number(e.target.value) })
                                }
                                className="w-full px-2 py-1 rounded bg-black border border-white/10 text-white text-xs"
                              >
                                <option value={12}>12 Mos (1 Yr)</option>
                                <option value={24}>24 Mos (2 Yrs)</option>
                                <option value={36}>36 Mos (3 Yrs)</option>
                                <option value={48}>48 Mos (4 Yrs)</option>
                                <option value={60}>60 Mos (5 Yrs)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
