'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import { calculateLifePlan } from '@/lib/engine/wealthEngine';
import { PlannerIntakeForm } from '@/components/planner/PlannerIntakeForm';
import { WealthHeadlineCards } from '@/components/planner/WealthHeadlineCards';
import { GoalShortfallCard } from '@/components/planner/GoalShortfallCard';
import { EmergencyFundCard } from '@/components/planner/EmergencyFundCard';
import { HoldingsLiabilitiesCard } from '@/components/planner/HoldingsLiabilitiesCard';
import { ExpenseWaterfall } from '@/components/planner/ExpenseWaterfall';
import { CompoundingChart } from '@/components/planner/CompoundingChart';
import { PayoutCalendarChart } from '@/components/planner/PayoutCalendarChart';
import { PortfolioAllocationsTable } from '@/components/planner/PortfolioAllocationsTable';
import { PsxExecutionSheet } from '@/components/planner/PsxExecutionSheet';
import { ShareSnapshotModal } from '@/components/ui/ShareSnapshotModal';
import { WhatThisCantTellYou } from '@/components/planner/WhatThisCantTellYou';
import { 
  BarChart3, 
  Sparkles, 
  RotateCcw, 
  Share2, 
  ShieldCheck, 
  Layers,
  Calendar,
  HelpCircle,
  Car,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

function PlannerContent() {
  const { profile, setProfile, resetToPreset, sharePlan } = useProfile();
  const { openGuide } = useBeginnerGuide();
  const searchParams = useSearchParams();
  const tickerParam = searchParams.get('ticker');
  const [activeVisualTab, setActiveVisualTab] = useState<'compounding' | 'calendar'>('compounding');
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Compute live multi-asset life plan. The projection start (today) is
  // passed IN so the pure engine can place balloon due dates in time —
  // the engine itself never reads the clock (NOTES #45).
  const plan = useMemo(() => {
    const now = new Date();
    return calculateLifePlan(profile, {
      projectionStart: { year: now.getFullYear(), month: now.getMonth() + 1 },
    });
  }, [profile]);

  return (
    <div className="min-h-screen py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Life & Wealth Freedom Planner
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-semibold">
              Multi-Asset Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Simulate your path to financial freedom: career raises, multi-asset splits, dated life goals, and Grade-A PSX dividends
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setShowSnapshotModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Snapshot Card</span>
          </button>

          <button
            onClick={() => sharePlan()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-semibold transition-all"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Share Plan</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset</span>
          </button>

          <button
            onClick={() => openGuide('lumpy-payouts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-semibold transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>How It Works</span>
          </button>
        </div>
      </div>

      {tickerParam && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              You came from the Markets screener (<strong className="text-white font-mono">{tickerParam}</strong>). This plan runs on your PSX bucket&apos;s expected return — adjust it under Allocation to model a specific stock.
            </span>
          </div>
          <Link
            href="/markets"
            className="text-amber-400 hover:text-amber-300 font-medium underline shrink-0"
          >
            Back to Markets
          </Link>
        </div>
      )}

      {/* 2-Column Responsive Layout: Left = Intake Forms, Right = Live Bento Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (5 cols): Intake Form Cards */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <PlannerIntakeForm
            profile={profile}
            onChange={setProfile}
            onSelectPreset={resetToPreset}
          />

          <HoldingsLiabilitiesCard profile={profile} onChange={setProfile} />

          {/* Quick link to Car Decision Map */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-amber-400" />
                Planning to Buy or Swap a Car?
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Evaluate Petrol vs EV 5-year total cost with solar opportunity cost.
              </p>
            </div>
            <Link
              href="/cars"
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 flex items-center gap-1"
            >
              <span>Cars</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Right Column (7 cols): Live Bento Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          {/* Headline 5-Card Metric Strip */}
          <WealthHeadlineCards plan={plan} profile={profile} />

          {/* Dated Life Goals & Opportunity Cost Cards */}
          <GoalShortfallCard goalOutcomes={plan.goalOutcomes} />

          {/* Emergency Fund 4-Month Gate */}
          <EmergencyFundCard plan={plan} profile={profile} />

          {/* Expense Waterfall */}
          <ExpenseWaterfall waterfall={plan.expenseWaterfall} />

          {/* Tabbed Interactive Visual Projections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Visual Wealth & Dividend Projections
                </h3>
              </div>

              <div className="flex items-center bg-[#0C0C0F] p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setActiveVisualTab('compounding')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeVisualTab === 'compounding'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>Compounding Curve</span>
                </button>
                <button
                  onClick={() => setActiveVisualTab('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeVisualTab === 'calendar'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>12-Month Calendar</span>
                </button>
              </div>
            </div>

            {activeVisualTab === 'compounding' ? (
              <CompoundingChart
                timeline={plan.timeline}
                startAge={profile.age}
                retirementAge={profile.retirementAge ?? 60}
              />
            ) : (
              <PayoutCalendarChart monthlyPayoutCalendar={plan.monthlyPayoutCalendar} />
            )}
          </div>

          {/* Auto-Built Grade-A Portfolio Table */}
          <PortfolioAllocationsTable
            allocations={plan.recommendedAllocations}
            totalLumpSum={profile.lumpSumPkr}
          />

          {/* PSX Broker Execution Sheet (Friction & Whole Shares) */}
          <PsxExecutionSheet
            allocations={plan.recommendedAllocations}
            portfolioPkr={profile.lumpSumPkr}
          />

          {/* What This Can't Tell You - Institutional Reality */}
          <WhatThisCantTellYou />
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0C0C0F] border border-white/10 p-6 space-y-4 shadow-2xl text-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 id="reset-modal-title" className="font-bold text-base text-white">Reset Plan to Default?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Reset to Junior Software Engineer baseline preset
                </p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              This will replace your current financial plan, living expenses, and asset allocations with the default starter preset. Any unsaved custom modifications will be lost.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  resetToPreset('junior-engineer');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors shadow-md shadow-amber-500/20"
              >
                Reset Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cinematic Freedom Snapshot Modal */}
      <ShareSnapshotModal
        isOpen={showSnapshotModal}
        onClose={() => setShowSnapshotModal(false)}
        plan={plan}
        profile={profile}
      />
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-zinc-500 font-mono">
          Loading Life & Wealth Planner Engine...
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
