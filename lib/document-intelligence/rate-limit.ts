/**
 * Lightweight in-process sliding-window rate limiter for the Document Intake
 * endpoints (spec §19). Not a distributed limiter — it caps abuse from a single
 * server process, which is all a self-hosted single-node deployment needs. A
 * Redis-backed limiter can replace `hit()` later without touching callers.
 */

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

const DEFAULTS = {
  upload: { limit: Number(process.env.DOC_INTAKE_RL_UPLOAD || 30), windowMs: 60_000 },
  process: { limit: Number(process.env.DOC_INTAKE_RL_PROCESS || 60), windowMs: 60_000 },
} as const;

export type RateLimitKind = keyof typeof DEFAULTS;

export function checkRateLimit(kind: RateLimitKind, subject: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const cfg = DEFAULTS[kind];
  const key = `${kind}:${subject}`;
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + cfg.windowMs });
    return { ok: true };
  }
  if (w.count >= cfg.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }
  w.count += 1;
  return { ok: true };
}

// opportunistic cleanup so the map cannot grow unbounded
let lastSweep = 0;
export function sweepRateLimiter(now = Date.now()) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
}

export class RateLimitError extends Error {
  status = 429;
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(`Too many requests — retry in ${retryAfterSec}s.`);
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}
