'use client';

import React, { useState, useEffect } from 'react';
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

type FuelChoice = VehicleCandidate['fuelType'];

const PRESET_VEHICLES: Record<string, VehicleCandidate> = {
  'honri-ve-2': {
    id: 'honri-ve-2',
    name: 'Honri Ve 2.0 (200km EV)',
    fuelType: 'ev',
    pricePkr: 3999000,
    kwhPer100Km: 13,
    fiveYearDepreciationPct: 30,
    annualMaintenancePkr: 25000,
  },
  'alsvin-petrol': {
    id: 'alsvin-petrol',
    name: 'Changan Alsvin 1.3L Petrol',
    fuelType: 'petrol',
    pricePkr: 3800000,
    kmPerLitre: 14,
    fiveYearDepreciationPct: 35,
    annualMaintenancePkr: 60000,
  },
  'yadea-m3': {
    id: 'yadea-m3',
    name: 'Yadea M3 E-Scooty',
    fuelType: 'e-scooty',
    pricePkr: 250000,
    kwhPer100Km: 3.5,
    fiveYearDepreciationPct: 25,
    annualMaintenancePkr: 12000,
  },
};

const DEFAULT_FLEET: VehicleCandidate[] = [
  PRESET_VEHICLES['alsvin-petrol'],
  PRESET_VEHICLES['honri-ve-2'],
  {
    id: 'nissan-leaf',
    name: 'Nissan Leaf 40kWh EV',
    fuelType: 'ev',
    pricePkr: 4800000,
    kwhPer100Km: 15,
    fiveYearDepreciationPct: 40,
    annualMaintenancePkr: 35000,
  },
  PRESET_VEHICLES['yadea-m3'],
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

function VehicleCardItem({
  vehicle: v,
  updateVehicle,
  updateEmiQuote,
  removeVehicle,
  changeFuelType,
  aiFillVehicle,
  fillingId,
  aiOn,
  openEmiId,
  toggleEmi,
  formatPkrMasked,
}: {
  vehicle: VehicleCandidate;
  updateVehicle: (id: string, updates: Partial<VehicleCandidate>) => void;
  updateEmiQuote: (id: string, emiUpdates: Partial<BankEmiQuote>) => void;
  removeVehicle: (id: string) => void;
  changeFuelType: (id: string, fuelType: FuelChoice) => void;
  aiFillVehicle: (v: VehicleCandidate) => void;
  fillingId: string | null;
  aiOn: boolean;
  openEmiId: string | null;
  toggleEmi: (id: string) => void;
  formatPkrMasked: (n: number) => string;
}) {
  const { profile: cardProfile } = useProfile();
  const annualKm = Math.max(0, (cardProfile.dailyCommuteKm || 0) * 365);
  const isBike = v.fuelType === 'e-scooty';
  const isEv = v.fuelType === 'ev';
  const isEmiOpen = openEmiId === v.id;
  const hasEmi = Boolean(v.emiQuote && v.emiQuote.enabled);
  const isQuoteIncomplete =
    hasEmi &&
    (v.emiQuote?.downPaymentPkr === undefined ||
      v.emiQuote.downPaymentPkr === null ||
      v.emiQuote.downPaymentPkr < 0 ||
      !v.emiQuote?.monthlyInstallmentPkr ||
      v.emiQuote.monthlyInstallmentPkr <= 0 ||
      !v.emiQuote?.tenureMonths ||
      v.emiQuote.tenureMonths <= 0);

  const initialEff = v.fuelType === 'petrol'
    ? (v.kmPerLitre !== undefined ? String(v.kmPerLitre) : '14')
    : (v.kwhPer100Km !== undefined ? String(v.kwhPer100Km) : (isBike ? '3.5' : '14'));

  const [rawEfficiency, setRawEfficiency] = useState<string>(initialEff);

  useEffect(() => {
    const cur = v.fuelType === 'petrol'
      ? (v.kmPerLitre !== undefined ? String(v.kmPerLitre) : '14')
      : (v.kwhPer100Km !== undefined ? String(v.kwhPer100Km) : (isBike ? '3.5' : '14'));
    setRawEfficiency(cur);
  }, [v.kmPerLitre, v.kwhPer100Km, v.fuelType, isBike]);

  return (
    <div
      key={v.id}
      className={`rounded-xl bg-[#0C0C0F] border p-4 flex flex-col justify-between space-y-4 transition-all ${
        v.isCurrentVehicle
          ? 'border-amber-400/50 ring-1 ring-amber-400/30'
          : 'border-white/[0.08] hover:border-white/15'
      }`}
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

        {/* Ownership */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!v.isCurrentVehicle}
            onChange={(e) => updateVehicle(v.id, { isCurrentVehicle: e.target.checked })}
            className="accent-amber-400 w-3.5 h-3.5"
          />
          <span className={`text-[11px] font-semibold ${v.isCurrentVehicle ? 'text-amber-300' : 'text-zinc-400'}`}>
            I own this vehicle
          </span>
        </label>

        {/* Form Fields Grid */}
        <div className="space-y-2.5 pt-1">
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Vehicle Name</label>
            <input
              type="text"
              value={v.name}
              onChange={(e) => updateVehicle(v.id, { name: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 text-white text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400">Price (PKR)</label>
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
                  <span>{v.fuelType === 'petrol' ? 'Mileage (km/L)' : 'Eff. (kWh/100km)'}</span>
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
                  value={rawEfficiency}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRawEfficiency(val);
                    if (val !== '') {
                      updateVehicle(v.id, { kmPerLitre: Number(val) });
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                />
              ) : (
                <input
                  type="number"
                  step={0.5}
                  value={rawEfficiency}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRawEfficiency(val);
                    if (val !== '') {
                      updateVehicle(v.id, { kwhPer100Km: Number(val) });
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">5-Yr Deprec. (%) <FieldInfo {...INFO.depreciation} /></label>
                <AiButton
                  type="car-depreciation"
                  context={{ name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr, annualKm }}
                  currentValue={v.fiveYearDepreciationPct}
                  onAccept={(val) => updateVehicle(v.id, { fiveYearDepreciationPct: val })}
                  formatValue={(x) => `${x}%`}
                />
              </div>
              <input
                type="number"
                min={0}
                max={90}
                value={v.fiveYearDepreciationPct}
                onChange={(e) =>
                  updateVehicle(v.id, { fiveYearDepreciationPct: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-white text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400 flex items-center gap-1">Maintenance (PKR/yr) <FieldInfo {...INFO.maintenance} /></label>
                <AiButton
                  type="car-maintenance"
                  context={{ name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr, annualKm }}
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
        </div>

        {/* Bank Financing (EMI Accordion) */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => toggleEmi(v.id)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-xs font-semibold text-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Bank Lease / Financing (EMI)</span>
              {hasEmi && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                  ACTIVE
                </span>
              )}
            </div>
            {isEmiOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {isEmiOpen && (
            <div className="mt-2 p-3 rounded-lg bg-black/[0.06] border border-white/5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-300 font-medium">Financed via Bank Lease?</span>
                <input
                  type="checkbox"
                  checked={Boolean(v.emiQuote?.enabled)}
                  onChange={(e) => updateEmiQuote(v.id, { enabled: e.target.checked })}
                  className="accent-amber-400 w-4 h-4 cursor-pointer"
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
                      value={v.emiQuote?.downPaymentPkr ?? ''}
                      onChange={(e) =>
                        updateEmiQuote(v.id, {
                          downPaymentPkr: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-black border border-white/10 font-mono text-white text-xs"
                    />
                    <AmountWords value={v.emiQuote?.downPaymentPkr ?? 0} />
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
                        value={v.emiQuote?.monthlyInstallmentPkr ?? ''}
                        onChange={(e) =>
                          updateEmiQuote(v.id, {
                            monthlyInstallmentPkr: e.target.value === '' ? 0 : Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 rounded bg-black border border-white/10 font-mono text-white text-xs"
                      />
                      <AmountWords value={v.emiQuote?.monthlyInstallmentPkr ?? 0} />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-0.5">
                        Tenure (Months)
                      </label>
                      <select
                        value={v.emiQuote?.tenureMonths ?? 36}
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
}

export function VehicleCardList({ vehicles, onChange }: VehicleCardListProps) {
  const { formatPkrMasked, showToast, profile } = useProfile();
  const annualKm = Math.max(0, (profile.dailyCommuteKm || 0) * 365);
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
      const currentQuote: BankEmiQuote = v.emiQuote ?? {
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
    try {
      const [dep, maint, eff] = await Promise.all([
        predict('car-depreciation', { name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr }),
        predict('car-maintenance', { name: v.name, fuelType: v.fuelType, pricePkr: v.pricePkr, annualKm }),
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
    } catch (err) {
      showToast('Could not complete AI autofill for vehicle');
    } finally {
      setFillingId(null);
    }
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
                  context={{ name: draft.name, fuelType: draft.fuelType, pricePkr: draft.pricePkr, annualKm }}
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
                  context={{ name: draft.name, fuelType: draft.fuelType, pricePkr: draft.pricePkr, annualKm }}
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

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">No vehicles yet — add your first</h4>
            <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto">
              Compare petrol, electric, and e-scooties with full TCO, fuel savings, and bank EMI modeling.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-400 text-black font-semibold text-xs hover:bg-amber-300 transition-colors"
            >
              + Add Custom Vehicle
            </button>
            <button
              onClick={() => onChange([PRESET_VEHICLES['yadea-m3']])}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white font-medium text-xs hover:bg-white/10 transition-colors"
            >
              + Add E-Scooty
            </button>
            <button
              onClick={() => onChange([PRESET_VEHICLES['byd-atto3']])}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white font-medium text-xs hover:bg-white/10 transition-colors"
            >
              + Add EV
            </button>
            <button
              onClick={() => onChange(DEFAULT_FLEET)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-zinc-400 font-medium text-xs hover:bg-white/10 transition-colors"
            >
              Reset Default Fleet
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <VehicleCardItem
              key={v.id}
              vehicle={v}
              updateVehicle={updateVehicle}
              updateEmiQuote={updateEmiQuote}
              removeVehicle={removeVehicle}
              changeFuelType={changeFuelType}
              aiFillVehicle={aiFillVehicle}
              fillingId={fillingId}
              aiOn={aiOn}
              openEmiId={openEmiId}
              toggleEmi={toggleEmi}
              formatPkrMasked={formatPkrMasked}
            />
          ))}
        </div>
      )}
    </div>
  );
}
