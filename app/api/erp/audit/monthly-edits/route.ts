import { NextRequest, NextResponse } from "next/server";
import { sessionSqlScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { getMonthlyEditSummary } from "@/lib/audit/enterprise-audit-service";
import { canAccessCountry, canAccessCityBranch } from "@/lib/permissions/middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");

    // Scope enforcement
    // One scope rule (sessionSqlScope): country roles → their country (all its branches);
    // branch users → their own branch (an explicit other branch is ignored).
    const sqlScope = sessionSqlScope(session);
    if (sqlScope.kind === "country") {
      if (!countryId || !sqlScope.ids.includes(countryId)) countryId = sqlScope.ids[0];
      if (cityBranchId && !session.cityBranchIds.includes(cityBranchId)) cityBranchId = null;
    } else if (sqlScope.kind === "cityBranch" || sqlScope.kind === "countryBranch" || sqlScope.kind === "none") {
      countryId = session.countryIds[0] ?? null;
      cityBranchId = sqlScope.kind === "cityBranch" && cityBranchId && sqlScope.ids.includes(cityBranchId) ? cityBranchId : (session.cityBranchIds[0] ?? "00000000-0000-0000-0000-000000000000");
    }

    const summary = await getMonthlyEditSummary({
      year,
      month,
      countryId,
      cityBranchId
    });

    return NextResponse.json({
      success: true,
      ...summary
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch monthly edit summary." }, { status: 500 });
  }
}
