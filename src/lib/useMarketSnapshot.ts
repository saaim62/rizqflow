'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_MARKET_RATES,
  getCustomRateKeys,
  loadCustomMarketRates,
} from '@/lib/marketRates';
import { MARKET_SNAPSHOT } from '@/data/marketData';
import type { MarketRatesConfig } from '@/types';

/**
 * Hourly-refreshed market snapshot shared by the pulse bar, the home ticker
 * pills and any other indicator. One module-level cache + one interval for
 * the whole app: first mount fetches /api/market-snapshot, then it re-pulls
 * every hour. Fields the user customized in the Adjust Rates editor are
 * never clobbered by a refresh (tracked via getCustomRateKeys).
 */

export interface MarketSnapshotState {
  rates: MarketRatesConfig;
  silverPerTolaPkr: number;
  updatedAt: number | null; // epoch ms of last successful server sync
  refresh: () => void;
}

const REFRESH_MS = 60 * 60 * 1000; // hourly

let cache: MarketRatesConfig = { ...DEFAULT_MARKET_RATES };
let silverCache: number = MARKET_SNAPSHOT.silverPerTolaPkr;
let lastSync = 0;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

async function pull() {
  try {
    const res = await fetch('/api/market-snapshot', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    const serverRates = (json?.rates ?? {}) as Partial<MarketRatesConfig>;
    const customKeys = new Set(getCustomRateKeys());
    // Local state (user customs + healed defaults) is the base; the server
    // wins only for fields the user has never customized.
    const next: MarketRatesConfig = { ...loadCustomMarketRates() };
    (Object.keys(serverRates) as (keyof MarketRatesConfig)[]).forEach((k) => {
      if (customKeys.has(k)) return; // user-customized: hands off
      const v = serverRates[k];
      if (typeof v === 'number' && v > 0) {
        (next as unknown as Record<string, unknown>)[k] = v;
      } else if (typeof v === 'string') {
        (next as unknown as Record<string, unknown>)[k] = v;
      }
    });
    cache = next;
    if (typeof json?.silverPerTolaPkr === 'number' && json.silverPerTolaPkr > 0) {
      silverCache = json.silverPerTolaPkr;
    }
    lastSync = Date.now();
    emit();
  } catch {
    // Offline / static hosting: keep serving the stamped seed snapshot.
  }
}

export function useMarketSnapshot(): MarketSnapshotState {
  const [, setTick] = useState(0);

  useEffect(() => {
    // First client mount: heal + load any user-customized rates, then sync.
    cache = loadCustomMarketRates();
    emit();
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    if (!started) {
      started = true;
      pull();
      setInterval(pull, REFRESH_MS);
    }
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return {
    rates: cache,
    silverPerTolaPkr: silverCache,
    updatedAt: lastSync || null,
    refresh: pull,
  };
}
