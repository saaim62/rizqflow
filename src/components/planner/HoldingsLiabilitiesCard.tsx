'use client';

import React, { useState, useEffect } from 'react';
import { HoldingItem, HoldingKind, LiabilityCategory, LiabilityItem, LiabilityKind, UserProfile } from '@/types';
import { netLiquidReservePkr, totalHoldingsPkr, totalLiabilitiesPkr } from '@/lib/engine/wealthEngine';
import { isScheduledLiability, liabilityBalancePkr, summarizeLiability } from '@/lib/engine/debtSchedule';
import { formatCompactPkr, formatPkr } from '@/lib/format';
import { AmountWords } from '@/components/ui/AmountWords';
import { AiButton } from '@/components/ui/AiButton';
import { FieldInfo } from '@/components/ui/FieldInfo';
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

function HoldingRow({
  holding: h,
  profile,
  updateHolding,
  onRemove,
}: {
  holding: HoldingItem;
  profile: UserProfile;
  updateHolding: (id: string, patch: Partial<HoldingItem>) => void;
  onRemove: () => void;
}) {
  const kindMeta = KIND_OPTIONS.find((k) => k.value === h.kind);
  const [rawQty, setRawQty] = useState<string>(
    h.quantity !== undefined && h.quantity !== null ? String(h.quantity) : ''
  );

  useEffect(() => {
    setRawQty(h.quantity !== undefined && h.quantity !== null ? String(h.quantity) : '');
  }, [h.quantity]);

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-2">
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
          onClick={onRemove}
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
                value={rawQty}
                onChange={(e) => {
                  const val = e.target.value;
                  setRawQty(val);
                  if (val === '') {
                    updateHolding(h.id, { quantity: 0 });
                  } else {
                    updateHolding(h.id, { quantity: Number(val) });
                  }
                }}
                className={numCls}
              />
            </label>
            <label className="space-y-1 block">
              <span className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>
                  {h.kind === 'fund' ? 'NAV / unit' : h.kind === 'gold' ? 'Rate / tola' : 'Price / share'}
                </span>
                <FieldInfo
                  title={
                    h.kind === 'gold'
                      ? 'Rate / tola — what it means'
                      : h.kind === 'fund'
                      ? 'NAV / unit — what it means'
                      : 'Price / share — what it means'
                  }
                  text={
                    h.kind === 'gold'
                      ? `The price of one tola (11.66 grams) of gold at YOUR purity.

24K is the headline Sarafa rate. 21K is worth 21/24 of it, 22K is 22/24, and so on.

Your holding's value = tola x this rate.`
                      : h.kind === 'fund'
                      ? `NAV is the price of ONE unit of the mutual fund today — funds publish it daily.

Your holding's value = units x NAV.`
                      : `The current market price of ONE share.

Your holding's value = shares x this price.`
                  }
                />
                {h.kind === 'gold' ? (
                  <AiButton
                    type="gold-rate"
                    context={{ purityKarat: h.purityKarat ?? 24, rate24kPerTola: profile.goldPerTolaPkr ?? DEFAULT_MARKET_RATES.goldPerTolaPkr }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    updateHolding(h.id, { unitPricePkr: 0 });
                  } else {
                    updateHolding(h.id, { unitPricePkr: Number(val) });
                  }
                }}
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
            value={h.valuePkr ?? ''}
            onChange={(e) => updateHolding(h.id, { valuePkr: e.target.value === '' ? 0 : Number(e.target.value) })}
            className={numCls}
          />
          <AmountWords value={h.valuePkr ?? 0} />
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
}

const LIABILITY_CATEGORY_OPTIONS: { value: LiabilityCategory; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'vehicle-loan', label: 'Vehicle Loan' },
  { value: 'education-loan', label: 'Education Loan' },
  { value: 'personal-loan', label: 'Personal Loan' },
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'bnpl', label: 'BNPL' },
  { value: 'medical', label: 'Medical' },
  { value: 'tax', label: 'Tax Due' },
  { value: 'family-loan', label: 'Family / Informal Loan' },
  { value: 'other', label: 'Other' },
];

const LIABILITY_KIND_OPTIONS: { value: LiabilityKind; label: string }[] = [
  { value: 'amortizing', label: 'Loan — fixed monthly payment' },
  { value: 'revolving', label: 'Revolving — % minimum payment' },
  { value: 'balloon', label: 'Balloon — full amount on a due date' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2029" for a 1-based schedule month counted from the projection start. */
function payoffMonthLabel(start: { year: number; month: number }, payoffMonth: number): string {
  const idx = start.month - 1 + (payoffMonth - 1);
  return `${MONTH_LABELS[idx % 12]} ${start.year + Math.floor(idx / 12)}`;
}

function LiabilityRow({
  liability: l,
  updateLiability,
  onRemove,
}: {
  liability: LiabilityItem;
  updateLiability: (id: string, patch: Partial<LiabilityItem>) => void;
  onRemove: () => void;
}) {
  // The component (not the engine) owns "today": it is passed into the
  // pure schedule helper as the projection start.
  const now = new Date();
  const start = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const scheduled = isScheduledLiability(l);
  const summary = scheduled ? summarizeLiability(l, start) : null;
  const balance = liabilityBalancePkr(l);

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={l.category ?? 'other'}
          onChange={(e) => updateLiability(l.id, { category: e.target.value as LiabilityCategory })}
          className={`${inputCls} w-auto shrink-0`}
          aria-label="Liability category"
        >
          {LIABILITY_CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value} className="bg-zinc-900">
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={l.name ?? l.label ?? ''}
          onChange={(e) => updateLiability(l.id, { name: e.target.value })}
          placeholder="e.g. Family loan — return in 5 years"
          className={inputCls}
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
          aria-label="Remove liability"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 block">
          <span className="text-[10px] text-zinc-500">Balance owed (PKR)</span>
          <input
            type="number"
            value={l.balancePkr ?? l.amountPkr ?? ''}
            onChange={(e) =>
              updateLiability(l.id, { balancePkr: e.target.value === '' ? 0 : Number(e.target.value) })
            }
            className={numCls}
          />
          <AmountWords value={balance} />
        </label>
        <label className="space-y-1 block">
          <span className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>APR % / year</span>
            <FieldInfo
              title="APR — what it means"
              text={`The yearly interest rate on this debt. Interest accrues monthly at APR ÷ 12 on the outstanding balance.

Family / informal loans are often interest-free — 0 is a valid APR.`}
            />
          </span>
          <input
            type="number"
            value={l.aprPct ?? ''}
            onChange={(e) =>
              updateLiability(l.id, { aprPct: e.target.value === '' ? 0 : Number(e.target.value) })
            }
            className={numCls}
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-[10px] text-zinc-500">Schedule type</span>
          <select
            value={l.kind ?? ''}
            onChange={(e) =>
              updateLiability(l.id, {
                kind: e.target.value === '' ? undefined : (e.target.value as LiabilityKind),
              })
            }
            className={inputCls}
          >
            <option value="" className="bg-zinc-900">
              No schedule (position only)
            </option>
            {LIABILITY_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value} className="bg-zinc-900">
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {l.kind === 'amortizing' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 block">
            <span className="text-[10px] text-zinc-500">Monthly payment (PKR)</span>
            <input
              type="number"
              value={l.monthlyPaymentPkr ?? ''}
              onChange={(e) =>
                updateLiability(l.id, {
                  monthlyPaymentPkr: e.target.value === '' ? 0 : Number(e.target.value),
                })
              }
              className={numCls}
            />
            <AmountWords value={l.monthlyPaymentPkr ?? 0} />
          </label>
          <label className="space-y-1 block">
            <span className="text-[10px] text-zinc-500">Term end (optional)</span>
            <input
              type="date"
              value={l.dueDateISO ?? ''}
              onChange={(e) => updateLiability(l.id, { dueDateISO: e.target.value || undefined })}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {l.kind === 'revolving' && (
        <label className="space-y-1 block">
          <span className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>Minimum payment (% of balance / month)</span>
            <FieldInfo
              title="Minimum payment % — what it means"
              text={`Cards and BNPL usually demand a minimum payment each month, set as a % of the outstanding balance.

The plan pays that % of the current balance every month until the debt clears — payments shrink as the balance falls.`}
            />
          </span>
          <input
            type="number"
            value={l.minPaymentPctOfBalance ?? ''}
            onChange={(e) =>
              updateLiability(l.id, {
                minPaymentPctOfBalance: e.target.value === '' ? 0 : Number(e.target.value),
              })
            }
            className={numCls}
          />
        </label>
      )}

      {l.kind === 'balloon' && (
        <label className="space-y-1 block">
          <span className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>Due date — full balance leaves the plan</span>
            <FieldInfo
              title="Balloon due date — what it means"
              text={`A balloon debt is repaid in ONE lump sum on its due date — common for family / informal loans ("return it in 5 years").

No monthly payments are modelled; the balance accrues interest at the APR and the full amount leaves your portfolio in the due month. If the portfolio cannot cover it, the plan shows the shortfall explicitly.`}
            />
          </span>
          <input
            type="date"
            value={l.dueDateISO ?? ''}
            onChange={(e) => updateLiability(l.id, { dueDateISO: e.target.value || undefined })}
            className={inputCls}
          />
        </label>
      )}

      <input
        type="text"
        value={l.details ?? ''}
        onChange={(e) => updateLiability(l.id, { details: e.target.value || undefined })}
        placeholder="Notes (optional)"
        className={inputCls}
      />

      {scheduled && summary ? (
        <p className="text-[11px] leading-relaxed text-zinc-400">
          {l.kind === 'balloon' ? (
            <>
              Due{' '}
              <span className="text-rose-300 font-semibold">
                {summary.payoffMonth ? payoffMonthLabel(start, summary.payoffMonth) : 'beyond the projection'}
              </span>{' '}
              · total interest {formatPkr(summary.totalInterestPkr)}
            </>
          ) : summary.payoffMonth ? (
            <>
              Clears{' '}
              <span className="text-emerald-300 font-semibold">
                {payoffMonthLabel(start, summary.payoffMonth)}
              </span>{' '}
              · total interest {formatPkr(summary.totalInterestPkr)}
            </>
          ) : (
            <span className="text-rose-300">
              Does not clear on this schedule — the payment does not outrun the interest.
            </span>
          )}
          {summary.negativeAmortization && (
            <span className="block text-rose-300 font-semibold mt-0.5">
              Warning: the monthly payment is less than the monthly interest — this balance is
              growing, not shrinking.
            </span>
          )}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          No schedule set — this debt counts in your net liquid position only. Pick a schedule type
          above and its payments will bite inside the life-plan projection.
        </p>
      )}
    </div>
  );
}

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
        if (patch.quantity !== undefined || patch.unitPricePkr !== undefined) {
          const qty = merged.quantity ?? 0;
          const price = merged.unitPricePkr ?? 0;
          if (qty <= 0 || price <= 0) {
            merged.valuePkr = 0;
          } else {
            merged.valuePkr = Math.round(qty * price);
          }
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
    setLiabilities(
      liabilities.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...patch };
        // Keep the legacy mirrors in sync with the canonical scheduled
        // fields so every consumer reads the same name / balance.
        if (patch.name !== undefined) merged.label = patch.name;
        if (patch.balancePkr !== undefined) merged.amountPkr = patch.balancePkr;
        return merged;
      })
    );

  const addLiability = () =>
    setLiabilities([
      ...liabilities,
      {
        id: newId(),
        name: '',
        label: '',
        category: 'personal-loan',
        kind: 'amortizing',
        balancePkr: 0,
        amountPkr: 0,
        aprPct: 0,
        monthlyPaymentPkr: 0,
      },
    ]);

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

        {holdings.map((h) => (
          <HoldingRow
            key={h.id}
            holding={h}
            profile={profile}
            updateHolding={updateHolding}
            onRemove={() => setHoldings(holdings.filter((x) => x.id !== h.id))}
          />
        ))}
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
          <LiabilityRow
            key={l.id}
            liability={l}
            updateLiability={updateLiability}
            onRemove={() => setLiabilities(liabilities.filter((x) => x.id !== l.id))}
          />
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
