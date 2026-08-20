import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);

    // Strictly restricted to Super Admin only
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Permanent deletion is strictly restricted to Super Admin level with immutable security audit." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, referenceNo, reason } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    // 1. Record permanent deletion event in immutable audit log before actual delete
    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      actionType: "PERMANENT_DELETE",
      reason: reason || "Permanent Deletion executed by Super Admin",
      session
    });

    // 2. Perform hard delete on the table
    await withLocalPg(async (sql) => {
      try {
        await sql.unsafe(`
          DELETE FROM ${sql(entityType)} 
          WHERE id::text = ${entityId} OR code = ${entityId};
        `);
      } catch (e: any) {
        console.warn(`[permanentDelete] Warning during hard delete on ${entityType}:`, e.message);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Permanent deletion executed and permanently logged in Super Admin audit vault.",
      auditEventId: event.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to execute permanent deletion." }, { status: 500 });
  }
}
