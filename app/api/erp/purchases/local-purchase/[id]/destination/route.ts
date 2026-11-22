export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import {
  LOCAL_PURCHASE_STAGE_SHIPMENT_TYPE,
  LOCAL_PURCHASE_STAGE_SHIPPING_MODE,
  localPurchaseDestinationChangeBlocker,
  parseLoadingDetails,
} from "@/lib/purchases/local-purchase-destination";

/**
 * POST /api/erp/purchases/local-purchase/:id/destination
 *
 * Moves a POSTED bill to another operational queue (Loading, Warehouse Transfer or Export) while no goods have moved for its
 * current destination. Writes only the destination fields (shipping_mode, loading_details, and the warehouse stage when that
 * stage was marked complete without a warehouse). It never touches journal, roznamcha or payment rows.
 */
const bodySchema = z.object({
  stage: z.enum(["warehouse_transfer", "loading", "export"]),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireErpSession();
    const { stage } = bodySchema.parse(await request.json());

    const outcome = await withLocalPg((sql) =>
      sql.begin(async (tx: any) => {
        const rows = await tx`select * from public.local_purchases where id = ${id}::uuid and deleted_at is null for update`;
        const purchase = rows[0];
        if (!purchase) throw new ApiClientError("Local purchase record not found", { status: 404, code: "NOT_FOUND" });

        authorizeApiScope(session, {
          resource: "purchases",
          action: "update",
          countryId: purchase.country_id,
          countryBranchId: purchase.country_branch_id,
          cityBranchId: purchase.city_branch_id ?? null,
        });

        const blocker = localPurchaseDestinationChangeBlocker(purchase, stage);
        if (blocker) throw new ApiClientError(blocker, { status: 409, code: "DESTINATION_LOCKED" });

        const details: Record<string, unknown> = parseLoadingDetails(purchase.loading_details);
        details.shipmentType = LOCAL_PURCHASE_STAGE_SHIPMENT_TYPE[stage];
        details.shippingMode = LOCAL_PURCHASE_STAGE_SHIPPING_MODE[stage];

        // The blocker allows this only for a warehouse stage completed with no warehouse recorded: nothing moved, so the stage is reset.
        const resetsWarehouseStage = String(purchase.warehouse_transfer_status || "") === "completed";
        const nowIso = new Date().toISOString();
        const updatedRows = await tx`
          update public.local_purchases
          set shipping_mode = ${LOCAL_PURCHASE_STAGE_SHIPPING_MODE[stage]},
              loading_details = ${tx.json(details)},
              warehouse_transfer_status = ${resetsWarehouseStage ? null : purchase.warehouse_transfer_status},
              warehouse_transferred_at = ${resetsWarehouseStage ? null : purchase.warehouse_transferred_at},
              warehouse_transferred_by = ${resetsWarehouseStage ? null : purchase.warehouse_transferred_by},
              updated_at = ${nowIso}
          where id = ${id}::uuid
          returning id, shipping_mode, warehouse_transfer_status, status;
        `;
        return { before: purchase, after: updatedRows[0] };
      })
    );

    if (!outcome) throw new Error("Destination change did not return the updated record.");

    void recordAuditEvent({
      entityType: "local_purchase",
      entityId: id,
      referenceNo: outcome.before.journal_serial_no ?? outcome.before.lot_no ?? null,
      module: "local_purchase",
      actionType: "EDIT",
      currentSnapshot: {
        previousShippingMode: outcome.before.shipping_mode ?? null,
        shippingMode: outcome.after.shipping_mode,
        resetWarehouseStage: String(outcome.before.warehouse_transfer_status || "") === "completed",
      },
      session,
      reason: `Local purchase destination changed to ${stage}`,
      countryId: outcome.before.country_id ?? null,
      cityBranchId: outcome.before.city_branch_id ?? null,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, data: { id, stage, shippingMode: outcome.after.shipping_mode } });
  } catch (err: any) {
    return handleApiError(err);
  }
}
