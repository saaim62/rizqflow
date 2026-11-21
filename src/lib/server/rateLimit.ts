/**
 * Minimal in-memory throttle for auth endpoints (per key, fixed window).
 * Good enough for a single-instance deployment; resets on restart.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowAttempt(key: string, limit = 12, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
