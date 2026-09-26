import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

const updateSchema = z.object({
  containerNumber: z.string().trim().min(1).max(160).optional(),
  containerType: z.string().trim().max(120).nullable().optional(),
  loadingStatus: z.enum(["draft", "pending", "loaded", "received", "cancelled"]).optional(),
  loadedAt: z.string().datetime().nullable().optional(),
  loadingLocation: z.string().trim().max(240).nullable().optional(),
  receivingLocation: z.string().trim().max(240).nullable().optional(),
  shipmentStatus: z.string().trim().max(120).nullable().optional(),
  carrierName: z.string().trim().max(180).nullable().optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
  loadedContainers: z.coerce.number().min(1).optional(),
  loadedQuantity: z.coerce.number().min(0).optional(),
  reportPayload: z.record(z.string(), z.unknown()).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const body = updateSchema.parse(await request.json());
    const id = (await params).id;

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`
        select * from purchase_loading_records
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] || null;
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Purchase loading record not found", 404);
    }

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: existing.country_id,
      countryBranchId: existing.country_branch_id,
      cityBranchId: existing.city_branch_id
    });

    const payload: Record<string, any> = {};
    if (body.containerNumber !== undefined) payload.container_number = body.containerNumber;
    if (body.containerType !== undefined) payload.container_type = body.containerType;
    if (body.loadingStatus !== undefined) payload.loading_status = body.loadingStatus;
    if (body.loadedAt !== undefined) payload.loaded_at = body.loadedAt;
    if (body.loadingLocation !== undefined) payload.loading_location = body.loadingLocation;
    if (body.receivingLocation !== undefined) payload.receiving_location = body.receivingLocation;
    if (body.shipmentStatus !== undefined) payload.shipment_status = body.shipmentStatus;
    if (body.carrierName !== undefined) payload.carrier_name = body.carrierName;
    if (body.remarks !== undefined) payload.remarks = body.remarks;
    if (body.reportPayload !== undefined) payload.report_payload = body.reportPayload;

    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        update purchase_loading_records
        set ${sql(payload as any)}
        where id = ${id}::uuid
        returning id, loading_record_no
      `;
      return rows[0] || null;
    });

    if (!updated) {
      return apiError("UPDATE_FAILED", "Failed to update purchase loading record", 500);
    }

    await writeAuditLog({
      action: "update",
      entityTable: "purchase_loading_records",
      entityId: updated.id,
      before: existing,
      after: { ...existing, ...payload },
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ loadingRecordId: updated.id, loadingRecordNo: updated.loading_record_no });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const id = (await params).id;

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`
        select * from purchase_loading_records
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] || null;
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Purchase loading record not found", 404);
    }

    authorizeApiScope(session, {
      resource: "purchases",
      action: "delete",
      countryId: existing.country_id,
      countryBranchId: existing.country_branch_id,
      cityBranchId: existing.city_branch_id
    });

    const deletedAt = new Date().toISOString();
    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        update purchase_loading_records
        set deleted_at = ${deletedAt}
        where id = ${id}::uuid
        returning id, loading_record_no
      `;
      return rows[0] || null;
    });

    if (!updated) {
      return apiError("DELETE_FAILED", "Failed to delete purchase loading record", 500);
    }

    await writeAuditLog({
      action: "delete",
      entityTable: "purchase_loading_records",
      entityId: updated.id,
      before: existing,
      after: { ...existing, deleted_at: deletedAt },
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiOk({ loadingRecordId: updated.id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
