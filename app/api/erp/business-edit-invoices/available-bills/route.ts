import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireBeiSession, beiErrorResponse } from "@/lib/business-edit-invoice/route-helpers";
import { listAvailableBills } from "@/lib/business-edit-invoice/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireBeiSession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const rows = await listAvailableBills(auth.session, {
      module: p.get("module") ?? undefined,
      q: p.get("q") ?? undefined,
      countryId: p.get("countryId") ?? undefined,
      branchId: p.get("branchId") ?? undefined,
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return beiErrorResponse(error, { rows: [] });
  }
}
