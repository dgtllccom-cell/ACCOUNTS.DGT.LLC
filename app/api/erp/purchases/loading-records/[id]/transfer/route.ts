export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { derivePurchaseStockLifecycle, normalizePurchaseStockDestination, purchaseStockDestinationLabel } from "@/lib/services/purchase-stock-lifecycle";

const paramsSchema = z.object({
  id: z.string().uuid()
});

const bodySchema = z.object({
  action: z.enum(["land", "forward"]),
  destination: z.enum(["warehouse", "in-transit", "export", "re-export", "local-sale"]).optional(),
  note: z.string().trim().max(500).optional()
});

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : 0;
}

function stageLabel(stage: string) {
  if (stage === "booking") return "Booking Stock";
  if (stage === "remaining") return "Remaining Stock";
  if (stage === "land") return "Land Stock";
  if (stage === "in-transit") return "In Transit Stock";
  if (stage === "warehouse") return "Warehouse Stock";
  if (stage === "export") return "Export Stock";
  if (stage === "re-export") return "Re-export Stock";
  if (stage === "local-sale") return "Local Sale / Delivered Stock";
  return "Booking Stock";
}

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
            po.payment_status as purchase_payment_status,
            po.remaining_due as purchase_remaining_due,
            po.advance_paid as purchase_advance_paid,
            po.order_total as purchase_order_total,
            po.form_data as purchase_form_data
          from purchase_loading_records plr
          left join purchase_orders po on po.id = plr.purchase_order_id
          where plr.id = ${params.id}::uuid
            and plr.deleted_at is null
          limit 1
          for update;
        `;

        const record = rows[0];
        if (!record) {
          throw new Error("Purchase loading record not found.");
        }

        authorizeApiScope(session, {
          resource: "purchases",
          action: "update",
          countryId: record.country_id,
          countryBranchId: record.country_branch_id,
          cityBranchId: record.city_branch_id
        });

        const purchaseForm = record.purchase_form_data ?? {};
        const paymentStatus = String(record.purchase_payment_status ?? "").trim().toLowerCase();
        const remainingDue = money(record.purchase_remaining_due);
        const paymentProofComplete = paymentStatus === "completed" || paymentStatus === "paid" || remainingDue <= 0;
        const currentLifecycle = derivePurchaseStockLifecycle(
          {
            id: record.purchase_order_id,
            order_total: record.purchase_order_total,
            advance_paid: record.purchase_advance_paid,
            remaining_due: record.purchase_remaining_due,
            payment_status: record.purchase_payment_status,
            form_data: purchaseForm
          },
          [record]
        );

        const previousStage = currentLifecycle.lifecycleStage;
        const nowIso = new Date().toISOString();

        if (body.action === "land") {
          if (!paymentProofComplete) {
            throw new Error("Payment proof is required before moving a load to Land Stock.");
          }
          if (previousStage !== "remaining" && previousStage !== "booking") {
            throw new Error(`This loading record is already in '${stageLabel(previousStage)}'.`);
          }
        }

        if (body.action === "forward") {
          const destination = normalizePurchaseStockDestination(body.destination);
          if (!destination) {
            throw new Error("A destination is required for forward transfer.");
          }
          if (previousStage !== "land") {
            throw new Error("Forward transfer is only available after Land Stock is reached.");
          }
          if (!paymentProofComplete) {
            throw new Error("Payment proof is required before forwarding Land Stock.");
          }
        }

        const nextDestination = body.action === "forward"
          ? normalizePurchaseStockDestination(body.destination)
          : null;

        const nextLifecycleStage = body.action === "land"
          ? "land"
          : String(nextDestination ?? "land");

        const payload = record.report_payload && typeof record.report_payload === "object"
          ? { ...(record.report_payload as Record<string, any>) }
          : {};

        const stageEvents = Array.isArray(payload.stageEvents) ? [...payload.stageEvents] : [];
        stageEvents.push({
          stage: nextLifecycleStage,
          action: body.action,
          destination: nextDestination ?? null,
          userId: session.userId,
          userName: session.fullName || session.email || "User",
          at: nowIso,
          note: body.note ?? null
        });

        const updatedPayload = {
          ...payload,
          lifecycleStage: nextLifecycleStage,
          stockStage: stageLabel(nextLifecycleStage),
          stockStatus: nextLifecycleStage === "land" ? "RED" : "BLACK",
          nextDestination: body.action === "land" ? null : nextDestination,
          destinationType: nextDestination ?? payload.destinationType ?? null,
          paymentProofComplete,
          paymentProofStatus: paymentStatus,
          paymentRemainingDue: remainingDue,
          totalQuantity: currentLifecycle.totalQuantity,
          loadedQuantity: currentLifecycle.totalLoadedQuantity,
          remainingQuantity: currentLifecycle.remainingQuantity,
          stageEvents
        };

        const loadingStatus = body.action === "land" ? "received" : "received";
        const shipmentStatus = nextLifecycleStage;

        await tx`
          update purchase_loading_records
          set
            loading_status = ${loadingStatus},
            shipment_status = ${shipmentStatus},
            report_payload = ${JSON.stringify(updatedPayload)}::jsonb,
            updated_at = now()
          where id = ${params.id}::uuid;
        `;

        const workflow = {
          ...(purchaseForm.workflow ?? {}),
          totalQuantity: currentLifecycle.totalQuantity,
          loadedQuantity: currentLifecycle.totalLoadedQuantity,
          remainingQuantity: currentLifecycle.remainingQuantity,
          inventoryStatus: stageLabel(nextLifecycleStage),
          nextDestination: body.action === "land" ? null : purchaseStockDestinationLabel(nextDestination ?? undefined),
          stockStage: nextLifecycleStage,
          stockStatus: nextLifecycleStage === "land" ? "RED" : "BLACK",
          paymentProofComplete,
          paymentRemainingDue: remainingDue,
          lastStockMovementAt: nowIso,
          lastStockMovementBy: session.userId
        };

        await tx`
          update purchase_orders
          set
            form_data = jsonb_set(
              coalesce(form_data, '{}'::jsonb),
              '{workflow}',
              ${JSON.stringify(workflow)}::jsonb,
              true
            ),
            updated_at = now()
          where id = ${record.purchase_order_id}::uuid;
        `;

        return {
          loadingRecordId: record.id,
          purchaseOrderId: record.purchase_order_id,
          purchaseOrderNo: record.purchase_order_no,
          lifecycleStage: nextLifecycleStage,
          stockStage: stageLabel(nextLifecycleStage),
          paymentProofComplete,
          remainingDue,
          loadedQuantity: currentLifecycle.totalLoadedQuantity,
          remainingQuantity: currentLifecycle.remainingQuantity,
          destination: nextDestination,
          destinationLabel: nextDestination ? purchaseStockDestinationLabel(nextDestination) : null
        };
      });
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transfer loading stage.";
    return NextResponse.json({ ok: false, error: { message } }, { status: 400 });
  }
}
