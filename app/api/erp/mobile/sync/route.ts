import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getMobileAutoSyncPayload } from "@/lib/services/mobile-sync-service";

/**
 * GET /api/erp/mobile/sync
 *
 * Mobile Auto-Sync Endpoint. Called automatically after mobile sign in on iOS/Android.
 * Returns company profile, permissions, country/branch scope, contacts, and live messaging stats.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const payload = await getMobileAutoSyncPayload(session);

    return apiOk({
      appName: "AI Mobile – Return WhatsApp Reply",
      version: "1.0.0",
      ...payload
    });
  } catch (error) {
    return handleApiError(error);
  }
}
