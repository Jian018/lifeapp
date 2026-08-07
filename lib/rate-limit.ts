type Attempt = { failures: number; lockUntil: number; lastSeen: number };
const attempts = new Map<string, Attempt>();
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;

export function getPinAttemptState(key: string, now = Date.now()) {
  const state = attempts.get(key);
  if (!state) return { locked: false, retryAfterSeconds: 0, failures: 0 };
  if (state.lockUntil > now) return { locked: true, retryAfterSeconds: Math.ceil((state.lockUntil - now) / 1000), failures: state.failures };
  if (now - state.lastSeen > LOCK_MS) attempts.delete(key);
  return { locked: false, retryAfterSeconds: 0, failures: state.failures };
}

export function recordPinFailure(key: string, now = Date.now()) {
  const current = attempts.get(key);
  const failures = (current && now - current.lastSeen <= LOCK_MS ? current.failures : 0) + 1;
  const lockUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
  attempts.set(key, { failures, lockUntil, lastSeen: now });
  return getPinAttemptState(key, now);
}

export function clearPinFailures(key: string) { attempts.delete(key); }
export function resetRateLimitsForTests() { attempts.clear(); }
