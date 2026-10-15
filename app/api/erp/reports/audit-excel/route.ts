import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { generateUrduAuditExcelWorkbook } from "@/lib/reports/audit-excel-generator";
import { AUDIT_SHEETS_DATA } from "@/lib/reports/audit-report-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    // Restrict strictly to authorized Global Super Admin or Business Super Admin
    const isAuthorized =
      session.isSuperAdmin ||
      session.roles?.includes("super_admin") ||
      session.roles?.includes("business_super_admin");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Authorized Global Super Admin access required to download the Complete Urdu Audit Report." },
        { status: 403 }
      );
    }

    const buffer = await generateUrduAuditExcelWorkbook(AUDIT_SHEETS_DATA);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `DGT_ERP_Complete_Business_System_Urdu_Audit_Report_${timestamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (err) {
    console.error("Failed to generate complete Urdu audit Excel report:", err);
    return NextResponse.json(
      { error: "Failed to generate audit report: " + (err as Error).message },
      { status: 500 }
    );
  }
}
