import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

/**
 * Server-side credential helpers (Node crypto only — no dependencies).
 * Passwords: scrypt with a per-user random salt, stored as
 *   scrypt$<saltHex>$<hashHex>
 * Session tokens: 32 random bytes shown to the client once; only the
 * SHA-256 of the token is stored in the database.
 */

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}
