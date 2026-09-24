import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getCrmUniversalReportData } from "@/lib/crm/smart-crm-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { assertShippingUserExplicitPermission } from "@/lib/permissions/shipping-explicit-gate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertShippingUserExplicitPermission(session, "crm", "read");
    const { searchParams } = new URL(request.url);

    const reportType = searchParams.get("reportType") || "daily_action";
    const reportTokens: Record<string, string> = { user_followup: "report_user", branch_crm: "report_branch", country_crm: "report_country" };
    if (reportTokens[reportType]) assertShippingUserExplicitPermission(session, "crm", reportTokens[reportType]);
    const countryId = searchParams.get("countryId");
    const cityBranchId = searchParams.get("cityBranchId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    // "User Follow-Up" report: restrict to the caller's OWN follow-ups unless they can
    // see a wider CRM scope (super admin, or explicit crm:read granted beyond their own
    // assignments) — the report type existed in the UI (crm-reports-view.tsx) with no
    // matching filter in the service, so it silently returned every record in scope.
    const userId = reportType === "user_followup" ? session.userId : null;

    const payload = await getCrmUniversalReportData({
      session,
      reportType,
      countryId,
      cityBranchId,
      startDate,
      endDate,
      status,
      userId
    });

    return NextResponse.json({
      success: true,
      ...payload
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch CRM report data." },
      { status: error?.status || 500 }
    );
  }
}
