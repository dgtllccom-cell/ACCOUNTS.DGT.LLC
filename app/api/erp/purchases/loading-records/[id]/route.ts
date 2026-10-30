import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeLogistics } from "@/lib/api/scope-middleware";
import { writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { parseJsonish } from "@/lib/stock-journal/model";

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
  reportPayload: z.record(z.string(), z.unknown()).optional(),
  // operational cargo fields (no financial fields are editable on a loading record)
  blNumber: z.string().trim().max(120).nullable().optional(),
  grossWeight: z.coerce.number().min(0).nullable().optional(),
  tareWeight: z.coerce.number().min(0).nullable().optional(),
  netWeight: z.coerce.number().min(0).nullable().optional(),
  sealNumber: z.string().trim().max(120).nullable().optional(),
  vesselName: z.string().trim().max(160).nullable().optional(),
  voyageNo: z.string().trim().max(80).nullable().optional(),
  awbNumber: z.string().trim().max(80).nullable().optional(),
  flightDetails: z.string().trim().max(200).nullable().optional(),
  railReference: z.string().trim().max(120).nullable().optional(),
  originText: z.string().trim().max(240).nullable().optional(),
  destinationText: z.string().trim().max(240).nullable().optional(),
  lotName: z.string().trim().max(120).nullable().optional()
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

    authorizeLogistics(session, {
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
    const opCols: Array<[keyof typeof body, string]> = [
      ["blNumber", "bl_number"], ["grossWeight", "gross_weight"], ["tareWeight", "tare_weight"], ["netWeight", "net_weight"], ["sealNumber", "seal_number"],
      ["vesselName", "vessel_name"], ["voyageNo", "voyage_no"], ["awbNumber", "awb_number"], ["flightDetails", "flight_details"],
      ["railReference", "rail_reference"], ["originText", "origin_text"], ["destinationText", "destination_text"], ["lotName", "lot_name"]
    ];
    for (const [k, col] of opCols) if (body[k] !== undefined) payload[col] = body[k];
    if (Object.keys(payload).length === 0) return apiOk({ loadingRecordId: id, loadingRecordNo: existing.loading_record_no });

    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        update purchase_loading_records
        set ${sql(payload as any)}
        where id = ${id}::uuid
        returning id, loading_record_no
      `;
      // keep the lane row's cargo details in step while the load has not started moving
      if (rows[0]) {
        await sql`
          update purchase_lane_loads l set
            bl_number = coalesce(plr.bl_number, l.bl_number), container_number = plr.container_number, container_type = plr.container_type,
            gross_weight = coalesce(plr.gross_weight, l.gross_weight), tare_weight = coalesce(plr.tare_weight, l.tare_weight), net_weight = coalesce(plr.net_weight, l.net_weight),
            origin_text = coalesce(plr.origin_text, l.origin_text), destination_text = coalesce(plr.destination_text, l.destination_text), updated_at = now()
          from purchase_loading_records plr
          where plr.id = ${id}::uuid and l.source_type = 'purchase_booking' and l.source_id = plr.id and l.deleted_at is null and l.lane_status = 'loaded'`;
      }
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

    authorizeLogistics(session, {
      action: "delete",
      countryId: existing.country_id,
      countryBranchId: existing.country_branch_id,
      cityBranchId: existing.city_branch_id
    });

    const lane = await withLocalPg(async (sql) => (await sql`select id, lane_status, owner_type, disposition, leg_no from purchase_lane_loads where source_type = 'purchase_booking' and source_id = ${id}::uuid and deleted_at is null`)[0] ?? null);
    if (lane && (lane.lane_status !== "loaded" || lane.owner_type !== "branch" || lane.leg_no > 1 || lane.disposition)) {
      return apiError("LOAD_IN_LANE", "This load has already moved in the Purchase Lane (transfer, customs, disposition). It cannot be deleted from the Loading page.", 409);
    }
    // A loading that already has money posted against it cannot simply disappear: the payment and its ledger entry would be left
    // pointing at nothing and the booking's balances would no longer add up. The payments must be reversed first.
    const postedAgainst = await withLocalPg(async (sql) =>
      Number((await sql`select count(*)::int as n from purchase_order_payments where loading_record_id = ${id}::uuid and deleted_at is null and status = 'posted'`)[0]?.n ?? 0)
    );
    if ((postedAgainst ?? 0) > 0) {
      return apiError("LOADING_HAS_PAYMENTS", "Payments have already been posted against this loading. Reverse those payments before deleting the loading.", 409);
    }
    const deletedAt = new Date().toISOString();
    // one transaction under the booking's row lock (the same lock a new loading takes): the loading disappears and the booking's loaded /
    // remaining quantity is recounted from the loadings that are left, so the Stock Journal, the workflow and the Remaining Payment list agree
    const updated = await withLocalPg(async (pg) => pg.begin(async (sql) => {
      if (existing.purchase_order_id) await sql`select 1 from purchase_orders where id = ${existing.purchase_order_id}::uuid for update`;
      if (lane) await sql`update purchase_lane_loads set deleted_at = now(), updated_at = now() where id = ${lane.id}::uuid`;
      const rows = await sql`
        update purchase_loading_records
        set deleted_at = ${deletedAt}
        where id = ${id}::uuid
        returning id, loading_record_no
      `;
      if (rows[0] && existing.purchase_order_id) {
        const [po] = await sql`select form_data from purchase_orders where id = ${existing.purchase_order_id}::uuid and deleted_at is null`;
        if (po) {
          const formData = parseJsonish(po.form_data) || {};
          const workflow = formData.workflow || {};
          const [left] = await sql`
            select coalesce(sum(loaded_quantity), 0)::float as qty, (count(*) filter (where loaded_quantity > 0))::int as containers
            from purchase_loading_records where purchase_order_id = ${existing.purchase_order_id}::uuid and deleted_at is null`;
          const totalQty = Number(workflow.totalQuantity || formData.totals?.totalQuantity || 0);
          const totalContainers = Number(workflow.totalContainers || 0);
          workflow.loadedQuantity = left.qty;
          workflow.remainingQuantity = Math.max(0, totalQty - left.qty);
          workflow.loadedContainers = left.containers;
          if (totalContainers > 0) workflow.remainingContainers = Math.max(0, totalContainers - left.containers);
          if (left.containers > 0) workflow.containerStatus = workflow.remainingQuantity > 0 ? "Partially Loaded" : "Fully Loaded";
          await sql`update purchase_orders set form_data = ${sql.json({ ...formData, workflow })} where id = ${existing.purchase_order_id}::uuid`;
        }
      }
      return rows[0] || null;
    }));

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
