'use client';

import React, { useState } from 'react';
import { UserProfile, UserRole, TaxStatus, AssetBucket, LifeGoal } from '@/types';
import { MultiAssetSplitter } from '@/components/planner/MultiAssetSplitter';
import { LifeGoalsManager } from '@/components/planner/LifeGoalsManager';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  User, 
  Wallet, 
  Receipt, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Moon, 
  ShieldCheck, 
  Percent, 
  TrendingUp,
  Sparkles,
  Sun,
  Calendar,
  Layers
} from 'lucide-react';

interface PlannerIntakeFormProps {
  profile: UserProfile;
  onChange: (updated: UserProfile) => void;
  onSelectPreset: (presetKey: string) => void;
  activePreset?: string;
}

export function PlannerIntakeForm({
  profile,
  onChange,
  onSelectPreset,
  activePreset,
}: PlannerIntakeFormProps) {
  const { formatPkrMasked } = useProfile();

  // Accordion state
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    profile: false,
    income: true,
    assets: true,
    goals: true,
    expenses: false,
    solarVehicle: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateProfileField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    onChange({ ...profile, [field]: value });
  };

  const updateExpenseField = (field: keyof UserProfile['expenses'], value: number) => {
    onChange({
      ...profile,
      expenses: {
        ...profile.expenses,
        [field]: Math.max(0, value),
      },
    });
  };

  const totalExpenses = Object.values(profile.expenses).reduce((a, b) => a + b, 0);

  // Asset buckets fallback
  const assetBuckets: AssetBucket[] = profile.assetBuckets && profile.assetBuckets.length > 0
    ? profile.assetBuckets
    : [
        { id: 'psx-dividends', label: 'PSX Dividend Equities', currentValuePkr: 0, monthlySplitPct: 40, expectedAnnualReturnPct: 14 },
        { id: 'gold', label: '24K Physical Gold', currentValuePkr: 0, monthlySplitPct: 20, expectedAnnualReturnPct: 12 },
        { id: 'real-estate', label: 'Real Estate / Land', currentValuePkr: 0, monthlySplitPct: 20, expectedAnnualReturnPct: 13 },
        { id: 'money-market', label: 'Shariah / Money Market', currentValuePkr: 0, monthlySplitPct: 15, expectedAnnualReturnPct: 11 },
        { id: 'cash', label: 'Cash Reserve', currentValuePkr: 0, monthlySplitPct: 5, expectedAnnualReturnPct: 8 },
      ];

  const lifeGoals: LifeGoal[] = profile.lifeGoals || [];

  return (
    <div className="space-y-5">
      {/* 1. Presets Selector Bar */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Quick Persona Presets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              id: 'junior-swe',
              label: 'Junior Software Engineer',
              desc: 'Rs 200k income · 12% raise · Rs 100k SIP',
            },
            {
              id: 'lump-sum-30lac',
              label: 'Rs 30 Lac Lump Sum',
              desc: 'Rs 30 Lac capital · Grade-A PSX focus',
            },
            {
              id: 'solar-ev-swap',
              label: 'Solar Home + SUV Swap',
              desc: '10 kW Solar · 45 km commute · House Build',
            },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className={`p-3 rounded-xl text-left transition-all border ${
                activePreset === preset.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                  : 'bg-black/30 border-white/5 text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <div className="font-bold text-xs text-white">{preset.label}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Global Modifiers Bar */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] p-4 shadow-lg flex flex-wrap items-center gap-2">
        {/* Shariah Only */}
        <button
          onClick={() => updateProfileField('shariahOnly', !profile.shariahOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            profile.shariahOnly
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-black/40 text-zinc-400 border-white/5 hover:text-white'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>{profile.shariahOnly ? 'Shariah (KMI-30)' : 'All PSX Stocks'}</span>
        </button>

        {/* Filer vs Non-Filer */}
        <button
          onClick={() =>
            updateProfileField(
              'taxStatus',
              profile.taxStatus === 'filer' ? 'non-filer' : 'filer'
            )
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            profile.taxStatus === 'filer'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{profile.taxStatus === 'filer' ? 'Filer (15% WHT)' : 'Non-Filer (30% WHT)'}</span>
        </button>

        {/* Zakat 2.5% */}
        <button
          onClick={() => updateProfileField('includeZakat', !profile.includeZakat)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            profile.includeZakat
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-black/40 text-zinc-400 border-white/5 hover:text-white'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>Zakat 2.5% {profile.includeZakat ? 'Deducted' : 'Exempt (CZ-50)'}</span>
        </button>

        {/* Inflation Adjusted */}
        <button
          onClick={() => updateProfileField('inflationAdjusted', !profile.inflationAdjusted)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            profile.inflationAdjusted
              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              : 'bg-black/40 text-zinc-400 border-white/5 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{profile.inflationAdjusted ? "Today's Purchasing Power" : 'Nominal Rupee'}</span>
        </button>
      </div>

      {/* 3. Income, Raises & Monthly SIP */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('income')}
          className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Income, Career Raises & SIP</span>
              <span className="block text-[11px] text-zinc-400 font-mono">
                Lump sum: {formatPkrMasked(profile.lumpSumPkr)} · SIP: {formatPkrMasked(profile.monthlyInvestPkr)}/mo · +{profile.annualSalaryRaisePct || 0}% Raise
              </span>
            </div>
          </div>
          {openSections.income ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {openSections.income && (
          <div className="p-4 space-y-4 border-t border-white/[0.06] text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Monthly Take-Home Income (PKR)
                </label>
                <input
                  type="number"
                  step={10000}
                  value={profile.monthlyIncomePkr}
                  onChange={(e) => updateProfileField('monthlyIncomePkr', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Annual Salary Raise (% p.a.)
                </label>
                <input
                  type="number"
                  step={1}
                  min={0}
                  max={40}
                  value={profile.annualSalaryRaisePct || 0}
                  onChange={(e) => updateProfileField('annualSalaryRaisePct', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Monthly SIP Investable (PKR)
                </label>
                <input
                  type="number"
                  step={5000}
                  value={profile.monthlyInvestPkr}
                  onChange={(e) => updateProfileField('monthlyInvestPkr', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Initial Lump Sum Capital (PKR)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={profile.lumpSumPkr}
                  onChange={(e) => updateProfileField('lumpSumPkr', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Current Liquid Cash Reserve (PKR)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={profile.currentCashReservePkr}
                  onChange={(e) => updateProfileField('currentCashReservePkr', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Multi-Asset Monthly Split */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('assets')}
          className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Multi-Asset Allocation</span>
              <span className="block text-[11px] text-zinc-400">
                PSX Stocks · 24K Gold · Real Estate · Money Market · Cash
              </span>
            </div>
          </div>
          {openSections.assets ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {openSections.assets && (
          <div className="p-4 border-t border-white/[0.06]">
            <MultiAssetSplitter
              assetBuckets={assetBuckets}
              onChange={(updated) => updateProfileField('assetBuckets', updated)}
            />
          </div>
        )}
      </div>

      {/* 5. Dated Life Goals CRUD */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('goals')}
          className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Dated Life Goals Milestones</span>
              <span className="block text-[11px] text-zinc-400">
                {lifeGoals.length} scheduled withdrawals (Wedding, House, EV)
              </span>
            </div>
          </div>
          {openSections.goals ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {openSections.goals && (
          <div className="p-4 border-t border-white/[0.06]">
            <LifeGoalsManager
              lifeGoals={lifeGoals}
              currentAge={profile.age}
              retirementAge={profile.retirementAge || 60}
              onChange={(updated) => updateProfileField('lifeGoals', updated)}
            />
          </div>
        )}
      </div>

      {/* 6. Monthly Living Expenses */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('expenses')}
          className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Monthly Living Expenses</span>
              <span className="block text-[11px] text-zinc-400 font-mono">
                Total: <strong className="text-white">{formatPkrMasked(totalExpenses)}/mo</strong>
              </span>
            </div>
          </div>
          {openSections.expenses ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {openSections.expenses && (
          <div className="p-4 space-y-3 border-t border-white/[0.06] text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">1. Fuel & Commute (PKR)</label>
                <input
                  type="number"
                  step={2000}
                  value={profile.expenses.fuelAndCommute}
                  onChange={(e) => updateExpenseField('fuelAndCommute', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">2. Utilities & Internet (PKR)</label>
                <input
                  type="number"
                  step={2000}
                  value={profile.expenses.utilitiesAndInternet}
                  onChange={(e) => updateExpenseField('utilitiesAndInternet', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">3. Groceries & Food (PKR)</label>
                <input
                  type="number"
                  step={3000}
                  value={profile.expenses.groceriesAndFood}
                  onChange={(e) => updateExpenseField('groceriesAndFood', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">4. Rent & Housing (PKR)</label>
                <input
                  type="number"
                  step={5000}
                  value={profile.expenses.rentOrHousing}
                  onChange={(e) => updateExpenseField('rentOrHousing', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] text-zinc-400 block mb-1">5. Family Support & Other (PKR)</label>
                <input
                  type="number"
                  step={3000}
                  value={profile.expenses.familyAndOther}
                  onChange={(e) => updateExpenseField('familyAndOther', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Age & Household Profile */}
      <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] overflow-hidden shadow-lg">
        <button
          onClick={() => toggleSection('profile')}
          className="w-full flex items-center justify-between p-4 bg-black/30 hover:bg-black/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Age & Career Profile</span>
              <span className="block text-[11px] text-zinc-400">
                Age {profile.age} &rarr; Target Retirement Age {profile.retirementAge || 60}
              </span>
            </div>
          </div>
          {openSections.profile ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        {openSections.profile && (
          <div className="p-4 space-y-4 border-t border-white/[0.06] text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Current Age</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => updateProfileField('age', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Target Retirement Age</label>
                <input
                  type="number"
                  value={profile.retirementAge || 60}
                  onChange={(e) => updateProfileField('retirementAge', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Career Role</label>
                <select
                  value={profile.role}
                  onChange={(e) => updateProfileField('role', e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
                >
                  <option value="salaried">Salaried Employee</option>
                  <option value="freelancer">Freelancer / IT Exporter</option>
                  <option value="business">Business Owner</option>
                  <option value="student">Student / Early Career</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Marital Status</label>
                <select
                  value={profile.maritalStatus}
                  onChange={(e) =>
                    updateProfileField('maritalStatus', e.target.value as 'unmarried' | 'married')
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
                >
                  <option value="unmarried">Single / Unmarried</option>
                  <option value="married">Married</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Gender</label>
                <select
                  value={profile.gender}
                  onChange={(e) => updateProfileField('gender', e.target.value as 'male' | 'female')}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Family Members (Household Size)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={profile.familyMembers}
                  onChange={(e) => updateProfileField('familyMembers', Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Main Breadwinner</label>
                <select
                  value={profile.isBreadwinner ? 'yes' : 'no'}
                  onChange={(e) => updateProfileField('isBreadwinner', e.target.value === 'yes')}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
                >
                  <option value="yes">Yes — I am</option>
                  <option value="no">No — someone else is</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
