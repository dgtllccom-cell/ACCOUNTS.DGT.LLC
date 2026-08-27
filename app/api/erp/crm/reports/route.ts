import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getCrmUniversalReportData } from "@/lib/crm/smart-crm-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const reportType = searchParams.get("reportType") || "daily_action";
    const countryId = searchParams.get("countryId");
    const cityBranchId = searchParams.get("cityBranchId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const payload = await getCrmUniversalReportData({
      session,
      reportType,
      countryId,
      cityBranchId,
      startDate,
      endDate,
      status
    });

    return NextResponse.json({
      success: true,
      ...payload
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch CRM report data." },
      { status: 500 }
    );
  }
}
