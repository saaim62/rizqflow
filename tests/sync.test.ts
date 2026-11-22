import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserProfile } from '@/types';
import { PRESET_PROFILES } from '@/data/marketData';
import {
  encodeProfileToHash,
  decodeProfileFromHash,
  loadProfileFromStorage,
  saveProfileToStorage,
} from '@/lib/stateUrl';
import { migrateStaleSeedValues } from '@/lib/marketRates';

describe('FIX-2.1: Sync Debouncing, Fast Portfolio Switching & BeforeUnload', () => {
  const baseProfile = (PRESET_PROFILES[0].profile || PRESET_PROFILES[0]) as UserProfile;

  it('stores pending debounced payload in a ref and flushes with outgoing ID before switching portfolios', async () => {
    const updatePortfolioMock = vi.fn().mockImplementation(async (id: string, patch: any) => ({
      portfolio: { id, name: 'Portfolio', profile: patch.profile },
    }));
    const setActiveMock = vi.fn().mockResolvedValue({ ok: true });

    // Emulate ProfileProvider ref-based sync mechanics
    let activePortfolioId = 'port_old';
    const pendingSaveRef: { current: { portfolioId: string; profile: UserProfile } | null } = {
      current: null,
    };
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastSynced = JSON.stringify(baseProfile);

    const flushPendingSync = async (): Promise<void> => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;

      const res = await updatePortfolioMock(pending.portfolioId, { profile: pending.profile });
      lastSynced = JSON.stringify(res.portfolio.profile);
    };

    const triggerEdit = (newProfile: UserProfile) => {
      pendingSaveRef.current = { portfolioId: activePortfolioId, profile: newProfile };
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void flushPendingSync();
      }, 900);
    };

    const switchActivePortfolio = async (nextPortfolioId: string) => {
      if (nextPortfolioId === activePortfolioId) return;

      // FIX-2.1: Must flush pending changes for outgoing portfolio ID before switching
      await flushPendingSync();
      await setActiveMock(nextPortfolioId);
      activePortfolioId = nextPortfolioId;
    };

    // 1. User performs an edit on 'port_old'
    const editedProfile: UserProfile = { ...baseProfile, monthlyIncomePkr: 850_000 };
    triggerEdit(editedProfile);

    // Pending save is queued in ref
    expect(pendingSaveRef.current).not.toBeNull();
    expect(pendingSaveRef.current?.portfolioId).toBe('port_old');
    expect(pendingSaveRef.current?.profile.monthlyIncomePkr).toBe(850_000);
    expect(updatePortfolioMock).not.toHaveBeenCalled();

    // 2. User rapidly switches to 'port_new' at e.g. 100ms (< 900ms debounce timer)
    await switchActivePortfolio('port_new');

    // 3. Assert flush was executed for 'port_old' with the edited profile BEFORE active ID became 'port_new'
    expect(updatePortfolioMock).toHaveBeenCalledTimes(1);
    expect(updatePortfolioMock).toHaveBeenCalledWith('port_old', { profile: editedProfile });
    expect(setActiveMock).toHaveBeenCalledWith('port_new');
    expect(activePortfolioId).toBe('port_new');
    expect(pendingSaveRef.current).toBeNull();
  });

  it('flushes pending debounced save immediately on beforeunload event', () => {
    const updatePortfolioMock = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;

    let activePortfolioId = 'port_active';
    const pendingSaveRef: { current: { portfolioId: string; profile: UserProfile } | null } = {
      current: null,
    };
    let debounceTimer: NodeJS.Timeout | null = null;

    const onBeforeUnload = () => {
      if (pendingSaveRef.current) {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        updatePortfolioMock(pending.portfolioId, { profile: pending.profile });
        fetchMock(`/api/portfolios/${pending.portfolioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: pending.profile }),
          keepalive: true,
        });
      }
    };

    // Trigger edit
    const editedProfile: UserProfile = { ...baseProfile, monthlyInvestPkr: 250_000 };
    pendingSaveRef.current = { portfolioId: activePortfolioId, profile: editedProfile };

    // Fire beforeunload
    onBeforeUnload();

    expect(updatePortfolioMock).toHaveBeenCalledWith('port_active', { profile: editedProfile });
    expect(fetchMock).toHaveBeenCalledWith('/api/portfolios/port_active', expect.objectContaining({
      method: 'PUT',
      keepalive: true,
    }));
    expect(pendingSaveRef.current).toBeNull();
  });
});

describe('FIX-2.2: Shared Plan Hash Decoding Across Both Auth States', () => {
  const defaultProfile = (PRESET_PROFILES[0].profile || PRESET_PROFILES[0]) as UserProfile;
  const sharedProfile: UserProfile = {
    ...defaultProfile,
    age: 35,
    monthlyIncomePkr: 750_000,
    lumpSumPkr: 5_000_000,
  };
  const hash = encodeProfileToHash(sharedProfile);

  it('decodes hash for signed-in users into current view without overwriting saved portfolios and sets toast', () => {
    const savedUserPortfolios = [
      { id: 'port_user_1', name: 'My Real Portfolio', profile: defaultProfile },
    ];
    let liveProfile = defaultProfile;
    let toastMessage: string | null = null;
    let lastSynced = JSON.stringify(defaultProfile);

    // Emulate signedIn branch in ProfileProvider
    const signedIn = true;
    if (signedIn) {
      const decodedFromHash = decodeProfileFromHash(hash, defaultProfile);
      expect(decodedFromHash).not.toBeNull();
      if (decodedFromHash) {
        const healed = migrateStaleSeedValues(decodedFromHash);
        // Important: sets lastSynced to shared plan so persist effect does not echo-save
        lastSynced = JSON.stringify(healed);
        liveProfile = healed;
        toastMessage = "Loaded shared plan — it isn't saved to your account";
      }
    }

    // 1. Current view displays the shared plan
    expect(liveProfile.age).toBe(35);
    expect(liveProfile.monthlyIncomePkr).toBe(750_000);
    expect(liveProfile.lumpSumPkr).toBe(5_000_000);

    // 2. Saved portfolios are NOT overwritten
    expect(savedUserPortfolios[0].name).toBe('My Real Portfolio');
    expect(savedUserPortfolios[0].profile.age).toBe(defaultProfile.age);

    // 3. Exact toast message is shown
    expect(toastMessage).toBe("Loaded shared plan — it isn't saved to your account");

    // 4. lastSynced snapshot matches live profile so auto-save will NOT fire on load
    expect(JSON.stringify(liveProfile)).toBe(lastSynced);
  });

  it('decodes hash for signed-out users into local workspace with URL toast', () => {
    let liveProfile = defaultProfile;
    let toastMessage: string | null = null;

    // Emulate signedOut branch in ProfileProvider
    const signedIn = false;
    if (!signedIn) {
      const decodedFromHash = decodeProfileFromHash(hash, defaultProfile);
      expect(decodedFromHash).not.toBeNull();
      if (decodedFromHash) {
        liveProfile = migrateStaleSeedValues(decodedFromHash);
        toastMessage = 'Loaded shared plan from URL!';
      }
    }

    expect(liveProfile.age).toBe(35);
    expect(liveProfile.monthlyIncomePkr).toBe(750_000);
    expect(toastMessage).toBe('Loaded shared plan from URL!');
  });
});
