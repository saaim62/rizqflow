'use client';

import React, { useState } from 'react';
import { UserProfile, UserRole, TaxStatus, SolarTariffMode } from '@/types';
import { AmountWords } from '@/components/ui/AmountWords';
import { useProfile } from '@/components/providers/ProfileProvider';
import { formatPkr } from '@/lib/format';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Car, 
  Sun, 
  HelpCircle, 
  Coins, 
  Zap, 
  X,
  Target,
  DollarSign,
  Briefcase,
  AlertTriangle
} from 'lucide-react';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'create' = new portfolio (default). 'update' = recalibrate the ACTIVE
   *  portfolio in place — never spawn a duplicate for a settings change. */
  mode?: 'create' | 'update';
  onComplete?: (profile: UserProfile, portfolioName: string) => void;
}

export function OnboardingWizardModal({ isOpen, onClose, mode = 'create', onComplete }: OnboardingWizardModalProps) {
  const { profile, updateProfile, showToast, currentUser, createNewPortfolio } = useProfile();

  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // Local draft state initialized with current profile
  const [name, setName] = useState<string>(currentUser?.name || '');
  const [portfolioName, setPortfolioName] = useState<string>('My Freedom Portfolio');
  const [age, setAge] = useState<number>(profile.age || 28);
  const [retirementAge, setRetirementAge] = useState<number>(profile.retirementAge || 55);
  const [role, setRole] = useState<UserRole>(profile.role || 'salaried');
  const [gender, setGender] = useState<'male' | 'female'>(profile.gender || 'male');
  const [isBreadwinner, setIsBreadwinner] = useState<boolean>(profile.isBreadwinner ?? true);
  const [maritalStatus, setMaritalStatus] = useState<'unmarried' | 'married'>(profile.maritalStatus || 'unmarried');
  const [familyMembers, setFamilyMembers] = useState<number>(profile.familyMembers || 1);

  // Step 2: Tax & Shariah
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(profile.taxStatus || 'filer');
  const [shariahOnly, setShariahOnly] = useState<boolean>(profile.shariahOnly ?? true);
  const [includeZakat, setIncludeZakat] = useState<boolean>(profile.includeZakat || false);

  // Step 3: Income & Investments
  const [monthlyIncomePkr, setMonthlyIncomePkr] = useState<number>(profile.monthlyIncomePkr || 250000);
  const [monthlyInvestPkr, setMonthlyInvestPkr] = useState<number>(profile.monthlyInvestPkr || 100000);
  const [annualSalaryRaisePct, setAnnualSalaryRaisePct] = useState<number>(profile.annualSalaryRaisePct || 10);
  const [lumpSumPkr, setLumpSumPkr] = useState<number>(profile.lumpSumPkr || 1500000);
  const [currentCashReservePkr, setCurrentCashReservePkr] = useState<number>(profile.currentCashReservePkr || 400000);

  // Step 4: Expenses
  const [fuelAndCommute, setFuelAndCommute] = useState<number>(profile.expenses.fuelAndCommute || 20000);
  const [utilitiesAndInternet, setUtilitiesAndInternet] = useState<number>(profile.expenses.utilitiesAndInternet || 25000);
  const [groceriesAndFood, setGroceriesAndFood] = useState<number>(profile.expenses.groceriesAndFood || 35000);
  const [rentOrHousing, setRentOrHousing] = useState<number>(profile.expenses.rentOrHousing || 20000);
  const [familyAndOther, setFamilyAndOther] = useState<number>(profile.expenses.familyAndOther || 15000);

  // Step 5: Vehicle & Solar
  const [dailyCommuteKm, setDailyCommuteKm] = useState<number>(profile.dailyCommuteKm || 35);
  const [currentVehicleType, setCurrentVehicleType] = useState<'none' | 'petrol-bike' | 'petrol-car' | 'ev-car'>('petrol-car');
  const [currentVehicleResalePkr, setCurrentVehicleResalePkr] = useState<number>(2800000);
  const [solarKw, setSolarKw] = useState<number>(profile.solarKw || 10);
  const [solarTariffMode, setSolarTariffMode] = useState<SolarTariffMode>(profile.solarTariffMode || 'net-metering-legacy');

  // Step 6: Life Goals
  const [weddingAge, setWeddingAge] = useState<number>(maritalStatus === 'unmarried' ? 29 : 0);
  const [weddingCost, setWeddingCost] = useState<number>(2500000);
  const [houseAge, setHouseAge] = useState<number>(33);
  const [houseCost, setHouseCost] = useState<number>(15000000);

  if (!isOpen) return null;

  const totalMonthlyExpenses = fuelAndCommute + utilitiesAndInternet + groceriesAndFood + rentOrHousing + familyAndOther;
  const emergencyTarget = totalMonthlyExpenses * 4;
  const emergencyGap = Math.max(0, emergencyTarget - currentCashReservePkr);
  const savingsRatePct = monthlyIncomePkr > 0 ? Math.round((monthlyInvestPkr / monthlyIncomePkr) * 100) : 0;

  const handleFinish = async () => {
    const goals = [];
    if (weddingAge > age) {
      goals.push({
        id: 'goal-wedding-custom',
        name: 'Wedding Ceremony',
        targetAge: weddingAge,
        costInTodaysPkr: weddingCost,
      });
    }
    if (houseAge > age) {
      goals.push({
        id: 'goal-house-custom',
        name: 'Home Construction / Downpayment',
        targetAge: houseAge,
        costInTodaysPkr: houseCost,
      });
    }

    const compiledProfile: UserProfile = {
      ...profile,
      role,
      gender,
      isBreadwinner,
      age,
      retirementAge,
      maritalStatus,
      familyMembers,
      taxStatus,
      shariahOnly,
      includeZakat,
      monthlyIncomePkr,
      monthlyInvestPkr,
      annualSalaryRaisePct,
      lumpSumPkr,
      currentCashReservePkr,
      expenses: {
        fuelAndCommute,
        utilitiesAndInternet,
        groceriesAndFood,
        rentOrHousing,
        familyAndOther,
      },
      dailyCommuteKm,
      solarKw,
      solarTariffMode,
      vehicles: profile.vehicles && profile.vehicles.length > 0 
        ? profile.vehicles.map((v, i) => i === 0 ? { ...v, pricePkr: currentVehicleResalePkr, isCurrentVehicle: true } : v)
        : [
            {
              id: 'current-user-vehicle',
              name:
                currentVehicleType === 'petrol-bike'
                  ? 'Existing 70cc Bike'
                  : currentVehicleType === 'ev-car'
                  ? 'Existing EV Car'
                  : 'Existing Petrol Car',
              fuelType: currentVehicleType === 'ev-car' ? 'ev' : 'petrol',
              pricePkr: currentVehicleResalePkr,
              isCurrentVehicle: true,
              // EV cars run on kWh/100km, not km/L (NOTES #23 — the wizard
              // previously offered only Petrol Car / Motorbike / None, so
              // an EV like a Nissan Leaf could not be labelled at all).
              // 16.5 kWh/100km is a Leaf-class real-world figure.
              ...(currentVehicleType === 'ev-car'
                ? { kwhPer100Km: 16.5 }
                : { kmPerLitre: currentVehicleType === 'petrol-bike' ? 45 : 13 }),
              fiveYearDepreciationPct: 35,
              annualMaintenancePkr:
                currentVehicleType === 'petrol-bike' ? 25000 : currentVehicleType === 'ev-car' ? 35000 : 60000,
            },
            {
              id: 'honri-ve2',
              name: 'Honri Ve 2.0 EV',
              fuelType: 'ev',
              pricePkr: 3599000,
              kwhPer100Km: 14.0,
              fiveYearDepreciationPct: 30,
              annualMaintenancePkr: 20000,
            },
          ],
      lifeGoals: goals.length > 0 ? goals : profile.lifeGoals,
    };

    if (mode === 'update' && currentUser) {
      // Recalibrate: update the ACTIVE portfolio in place. (Previously every
      // recalibration silently created a duplicate portfolio.)
      updateProfile(compiledProfile);
      showToast('Active portfolio recalibrated & saved!');
    } else if (currentUser) {
      const res = await createNewPortfolio(portfolioName, compiledProfile);
      if (!res.success) {
        showToast('Could not save the portfolio to the server — please try again.');
        return;
      }
      showToast(`Portfolio "${portfolioName}" configured & loaded successfully!`);
    } else {
      updateProfile(compiledProfile);
      showToast(`Portfolio "${portfolioName}" configured & loaded successfully!`);
    }
    if (onComplete) onComplete(compiledProfile, portfolioName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 rounded-2xl bg-[#0C0C0F] border border-white/10 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden text-zinc-100">
        
        {/* Header Strip */}
        <div className="p-6 border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                Step {step} of {totalSteps}
              </span>
              <span className="text-xs text-zinc-400 font-medium">PSX Stock Broker & Wealth Calibration</span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {step === 1 && '1. Investor Persona & Household Setup'}
              {step === 2 && '2. FBR Tax Status & Halal Compliance'}
              {step === 3 && '3. Income & Savings Firepower (SIP)'}
              {step === 4 && '4. Monthly Living Expenses Breakdown'}
              {step === 5 && '5. Commute & Rooftop Solar Exposure'}
              {step === 6 && '6. Big Life Milestones & Portfolio Finalize'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/5">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300" 
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300 leading-relaxed flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Stock Broker Tip:</span> Financial freedom is not one-size-fits-all. Your current age, dependents, and retirement horizon dictate how aggressively your dividend snowball can compound before you need living withdrawals.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Investor Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Portfolio Label</label>
                  <input
                    type="text"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. My Halal Wealth"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Current Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    min={18}
                    max={75}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Target Freedom / Retirement Age</label>
                  <input
                    type="number"
                    value={retirementAge}
                    onChange={(e) => setRetirementAge(Number(e.target.value))}
                    min={age + 1}
                    max={80}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Professional Category</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="salaried" className="bg-zinc-900">Salaried Corporate / Tech</option>
                    <option value="freelancer" className="bg-zinc-900">Freelancer / Remote USD Earner</option>
                    <option value="business" className="bg-zinc-900">Business Owner / Trader</option>
                    <option value="student" className="bg-zinc-900">Student / Early Career</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Marital Status & Family</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMaritalStatus('unmarried')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        maritalStatus === 'unmarried'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-[#0C0C0F] border-white/10 text-zinc-400'
                      }`}
                    >
                      Single / Unmarried
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaritalStatus('married')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        maritalStatus === 'married'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-[#0C0C0F] border-white/10 text-zinc-400'
                      }`}
                    >
                      Married
                    </button>
                  </div>
                </div>
              </div>

            {/* Household questions — the profile type always carried gender,
                familyMembers and isBreadwinner, but no UI collected them
                before the Forgewarden fix round. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setGender('male')} className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${gender === 'male' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#0C0C0F] border-white/10 text-zinc-400'}`}>Male</button>
                  <button type="button" onClick={() => setGender('female')} className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${gender === 'female' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#0C0C0F] border-white/10 text-zinc-400'}`}>Female</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Family Members (Household Size)</label>
                <input type="number" value={familyMembers} onChange={(e) => setFamilyMembers(Number(e.target.value))} min={1} max={30} className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Are You the Main Breadwinner?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setIsBreadwinner(true)} className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${isBreadwinner ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#0C0C0F] border-white/10 text-zinc-400'}`}>Yes, I am</button>
                  <button type="button" onClick={() => setIsBreadwinner(false)} className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${!isBreadwinner ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#0C0C0F] border-white/10 text-zinc-400'}`}>Someone else</button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">Critical Broker Reality (FBR Section 150):</span> Non-filers are taxed at 30% withholding tax on dividends, whereas active filers pay only 15%. Being a filer instantly gives you double the net income retainment!
                </div>
              </div>

              {/* Filer Status Cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Your FBR Tax Status</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setTaxStatus('filer')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      taxStatus === 'filer'
                        ? 'bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/10'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Active Tax Filer</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">15% WHT</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Full dividend yield efficiency. Minimum withholding tax deducted at source by CDC/Broker.
                    </p>
                  </div>

                  <div
                    onClick={() => setTaxStatus('non-filer')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      taxStatus === 'non-filer'
                        ? 'bg-rose-500/15 border-rose-500 shadow-md shadow-rose-500/10'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Non-Filer</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-xs font-bold">30% WHT (2x)</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      FBR penalizes non-filers with double withholding tax. RizqFlow will track your exact PKR tax loss.
                    </p>
                  </div>
                </div>
              </div>

              {/* Shariah Screener Filter */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-zinc-300">Shariah Screening (KMI-30 Standards)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setShariahOnly(true)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      shariahOnly
                        ? 'bg-emerald-500/15 border-emerald-500'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">100% Shariah Compliant Only</span>
                      <span className="text-xs text-amber-400 font-bold">Halal Filter</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Excludes conventional banks (MCB, UBL, HBL) and non-compliant balance sheets. Selects FFC, HUBC, MEBL, POL, OGDC, PPL.
                    </p>
                  </div>

                  <div
                    onClick={() => setShariahOnly(false)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      !shariahOnly
                        ? 'bg-emerald-500/15 border-emerald-500'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">Full Market Blend</span>
                      <span className="text-xs text-zinc-400">All Sectors</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">
                      Includes high-yielding conventional commercial banks (MCB 8.8%, UBL 8.4%) alongside top dividend equities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300 leading-relaxed flex items-start gap-3">
                <Coins className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Savings Firepower:</span> Regular monthly SIP investing compounds far more reliably than waiting for a market dip. Let us capture your current monthly surplus and initial capital.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">{isBreadwinner ? 'Monthly Net Income (PKR)' : "Breadwinner's Monthly Income — Household (PKR)"}</label>
                  <input
                    type="number"
                    value={monthlyIncomePkr}
                    onChange={(e) => setMonthlyIncomePkr(Number(e.target.value))}
                    step={10000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={monthlyIncomePkr} />
                  <span className="text-[11px] text-zinc-400">{formatPkr(monthlyIncomePkr)} / month</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Monthly Investable SIP (PKR)</label>
                  <input
                    type="number"
                    value={monthlyInvestPkr}
                    onChange={(e) => setMonthlyInvestPkr(Number(e.target.value))}
                    step={5000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={monthlyInvestPkr} />
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {savingsRatePct}% savings rate ({formatPkr(monthlyInvestPkr)} / mo)
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Initial Investable Lump Sum (PKR)</label>
                  <input
                    type="number"
                    value={lumpSumPkr}
                    onChange={(e) => setLumpSumPkr(Number(e.target.value))}
                    step={50000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={lumpSumPkr} />
                  <span className="text-[11px] text-zinc-400">Immediate capital for dividend stocks ({formatPkr(lumpSumPkr)})</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Liquid Cash Cushion / Bank Savings</label>
                  <input
                    type="number"
                    value={currentCashReservePkr}
                    onChange={(e) => setCurrentCashReservePkr(Number(e.target.value))}
                    step={25000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={currentCashReservePkr} />
                  <span className="text-[11px] text-zinc-400">Emergency fund ({formatPkr(currentCashReservePkr)})</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300 leading-relaxed flex items-start gap-3">
                <Target className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">The Expense Waterfall Sorter:</span> RizqFlow assigns your PSX dividend checks bill-by-bill in order of survival priority (Fuel &rarr; Utilities &rarr; Groceries &rarr; Rent &rarr; Family).
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">1. Fuel & Commute (PKR/mo)</label>
                  <input
                    type="number"
                    value={fuelAndCommute}
                    onChange={(e) => setFuelAndCommute(Number(e.target.value))}
                    step={1000}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={fuelAndCommute} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">2. Utilities & Internet (PKR/mo)</label>
                  <input
                    type="number"
                    value={utilitiesAndInternet}
                    onChange={(e) => setUtilitiesAndInternet(Number(e.target.value))}
                    step={1000}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={utilitiesAndInternet} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">3. Groceries & Food (PKR/mo)</label>
                  <input
                    type="number"
                    value={groceriesAndFood}
                    onChange={(e) => setGroceriesAndFood(Number(e.target.value))}
                    step={2000}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={groceriesAndFood} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">4. Rent / Housing (PKR/mo)</label>
                  <input
                    type="number"
                    value={rentOrHousing}
                    onChange={(e) => setRentOrHousing(Number(e.target.value))}
                    step={2000}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={rentOrHousing} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-300">5. Family & Healthcare (PKR/mo)</label>
                  <input
                    type="number"
                    value={familyAndOther}
                    onChange={(e) => setFamilyAndOther(Number(e.target.value))}
                    step={1000}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <AmountWords value={familyAndOther} />
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400">Total Monthly Living Expenses:</span>
                  <div className="font-mono font-bold text-white text-base">{formatPkr(totalMonthlyExpenses)} / mo</div>
                </div>
                <div className="text-right">
                  <span className="text-zinc-400">4-Month Emergency Fund Target:</span>
                  <div className="font-mono font-bold text-emerald-400 text-base">{formatPkr(emergencyTarget)}</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300 leading-relaxed flex items-start gap-3">
                <Car className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Vehicle & Solar Arbitrage:</span> Fuel is the single fastest-growing expense in Pakistan. Switching from petrol to EV charging on rooftop solar can save Rs 25,000–60,000 every single month!
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Daily Commute Distance (km/day)</label>
                  <input
                    type="number"
                    value={dailyCommuteKm}
                    onChange={(e) => setDailyCommuteKm(Number(e.target.value))}
                    min={5}
                    max={150}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-zinc-400">~{dailyCommuteKm * 30} km / month</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Current Vehicle Setup</label>
                  <select
                    value={currentVehicleType}
                    onChange={(e) => setCurrentVehicleType(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="petrol-car" className="bg-zinc-900">Petrol Car (Sedan / Hatchback / SUV)</option>
                    <option value="ev-car" className="bg-zinc-900">Electric Car (EV — e.g. Nissan Leaf)</option>
                    <option value="petrol-bike" className="bg-zinc-900">Petrol 70cc / 125cc Motorbike</option>
                    <option value="none" className="bg-zinc-900">No Vehicle / Careem / Metro</option>
                  </select>
                </div>

                {currentVehicleType !== 'none' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Current Vehicle Resale Value (PKR)</label>
                  <input type="number" value={currentVehicleResalePkr} onChange={(e) => setCurrentVehicleResalePkr(Number(e.target.value))} step={50000} className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none" />
                  <AmountWords value={currentVehicleResalePkr} />
                  <span className="text-[11px] text-zinc-400">What you could sell it for today — drives the EV-swap math ({formatPkr(currentVehicleResalePkr)})</span>
                </div>
              )}

              <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Rooftop Solar Installed (kW)</label>
                  <input
                    type="number"
                    value={solarKw}
                    onChange={(e) => setSolarKw(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-zinc-400">
                    {solarKw > 0 ? `${solarKw} kW system produces ~${solarKw * 4} kWh/day` : 'No Solar (Grid Only)'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Solar Tariff Policy</label>
                  <select
                    value={solarTariffMode}
                    onChange={(e) => setSolarTariffMode(e.target.value as SolarTariffMode)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="net-metering-legacy" className="bg-zinc-900">Legacy Net Metering (Rs 26/kWh)</option>
                    <option value="net-billing-2026" className="bg-zinc-900">2026 NEPRA Gross Billing (Rs 11/kWh)</option>
                    <option value="none" className="bg-zinc-900">Grid Rate (Rs 55/kWh)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-200">You are All Set!</span> We have incorporated all your real Pakistani economic variables: PSX quarterly dividends, FBR 15% filer tax rate, emergency cushion, and solar arbitrage.
                </div>
              </div>

              {/* Ready Summary Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                <h3 className="font-bold text-white text-sm">Portfolio Setup Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Investor</span>
                    <div className="font-bold text-white mt-0.5">{name}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Monthly SIP</span>
                    <div className="font-bold text-emerald-400 font-mono mt-0.5">{formatPkr(monthlyInvestPkr)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Lump Sum Capital</span>
                    <div className="font-bold text-white font-mono mt-0.5">{formatPkr(lumpSumPkr)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Tax Status</span>
                    <div className="font-bold text-white mt-0.5">{taxStatus === 'filer' ? 'Filer (15% WHT)' : 'Non-Filer'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Halal Filter</span>
                    <div className="font-bold text-amber-300 mt-0.5">{shariahOnly ? '100% Shariah Compliant' : 'Full Market'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-zinc-500">Living Expenses</span>
                    <div className="font-bold text-white font-mono mt-0.5">{formatPkr(totalMonthlyExpenses)} / mo</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-6 border-t border-white/[0.08] bg-[#0C0C0F] flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs transition-all shadow-xl shadow-emerald-500/30"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>{mode === 'update' ? 'Save & Recalibrate My Portfolio' : 'Launch & Calibrate My Portfolio'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
