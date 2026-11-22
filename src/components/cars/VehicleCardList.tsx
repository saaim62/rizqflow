'use client';

import React, { useState } from 'react';
import { VehicleCandidate, BankEmiQuote } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { AmountWords } from '@/components/ui/AmountWords';
import { AiButton } from '@/components/ui/AiButton';
import { FieldInfo } from '@/components/ui/FieldInfo';
import { formatCompactPkr } from '@/lib/format';
import { useAiAssist } from '@/components/providers/AiAssistProvider';
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
  RotateCcw,
  Sparkles,
  Loader2
} from 'lucide-react';

interface VehicleCardListProps {
  vehicles: VehicleCandidate[];
  onChange: (updatedVehicles: VehicleCandidate[]) => void;
}


/** Plain-language field explanations (NOTES #32) — shown by the small
 * "i" beside each hard-to-understand field. */
const INFO = {
  price: {
    title: 'Price / Resale — what it means',
    text: `For a vehicle you own: what you could sell it for TODAY. For one you are comparing to buy: its purchase price today.

Every vehicle is compared from this same starting point, so the 5-year costs are fair.`,
  },
  depreciation: {
    title: '5-year depreciation — what it means',
    text: `How much of today's price this vehicle will LOSE over the next 5 years.

Example: a car worth Rs 30 Lac today with 50% depreciation loses Rs 15 Lac — you would sell it for about Rs 15 Lac after 5 years. That loss is a real cost of owning it, and it is counted in the 5-year total.

Vehicles with strong resale in Pakistan (Toyota, Honda, Suzuki) lose less. Slow-selling models and most EVs lose more.`,
  },
  maintenance: {
    title: 'Maintenance / year — what it means',
    text: `What you expect to spend in a typical year on oil, filters, brakes, tyres and minor repairs — not fuel, not insurance.

EVs and e-scooties need far less maintenance than petrol cars.`,
  },
  effPetrol: {
    title: 'Mileage (km/L) — what it means',
    text: `How many kilometres this vehicle runs on 1 litre of petrol. Higher is cheaper to run.

Use your real city average, not the company claim — Lahore traffic usually gives 10-20% less than the brochure figure.`,
  },
  effEv: {
    title: 'kWh / 100km — what it means',
    text: `How much electricity this vehicle uses to drive 100 km. Lower is cheaper to run.

Don't know yours? Work it out from the battery:
Usable battery = battery size x battery health (SOH)
Consumption = usable battery / range on a full charge x 100

Example — a Nissan Leaf with a 40 kWh battery at 80% health has 32 kWh usable. If it runs 200 km on that, it uses 32 / 200 x 100 = 16 kWh/100km.`,
  },
  emiDown: {
    title: 'Down payment — what it means',
    text: `The amount you pay upfront when buying on a bank lease or loan. The rest is split into monthly installments.

A bigger down payment means smaller monthly payments, but more of your cash locked in today.`,
  },
  emiInstallment: {
    title: 'Monthly installment — what it means',
    text: `What the bank charges you every month for this vehicle, including their markup.

Take this figure from the bank's lease quote for the same vehicle and the same period.`,
  },
};

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

  // ---- AI Fill (one tap: depreciation + maintenance + efficiency) ----
  const { aiOn, predict } = useAiAssist();
  const [fillingId, setFillingId] = useState<string | null>(null);

  const aiFillVehicle = async (v: VehicleCandidate) => {
    setFillingId(v.id);
    const [dep, maint, eff] = await Promise.all([
      predict('car-depreciation', { name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr }),
      predict('car-maintenance', { name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr }),
      predict('car-efficiency', { name: v.name, fuelType: v.fuelType }),
    ]);
    const updates: Partial<VehicleCandidate> = {};
    if (dep) updates.fiveYearDepreciationPct = dep.value;
    if (maint) updates.annualMaintenancePkr = maint.value;
    if (eff) {
      if (v.fuelType === 'petrol') updates.kmPerLitre = eff.value;
      else updates.kwhPer100Km = eff.value;
    }
    if (Object.keys(updates).length > 0) updateVehicle(v.id, updates);
    setFillingId(null);
  };

  // ---- Add vehicle (NOTES #24) ----
  // This card previously had NO add control at all — existing candidates
  // could be edited or deleted, but a new one (e.g. another electric car)
  // could never be created from the Cars page.
  type FuelChoice = VehicleCandidate['fuelType'];
  const FUEL_DEFAULTS: Record<
    FuelChoice,
    { name: string; pricePkr: number; efficiency: number; fiveYearDepreciationPct: number; annualMaintenancePkr: number }
  > = {
    petrol: { name: 'New Petrol Car', pricePkr: 3500000, efficiency: 14, fiveYearDepreciationPct: 35, annualMaintenancePkr: 60000 },
    ev: { name: 'New Electric Car', pricePkr: 4800000, efficiency: 15, fiveYearDepreciationPct: 40, annualMaintenancePkr: 35000 },
    'e-scooty': { name: 'New E-Scooty', pricePkr: 250000, efficiency: 3.5, fiveYearDepreciationPct: 25, annualMaintenancePkr: 12000 },
  };
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    name: FUEL_DEFAULTS.ev.name,
    fuelType: 'ev' as FuelChoice,
    pricePkr: FUEL_DEFAULTS.ev.pricePkr,
    efficiency: FUEL_DEFAULTS.ev.efficiency,
    fiveYearDepreciationPct: FUEL_DEFAULTS.ev.fiveYearDepreciationPct,
    annualMaintenancePkr: FUEL_DEFAULTS.ev.annualMaintenancePkr,
  });

  const pickFuel = (fuelType: FuelChoice) => {
    const d = FUEL_DEFAULTS[fuelType];
    setDraft({
      name: d.name,
      fuelType,
      pricePkr: d.pricePkr,
      efficiency: d.efficiency,
      fiveYearDepreciationPct: d.fiveYearDepreciationPct,
      annualMaintenancePkr: d.annualMaintenancePkr,
    });
  };

  const addVehicle = () => {
    const vehicle: VehicleCandidate = {
      id: `veh-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      name: draft.name.trim() || FUEL_DEFAULTS[draft.fuelType].name,
      fuelType: draft.fuelType,
      pricePkr: draft.pricePkr,
      fiveYearDepreciationPct: draft.fiveYearDepreciationPct,
      annualMaintenancePkr: draft.annualMaintenancePkr,
      ...(draft.fuelType === 'petrol'
        ? { kmPerLitre: draft.efficiency }
        : { kwhPer100Km: draft.efficiency }),
    };
    onChange([...vehicles, vehicle]);
    setShowAdd(false);
  };

  const changeFuelType = (id: string, fuelType: FuelChoice) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    const updates: Partial<VehicleCandidate> = { fuelType };
    if (fuelType === 'petrol' && !v.kmPerLitre) updates.kmPerLitre = 14;
    if (fuelType === 'ev' && !v.kwhPer100Km) updates.kwhPer100Km = 15;
    if (fuelType === 'e-scooty' && !v.kwhPer100Km) updates.kwhPer100Km = 3.5;
    updateVehicle(id, updates);
  };

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-5">
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

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400">
            {vehicles.length} Candidates Active
          </span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Vehicle Type</label>
              <select
                value={draft.fuelType}
                onChange={(e) => pickFuel(e.target.value as FuelChoice)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 text-white text-xs focus:outline-none"
              >
                <option value="petrol" className="bg-zinc-900">Petrol Car</option>
                <option value="ev" className="bg-zinc-900">Electric Car (EV)</option>
                <option value="e-scooty" className="bg-zinc-900">E-Scooty / E-Bike</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Nissan Leaf 40kWh EV"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 text-white text-xs focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">Price / Resale (PKR) <FieldInfo {...INFO.price} /></label>
                <AiButton
                  type="car-price"
                  context={{ name: draft.name, fuelType: draft.fuelType }}
                  currentValue={draft.pricePkr}
                  onAccept={(val) => setDraft({ ...draft, pricePkr: val })}
                  formatValue={(x) => formatCompactPkr(x)}
                />
              </div>
              <input
                type="number"
                step={50000}
                value={draft.pricePkr}
                onChange={(e) => setDraft({ ...draft, pricePkr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
              />
              <AmountWords value={draft.pricePkr} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">
                  {draft.fuelType === 'petrol' ? 'Mileage (km/L)' : 'kWh / 100km'}
                  <FieldInfo {...(draft.fuelType === 'petrol' ? INFO.effPetrol : INFO.effEv)} />
                </label>
                <AiButton
                  type="car-efficiency"
                  context={{ name: draft.name, fuelType: draft.fuelType }}
                  currentValue={draft.efficiency}
                  onAccept={(val) => setDraft({ ...draft, efficiency: val })}
                  formatValue={(x) => (draft.fuelType === 'petrol' ? `${x} km/L` : `${x} kWh/100km`)}
                />
              </div>
              <input
                type="number"
                step={0.5}
                value={draft.efficiency}
                onChange={(e) => setDraft({ ...draft, efficiency: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">5-Yr Deprec. (%) <FieldInfo {...INFO.depreciation} /></label>
                <AiButton
                  type="car-depreciation"
                  context={{ name: draft.name, fuelType: draft.fuelType, pricePkr: draft.pricePkr }}
                  currentValue={draft.fiveYearDepreciationPct}
                  onAccept={(val) => setDraft({ ...draft, fiveYearDepreciationPct: val })}
                  formatValue={(x) => `${x}%`}
                />
              </div>
              <input
                type="number"
                step={5}
                min={0}
                max={100}
                value={draft.fiveYearDepreciationPct}
                onChange={(e) => setDraft({ ...draft, fiveYearDepreciationPct: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">Maint / Year (PKR) <FieldInfo {...INFO.maintenance} /></label>
                <AiButton
                  type="car-maintenance"
                  context={{ name: draft.name, fuelType: draft.fuelType, pricePkr: draft.pricePkr }}
                  currentValue={draft.annualMaintenancePkr}
                  onAccept={(val) => setDraft({ ...draft, annualMaintenancePkr: val })}
                  formatValue={(x) => formatCompactPkr(x)}
                />
              </div>
              <input
                type="number"
                step={5000}
                value={draft.annualMaintenancePkr}
                onChange={(e) => setDraft({ ...draft, annualMaintenancePkr: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
              />
              <AmountWords value={draft.annualMaintenancePkr} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={addVehicle}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-xs font-bold"
            >
              Add Vehicle
            </button>
          </div>
        </div>
      )}

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
              className="rounded-xl bg-[#0C0C0F] border border-white/[0.08] p-4 flex flex-col justify-between space-y-4 hover:border-white/15 transition-all"
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
                      <select
                        value={v.fuelType}
                        onChange={(e) => changeFuelType(v.id, e.target.value as FuelChoice)}
                        className="bg-transparent text-[10px] text-zinc-400 font-mono uppercase focus:outline-none cursor-pointer"
                        title="Change vehicle type"
                      >
                        <option value="petrol" className="bg-zinc-900">Petrol</option>
                        <option value="ev" className="bg-zinc-900">Electric (EV)</option>
                        <option value="e-scooty" className="bg-zinc-900">E-Scooty</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {aiOn && (
                      <button
                        onClick={() => aiFillVehicle(v)}
                        disabled={fillingId === v.id}
                        className="flex items-center gap-1 px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-[9px] font-bold transition-all disabled:opacity-60"
                        title="AI Fill: predict depreciation, maintenance and efficiency for this vehicle"
                      >
                        {fillingId === v.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>AI Fill</span>
                      </button>
                    )}
                    <button
                      onClick={() => removeVehicle(v.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Remove vehicle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Price and Efficiency Inputs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400 flex items-center gap-1">Price / Resale (PKR) <FieldInfo {...INFO.price} /></label>
                      <AiButton
                        type="car-price"
                        context={{ name: v.name, fuelType: v.fuelType }}
                        currentValue={v.pricePkr}
                        onAccept={(val) => updateVehicle(v.id, { pricePkr: val })}
                        formatValue={(x) => formatCompactPkr(x)}
                      />
                    </div>
                    <input
                      type="number"
                      step={50000}
                      value={v.pricePkr}
                      onChange={(e) => updateVehicle(v.id, { pricePkr: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                    />
                    <AmountWords value={v.pricePkr} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400 flex items-center gap-1">
                        {v.fuelType === 'petrol' ? 'Mileage (km/L)' : 'kWh / 100km'}
                        <FieldInfo {...(v.fuelType === 'petrol' ? INFO.effPetrol : INFO.effEv)} />
                      </label>
                      <AiButton
                        type="car-efficiency"
                        context={{ name: v.name, fuelType: v.fuelType }}
                        currentValue={v.fuelType === 'petrol' ? v.kmPerLitre : v.kwhPer100Km}
                        onAccept={(val) =>
                          updateVehicle(
                            v.id,
                            v.fuelType === 'petrol' ? { kmPerLitre: val } : { kwhPer100Km: val }
                          )
                        }
                        formatValue={(x) =>
                          v.fuelType === 'petrol' ? `${x} km/L` : `${x} kWh/100km`
                        }
                      />
                    </div>
                    {v.fuelType === 'petrol' ? (
                      <input
                        type="number"
                        step={0.5}
                        value={v.kmPerLitre || 14}
                        onChange={(e) =>
                          updateVehicle(v.id, { kmPerLitre: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                      />
                    ) : (
                      <input
                        type="number"
                        step={0.5}
                        value={v.kwhPer100Km || (isBike ? 3.5 : 14)}
                        onChange={(e) =>
                          updateVehicle(v.id, { kwhPer100Km: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400 flex items-center gap-1">5-Yr Deprec. (%) <FieldInfo {...INFO.depreciation} /></label>
                      <AiButton
                        type="car-depreciation"
                        context={{ name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr }}
                        currentValue={v.fiveYearDepreciationPct}
                        onAccept={(val) => updateVehicle(v.id, { fiveYearDepreciationPct: val })}
                        formatValue={(x) => `${x}%`}
                      />
                    </div>
                    <input
                      type="number"
                      step={5}
                      min={0}
                      max={100}
                      value={v.fiveYearDepreciationPct}
                      onChange={(e) =>
                        updateVehicle(v.id, { fiveYearDepreciationPct: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400 flex items-center gap-1">Maint / Year (PKR) <FieldInfo {...INFO.maintenance} /></label>
                      <AiButton
                        type="car-maintenance"
                        context={{ name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr }}
                        currentValue={v.annualMaintenancePkr}
                        onAccept={(val) => updateVehicle(v.id, { annualMaintenancePkr: val })}
                        formatValue={(x) => formatCompactPkr(x)}
                      />
                    </div>
                    <input
                      type="number"
                      step={5000}
                      value={v.annualMaintenancePkr}
                      onChange={(e) =>
                        updateVehicle(v.id, { annualMaintenancePkr: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                    />
                    <AmountWords value={v.annualMaintenancePkr} />
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
                            <label className="text-[10px] text-zinc-400 flex items-center gap-1 mb-0.5">
                              Down Payment (PKR) <FieldInfo {...INFO.emiDown} />
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
                            <AmountWords value={v.emiQuote?.downPaymentPkr || 0} />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-400 flex items-center gap-1 mb-0.5">
                                Monthly Installment <FieldInfo {...INFO.emiInstallment} />
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
                              <AmountWords value={v.emiQuote?.monthlyInstallmentPkr || 0} />
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
