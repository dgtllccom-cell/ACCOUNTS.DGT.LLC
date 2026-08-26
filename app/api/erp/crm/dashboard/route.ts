import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getSmartCrmDashboardData } from "@/lib/crm/smart-crm-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    const generalBrand = searchParams.get("generalBrand");
    const countryId = searchParams.get("countryId");
    const countryBranchId = searchParams.get("countryBranchId");
    const cityBranchId = searchParams.get("cityBranchId");
    const targetDate = searchParams.get("targetDate");
    const tab = searchParams.get("tab") || "today";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 50);
    const search = searchParams.get("search");

    const payload = await getSmartCrmDashboardData({
      session,
      generalBrand,
      countryId,
      countryBranchId,
      cityBranchId,
      targetDate,
      tab,
      page,
      pageSize,
      search
    });

    return NextResponse.json({
      success: true,
      ...payload
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch CRM dashboard data." },
      { status: 500 }
    );
  }
}
