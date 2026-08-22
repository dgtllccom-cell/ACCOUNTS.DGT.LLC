import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/response";

export interface IdempotencyOptions {
  req: NextRequest;
  scopeModule: string;
  userId?: string | null;
  countryId?: string | null;
  cityBranchId?: string | null;
  businessReference?: string | null;
  payload?: any;
}

export interface LockAcquisitionResult {
  acquired: boolean;
  isReplayed: boolean;
  idempotencyKey: string;
  tenantHash: string;
  responseCode?: number;
  responseBody?: any;
}

/**
 * Extracts Idempotency-Key header from incoming HTTP request.
 */
export function getIdempotencyKey(req: NextRequest): string | null {
  const headerKey = req.headers.get("x-idempotency-key") || req.headers.get("idempotency-key");
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }
  return null;
}

/**
 * Creates a sha256 hash of payload body to detect payload tampering or exact payload matching.
 */
export function hashPayload(payload: any): string {
  if (!payload) return "EMPTY_PAYLOAD";
  try {
    const jsonStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHash("sha256").update(jsonStr).digest("hex");
  } catch {
    return "INVALID_PAYLOAD_HASH";
  }
}

/**
 * Generates composite multi-tenant hash isolating Keys per User, Country, Branch, Module, and Business Reference.
 */
export function generateTenantHash(params: {
  userId?: string | null;
  countryId?: string | null;
  cityBranchId?: string | null;
  scopeModule: string;
  businessReference?: string | null;
}): string {
  const rawKey = [
    params.userId || "anon",
    params.countryId || "no_country",
    params.cityBranchId || "no_branch",
    params.scopeModule.toUpperCase(),
    params.businessReference || "no_ref"
  ].join("::");

  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Attempts to acquire an atomic idempotency lock in Supabase DB.
 * Returns lock status or replayed response body if already completed.
 */
export async function acquireIdempotencyLock(options: IdempotencyOptions): Promise<LockAcquisitionResult> {
  const key = getIdempotencyKey(options.req);
  if (!key) {
    return { acquired: true, isReplayed: false, idempotencyKey: "", tenantHash: "" };
  }

  const tenantHash = generateTenantHash({
    userId: options.userId,
    countryId: options.countryId,
    cityBranchId: options.cityBranchId,
    scopeModule: options.scopeModule,
    businessReference: options.businessReference
  });

  const requestHash = hashPayload(options.payload);
  const admin = createSupabaseAdminClient();

  try {
    // Attempt RPC lock acquisition first
    const { data: rpcData, error: rpcError } = await (admin as any).rpc("acquire_idempotency_lock", {
      p_idempotency_key: key,
      p_tenant_hash: tenantHash,
      p_scope_module: options.scopeModule,
      p_user_id: options.userId || null,
      p_country_id: options.countryId || null,
      p_city_branch_id: options.cityBranchId || null,
      p_business_reference: options.businessReference || null,
      p_request_hash: requestHash,
      p_lock_seconds: 90
    });

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const lockRes = rpcData[0] as any;
      if (lockRes.is_replayed) {
        return {
          acquired: false,
          isReplayed: true,
          idempotencyKey: key,
          tenantHash,
          responseCode: lockRes.response_code || 200,
          responseBody: lockRes.response_body || { ok: true, isReplayed: true }
        };
      }
      if (lockRes.acquired) {
        return { acquired: true, isReplayed: false, idempotencyKey: key, tenantHash };
      }
      return { acquired: false, isReplayed: false, idempotencyKey: key, tenantHash };
    }

    // Fallback: Direct DB query if RPC is not yet applied.
    //
    // This MUST be a plain INSERT relying on the (tenant_hash, idempotency_key) unique index to
    // atomically reject a concurrent duplicate — not a SELECT-then-upsert. Two requests carrying
    // the same idempotency key can arrive genuinely concurrently (a double-click, or a client
    // retry racing the original), and a SELECT-then-upsert has a window between the two where
    // both callers see "no existing lock" and both proceed to acquire=true, defeating the whole
    // point of idempotency (verified: this exact race let two identical sales-payment POSTs both
    // post as separate accounting entries in testing). unique_violation (23505) on the insert is
    // the atomic signal that someone else already holds — or held — the lock.
    const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();
    const { error: insertError } = await (admin as any).from("idempotency_keys").insert({
      idempotency_key: key,
      tenant_hash: tenantHash,
      scope_module: options.scopeModule,
      user_id: options.userId || null,
      country_id: options.countryId || null,
      city_branch_id: options.cityBranchId || null,
      business_reference: options.businessReference || null,
      request_hash: requestHash,
      status: "PROCESSING",
      locked_at: new Date().toISOString(),
      expires_at: expiresAt
    });

    if (!insertError) {
      return { acquired: true, isReplayed: false, idempotencyKey: key, tenantHash };
    }

    if (insertError.code !== "23505") {
      // Unexpected DB error (not a conflict) — fail open rather than block business operations.
      console.error("[Idempotency] Unexpected insert error:", insertError);
      return { acquired: true, isReplayed: false, idempotencyKey: key, tenantHash };
    }

    // Someone else holds (or held) this key. Inspect it.
    const { data: existing } = await (admin as any)
      .from("idempotency_keys")
      .select("*")
      .eq("tenant_hash", tenantHash)
      .eq("idempotency_key", key)
      .maybeSingle();

    if (existing?.status === "COMPLETED") {
      return {
        acquired: false,
        isReplayed: true,
        idempotencyKey: key,
        tenantHash,
        responseCode: existing.response_code || 200,
        responseBody: existing.response_body || { ok: true, isReplayed: true }
      };
    }

    const isLockExpired = existing ? new Date(existing.expires_at).getTime() < Date.now() : false;
    if (!isLockExpired) {
      // Still genuinely in flight — the caller must not proceed.
      return { acquired: false, isReplayed: false, idempotencyKey: key, tenantHash };
    }

    // The prior lock expired (crashed/timed-out request) — atomically steal it. The WHERE clause
    // keeps this conditional-update race-safe too: only one concurrent stealer can match a row
    // still in the expired PROCESSING state.
    const { data: stolen } = await (admin as any)
      .from("idempotency_keys")
      .update({
        status: "PROCESSING",
        request_hash: requestHash,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt
      })
      .eq("tenant_hash", tenantHash)
      .eq("idempotency_key", key)
      .eq("status", "PROCESSING")
      .lt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();

    if (stolen) {
      return { acquired: true, isReplayed: false, idempotencyKey: key, tenantHash };
    }

    // Another caller stole it first, or it completed in the interim — do not proceed.
    return { acquired: false, isReplayed: false, idempotencyKey: key, tenantHash };
  } catch (err) {
    console.error("[Idempotency] Failed to acquire lock:", err);
    // On unexpected error, permit processing to avoid blocking business operations
    return { acquired: true, isReplayed: false, idempotencyKey: key, tenantHash };
  }
}

/**
 * Commits successful execution result to idempotency store for future replay.
 */
export async function commitIdempotencySuccess(
  idempotencyKey: string,
  tenantHash: string,
  responseCode: number,
  responseBody: any
): Promise<void> {
  if (!idempotencyKey || !tenantHash) return;
  try {
    const admin = createSupabaseAdminClient();
    const cleanBody = responseBody && typeof responseBody === "object"
      ? { ...responseBody, isReplayed: true }
      : { ok: true, data: responseBody, isReplayed: true };

    await (admin as any)
      .from("idempotency_keys")
      .update({
        status: "COMPLETED",
        response_code: responseCode,
        response_body: cleanBody,
        updated_at: new Date().toISOString()
      })
      .eq("tenant_hash", tenantHash)
      .eq("idempotency_key", idempotencyKey);
  } catch (err) {
    console.error("[Idempotency] Failed to commit success:", err);
  }
}

/**
 * Releases idempotency lock on execution failure or validation error.
 */
export async function releaseIdempotencyLock(idempotencyKey: string, tenantHash: string): Promise<void> {
  if (!idempotencyKey || !tenantHash) return;
  try {
    const admin = createSupabaseAdminClient();
    await (admin as any)
      .from("idempotency_keys")
      .delete()
      .eq("tenant_hash", tenantHash)
      .eq("idempotency_key", idempotencyKey);
  } catch (err) {
    console.error("[Idempotency] Failed to release lock:", err);
  }
}

/**
 * Builds standard replayed response with X-Idempotent-Replayed HTTP header.
 */
export function buildReplayedResponse(responseCode: number, responseBody: any): NextResponse {
  const res = NextResponse.json(responseBody, { status: responseCode });
  res.headers.set("X-Idempotent-Replayed", "true");
  return res;
}

/**
 * Higher-order helper for wrapping POST handler functions with full idempotency protection.
 */
export async function withIdempotency(
  options: IdempotencyOptions,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const lockRes = await acquireIdempotencyLock(options);

  if (lockRes.isReplayed) {
    return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
  }

  if (!lockRes.acquired) {
    return apiError(
      "IDEMPOTENCY_CONFLICT",
      "A request with this idempotency key is currently being processed or duplicate submission detected. Please wait.",
      409
    );
  }

  try {
    const response = await handler();
    if (lockRes.idempotencyKey && response.status >= 200 && response.status < 300) {
      try {
        const clonedRes = response.clone();
        const jsonBody = await clonedRes.json();
        await commitIdempotencySuccess(lockRes.idempotencyKey, lockRes.tenantHash, response.status, jsonBody);
      } catch {
        await commitIdempotencySuccess(lockRes.idempotencyKey, lockRes.tenantHash, response.status, { ok: true });
      }
    } else if (lockRes.idempotencyKey && response.status >= 400) {
      await releaseIdempotencyLock(lockRes.idempotencyKey, lockRes.tenantHash);
    }
    return response;
  } catch (error) {
    if (lockRes.idempotencyKey) {
      await releaseIdempotencyLock(lockRes.idempotencyKey, lockRes.tenantHash);
    }
    throw error;
  }
}
