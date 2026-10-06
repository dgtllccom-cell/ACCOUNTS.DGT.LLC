/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession, ErpAuthError } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { resolveEntryDetail } from "@/lib/services/erp-entry-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Super Admin — full detail for a single "All Release Entries" row, for ANY ERP source type.
 * READ-ONLY, super-admin only, REAL data only. Dispatches to the reusable resolver by
 * ?module= + ?src= (the same values the feed emits). Sections with no backing data or no verified
 * relationship come back empty / "not linked" — never fabricated.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new ErpAuthError("Super Admin access is required for the ERP activity monitor.");

    const { id } = await context.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return apiOk({ found: false });

    const module = request.nextUrl.searchParams.get("module")?.trim() || "Roznamcha";
    const src = request.nextUrl.searchParams.get("src")?.trim() || "Roznamcha";

    const detail = await withLocalPg((sql) => resolveEntryDetail(sql, { id, module, src }));
    if (!detail) return apiOk({ found: false });
    return apiOk(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
