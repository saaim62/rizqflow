import { describe, expect, it, beforeEach } from 'vitest';
import {
  getRegisteredUsers,
  signIn,
  signUp,
  signOut,
  createPortfolioForUser,
  switchUserPortfolio,
  saveProfileToActivePortfolio,
  getActiveSession,
} from '@/lib/auth';
import { PRESET_PROFILES } from '@/data/marketData';
import { UserProfile } from '@/types';

// Mock localStorage for node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

const baseProfile = (PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile;

describe('Authentication & Multi-Portfolio Management (src/lib/auth.ts)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('starts with ZERO registered users — no seeded accounts, no hardcoded credentials', () => {
    const users = getRegisteredUsers();
    expect(users).toEqual([]);
    // Signing in with any credential must fail before anyone signs up.
    const res = signIn('anyone@example.com', 'password123');
    expect(res.success).toBe(false);
  });

  it('signs up a new user with a salted v2 password hash and a default portfolio', () => {
    const res = signUp('Ayesha Khan', 'ayesha@example.com', 'my-secret-pw', baseProfile, "Ayesha's Main Portfolio");
    expect(res.success).toBe(true);
    expect(res.user?.email).toBe('ayesha@example.com');
    expect(res.user?.portfolios.length).toBe(1);
    expect(res.user?.portfolios[0].name).toBe("Ayesha's Main Portfolio");

    // Password is never stored in plain text and uses the salted v2 format.
    expect(res.user?.passwordHash).not.toContain('my-secret-pw');
    expect(res.user?.passwordHash.startsWith('rf2$')).toBe(true);

    // A session is active immediately after sign-up.
    const session = getActiveSession();
    expect(session?.email).toBe('ayesha@example.com');
    expect(session?.activePortfolioId).toBe(res.user?.activePortfolioId);
  });

  it('rejects a duplicate email on sign-up', () => {
    signUp('First User', 'dup@example.com', 'pw-one-123');
    const res = signUp('Second User', 'DUP@example.com', 'pw-two-123');
    expect(res.success).toBe(false);
    expect(getRegisteredUsers().length).toBe(1);
  });

  it('signs in with the correct password and rejects wrong password / unknown email', () => {
    signUp('Bilal Ahmed', 'bilal@example.com', 'correct-horse');
    signOut();

    const ok = signIn('bilal@example.com', 'correct-horse');
    expect(ok.success).toBe(true);
    expect(ok.user?.email).toBe('bilal@example.com');
    expect(getActiveSession()?.email).toBe('bilal@example.com');

    signOut();
    const badPass = signIn('bilal@example.com', 'wrongpassword');
    expect(badPass.success).toBe(false);
    expect(badPass.error).toContain('Incorrect password');

    const badEmail = signIn('unknown@example.com', 'correct-horse');
    expect(badEmail.success).toBe(false);
    expect(badEmail.error).toContain('Account not found');
  });

  it("keeps each user's portfolios fully isolated from other users", () => {
    const a = signUp('User A', 'a@example.com', 'pw-a-12345', baseProfile, 'A Portfolio');
    const b = signUp('User B', 'b@example.com', 'pw-b-12345', baseProfile, 'B Portfolio');
    expect(a.success && b.success).toBe(true);

    createPortfolioForUser(a.user!.id, 'A Second Portfolio', baseProfile);

    const users = getRegisteredUsers();
    const storedA = users.find((u) => u.email === 'a@example.com');
    const storedB = users.find((u) => u.email === 'b@example.com');
    expect(storedA?.portfolios.length).toBe(2);
    expect(storedB?.portfolios.length).toBe(1);
    expect(storedB?.portfolios[0].name).toBe('B Portfolio');
    // No portfolio id leaks across accounts.
    const aIds = new Set(storedA?.portfolios.map((p) => p.id));
    expect(storedB?.portfolios.every((p) => !aIds.has(p.id))).toBe(true);
  });

  it('creates and switches multiple portfolios under the same user account', () => {
    const res = signUp('Switch Tester', 'switch@example.com', 'pw-switch-1', baseProfile, 'First Portfolio');
    const user = res.user!;

    const createRes = createPortfolioForUser(user.id, 'Children Education Fund', {
      ...baseProfile,
      monthlyInvestPkr: 50000,
    });
    expect(createRes.success).toBe(true);
    expect(createRes.portfolio?.name).toBe('Children Education Fund');

    const switchedProfile = switchUserPortfolio(user.id, createRes.portfolio!.id);
    expect(switchedProfile).toBeDefined();
    expect(switchedProfile?.monthlyInvestPkr).toBe(50000);

    const session = getActiveSession();
    expect(session?.activePortfolioId).toBe(createRes.portfolio!.id);
  });

  it('saves profile updates into the active portfolio only', () => {
    const res = signUp('Saver', 'saver@example.com', 'pw-saver-1', baseProfile, 'Saver Portfolio');
    const user = res.user!;
    const updated: UserProfile = { ...baseProfile, monthlyIncomePkr: 999000 };
    saveProfileToActivePortfolio(user.id, user.activePortfolioId, updated);

    const stored = getRegisteredUsers().find((u) => u.id === user.id);
    expect(stored?.portfolios[0].profile.monthlyIncomePkr).toBe(999000);
  });

  it('signs out and clears active session', () => {
    signUp('Leaver', 'leaver@example.com', 'pw-leaver-1');
    expect(getActiveSession()).not.toBeNull();

    signOut();
    expect(getActiveSession()).toBeNull();
  });
});
