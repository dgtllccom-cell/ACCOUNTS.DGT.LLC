import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getMonthlyEditSummary } from "@/lib/audit/enterprise-audit-service";
import { canAccessCountry, canAccessCityBranch } from "@/lib/permissions/middleware";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
    const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");

    // Scope enforcement
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
      if (session.cityBranchIds.length > 0) {
        cityBranchId = session.cityBranchIds[0];
      }
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
    return NextResponse.json({ error: error.message || "Failed to fetch monthly edit summary." }, { status: 500 });
  }
}
