'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PredictionResult, PredictionType } from '@/lib/aiPredictions';

/**
 * AiAssistProvider — global AI Assist state (NOTES #27).
 * The toggle is persisted per browser; availability comes from the
 * server (GET /api/ai/predict reports whether a Groq key is configured).
 * When the toggle is off or AI is unconfigured, every AI control hides
 * and the app behaves exactly as it did before AI Assist existed.
 */

interface AiAssistContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  available: boolean;
  aiOn: boolean;
  predict: (
    type: PredictionType,
    context: Record<string, unknown>
  ) => Promise<(PredictionResult & { model?: string }) | null>;
}

const AiAssistContext = createContext<AiAssistContextValue | null>(null);

const STORAGE_KEY = 'rizqflow-ai-assist';

export function AiAssistProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'off') setEnabledState(false);
    } catch {
      /* storage unavailable — default stays on */
    }
    fetch('/api/ai/predict')
      .then((r) => r.json())
      .then((d) => setAvailable(!!d?.available))
      .catch(() => setAvailable(false));
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off');
    } catch {
      /* non-fatal */
    }
  }, []);

  const predict = useCallback(
    async (type: PredictionType, context: Record<string, unknown>) => {
      try {
        const res = await fetch('/api/ai/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, context }),
        });
        if (!res.ok) return null;
        return (await res.json()) as PredictionResult & { model?: string };
      } catch {
        return null;
      }
    },
    []
  );

  return (
    <AiAssistContext.Provider
      value={{ enabled, setEnabled, available, aiOn: enabled && available, predict }}
    >
      {children}
    </AiAssistContext.Provider>
  );
}

export function useAiAssist(): AiAssistContextValue {
  const ctx = useContext(AiAssistContext);
  if (!ctx) throw new Error('useAiAssist must be used within AiAssistProvider');
  return ctx;
}
