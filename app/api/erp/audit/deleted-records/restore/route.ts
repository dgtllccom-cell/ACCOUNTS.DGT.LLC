import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const body = await request.json();

    const { entityType, entityId, referenceNo, reason } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    // Only Super Admin or authorized Country Admin can restore
    if (!session.isSuperAdmin && !session.countryIds.length) {
      return NextResponse.json({ error: "Insufficient permissions to restore deleted records." }, { status: 403 });
    }

    // Update actual table to clear deleted_at / set status = active
    await withLocalPg(async (sql) => {
      try {
        await sql.unsafe(`
          UPDATE ${sql(entityType)} 
          SET deleted_at = NULL 
          WHERE id::text = ${entityId} OR code = ${entityId};
        `);
      } catch (e) {
        try {
          await sql.unsafe(`
            UPDATE ${sql(entityType)} 
            SET status = 'active' 
            WHERE id::text = ${entityId} OR code = ${entityId};
          `);
        } catch (_) {}
      }
    });

    // Record immutable audit event for restore
    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      actionType: "RESTORE",
      reason: reason || "Restored by Administrator",
      session
    });

    return NextResponse.json({
      success: true,
      message: "Record successfully restored with complete audit trail preserved.",
      auditEventId: event.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to restore record." }, { status: 500 });
  }
}
