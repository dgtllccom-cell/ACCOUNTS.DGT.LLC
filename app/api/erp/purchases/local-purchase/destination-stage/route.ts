export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { acquireIdempotencyLock, buildReplayedResponse, commitIdempotencySuccess, releaseIdempotencyLock } from "@/lib/api/idempotency";
import { z } from "zod";
import { ensureLaneFromLocalPurchase } from "@/lib/services/purchase-lane-service";
import { checkLocalPurchaseLoadingEligibility, remainingLocalPurchaseQuantity } from "@/lib/purchases/local-purchase-loading-rules";

/**
 * POST /api/erp/purchases/local-purchase/destination-stage
 *
 * Handles Local Purchase destination movements:
 * 1. Loading (with single or multiple partial loading entries, stock protection, and payment eligibility validation).
 * 2. Warehouse Transfer.
 * 3. Export Shipment.
 *
 * Never posts or duplicates financial transactions; all financial postings are handled
 * exclusively by Transfer & Post.
 */
const STAGE_TO_SHIPPING_MODE: Record<string, string> = {
  warehouse_transfer: "Transfer Layout",
  loading: "Loading",
  export: "Export",
};

const destinationStageSchema = z.object({
  purchaseId: z.string().uuid(),
  stage: z.enum(["warehouse_transfer", "loading", "export"]),
  loadingEntry: z
    .object({
      loadingDate: z.string().optional(),
      loadingNumber: z.string().optional(),
      truckNo: z.string().optional(),
      driverName: z.string().optional(),
      blOrContainerNo: z.string().optional(),
      transportDetails: z.string().optional(),
      route: z.string().optional(),
      remarks: z.string().optional(),
      loadedQuantity: z.coerce.number().positive(),
      grossWeight: z.coerce.number().optional(),
      netWeight: z.coerce.number().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const { purchaseId, stage, loadingEntry } = destinationStageSchema.parse(body);

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

        // Payment eligibility check for loading
        if (stage === "loading") {
          const payAgg = await tx`
            select
              coalesce(sum(amount) filter (where payment_status = 'posted'), 0)::numeric as posted_paid_amount,
              count(*) filter (where payment_status = 'posted')::int as posted_payment_count
            from public.purchase_order_payments
            where local_purchase_id = ${purchaseId}::uuid
              and deleted_at is null
              and kind != 'booking';
          `;
          const postedPaid = Math.max(0, Number(payAgg[0]?.posted_paid_amount ?? 0));
          const postedCount = Number(payAgg[0]?.posted_payment_count ?? 0);
          const advanceRequired = Number(purchase.advance_amount ?? 0);
          const elig = checkLocalPurchaseLoadingEligibility({
            purchaseStatus: purchase.status,
            mode: purchase.payment_mode,
            requiredAdvance: advanceRequired,
            postedAdvance: postedPaid,
            cashPaymentPosted: Boolean(purchase.roznamcha_entry_id) || postedCount > 0,
            creditApproved: true,
          });

          if (!elig.allowed) {
            throw new ApiClientError(
              `Cannot load bill: payment condition is not satisfied (${elig.reason}). Outstanding: ${elig.advanceOutstanding}`,
              { status: 422, code: "PAYMENT_NOT_ELIGIBLE" }
            );
          }
        }

        const nowIso = new Date().toISOString();
        let updatedRows;
        if (stage === "warehouse_transfer") {
          if (String(purchase.warehouse_transfer_status || "") === "completed") {
            throw new ApiClientError("This warehouse transfer stage has already been marked complete.", { status: 409, code: "ALREADY_COMPLETED" });
          }
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
          const loadingDetails = (typeof purchase.loading_details === "object" && purchase.loading_details !== null)
            ? { ...purchase.loading_details }
            : {};
          const existingEntries: any[] = Array.isArray(loadingDetails.entries) ? [...loadingDetails.entries] : [];

          const bookedQty = Number(purchase.numbers ?? purchase.quantity_kgs ?? 0);
          const previouslyLoaded = existingEntries.reduce((sum, e) => sum + Number(e.loadedQuantity ?? 0), 0);
          const remaining = remainingLocalPurchaseQuantity(bookedQty, previouslyLoaded);

          if (remaining <= 0 && existingEntries.length > 0) {
            throw new ApiClientError("This bill is already fully loaded.", { status: 409, code: "ALREADY_COMPLETED" });
          }

          const newQty = loadingEntry?.loadedQuantity !== undefined
            ? Number(loadingEntry.loadedQuantity)
            : remaining;

          if (newQty <= 0) {
            throw new ApiClientError("Loading quantity must be greater than zero.", { status: 400 });
          }
          if (newQty > remaining + 1e-8) {
            throw new ApiClientError(
              `Cannot load ${newQty}. Only ${remaining} remains to be loaded for this bill.`,
              { status: 422, code: "OVERLOADING" }
            );
          }

          const entrySeq = existingEntries.length + 1;
          const voucherSerial = purchase.journal_serial_no || purchase.manual_bill_no || `LP-${purchaseId.slice(0, 5).toUpperCase()}`;
          const entryId = crypto.randomUUID();
          const loadingNo = loadingEntry?.loadingNumber || `LD-${voucherSerial}-${String(entrySeq).padStart(2, "0")}`;
          const entryDate = loadingEntry?.loadingDate || new Date().toISOString().slice(0, 10);
          const truck = loadingEntry?.truckNo || purchase.truck_no || "—";
          const driver = loadingEntry?.driverName || purchase.driver_name || "—";

          const newCumulative = previouslyLoaded + newQty;
          const newRemaining = remainingLocalPurchaseQuantity(bookedQty, newCumulative);

          const totalGross = Number(purchase.total_gross_weight ?? purchase.quantity_kgs ?? 0);
          const totalNet = Number(purchase.net_weight ?? totalGross);
          const propGross = bookedQty > 0 ? (newQty / bookedQty) * totalGross : 0;
          const propNet = bookedQty > 0 ? (newQty / bookedQty) * totalNet : 0;

          const entryGross = Number(loadingEntry?.grossWeight ?? propGross);
          const entryNet = Number(loadingEntry?.netWeight ?? propNet);

          const entryRecord = {
            id: entryId,
            entryNo: entrySeq,
            loadingNumber: loadingNo,
            loadingDate: entryDate,
            truckNo: truck,
            driverName: driver,
            blOrContainerNo: loadingEntry?.blOrContainerNo || "—",
            transportDetails: loadingEntry?.transportDetails || purchase.shipping_mode || "Road Transport",
            route: loadingEntry?.route || `${purchase.origin_country_name || "Local"} → ${purchase.warehouse_name || "Warehouse"}`,
            goodsName: purchase.goods_name,
            quantityName: purchase.quantity_name || "Bags",
            loadedQuantity: newQty,
            bookedQuantity: bookedQty,
            previouslyLoadedQuantity: previouslyLoaded,
            remainingQuantity: newRemaining,
            grossWeight: entryGross,
            netWeight: entryNet,
            remarks: loadingEntry?.remarks || "Local purchase loading entry",
            responsibleUser: session.fullName || "User",
            createdAt: nowIso,
            createdBy: session.userId,
          };

          existingEntries.push(entryRecord);
          loadingDetails.entries = existingEntries;
          loadingDetails.cumulativeLoadedQuantity = newCumulative;
          loadingDetails.remainingQuantity = newRemaining;

          const newStatus = newRemaining <= 0 ? "completed" : "partial";

          updatedRows = await tx`
            update public.local_purchases
            set loading_status = ${newStatus},
                loading_completed_at = ${newStatus === "completed" ? nowIso : null},
                loading_completed_by = ${newStatus === "completed" ? session.userId : null}::uuid,
                loading_details = ${JSON.stringify(loadingDetails)}::jsonb,
                truck_no = ${truck},
                driver_name = ${driver},
                loading_date = ${entryDate},
                updated_at = ${nowIso}
            where id = ${purchaseId}::uuid
            returning *;
          `;
          // Loaded -> the load enters the General Purchase Lane (idempotent; one lane row per local purchase).
          await ensureLaneFromLocalPurchase(tx, purchaseId, session);
        } else {
          if (String(purchase.export_status || "") === "completed") {
            throw new ApiClientError("This export stage has already been marked complete.", { status: 409, code: "ALREADY_COMPLETED" });
          }
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
