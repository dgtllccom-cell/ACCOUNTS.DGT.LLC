import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/api/response";
import { DgtAccessError } from "./service";

export async function requireDgtSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) {
    return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  }
  return { session };
}

/**
 * True when the error is Postgres "relation does not exist" (42P01) — i.e. the
 * DGT Connect migration (20261012) has not been applied to this database yet.
 * The feature is simply "not set up" — callers return a clean empty payload so
 * one lagging migration never bleeds a raw SQL string onto the dashboard. The
 * fix is running the migration; this only keeps the rest of the UI healthy.
 */
export function isDgtSchemaMissing(error: unknown): boolean {
  const e = error as any;
  const code = e?.code || e?.cause?.code;
  const msg = String(e?.message || e || "");
  return code === "42P01" || /relation "?public\.?dgt_\w+"? does not exist/i.test(msg);
}

export function dgtErrorResponse(error: unknown, emptyPayload?: unknown): Response {
  if (error instanceof DgtAccessError) {
    return apiError("FORBIDDEN", error.message, 403);
  }
  if (isDgtSchemaMissing(error)) {
    console.warn("[DGT Connect] schema missing — migration 20261012_dgt_connect is not applied on this database");
    return apiOk({ ...(emptyPayload as any), setupPending: true });
  }
  // Never surface a raw DB/driver string to the client.
  console.error("[DGT Connect]", error instanceof Error ? error.stack || error.message : error);
  return apiError("DGT_CONNECT_ERROR", "DGT Connect is temporarily unavailable.", 503);
}
