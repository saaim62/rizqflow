/**
 * Minimal in-memory throttle for auth endpoints (per key, fixed window).
 * Good enough for a single-instance deployment; resets on restart.
 * Capped at 500 entries with FIFO eviction.
 */
const MAX_BUCKETS = 500;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowAttempt(key: string, limit = 12, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function _resetBucketsForTesting(): void {
  buckets.clear();
}

export function _getBucketsSizeForTesting(): number {
  return buckets.size;
}
