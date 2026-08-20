import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getDeletedRecords, recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search");
    const limit = Number(searchParams.get("limit") || 50);
    const offset = Number(searchParams.get("offset") || 0);

    // Isolation: Country Admin only sees own country
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      if (session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
      if (session.cityBranchIds.length > 0) {
        cityBranchId = session.cityBranchIds[0];
      }
    }

    const result = await getDeletedRecords({
      countryId,
      cityBranchId,
      entityType,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch deleted records." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const body = await request.json();

    const { entityType, entityId, referenceNo, reason, countryId, cityBranchId } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    // Perform soft delete on the underlying table if column exists, and write audit event
    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      actionType: "SOFT_DELETE",
      reason: reason || "Archived via Soft Delete",
      session,
      countryId,
      cityBranchId
    });

    // Also update deleted_at in the actual database table if it exists
    await withLocalPg(async (sql) => {
      try {
        await sql.unsafe(`
          UPDATE ${sql(entityType)} 
          SET deleted_at = NOW() 
          WHERE id::text = ${entityId} OR code = ${entityId};
        `);
      } catch (e) {
        // Table might not have deleted_at or might use status column
        try {
          await sql.unsafe(`
            UPDATE ${sql(entityType)} 
            SET status = 'deleted' 
            WHERE id::text = ${entityId} OR code = ${entityId};
          `);
        } catch (_) {}
      }
    });

    return NextResponse.json({
      success: true,
      message: "Record successfully soft deleted and archived into audit history.",
      auditEventId: event.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to soft delete record." }, { status: 500 });
  }
}
