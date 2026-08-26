import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { restoreDeletedRecord } from "@/lib/audit/enterprise-audit-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);

    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      return NextResponse.json({ error: "Unauthorized. Only authorized Super Admin can restore deleted records." }, { status: 403 });
    }

    const body = await request.json();
    const { entityType, entityId, reason } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    const result = await restoreDeletedRecord({
      entityType,
      entityId,
      session,
      reason
    });

    return NextResponse.json({
      success: true,
      message: "Record successfully restored. Permanent audit restoration log created.",
      ...result
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to restore record." }, { status: 500 });
  }
}
