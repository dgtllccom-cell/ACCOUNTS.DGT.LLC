export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { acquireIdempotencyLock, buildReplayedResponse, commitIdempotencySuccess, releaseIdempotencyLock } from "@/lib/api/idempotency";
import { z } from "zod";

/**
 * POST /api/erp/purchases/local-purchase/destination-stage
 *
 * A Local Purchase bill's destination (Loading by Truck / Warehouse Transfer /
 * Export Shipment), chosen at booking time and persisted as
 * local_purchases.shipping_mode, must determine the actual next operational
 * queue once the bill is posted (Transfer & Post already ran the one-time
 * Journal -> Roznamcha -> GL posting — this route never touches that).
 * This marks ONE destination's own queue stage complete; it does not create
 * any accounting entry.
 */
const STAGE_TO_SHIPPING_MODE: Record<string, string> = {
  warehouse_transfer: "Transfer Layout",
  loading: "Loading",
  export: "Export",
};

const destinationStageSchema = z.object({
  purchaseId: z.string().uuid(),
  stage: z.enum(["warehouse_transfer", "loading", "export"]),
});

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId, stage } = destinationStageSchema.parse(body);

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "LOCAL_PURCHASE_DESTINATION_STAGE",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      businessReference: `${purchaseId}:${stage}`,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
    }
    if (!lockRes.acquired) {
      return NextResponse.json(
        { ok: false, error: { message: "A request with this idempotency key is currently being processed or duplicate submission detected. Please wait." } },
        { status: 409 }
      );
    }
    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const result = await withLocalPg(async (sql) => {
      return await sql.begin(async (tx) => {
        const rows = await tx`
          select *
          from public.local_purchases
          where id = ${purchaseId}::uuid and deleted_at is null
          limit 1
          for update;
        `;
        const purchase = rows[0];
        if (!purchase) throw new ApiClientError("Local purchase record not found", { status: 404, code: "NOT_FOUND" });

        authorizeApiScope(session, {
          resource: "purchases",
          action: "update",
          countryId: purchase.country_id,
          countryBranchId: purchase.country_branch_id,
          cityBranchId: purchase.city_branch_id ?? null,
        });

        // Only a posted bill (Journal/Roznamcha/GL already booked) has anything
        // to route into an operational queue.
        if (purchase.status !== "posted") {
          throw new ApiClientError(
            `Cannot advance a bill with status '${purchase.status}'. Transfer & Post it first.`,
            { status: 409, code: "NOT_POSTED" }
          );
        }

        const expectedMode = STAGE_TO_SHIPPING_MODE[stage];
        if (String(purchase.shipping_mode || "") !== expectedMode) {
          throw new ApiClientError(
            `This bill's selected destination is '${purchase.shipping_mode || "Local Market"}', not '${expectedMode}'.`,
            { status: 409, code: "WRONG_DESTINATION" }
          );
        }

        const statusColumn =
          stage === "warehouse_transfer" ? "warehouse_transfer_status" :
          stage === "loading" ? "loading_status" : "export_status";
        if (String(purchase[statusColumn] || "") === "completed") {
          throw new ApiClientError("This destination stage has already been marked complete.", { status: 409, code: "ALREADY_COMPLETED" });
        }

        const nowIso = new Date().toISOString();
        let updatedRows;
        if (stage === "warehouse_transfer") {
          updatedRows = await tx`
            update public.local_purchases
            set warehouse_transfer_status = 'completed',
                warehouse_transferred_at = ${nowIso},
                warehouse_transferred_by = ${session.userId}::uuid,
                updated_at = ${nowIso}
            where id = ${purchaseId}::uuid
            returning *;
          `;
        } else if (stage === "loading") {
          updatedRows = await tx`
            update public.local_purchases
            set loading_status = 'completed',
                loading_completed_at = ${nowIso},
                loading_completed_by = ${session.userId}::uuid,
                updated_at = ${nowIso}
            where id = ${purchaseId}::uuid
            returning *;
          `;
        } else {
          updatedRows = await tx`
            update public.local_purchases
            set export_status = 'completed',
                export_handover_at = ${nowIso},
                export_handover_by = ${session.userId}::uuid,
                updated_at = ${nowIso}
            where id = ${purchaseId}::uuid
            returning *;
          `;
        }

        return updatedRows[0];
      });
    });

    if (!result) throw new Error("Destination stage update did not return the updated record.");

    const resPayload = { ok: true, data: { purchase: result } };
    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }
    return NextResponse.json(resPayload);
  } catch (err: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    return handleApiError(err);
  }
}
