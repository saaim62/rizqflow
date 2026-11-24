'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  BookOpen, 
  X, 
  AlertTriangle, 
  Coins, 
  Calendar, 
  Landmark, 
  ShieldCheck, 
  Percent, 
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface BeginnerGuideContextType {
  isOpen: boolean;
  activeTopic: string;
  openGuide: (topic?: string) => void;
  closeGuide: () => void;
}

const BeginnerGuideContext = createContext<BeginnerGuideContextType>({
  isOpen: false,
  activeTopic: 'dividends',
  openGuide: () => {},
  closeGuide: () => {},
});

export const useBeginnerGuide = () => useContext(BeginnerGuideContext);

const TOPICS = [
  {
    id: 'dividends',
    title: 'What is a Dividend?',
    shortDesc: 'Quarterly cash profit directly into your bank',
    icon: Coins,
    color: 'emerald',
  },
  {
    id: 'yield-traps',
    title: 'Yield Traps (Why 20% hurts)',
    shortDesc: 'NBP, KAPCO, LOTCHEM deceptive yields',
    icon: AlertTriangle,
    color: 'rose',
  },
  {
    id: 'ex-date',
    title: 'Ex-Dividend & Book Closure',
    shortDesc: 'Exact cutoff dates to qualify for cash payouts',
    icon: Calendar,
    color: 'blue',
  },
  {
    id: 'lumpy-payouts',
    title: 'Lumpy PSX Payouts',
    shortDesc: 'Feast-or-famine quarterly distribution reality',
    icon: Landmark,
    color: 'amber',
  },
  {
    id: 'cdc-brokerage',
    title: 'CDC & Brokerage Basics',
    shortDesc: 'How your shares sit safely under SECP regulations',
    icon: ShieldCheck,
    color: 'purple',
  },
  {
    id: 'filer-tax',
    title: 'Filer vs Non-Filer Tax (15% vs 30%)',
    shortDesc: 'Non-filers surrender double tax at source',
    icon: Percent,
    color: 'rose',
  },
];

export function BeginnerGuideProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState('dividends');

  const openGuide = (topic?: string) => {
    if (topic) setActiveTopic(topic);
    setIsOpen(true);
  };

  const closeGuide = () => setIsOpen(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGuide();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  return (
    <BeginnerGuideContext.Provider value={{ isOpen, activeTopic, openGuide, closeGuide }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeGuide}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-2xl bg-[#0C0C0F] border-l border-white/10 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-[#0C0C0F]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    Pakistani Beginner's Dividend Guide
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      PSX 101
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">Essential rules for halal cash-flow investing in Pakistan</p>
                </div>
              </div>
              <button
                onClick={closeGuide}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close Guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Topic Chips */}
            <div className="flex gap-2 p-3 px-6 overflow-x-auto border-b border-white/5 bg-[#121214]/80 no-scrollbar">
              {TOPICS.map((t) => {
                const Icon = t.icon;
                const isSelected = activeTopic === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTopic(t.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                        : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-zinc-300 leading-relaxed">
              {activeTopic === 'dividends' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Core Principle</span>
                    <h3 className="text-base font-semibold text-white mt-1">What is a Cash Dividend?</h3>
                    <p className="mt-2 text-zinc-300">
                      When a profitable company (like Fauji Fertilizer or Meezan Bank) earns real operational profit, 
                      its board of directors declares a cash distribution. For every share you own, money is deposited 
                      <strong> directly into your IBAN bank account via e-Dividend / CDC</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-emerald-400 font-semibold mb-1">Passive Cash Stream</div>
                      <p className="text-xs text-zinc-400 leading-normal">
                        You do not need to sell your shares to get cash. You keep your shares, while quarterly profit cheques cover your utility bills, groceries, or petrol.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-amber-400 font-semibold mb-1">Inflation Hedge</div>
                      <p className="text-xs text-zinc-400 leading-normal">
                        Top Pakistani blue chips (FFC, HUBC, EFERT) raise prices alongside inflation, growing their rupee dividend payouts over 5-10 year horizons.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-sm font-semibold text-white mb-2">Example Calculation:</h4>
                    <p className="text-xs text-zinc-300">
                      If you hold <strong>1,000 shares</strong> of FFC bought at Rs 310 (Rs 310,000 invested) and FFC pays Rs 28/share annual dividend:
                    </p>
                    <div className="mt-3 p-3 rounded-lg bg-[#0C0C0F] border border-white/10 font-mono text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Gross Dividend:</span>
                        <span className="text-white font-semibold">1,000 × Rs 28 = Rs 28,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Filer WHT Tax (15%):</span>
                        <span className="text-rose-400">- Rs 4,200</span>
                      </div>
                      <div className="flex justify-between border-t border-white/10 pt-1 text-emerald-400 font-bold">
                        <span>Net Deposited into Bank:</span>
                        <span>Rs 23,800 (~7.7% Net Yield)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTopic === 'yield-traps' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                    <div className="flex items-center gap-2 font-bold text-rose-400 uppercase text-xs tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      Critical Risk: The High-Yield Mirage
                    </div>
                    <h3 className="text-base font-semibold text-white mt-1">Why a 20%+ Dividend Yield Can Ruin You</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Beginners in Pakistan frequently search for stocks with the highest trailing dividend yield, 
                      assuming a 22% yield will pay forever. In PSX, abnormal yields almost always signal severe underlying risks:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-400">1. NBP (National Bank of Pakistan) — Trailing 18-20%</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Grade C Trap</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">
                        <strong>The Trap:</strong> NBP paid an extraordinary one-off payout following the Supreme Court pension litigation resolution in late 2024 / 2025. This was an exceptional backlog settlement, <strong>not repeatable operational earnings</strong>. Looking at trailing 12-month data paints a deceptive picture.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-400">2. KAPCO (Kot Addu Power) — Trailing 17-21%</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Grade C Trap</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">
                        <strong>The Trap:</strong> KAPCO&apos;s 25-year Power Purchase Agreement (PPA) with the government expired. Its cash payouts represented the liquidation of legacy cash reserves and final capacity receivables, not sustainable ongoing plant generation profits.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-400">3. LOTCHEM (Lotte Chemical) — Trailing 14-18%</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Grade B Cyclical</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-2">
                        <strong>The Trap:</strong> Highly cyclical petrochemical margins (PTA-Paraxylene spreads). When global chemical spreads collapse, earnings plummet to zero and dividends vanish overnight.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    💡 <strong>The RizqFlow Rule:</strong> Stick to Grade A Core compounders (FFC, HUBC, EFERT, MEBL) with 7.5% - 9.5% sustainable yields backed by monopolistic cash flow and defensive consumer demand.
                  </div>
                </div>
              )}

              {activeTopic === 'ex-date' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Timing Mechanics</span>
                    <h3 className="text-base font-semibold text-white mt-1">Ex-Dividend Date & Book Closure</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      You do not have to hold a stock all year to receive a dividend, but you <strong>must own it before the Ex-Date</strong>.
                    </p>
                  </div>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-[#0C0C0F]" />
                      <h4 className="text-sm font-semibold text-white">1. Board Announcement</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        The company announces results (e.g. "Rs 5/share interim dividend") and specifies the <strong>Book Closure</strong> dates (e.g. March 18 to March 25).
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-[#0C0C0F]" />
                      <h4 className="text-sm font-semibold text-white">2. Ex-Dividend Date (T+2 Settlement)</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Because PSX trades settle in 2 business days (T+2), the stock begins trading "Ex-Dividend" usually 2 working days before book closure. You must purchase <strong>BEFORE</strong> the Ex-Date to have your name in the CDC ledger.
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-[#0C0C0F]" />
                      <h4 className="text-sm font-semibold text-white">3. Price Adjustment on Ex-Date</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        On the morning of the Ex-Date, the PSX automatically adjusts the opening stock price downward by the exact dividend amount. There is no "free money" glitch — dividend investing is about long-term ownership and compounding cash generation.
                      </p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-400 ring-4 ring-[#0C0C0F]" />
                      <h4 className="text-sm font-semibold text-white">4. Cash Payout (Warrant / Direct Credit)</h4>
                      <p className="text-xs text-zinc-400 mt-1">
                        Within 10 to 15 working days following book closure, funds are credited directly to your registered Pakistani bank account via 1-Link CDC e-Dividend.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTopic === 'lumpy-payouts' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Cash Flow Reality</span>
                    <h3 className="text-base font-semibold text-white mt-1">Lumpy PSX Payouts: The Chunky Calendar</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Salaried employees are accustomed to receiving equal pay on the 1st of every month. 
                      <strong> PSX dividends do NOT pay monthly!</strong>
                    </p>
                  </div>

                  <p className="text-xs text-zinc-300">
                    Pakistani corporations report quarterly results and pay in seasonal clusters:
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="font-bold text-emerald-400">March - April</div>
                      <div className="text-zinc-400 mt-1">Final Dec payouts (Huge cluster)</div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="font-bold text-emerald-400">May - June</div>
                      <div className="text-zinc-400 mt-1">Q1 interim distributions</div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="font-bold text-emerald-400">August - September</div>
                      <div className="text-zinc-400 mt-1">Half-year interims + June finals</div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="font-bold text-emerald-400">November</div>
                      <div className="text-zinc-400 mt-1">Q3 interims (Fertilizers/Power)</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <h4 className="text-sm font-semibold text-white">Why the Emergency Buffer is Essential:</h4>
                    <p className="text-xs text-zinc-400">
                      In months like January, July, or December, dividend receipts may drop to near zero. 
                      That is why RizqFlow mandates a <strong>4-month Emergency Fund buffer</strong> so you never have to liquidate shares at a market bottom just to pay rent or utility bills.
                    </p>
                  </div>
                </div>
              )}

              {activeTopic === 'cdc-brokerage' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Safety & Infrastructure</span>
                    <h3 className="text-base font-semibold text-white mt-1">How Your Money is Protected</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Many beginners fear: <em>"What if the broker runs away with my money?"</em> 
                      Pakistan has one of the safest custody architectures via the Central Depository Company (CDC).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <h4 className="text-sm font-semibold text-emerald-400">1. Sub-Account at CDC</h4>
                      <p className="text-xs text-zinc-300 mt-1">
                        When you open an account with a TREC-holder PSX broker (e.g. Arif Habib, AKD, Finox, KTrade, JS Global), your shares are stored electronically in your name with CDC. The broker cannot transfer your shares without your authorization.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <h4 className="text-sm font-semibold text-blue-400">2. SECP Regulated</h4>
                      <p className="text-xs text-zinc-300 mt-1">
                        The Securities & Exchange Commission of Pakistan (SECP) strictly audits broker balances. Segregated client bank accounts mean broker operational expenses cannot touch customer funds.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <h4 className="text-sm font-semibold text-purple-400">3. Roshan Digital Account (RDA) & Sahulat Accounts</h4>
                      <p className="text-xs text-zinc-300 mt-1">
                        Overseas Pakistanis can open an RDA account in under 48 hours to invest in PSX. Resident Pakistanis can open a <strong>Sahulat Account</strong> using just their CNIC without complex income proof for initial portfolios under Rs 10 Lac.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTopic === 'filer-tax' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-2 font-bold text-rose-400 uppercase text-xs tracking-wider">
                      <Percent className="w-4 h-4" />
                      FBR Withholding Tax Shock
                    </div>
                    <h3 className="text-base font-semibold text-white mt-1">Filers Keep Double: 15% vs 30% WHT</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Under Section 150 of the Income Tax Ordinance, cash dividends are subject to full withholding tax at source before reaching your account.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-400 uppercase">Active Tax Filer</div>
                      <div className="text-3xl font-extrabold text-white mt-2 font-mono">15%</div>
                      <p className="text-xs text-zinc-400 mt-2">
                        On Rs 300,000 annual dividends, tax is Rs 45,000. You keep <strong>Rs 255,000</strong>.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <div className="text-xs font-bold text-rose-400 uppercase">Non-Filer</div>
                      <div className="text-3xl font-extrabold text-rose-400 mt-2 font-mono">30%</div>
                      <p className="text-xs text-zinc-400 mt-2">
                        On Rs 300,000 annual dividends, tax is Rs 90,000. You lose <strong>Rs 45,000 extra</strong> every year!
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <h4 className="text-xs font-bold text-amber-400 uppercase">Zakat on PSX Shares</h4>
                    <p className="text-xs text-zinc-300 mt-1">
                      Zakat at 2.5% is automatically deducted on the 1st of Ramadan unless you submit a notarized CZ-50 declaration (Zakat exemption form) to your broker prior to Sha&apos;ban.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Action */}
            <div className="p-4 px-6 border-t border-white/10 bg-[#0C0C0F] flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Stamped PSX data (see as-of stamp) & simulated models
              </span>
              <button
                onClick={closeGuide}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
              >
                Got It, Let&apos;s Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </BeginnerGuideContext.Provider>
  );
}
