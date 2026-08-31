import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getDeletedRecords, recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    let countryId = searchParams.get("countryId");
    let cityBranchId = searchParams.get("cityBranchId");
    const moduleName = searchParams.get("module") || searchParams.get("entityType");
    const deletedBy = searchParams.get("deletedBy");
    const riskLevel = searchParams.get("riskLevel");
    const reviewStatus = searchParams.get("reviewStatus");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const search = searchParams.get("search");
    const limit = Number(searchParams.get("limit") || 50);
    const offset = Number(searchParams.get("offset") || 0);

    // Permission Scope
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports") && !session.roles.includes("auditor_viewer")) {
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
      module: moduleName,
      deletedBy,
      riskLevel,
      reviewStatus,
      fromDate,
      toDate,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to fetch deleted records." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const {
      entityType,
      entityId,
      referenceNo,
      module,
      reason,
      partyName,
      amount,
      currency,
      countryId,
      countryName,
      cityBranchId,
      branchName,
      snapshot
    } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    // Perform soft delete on the underlying table if column exists, and write audit event
    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      module: module || entityType,
      actionType: "SOFT_DELETE",
      reason: reason || "Archived via Soft Delete",
      previousSnapshot: snapshot || null,
      currentSnapshot: null,
      partyName,
      amount,
      currency,
      session,
      countryId,
      countryName,
      cityBranchId,
      branchName,
      riskLevel: "High"
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
        rethrowIfNextControlFlow(e);
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
      auditEventId: event?.id ?? null
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to soft delete record." }, { status: 500 });
  }
}
