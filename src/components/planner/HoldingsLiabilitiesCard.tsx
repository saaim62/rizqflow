'use client';

import React from 'react';
import { HoldingItem, HoldingKind, LiabilityItem, UserProfile } from '@/types';
import { netLiquidReservePkr, totalHoldingsPkr, totalLiabilitiesPkr } from '@/lib/engine/wealthEngine';
import { formatCompactPkr, formatPkr } from '@/lib/format';
import { AmountWords } from '@/components/ui/AmountWords';
import { AiButton } from '@/components/ui/AiButton';
import { DEFAULT_MARKET_RATES } from '@/lib/marketRates';
import { Briefcase, Plus, Trash2 } from 'lucide-react';

/**
 * HoldingsLiabilitiesCard — item-level detail for a portfolio (NOTES #23).
 * The asset buckets say HOW money is split; this card records WHAT is
 * actually held and owed, item by item: gold weight & purity, fund units
 * & NAV, plot details, individual bank balances, stock holdings — and
 * liabilities (e.g. a Splitwise balance), which feed the plan's net
 * liquid position and emergency-fund gap.
 */

interface Props {
  profile: UserProfile;
  onChange: (updated: UserProfile) => void;
}

const KIND_OPTIONS: { value: HoldingKind; label: string; unitLabel?: string; detailsHint: string }[] = [
  { value: 'gold', label: 'Gold', unitLabel: 'tola', detailsHint: 'e.g. jewellery set, biscuits' },
  { value: 'fund', label: 'Mutual Fund', unitLabel: 'units', detailsHint: 'e.g. KSE Meezan Index Fund (KMIF)' },
  { value: 'stock', label: 'Stocks (PSX)', unitLabel: 'shares', detailsHint: 'e.g. OGDC, held at CDC' },
  { value: 'real-estate', label: 'Real Estate / Plot', detailsHint: 'e.g. 10 Marla, DHA Phase 6, Block C' },
  { value: 'bank', label: 'Bank Account', detailsHint: 'e.g. Meezan Mahana Munafa account' },
  { value: 'other', label: 'Other Asset', detailsHint: 'Any note that identifies the item' },
];

const newId = () => `item-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none';
const numCls = `${inputCls} font-mono`;

export function HoldingsLiabilitiesCard({ profile, onChange }: Props) {
  const holdings = profile.holdings ?? [];
  const liabilities = profile.liabilities ?? [];
  const holdingsTotal = totalHoldingsPkr(profile);
  const liabilitiesTotal = totalLiabilitiesPkr(profile);
  const netLiquid = netLiquidReservePkr(profile);

  const setHoldings = (next: HoldingItem[]) => onChange({ ...profile, holdings: next });
  const setLiabilities = (next: LiabilityItem[]) => onChange({ ...profile, liabilities: next });

  const updateHolding = (id: string, patch: Partial<HoldingItem>) => {
    setHoldings(
      holdings.map((h) => {
        if (h.id !== id) return h;
        const merged = { ...h, ...patch };
        // Quantity × unit price drives the value when both are present
        // (fund units × NAV, shares × price, tola × rate).
        if (
          (patch.quantity !== undefined || patch.unitPricePkr !== undefined) &&
          merged.quantity &&
          merged.quantity > 0 &&
          merged.unitPricePkr &&
          merged.unitPricePkr > 0
        ) {
          merged.valuePkr = Math.round(merged.quantity * merged.unitPricePkr);
        }
        return merged;
      })
    );
  };

  const addHolding = () =>
    setHoldings([
      ...holdings,
      { id: newId(), kind: 'gold', label: '', valuePkr: 0, unitLabel: 'tola', purityKarat: 24 },
    ]);

  const updateLiability = (id: string, patch: Partial<LiabilityItem>) =>
    setLiabilities(liabilities.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLiability = () => setLiabilities([...liabilities, { id: newId(), label: '', amountPkr: 0 }]);

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/10 p-5 space-y-5 shadow-md">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white tracking-tight">Holdings & Liabilities — Item Detail</h3>
      </div>

      {/* ---- Holdings ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">What you hold, item by item</span>
          <button
            type="button"
            onClick={addHolding}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold"
          >
            <Plus className="w-3 h-3" /> Add item
          </button>
        </div>

        {holdings.length === 0 && (
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Nothing itemised yet. Add your gold (weight & purity), funds (units & NAV), plots, bank
            balances and stock holdings so the portfolio reflects what you actually own — not just
            bucket percentages.
          </p>
        )}

        {holdings.map((h) => {
          const kindMeta = KIND_OPTIONS.find((k) => k.value === h.kind);
          return (
            <div key={h.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={h.kind}
                  onChange={(e) => {
                    const kind = e.target.value as HoldingKind;
                    const meta = KIND_OPTIONS.find((k) => k.value === kind);
                    updateHolding(h.id, { kind, unitLabel: meta?.unitLabel });
                  }}
                  className={`${inputCls} w-auto shrink-0`}
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value} className="bg-zinc-900">
                      {k.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={h.label}
                  onChange={(e) => updateHolding(h.id, { label: e.target.value })}
                  placeholder="Item name"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setHoldings(holdings.filter((x) => x.id !== h.id))}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {kindMeta?.unitLabel && (
                  <>
                    <label className="space-y-1 block">
                      <span className="text-[10px] text-zinc-500">Qty ({kindMeta.unitLabel})</span>
                      <input
                        type="number"
                        value={h.quantity ?? ''}
                        onChange={(e) => updateHolding(h.id, { quantity: Number(e.target.value) || undefined })}
                        className={numCls}
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span>
                          {h.kind === 'fund' ? 'NAV / unit' : h.kind === 'gold' ? 'Rate / tola' : 'Price / share'}
                        </span>
                        {h.kind === 'gold' ? (
                          <AiButton
                            type="gold-rate"
                            context={{ purityKarat: h.purityKarat ?? 24, rate24kPerTola: profile.goldPerTolaPkr || DEFAULT_MARKET_RATES.goldPerTolaPkr }}
                            currentValue={h.unitPricePkr}
                            onAccept={(val) => updateHolding(h.id, { unitPricePkr: val })}
                            formatValue={(x) => formatCompactPkr(x)}
                          />
                        ) : h.kind === 'fund' ? (
                          <AiButton
                            type="fund-nav"
                            context={{ fundName: h.label }}
                            currentValue={h.unitPricePkr}
                            onAccept={(val) => updateHolding(h.id, { unitPricePkr: val })}
                            formatValue={(x) => `Rs ${x.toLocaleString('en-US')}`}
                          />
                        ) : (
                          <AiButton
                            type="stock-price"
                            context={{ ticker: h.label, companyName: h.label }}
                            currentValue={h.unitPricePkr}
                            onAccept={(val) => updateHolding(h.id, { unitPricePkr: val })}
                            formatValue={(x) => `Rs ${x.toLocaleString('en-US')}`}
                          />
                        )}
                      </span>
                      <input
                        type="number"
                        value={h.unitPricePkr ?? ''}
                        onChange={(e) => updateHolding(h.id, { unitPricePkr: Number(e.target.value) || undefined })}
                        className={numCls}
                      />
                      <AmountWords value={h.unitPricePkr ?? 0} />
                    </label>
                  </>
                )}
                {h.kind === 'gold' && (
                  <label className="space-y-1 block">
                    <span className="text-[10px] text-zinc-500">Purity</span>
                    <select
                      value={h.purityKarat ?? 24}
                      onChange={(e) => updateHolding(h.id, { purityKarat: Number(e.target.value) })}
                      className={inputCls}
                    >
                      {[24, 22, 21, 18].map((k) => (
                        <option key={k} value={k} className="bg-zinc-900">
                          {k}K
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="space-y-1 block">
                  <span className="text-[10px] text-zinc-500">Value (PKR)</span>
                  <input
                    type="number"
                    value={h.valuePkr || ''}
                    onChange={(e) => updateHolding(h.id, { valuePkr: Number(e.target.value) || 0 })}
                    className={numCls}
                  />
                  <AmountWords value={h.valuePkr} />
                </label>
              </div>

              <input
                type="text"
                value={h.details ?? ''}
                onChange={(e) => updateHolding(h.id, { details: e.target.value || undefined })}
                placeholder={kindMeta?.detailsHint}
                className={inputCls}
              />
            </div>
          );
        })}
      </div>

      {/* ---- Liabilities ---- */}
      <div className="space-y-3 pt-1 border-t border-white/[0.06]">
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-semibold text-zinc-300">What you owe</span>
          <button
            type="button"
            onClick={addLiability}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold"
          >
            <Plus className="w-3 h-3" /> Add liability
          </button>
        </div>

        {liabilities.length === 0 && (
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            No liabilities recorded. Add anything you owe — a Splitwise balance, a credit card, a loan —
            it reduces your net liquid position and is counted in the emergency-fund gap.
          </p>
        )}

        {liabilities.map((l) => (
          <div key={l.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={l.label}
                onChange={(e) => updateLiability(l.id, { label: e.target.value })}
                placeholder="e.g. Splitwise balance owed"
                className={inputCls}
              />
              <input
                type="number"
                value={l.amountPkr || ''}
                onChange={(e) => updateLiability(l.id, { amountPkr: Number(e.target.value) || 0 })}
                placeholder="Amount (PKR)"
                className={`${numCls} w-[130px] shrink-0`}
              />
              <AmountWords value={l.amountPkr} />
              <button
                type="button"
                onClick={() => setLiabilities(liabilities.filter((x) => x.id !== l.id))}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                aria-label="Remove liability"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={l.details ?? ''}
              onChange={(e) => updateLiability(l.id, { details: e.target.value || undefined })}
              placeholder="Notes (optional)"
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {/* ---- Summary ---- */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/[0.06] text-center">
        <div className="pt-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Itemised holdings</div>
          <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{formatPkr(holdingsTotal)}</div>
        </div>
        <div className="pt-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Liabilities</div>
          <div className="font-mono font-bold text-rose-400 text-sm mt-0.5">−{formatPkr(liabilitiesTotal)}</div>
        </div>
        <div className="pt-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Net liquid position</div>
          <div className="font-mono font-bold text-white text-sm mt-0.5">{formatPkr(netLiquid)}</div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Net liquid position = cash reserve − liabilities. Enter each debt once: either here as a liability,
        or inside the cash reserve — not both.
      </p>
    </div>
  );
}
