import { describe, expect, it, beforeEach } from 'vitest';
import { 
  getRegisteredUsers, 
  signIn, 
  signUp, 
  signOut, 
  createPortfolioForUser, 
  switchUserPortfolio, 
  saveProfileToActivePortfolio,
  getActiveSession 
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

describe('Authentication & Multi-Portfolio Management (src/lib/auth.ts)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('seeds default account for Saim Asif (saaim62@gmail.com) on initial launch', () => {
    const users = getRegisteredUsers();
    expect(users.length).toBe(1);
    expect(users[0].name).toBe('Saim Asif');
    expect(users[0].email).toBe('saaim62@gmail.com');
    expect(users[0].portfolios.length).toBeGreaterThanOrEqual(1);
  });

  it('signs in Saim Asif with valid credentials and sets active session', () => {
    const res = signIn('saaim62@gmail.com', 'password123');
    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.email).toBe('saaim62@gmail.com');

    const session = getActiveSession();
    expect(session).toBeDefined();
    expect(session?.email).toBe('saaim62@gmail.com');
  });

  it('rejects invalid password or non-existent email cleanly', () => {
    const badPass = signIn('saaim62@gmail.com', 'wrongpassword');
    expect(badPass.success).toBe(false);
    expect(badPass.error).toContain('Incorrect password');

    const badEmail = signIn('unknown@example.com', 'password123');
    expect(badEmail.success).toBe(false);
    expect(badEmail.error).toContain('Account not found');
  });

  it('allows new user sign up and creates initial portfolio', () => {
    const res = signUp('Ali Khan', 'ali@example.com', 'mypassword', undefined, "Ali's Halal Fund");
    expect(res.success).toBe(true);
    expect(res.user?.name).toBe('Ali Khan');
    expect(res.user?.portfolios[0].name).toBe("Ali's Halal Fund");

    // Rejects duplicate email
    const duplicate = signUp('Ali Duplicate', 'ali@example.com', 'mypassword');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already exists');
  });

  it('creates and switches multiple portfolios under the same user account', () => {
    const userRes = signIn('saaim62@gmail.com', 'password123');
    const user = userRes.user!;
    const baseProfile = user.portfolios[0].profile;

    // Create a 2nd portfolio
    const createRes = createPortfolioForUser(user.id, 'Children Education Fund', {
      ...baseProfile,
      monthlyInvestPkr: 50000,
    });
    expect(createRes.success).toBe(true);
    expect(createRes.portfolio?.name).toBe('Children Education Fund');

    // Switch to new portfolio
    const switchedProfile = switchUserPortfolio(user.id, createRes.portfolio!.id);
    expect(switchedProfile).toBeDefined();
    expect(switchedProfile?.monthlyInvestPkr).toBe(50000);

    const session = getActiveSession();
    expect(session?.activePortfolioId).toBe(createRes.portfolio!.id);
  });

  it('signs out and clears active session', () => {
    signIn('saaim62@gmail.com', 'password123');
    expect(getActiveSession()).not.toBeNull();

    signOut();
    expect(getActiveSession()).toBeNull();
  });
});
