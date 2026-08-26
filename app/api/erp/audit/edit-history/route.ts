import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getEditHistoryRecords } from "@/lib/audit/enterprise-audit-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");
    const moduleName = searchParams.get("module");
    const user = searchParams.get("user");
    const riskLevel = searchParams.get("riskLevel");
    const approvalStatus = searchParams.get("approvalStatus");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const search = searchParams.get("search");
    const limit = Number(searchParams.get("limit") || 50);
    const offset = Number(searchParams.get("offset") || 0);

    // Permission Scope
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports") && !session.roles.includes("audit_viewer")) {
      if (session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
      if (session.cityBranchIds.length > 0) {
        cityBranchId = session.cityBranchIds[0];
      }
    }

    const result = await getEditHistoryRecords({
      countryId,
      cityBranchId,
      module: moduleName,
      user,
      riskLevel,
      approvalStatus,
      fromDate,
      toDate,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch edit history." }, { status: 500 });
  }
}
