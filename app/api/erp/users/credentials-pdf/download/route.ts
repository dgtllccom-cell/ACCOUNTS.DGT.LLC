import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    const roles = new Set(session.roles ?? []);
    const isAuthorized =
      session.isSuperAdmin ||
      roles.has("country_admin") ||
      roles.has("country_user") ||
      roles.has("main_branch_admin") ||
      roles.has("city_branch_admin");

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Access Denied. Only Admins have permission to download user credentials and security reports." },
        { status: 403 }
      );
    }

    const pdfPath = path.resolve(process.cwd(), "ACCOUNTS_DGT_LLC_USERS_CREDENTIALS_AND_LIVE_MONITORING.pdf");
    
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: "PDF report not found. Please generate the PDF first." },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="ACCOUNTS_DGT_LLC_USERS_CREDENTIALS_AND_LIVE_MONITORING.pdf"',
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.message?.includes("Unauthenticated") || error?.message?.includes("session")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    console.error("PDF download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
