export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { ErpPermissionError, isStrictOperationalSession } from "@/lib/permissions/middleware";
import { assertShippingUserExplicitPermission } from "@/lib/permissions/shipping-explicit-gate";
import { getCrmPayablesReceivablesData } from "@/lib/crm/crm-payables-receivables-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) {
      throw new ErpPermissionError("CRM financial views are outside your access.");
    }
    assertShippingUserExplicitPermission(session, "crm", "read");

    const { searchParams } = new URL(request.url);
    const referenceDate = searchParams.get("referenceDate");
    const countryId = searchParams.get("countryId");
    const cityBranchId = searchParams.get("cityBranchId");
    const search = searchParams.get("search");
    const categoryFilter = searchParams.get("category");

    const data = await getCrmPayablesReceivablesData({
      session,
      referenceDate,
      countryId,
      cityBranchId,
      search,
      categoryFilter
    });

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch CRM Payables & Receivables data." },
      { status: error?.status || 500 }
    );
  }
}
