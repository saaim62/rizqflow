'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PsxStock, StockGrade } from '@/types';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { GradeBadge, ShariahBadge } from '@/components/ui/GradeBadge';
import { Sparkline } from '@/components/markets/Sparkline';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Moon, 
  Sparkles,
  Info,
  TrendingDown,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

interface StockScreenerProps {
  stocks: PsxStock[];
  initialTicker?: string;
}

type SortField = 'streak-red' | 'streak-green' | 'yield' | 'drawdown' | 'ticker';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function StockScreener({ stocks, initialTicker }: StockScreenerProps) {
  const { openGuide } = useBeginnerGuide();
  const [searchTerm, setSearchTerm] = useState('');
  const [shariahOnly, setShariahOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'TRAPS'>('ALL');
  const [sortField, setSortField] = useState<SortField>('streak-red');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(initialTicker || null);

  const filteredStocks = useMemo(() => {
    return stocks
      .filter((stock) => {
        // Search filter
        const matchesSearch =
          stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.sector.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Shariah filter
        if (shariahOnly && !stock.isShariah) return false;

        // Grade filter
        if (gradeFilter === 'A' && stock.grade !== 'A') return false;
        if (gradeFilter === 'TRAPS' && stock.grade === 'A') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortField === 'streak-red') {
          // Most negative streak first
          return a.streak.currentStreak - b.streak.currentStreak;
        }
        if (sortField === 'streak-green') {
          // Most positive streak first
          return b.streak.currentStreak - a.streak.currentStreak;
        }
        if (sortField === 'yield') {
          return b.dividendYieldPct - a.dividendYieldPct;
        }
        if (sortField === 'drawdown') {
          return a.streak.drawdownFromPeakPct - b.streak.drawdownFromPeakPct;
        }
        return a.ticker.localeCompare(b.ticker);
      });
  }, [stocks, searchTerm, shariahOnly, gradeFilter, sortField]);

  const toggleExpand = (ticker: string) => {
    setExpandedTicker(expandedTicker === ticker ? null : ticker);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="rounded-2xl bg-[#0D0B08] border border-white/[0.08] p-4 sm:p-6 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search ticker, company (e.g. FFC, Meezan, KAPCO)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Shariah Toggle */}
            <button
              onClick={() => setShariahOnly(!shariahOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                shariahOnly
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Shariah Only (KMI)</span>
            </button>

            {/* Grade Tabs */}
            <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/5">
              <button
                onClick={() => setGradeFilter('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  gradeFilter === 'ALL'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({stocks.length})
              </button>
              <button
                onClick={() => setGradeFilter('A')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  gradeFilter === 'A'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Safe Core (A)
              </button>
              <button
                onClick={() => setGradeFilter('TRAPS')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  gradeFilter === 'TRAPS'
                    ? 'bg-rose-500/20 text-rose-300 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Yield Traps (B/C)
              </button>
            </div>
          </div>
        </div>

        {/* Sort and Count Sub-bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06] text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Showing</span>
            <span className="font-mono font-bold text-white">{filteredStocks.length}</span>
            <span>of {stocks.length} tracked PSX companies</span>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sort by:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="streak-red">Longest Red Streak (SIP Dips)</option>
              <option value="streak-green">Longest Green Streak</option>
              <option value="yield">Highest Dividend Yield %</option>
              <option value="drawdown">Drawdown from Peak</option>
              <option value="ticker">Ticker (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stocks Table (Desktop) & Cards (Mobile) */}
      <div className="rounded-2xl bg-[#0D0B08] border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-black/40 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Grade & Shariah</th>
                <th className="py-3 px-4 text-right">Price (PKR)</th>
                <th className="py-3 px-4 text-right">Yield %</th>
                <th className="py-3 px-4">Streak Status</th>
                <th className="py-3 px-4 w-28">30d Sparkline</th>
                <th className="py-3 px-4 text-center">Schedule</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {filteredStocks.map((stock) => {
                const isExpanded = expandedTicker === stock.ticker;
                const isTrap = stock.grade !== 'A';

                return (
                  <React.Fragment key={stock.ticker}>
                    <tr
                      onClick={() => toggleExpand(stock.ticker)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                      } ${isTrap ? 'border-l-2 border-l-rose-500/50' : ''}`}
                    >
                      {/* Company Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-white font-mono flex items-center gap-2">
                          <span>{stock.ticker}</span>
                          {stock.streak.isSipDipZone && (
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 line-clamp-1 max-w-[200px]">
                          {stock.name}
                        </div>
                        <div className="text-[10px] text-zinc-400">{stock.sector}</div>
                      </td>

                      {/* Grade & Shariah */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <GradeBadge grade={stock.grade} showLabel={false} />
                          <ShariahBadge isShariah={stock.isShariah} />
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white tabular-nums">
                        Rs {stock.price.toLocaleString('en-PK')}
                        <div className="text-[10px] text-zinc-400 font-normal">
                          {stock.streak.changeTodayPct >= 0 ? '+' : ''}
                          {stock.streak.changeTodayPct.toFixed(1)}%
                        </div>
                      </td>

                      {/* Yield */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                        <span
                          className={`text-sm ${
                            isTrap
                              ? 'text-rose-400 underline decoration-rose-500/40 decoration-wavy'
                              : 'text-emerald-400'
                          }`}
                        >
                          {stock.dividendYieldPct.toFixed(1)}%
                        </span>
                        <div className="text-[10px] text-zinc-400 font-normal">
                          {isTrap ? 'Trailing Trap' : 'Grade A Core'}
                        </div>
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4">
                        <StreakBadge streak={stock.streak} compact={false} />
                        <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                          {stock.streak.drawdownFromPeakPct.toFixed(1)}% off peak
                        </div>
                      </td>

                      {/* Sparkline */}
                      <td className="py-3.5 px-4">
                        <div className="w-24">
                          <Sparkline
                            data={stock.history}
                            color={stock.streak.currentStreak < 0 ? 'rose' : 'emerald'}
                            height={26}
                          />
                        </div>
                      </td>

                      {/* Schedule Pills */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-zinc-300 font-mono text-[10px]">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {stock.payoutMonths.length}x / yr
                        </span>
                      </td>

                      {/* Expand Toggle */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(stock.ticker);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Details Row */}
                    {isExpanded && (
                      <tr className="bg-black/40">
                        <td colSpan={8} className="p-5 border-t border-b border-white/[0.06]">
                          <div className="space-y-4">
                            {/* Yield Trap Warning Alert if Grade B/C */}
                            {stock.trapWarning && (
                              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-2">
                                    <span>Yield Trap Alert: Do Not Rely on Trailing Yield</span>
                                    <button
                                      onClick={() => openGuide('yield-traps')}
                                      className="text-[10px] underline hover:text-white"
                                    >
                                      Read Guide on Traps &rarr;
                                    </button>
                                  </div>
                                  <p className="text-xs text-rose-200/90 leading-relaxed">
                                    {stock.trapWarning}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Two-column overview */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left: Plain English Summary */}
                              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                  Beginner Summary & Business Moat
                                </span>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {stock.beginnerSummary}
                                </p>
                                <div className="text-[11px] text-zinc-400 pt-1">
                                  <strong className="text-zinc-300">Grade Reason:</strong> {stock.gradeReason}
                                </div>
                              </div>

                              {/* Right: Payout Calendar Breakdown */}
                              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" />
                                  12-Month Expected Payout Schedule
                                </span>
                                <div className="grid grid-cols-6 gap-1.5 text-center">
                                  {MONTH_NAMES.map((month, idx) => {
                                    const monthNum = idx + 1;
                                    const paysInThisMonth = stock.payoutMonths.includes(monthNum);
                                    return (
                                      <div
                                        key={month}
                                        className={`p-1.5 rounded text-[11px] font-mono transition-colors ${
                                          paysInThisMonth
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                                            : 'bg-black/30 text-zinc-600 border border-transparent'
                                        }`}
                                      >
                                        <div>{month}</div>
                                        <div className="text-[9px] mt-0.5">
                                          {paysInThisMonth ? 'Payout' : '-'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[11px] text-zinc-400">
                                  Historical payouts occur in {stock.payoutMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')}.
                                </p>
                              </div>
                            </div>

                            {/* Action CTA */}
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-xs text-zinc-400">
                                30-Day Drawdown: <span className="text-white font-mono">{stock.streak.drawdownFromPeakPct.toFixed(1)}%</span>
                              </span>
                              <Link
                                href={`/planner?ticker=${stock.ticker}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
                              >
                                <span>Simulate in Life Planner</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards */}
        <div className="lg:hidden divide-y divide-white/[0.06] p-3 space-y-3">
          {filteredStocks.map((stock) => {
            const isExpanded = expandedTicker === stock.ticker;
            const isTrap = stock.grade !== 'A';

            return (
              <div
                key={stock.ticker}
                className={`p-3 rounded-xl bg-black/40 border border-white/5 space-y-3 ${
                  isTrap ? 'border-l-4 border-l-rose-500' : ''
                }`}
              >
                <div
                  onClick={() => toggleExpand(stock.ticker)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-white">
                        {stock.ticker}
                      </span>
                      <ShariahBadge isShariah={stock.isShariah} />
                      <GradeBadge grade={stock.grade} showLabel={false} />
                    </div>
                    <div className="text-xs text-zinc-400">{stock.name}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-white">
                      Rs {stock.price.toLocaleString('en-PK')}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {stock.dividendYieldPct.toFixed(1)}% Yield
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <StreakBadge streak={stock.streak} compact={true} />
                  <div className="w-20">
                    <Sparkline
                      data={stock.history}
                      color={stock.streak.currentStreak < 0 ? 'rose' : 'emerald'}
                      height={20}
                    />
                  </div>
                  <button
                    onClick={() => toggleExpand(stock.ticker)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    {isExpanded ? 'Less' : 'Details'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-white/10 space-y-3 text-xs">
                    {stock.trapWarning && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                        <div className="font-bold uppercase text-[10px]">Yield Trap Warning:</div>
                        <p className="mt-1 text-[11px]">{stock.trapWarning}</p>
                      </div>
                    )}
                    <p className="text-zinc-300 leading-normal">{stock.beginnerSummary}</p>
                    <div className="text-[11px] text-zinc-400">
                      Payout months: {stock.payoutMonths.map((m) => MONTH_NAMES[m - 1]).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
