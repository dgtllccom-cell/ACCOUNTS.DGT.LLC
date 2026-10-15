import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { uuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const transferSchema = z.object({
  sourceType: z.enum(["purchase_booking", "local_purchase"]),
  purchaseOrderId: uuidSchema.optional(),
  localPurchaseId: uuidSchema.optional(),
  loadingRecordId: uuidSchema.optional(),
  goodsName: z.string().trim().min(1, "Product name is required"),
  unit: z.string().trim().default("KG"),
  quantity: z.coerce.number().positive("Transfer quantity must be greater than zero"),
  destinationType: z.enum(["warehouse", "export", "local_sales"], {
    errorMap: () => ({ message: "Destination must be Warehouse, Export, or Local Sales" })
  }),
  warehouseId: uuidSchema.optional(),
  referenceNo: z.string().trim().max(100).optional(),
  transferDate: z.string().optional(),
  remarks: z.string().trim().max(500).optional()
}).refine(data => {
  if (data.destinationType === "warehouse" && !data.warehouseId) {
    return false;
  }
  return true;
}, {
  message: "Warehouse is required when transferring to Warehouse Stock",
  path: ["warehouseId"]
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const lang = getRequestLanguage(request);
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Validation failed", 400, parsed.error.flatten().fieldErrors);
    }

    const {
      sourceType,
      purchaseOrderId,
      localPurchaseId,
      loadingRecordId,
      goodsName,
      unit,
      quantity,
      destinationType,
      warehouseId,
      referenceNo,
      transferDate,
      remarks
    } = parsed.data;

    const result = await withLocalPg(async (sql) => {
      let countryId: string | null = null;
      let countryBranchId: string | null = null;
      let cityBranchId: string | null = null;
      let effectivePoId: string | null = purchaseOrderId || null;
      let effectiveLpId: string | null = localPurchaseId || null;
      let availableBalance = 0;

      // 1. Verify source and calculate strictly available balance
      if (sourceType === "purchase_booking") {
        if (!loadingRecordId && !purchaseOrderId) {
          throw new Error("Either loadingRecordId or purchaseOrderId is required for Purchase Booking transfer.");
        }

        if (loadingRecordId) {
          const loadingRows = await sql`
            SELECT plr.*, po.country_id, po.country_branch_id, po.city_branch_id, po.purchase_order_no
            FROM public.purchase_loading_records plr
            JOIN public.purchase_orders po ON po.id = plr.purchase_order_id
            WHERE plr.id = ${loadingRecordId}::uuid AND plr.deleted_at IS NULL
            LIMIT 1;
          `;

          if (loadingRows.length === 0) {
            throw new Error("Specified Loading Record was not found.");
          }

          const lr = loadingRows[0];
          effectivePoId = lr.purchase_order_id;
          countryId = lr.country_id;
          countryBranchId = lr.country_branch_id;
          cityBranchId = lr.city_branch_id;

          const totalLoaded = Number(lr.loaded_quantity || 0);

          // Sum existing transfers from this loading record
          const priorTransfers = await sql`
            SELECT COALESCE(SUM(quantity), 0) as transferred
            FROM public.journal_stock_transfers
            WHERE loading_record_id = ${loadingRecordId}::uuid
              AND deleted_at IS NULL;
          `;
          const alreadyTransferred = Number(priorTransfers[0]?.transferred || 0);
          availableBalance = Math.max(0, totalLoaded - alreadyTransferred);

          if (quantity > availableBalance + 0.0001) {
            throw new Error(`Transfer quantity (${quantity} ${unit}) exceeds available Loading Stock (${availableBalance.toFixed(2)} ${unit}).`);
          }
        } else {
          // No loading record specified, must check PO
          const validPoId = purchaseOrderId ?? null;
          const poRows = await sql`
            SELECT po.*
            FROM public.purchase_orders po
            WHERE po.id = ${validPoId}::uuid AND po.deleted_at IS NULL
            LIMIT 1;
          `;
          if (poRows.length === 0) throw new Error("Purchase Order not found.");
          countryId = poRows[0].country_id;
          countryBranchId = poRows[0].country_branch_id;
          cityBranchId = poRows[0].city_branch_id;
        }
      } else {
        // Local Purchase source
        if (!localPurchaseId) {
          throw new Error("Local purchase ID is required for local purchase transfer.");
        }

        const validLpId = localPurchaseId;
        const lpRows = await sql`
          SELECT lp.*
          FROM public.local_purchases lp
          WHERE lp.id = ${validLpId}::uuid AND lp.deleted_at IS NULL
          LIMIT 1;
        `;

        if (lpRows.length === 0) {
          throw new Error("Local Purchase record was not found.");
        }

        const lp = lpRows[0];
        countryId = lp.country_id;
        countryBranchId = lp.country_branch_id;
        cityBranchId = lp.city_branch_id;
        effectiveLpId = lp.id;

        const totalQty = Number(lp.quantity_kgs || lp.total_quantity || 0);

        const priorTransfers = await sql`
          SELECT COALESCE(SUM(quantity), 0) as transferred
          FROM public.journal_stock_transfers
          WHERE local_purchase_id = ${validLpId}::uuid
            AND deleted_at IS NULL;
        `;
        const alreadyTransferred = Number(priorTransfers[0]?.transferred || 0);
        availableBalance = Math.max(0, totalQty - alreadyTransferred);

        if (quantity > availableBalance + 0.0001) {
          throw new Error(`Transfer quantity (${quantity} ${unit}) exceeds available Local Purchase stock (${availableBalance.toFixed(2)} ${unit}).`);
        }
      }

      // 2. Validate warehouse if warehouse transfer
      let warehouseName: string | null = null;
      if (destinationType === "warehouse") {
        const validWhId = warehouseId ?? null;
        const whRows = await sql`
          SELECT id, warehouse_name
          FROM public.warehouses
          WHERE id = ${validWhId}::uuid AND deleted_at IS NULL
          LIMIT 1;
        `;
        if (whRows.length === 0) {
          throw new Error("Selected destination Warehouse was not found.");
        }
        warehouseName = whRows[0].warehouse_name;
      }

      // 3. Generate sequential / unique transfer number
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const countRes = await sql`
        SELECT COUNT(*) as count
        FROM public.journal_stock_transfers
        WHERE created_at >= CURRENT_DATE;
      `;
      const seq = Number(countRes[0]?.count || 0) + 1;
      const transferNo = `TRF-${datePrefix}-${String(seq).padStart(4, "0")}`;

      const tDate = transferDate ? new Date(transferDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

      // 4. Insert Stock Transfer Record
      const inserted = await sql`
        INSERT INTO public.journal_stock_transfers (
          transfer_no,
          purchase_order_id,
          local_purchase_id,
          loading_record_id,
          source_stage,
          destination_type,
          warehouse_id,
          quantity,
          goods_name,
          unit,
          country_id,
          country_branch_id,
          city_branch_id,
          reference_no,
          transfer_date,
          remarks,
          created_by
        ) VALUES (
          ${transferNo},
          ${effectivePoId ? sql`${effectivePoId}::uuid` : null},
          ${effectiveLpId ? sql`${effectiveLpId}::uuid` : null},
          ${loadingRecordId ? sql`${loadingRecordId}::uuid` : null},
          'loading',
          ${destinationType},
          ${warehouseId ? sql`${warehouseId}::uuid` : null},
          ${quantity},
          ${goodsName},
          ${unit},
          ${countryId ? sql`${countryId}::uuid` : null},
          ${countryBranchId ? sql`${countryBranchId}::uuid` : null},
          ${cityBranchId ? sql`${cityBranchId}::uuid` : null},
          ${referenceNo || null},
          ${tDate}::date,
          ${remarks || null},
          ${session.userId ? sql`${session.userId}::uuid` : null}
        )
        RETURNING *;
      `;

      // 5. If transferred to warehouse, optionally sync to stock_movements for warehouse stock tracking
      if (destinationType === "warehouse" && warehouseId) {
        try {
          const goodsRows = await sql`
            SELECT id FROM public.goods WHERE LOWER(goods_name) = LOWER(${goodsName}) AND deleted_at IS NULL LIMIT 1;
          `;
          const goodsId = goodsRows[0]?.id || null;

          if (goodsId) {
            await sql`
              INSERT INTO public.stock_movements (
                movement_type,
                goods_id,
                warehouse_id,
                country_id,
                country_branch_id,
                city_branch_id,
                quantity,
                reference_no,
                notes,
                movement_date,
                created_by,
                purchase_order_id,
                loading_record_id
              ) VALUES (
                'STOCK_IN',
                ${goodsId}::uuid,
                ${warehouseId}::uuid,
                ${countryId ? sql`${countryId}::uuid` : null},
                ${countryBranchId ? sql`${countryBranchId}::uuid` : null},
                ${cityBranchId ? sql`${cityBranchId}::uuid` : null},
                ${quantity},
                ${transferNo},
                ${`Stock Transfer from Loading (${destinationType}): ${remarks || ""}`},
                NOW(),
                ${session.userId ? sql`${session.userId}::uuid` : null},
                ${effectivePoId ? sql`${effectivePoId}::uuid` : null},
                ${loadingRecordId ? sql`${loadingRecordId}::uuid` : null}
              );
            `;
          }
        } catch (smErr) {
          console.warn("[JournalStockTransfer] Non-fatal stock_movement sync skip:", smErr);
        }
      }

      return {
        transfer: inserted[0],
        transferNo,
        destinationType,
        warehouseName,
        quantity,
        remainingLoadingStock: availableBalance - quantity,
        language: lang
      };
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
