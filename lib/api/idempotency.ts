/**
 * Idempotency protection for accounting-sensitive POST endpoints
 * (payments, transfers, final posting, roznamcha, journal, ledger).
 *
 * Prevents duplicate accounting records when Save / Post / Transfer / Payment
 * is clicked multiple times, or when a request is retried. Uses a
 * self-provisioning `erp_idempotency_keys` table so it works in production
 * without a manual migration (the same table is also declared as a Drizzle
 * migration for a clean schema).
 *
 * Pattern (claim-first):
 *   const key = naturalKey([...stableRequestParts]);            // or the Idempotency-Key header
 *   const claim = await claimIdempotency(key, "purchase_payment", userId);
 *   if (claim.state === "duplicate") return respondDuplicate(claim);
 *   try { ...post inside a DB transaction...; await completeIdempotency(key, result); }
 *   catch (e) { await releaseIdempotency(key); throw e; }
 */
import crypto from "node:crypto";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

let ensured = false;

export async function ensureIdempotencyTable(): Promise<boolean> {
  if (ensured) return true;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS erp_idempotency_keys (
        idempotency_key text PRIMARY KEY,
        endpoint text NOT NULL,
        user_id uuid,
        status text NOT NULL DEFAULT 'processing',
        response jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      )
    `);
    ensured = true;
    return true;
  } catch (e) {
    console.error("[idempotency] ensure table failed:", e);
    return false;
  }
}

/** Build a stable natural key from request parts (order id, kind, amount, etc.). */
export function naturalKey(parts: Array<string | number | null | undefined>): string {
  return crypto.createHash("sha256").update(parts.map((p) => String(p ?? "")).join("|")).digest("hex");
}

/** Read an explicit Idempotency-Key header if the client sent one. */
export function headerKey(request: Request): string | null {
  const v = request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key");
  return v && v.trim() ? v.trim() : null;
}

export type IdempotencyClaim =
  | { state: "claimed" }
  | { state: "duplicate"; status: string; response: unknown }
  | { state: "unavailable" };

/**
 * Atomically claim a key. If it already exists, the request is a duplicate.
 * Uses INSERT ... ON CONFLICT DO NOTHING so exactly one caller wins the race.
 */
export async function claimIdempotency(key: string, endpoint: string, userId: string | null): Promise<IdempotencyClaim> {
  if (!(await ensureIdempotencyTable())) return { state: "unavailable" };
  try {
    const inserted: any = await db.execute(sql`
      INSERT INTO erp_idempotency_keys (idempotency_key, endpoint, user_id, status)
      VALUES (${key}, ${endpoint}, ${userId ?? null}, 'processing')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key
    `);
    const insArr = Array.isArray(inserted) ? inserted : inserted?.rows || [];
    if (insArr.length > 0) return { state: "claimed" };

    const existing: any = await db.execute(sql`
      SELECT status, response FROM erp_idempotency_keys WHERE idempotency_key = ${key}
    `);
    const exArr = Array.isArray(existing) ? existing : existing?.rows || [];
    const row = exArr[0] ?? { status: "processing", response: null };
    return { state: "duplicate", status: String(row.status ?? "processing"), response: row.response ?? null };
  } catch (e) {
    console.error("[idempotency] claim failed:", e);
    return { state: "unavailable" };
  }
}

/** Mark a claimed key as completed and cache its response for safe replay. */
export async function completeIdempotency(key: string, response: unknown): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE erp_idempotency_keys
      SET status = 'completed', response = ${response ? JSON.stringify(response) : null}::jsonb, completed_at = now()
      WHERE idempotency_key = ${key}
    `);
  } catch (e) {
    console.error("[idempotency] complete failed:", e);
  }
}

/** Release a claim after a failed attempt so a genuine retry can proceed. */
export async function releaseIdempotency(key: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM erp_idempotency_keys WHERE idempotency_key = ${key} AND status = 'processing'`);
  } catch (e) {
    console.error("[idempotency] release failed:", e);
  }
}
