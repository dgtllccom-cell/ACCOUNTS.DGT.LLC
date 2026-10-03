export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { isDestinationScopeUser, authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { stockInToWarehouse } from "@/lib/services/purchase-warehouse-stock";

const paramsSchema = z.object({ id: z.string().uuid() });

const bodySchema = z.object({
  receivedQuantity: z.coerce.number().positive(),
  warehouseId: z.string().uuid(),
  goodsId: z.string().uuid().optional(),
  unitCost: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(1000).nullable().optional()
});

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : 0;
}

/**
 * Destination Receiving. Confirms received quantity against a loading record (which already
 * tracks loaded_quantity from the existing partial-loading engine — see
 * purchase-stock-lifecycle.ts / purchase_loading_records), enforces partial/over-receiving
 * limits at the DB level (plr_received_not_exceeding_loaded_chk), and writes the SAME
 * stock_movements + product_inventory_balances tables the rest of the ERP's inventory system
 * already uses (see app/api/erp/inventory/stock-movements/route.ts) — no parallel stock system.
 * Restricted to the destination-scope holder of the linked purchase order (or super admin) —
 * the source/purchasing branch cannot confirm receiving on behalf of the destination.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());

    const result = await withLocalPg(async (sql) => {
      return sql.begin(async (tx) => {
        const rows = await tx`
          select
            plr.*,
            po.dest_country_id, po.dest_country_branch_id, po.dest_city_branch_id
          from purchase_loading_records plr
          left join purchase_orders po on po.id = plr.purchase_order_id
          where plr.id = ${params.id}::uuid
            and plr.deleted_at is null
          limit 1
          for update of plr;
        `;
        const record = rows[0];
        if (!record) throw new Error("Purchase loading record not found.");

        const destinationScope = {
          countryId: record.dest_country_id ?? null,
          countryBranchId: record.dest_country_branch_id ?? null,
          cityBranchId: record.dest_city_branch_id ?? null
        };

        if (destinationScope.countryId || destinationScope.countryBranchId || destinationScope.cityBranchId) {
          // Country-to-Country Purchase: only the destination-scope holder (or super admin)
          // may confirm receiving — the source/purchasing branch cannot receive on the
          // destination's behalf.
          if (!isDestinationScopeUser(session, destinationScope)) {
            throw new Error("Only the destination country/branch may confirm receiving for this shipment.");
          }
        } else {
          // Plain same-country loading record (no destination scope set) — fall back to the
          // ordinary single-scope check against the record's own (source) scope.
          authorizeApiScope(session, {
            resource: "purchases",
            action: "update",
            countryId: record.country_id,
            countryBranchId: record.country_branch_id,
            cityBranchId: record.city_branch_id
          });
        }

        const alreadyReceived = money(record.received_quantity);
        const loaded = money(record.loaded_quantity);
        const newReceivedTotal = alreadyReceived + money(body.receivedQuantity);

        if (newReceivedTotal > loaded + 0.0001) {
          throw new Error(
            `Received quantity would exceed loaded quantity. Loaded: ${loaded}, already received: ${alreadyReceived}, remaining to receive: ${money(loaded - alreadyReceived)}.`
          );
        }

        // Resolve goods_id: prefer the explicit body value, else the loading record's own
        // receiving_goods_id, else the first item on the linked purchase order.
        let goodsId = body.goodsId || record.receiving_goods_id || null;
        if (!goodsId && record.purchase_order_id) {
          const itemRows = await tx`
            select product_id from purchase_order_items
            where purchase_order_id = ${record.purchase_order_id}::uuid and product_id is not null
            order by created_at asc limit 1
          `;
          goodsId = itemRows[0]?.product_id ?? null;
        }
        if (!goodsId) {
          throw new Error("No goods reference available for this shipment — specify goodsId to receive into stock.");
        }

        const nowIso = new Date().toISOString();
        const newStatus = newReceivedTotal >= loaded ? "received" : "partially_received";

        await tx`
          update purchase_loading_records
          set
            received_quantity = ${newReceivedTotal},
            received_at = ${nowIso},
            received_by = ${session.userId}::uuid,
            receiving_warehouse_id = ${body.warehouseId}::uuid,
            receiving_goods_id = ${goodsId}::uuid,
            receiving_remarks = ${body.remarks ?? null},
            loading_status = ${newStatus},
            shipment_status = ${newStatus},
            updated_at = now()
          where id = ${params.id}::uuid;
        `;

        // ── Reuse the existing stock write path (same tables the rest of the ERP uses) ──
        const { stockMovementId } = await stockInToWarehouse(tx, {
          goodsId,
          warehouseId: body.warehouseId,
          quantity: money(body.receivedQuantity),
          unitCost: money(body.unitCost),
          scope: destinationScope,
          referenceNo: record.loading_record_no,
          purchaseOrderId: record.purchase_order_id ?? null,
          loadingRecordId: params.id,
          userId: session.userId,
          remarks: body.remarks ?? null
        });
        const movementRows = [{ id: stockMovementId }];

        return {
          loadingRecordId: params.id,
          loadingStatus: newStatus,
          receivedQuantity: newReceivedTotal,
          loadedQuantity: loaded,
          remainingToReceive: money(loaded - newReceivedTotal),
          stockMovementId: movementRows[0]?.id ?? null
        };
      });
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    rethrowIfNextControlFlow(error);
    const fallbackMsg = "Failed to confirm receiving.";
    const message = error instanceof Error ? error.message : fallbackMsg;
    return NextResponse.json({ ok: false, error: { message } }, { status: 400 });
  }
}
