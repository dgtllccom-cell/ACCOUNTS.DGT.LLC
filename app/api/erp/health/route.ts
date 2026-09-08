import { NextRequest } from "next/server";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { buildHealthReport } from "@/lib/health/report";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/erp/health           → static-only scan (fast; navigation, languages, print, build)
 * GET /api/erp/health?live=1     → full scan incl. live route / API / RBAC probes
 *
 * Super Admin only. READ-ONLY — no scan step writes any business record.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return apiError("FORBIDDEN", "The ERP Health & Integrity Center is Super Admin only.", 403);
    }

    const live = ["1", "true", "yes"].includes((request.nextUrl.searchParams.get("live") || "").toLowerCase());

    // Base URL for the live probes = this same server.
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = host ? `${proto}://${host}` : request.nextUrl.origin;
    const cookie = request.headers.get("cookie") || "";

    const report = await buildHealthReport({
      session,
      baseUrl: live ? baseUrl : null,
      cookie: live ? cookie : null,
      live,
    });

    return apiOk({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
