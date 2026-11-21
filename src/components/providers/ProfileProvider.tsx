'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { PRESET_PROFILES } from '@/data/marketData';
import { 
  loadProfileFromStorage, 
  saveProfileToStorage, 
  encodeProfileToHash, 
  decodeProfileFromHash 
} from '@/lib/stateUrl';
import { formatPkr, formatCompactPkr, maskAmount, FormatPkrOptions } from '@/lib/format';

interface ProfileContextType {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateProfile: (updated: Partial<UserProfile>) => void;
  resetToPreset: (presetId: string) => void;
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  sharePlan: () => Promise<string>;
  formatPkrMasked: (n: number, options?: FormatPkrOptions) => string;
  formatCompactPkrMasked: (n: number) => string;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const defaultProfile = (PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile;

  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [hideAmounts, setHideAmounts] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Show temporary toast message
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Hydrate from localStorage or URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check privacy setting from storage
    const savedPrivacy = window.localStorage.getItem('rizqflow_hide_amounts');
    if (savedPrivacy === 'true') {
      setHideAmounts(true);
    }

    // Check theme setting
    const savedTheme = window.localStorage.getItem('rizqflow_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }

    // Check URL Hash first, then localStorage
    const hash = window.location.hash;
    const decodedFromHash = decodeProfileFromHash(hash, defaultProfile);
    if (decodedFromHash) {
      setProfileState(decodedFromHash);
      showToast('Loaded shared plan from URL!');
    } else {
      const stored = loadProfileFromStorage(defaultProfile);
      setProfileState(stored);
    }

    setHasLoaded(true);
  }, [defaultProfile, showToast]);

  // Persist profile to localStorage whenever it changes after initial load
  useEffect(() => {
    if (hasLoaded) {
      saveProfileToStorage(profile);
    }
  }, [profile, hasLoaded]);

  // Update profile partially
  const updateProfile = useCallback((updated: Partial<UserProfile>) => {
    setProfileState((prev) => ({
      ...prev,
      ...updated,
    }));
  }, []);

  // Reset to preset
  const resetToPreset = useCallback(
    (presetId: string) => {
      let found: any = null;
      if (presetId === 'junior-engineer' || presetId === 'junior-swe') {
        found = PRESET_PROFILES['junior-engineer'] || PRESET_PROFILES[0];
      } else if (presetId === 'lump-sum-30lac') {
        found = PRESET_PROFILES['lump-sum-30lac'] || PRESET_PROFILES[1];
      } else if (presetId === 'solar-commuter' || presetId === 'solar-ev-swap') {
        found = PRESET_PROFILES['solar-commuter'] || PRESET_PROFILES[2];
      } else {
        found = (PRESET_PROFILES as any)[presetId] || PRESET_PROFILES[0];
      }

      if (found) {
        const nextProfile = (found.profile || found) as UserProfile;
        setProfileState(nextProfile);
        saveProfileToStorage(nextProfile);
        showToast(`Reset to preset: ${found.name || presetId}`);
      }
    },
    [showToast]
  );

  // Toggle Hide Amounts
  const toggleHideAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rizqflow_hide_amounts', String(next));
      }
      return next;
    });
  }, []);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rizqflow_theme', next);
        if (next === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      }
      return next;
    });
  }, []);

  // Share plan URL
  const sharePlan = useCallback(async (): Promise<string> => {
    const hash = encodeProfileToHash(profile);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/planner';
    const fullUrl = `${origin}${pathname}${hash}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('Plan link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
    return fullUrl;
  }, [profile, showToast]);

  // Masked formatting helpers
  const formatPkrMasked = useCallback(
    (n: number, options?: FormatPkrOptions) => {
      const formatted = formatPkr(n, options);
      return maskAmount(formatted, hideAmounts);
    },
    [hideAmounts]
  );

  const formatCompactPkrMasked = useCallback(
    (n: number) => {
      const formatted = formatCompactPkr(n);
      return maskAmount(formatted, hideAmounts);
    },
    [hideAmounts]
  );

  return (
    <ProfileContext.Provider
      value={{
        profile,
        setProfile: setProfileState,
        updateProfile,
        resetToPreset,
        hideAmounts,
        toggleHideAmounts,
        theme,
        toggleTheme,
        toast,
        showToast,
        sharePlan,
        formatPkrMasked,
        formatCompactPkrMasked,
      }}
    >
      {children}

      {/* Floating Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-2xl shadow-emerald-500/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-black animate-ping" />
          <span>{toast}</span>
        </div>
      )}
    </ProfileContext.Provider>
  );
}
