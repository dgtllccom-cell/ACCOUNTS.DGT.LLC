import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { ErpPermissionError, isStrictOperationalSession } from "@/lib/permissions/middleware";
import { getCrmInsights } from "@/lib/crm/crm-insights-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The 8 real, rule-based CRM insight categories — real data, real source links, honest empty states. */
export async function GET() {
  try {
    const session = await requireErpSession();
    // amount-bearing CRM views: never for an operational login nor for a login whose financial field access is denied
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) throw new ErpPermissionError("CRM financial views are outside your access.");
    const groups = await getCrmInsights(session);
    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to load CRM insights." }, { status: error?.status || 500 });
  }
}
