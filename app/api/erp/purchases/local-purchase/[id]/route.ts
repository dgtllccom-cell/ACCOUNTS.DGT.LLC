export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertBusinessCityBranch } from "@/lib/api/branch-scope-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { z } from "zod";

/**
 * Full-field update for a DRAFT local purchase, by its real id. The base
 * /api/erp/purchases/local-purchase route only exposes POST (create) and a
 * narrow PATCH for goods-receipt confirmation — there was no way to persist
 * an edited draft's own fields, so "Edit Draft" in local-purchase-view.tsx
 * always POSTed a brand-new record and left the original draft orphaned.
 * This mirrors the POST route's column list so create and edit stay in sync.
 */
const localPurchaseUpdateSchema = z.object({
  countryBranchId: z.string().uuid().optional(),
  cityBranchId: z.string().uuid().nullable().optional(),
  goodsId: z.string().uuid().nullable().optional(),
  purchaseAccountNo: z.string().nullable().optional(),
  salesAccountNo: z.string().nullable().optional(),
  brokerAccountNo: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  chassisCode: z.string().nullable().optional(),
  lotNo: z.string().nullable().optional(),
  goodsName: z.string().min(1),
  supplierName: z.string().nullable().optional(),
  paymentMode: z.string().default("Cash"),
  shippingMode: z.string().default("Local Market"),
  originCountryId: z.string().uuid().nullable().optional(),
  originCountryName: z.string().default("Local"),
  advancePercentage: z.coerce.number().default(0),
  advanceAmount: z.coerce.number().default(0),
  remainingBalance: z.coerce.number().default(0),
  warehouseName: z.string().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  supplierPersonId: z.string().uuid().nullable().optional(),
  warehousePlotNo: z.string().nullable().optional(),
  transferDate: z.string().nullable().optional(),
  truckNo: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  quantityName: z.string().default("Bags"),
  quantityKgs: z.coerce.number().min(0),
  totalGrossWeight: z.coerce.number().min(0),
  emptyKgs: z.coerce.number().min(0),
  netWeight: z.coerce.number().min(0),
  divideKgs: z.coerce.number().min(0),
  numbers: z.coerce.number().min(0),
  rateType: z.string().default("per_kg"),
  purchaseRate: z.coerce.number().min(0),
  purchaseCurrency: z.string().default("USD"),
  exchangeRate: z.coerce.number().min(0),
  localCurrency: z.string().default("PKR"),
  purchaseCost: z.coerce.number().min(0),
  applyTax: z.string().default("No"),
  taxType: z.string().default("VAT"),
  taxPercentage: z.coerce.number().default(0),
  taxAmount: z.coerce.number().default(0),
  finalCost: z.coerce.number().min(0),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const payload = localPurchaseUpdateSchema.parse(await request.json());

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, country_id, country_branch_id, city_branch_id, status
        from public.local_purchases
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });
    if (!existing) throw new ApiClientError("Local purchase record not found", { status: 404, code: "NOT_FOUND" });

    // Only a draft can be edited through this form — once accepted/transferred
    // the record has already moved into the accounting/payment pipeline.
    if (String((existing as any).status || "").toLowerCase() !== "draft") {
      throw new ApiClientError("Only a draft purchase can be edited. Accepted/transferred records are read-only here.", { status: 409, code: "NOT_DRAFT" });
    }

    const countryBranchId = payload.countryBranchId ?? (existing as any).country_branch_id;
    const cityBranchId = payload.cityBranchId !== undefined ? payload.cityBranchId : (existing as any).city_branch_id;

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: (existing as any).country_id,
      countryBranchId,
      cityBranchId: cityBranchId ?? null,
    });
    await assertBusinessCityBranch(cityBranchId ?? null);

    const updatedViaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        update public.local_purchases set
          country_branch_id = ${countryBranchId}, city_branch_id = ${cityBranchId || null},
          goods_id = ${payload.goodsId || null}, purchase_account_no = ${payload.purchaseAccountNo || null},
          sales_account_no = ${payload.salesAccountNo || null}, broker_account_no = ${payload.brokerAccountNo || null},
          brand = ${payload.brand || null}, size = ${payload.size || null},
          chassis_code = ${payload.chassisCode || null}, lot_no = ${payload.lotNo || null},
          goods_name = ${payload.goodsName}, supplier_name = ${payload.supplierName || null},
          payment_mode = ${payload.paymentMode || "Cash"}, shipping_mode = ${payload.shippingMode || "Local Market"},
          origin_country_id = ${payload.originCountryId || null}, origin_country_name = ${payload.originCountryName || "Local"},
          advance_percentage = ${payload.advancePercentage || 0}, advance_amount = ${payload.advanceAmount || 0},
          remaining_balance = ${payload.remainingBalance || 0}, warehouse_name = ${payload.warehouseName || null},
          warehouse_id = ${payload.warehouseId || null}, supplier_person_id = ${payload.supplierPersonId || null},
          warehouse_plot_no = ${payload.warehousePlotNo || null}, transfer_date = ${payload.transferDate || null},
          truck_no = ${payload.truckNo || null}, driver_name = ${payload.driverName || null},
          quantity_name = ${payload.quantityName}, quantity_kgs = ${payload.quantityKgs},
          total_gross_weight = ${payload.totalGrossWeight}, empty_kgs = ${payload.emptyKgs},
          net_weight = ${payload.netWeight}, divide_kgs = ${payload.divideKgs}, numbers = ${payload.numbers},
          rate_type = ${payload.rateType}, purchase_rate = ${payload.purchaseRate},
          purchase_currency = ${payload.purchaseCurrency}, exchange_rate = ${payload.exchangeRate},
          local_currency = ${payload.localCurrency}, purchase_cost = ${payload.purchaseCost},
          apply_tax = ${payload.applyTax || "No"}, tax_type = ${payload.taxType || "VAT"},
          tax_percentage = ${payload.taxPercentage || 0}, tax_amount = ${payload.taxAmount || 0},
          final_cost = ${payload.finalCost}, updated_at = now()
        where id = ${id}::uuid and deleted_at is null and status = 'draft'
        returning *
      `;
      return rows[0] ?? null;
    });

    let updated = updatedViaPg;
    if (!updated) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await (supabase as any).from("local_purchases").update({
        country_branch_id: countryBranchId, city_branch_id: cityBranchId || null,
        goods_id: payload.goodsId || null, purchase_account_no: payload.purchaseAccountNo || null,
        sales_account_no: payload.salesAccountNo || null, broker_account_no: payload.brokerAccountNo || null,
        brand: payload.brand || null, size: payload.size || null, chassis_code: payload.chassisCode || null,
        lot_no: payload.lotNo || null, goods_name: payload.goodsName, supplier_name: payload.supplierName || null,
        payment_mode: payload.paymentMode || "Cash", shipping_mode: payload.shippingMode || "Local Market",
        origin_country_id: payload.originCountryId || null, origin_country_name: payload.originCountryName || "Local",
        advance_percentage: payload.advancePercentage || 0, advance_amount: payload.advanceAmount || 0,
        remaining_balance: payload.remainingBalance || 0, warehouse_name: payload.warehouseName || null,
        warehouse_id: payload.warehouseId || null, supplier_person_id: payload.supplierPersonId || null,
        warehouse_plot_no: payload.warehousePlotNo || null, transfer_date: payload.transferDate || null,
        truck_no: payload.truckNo || null, driver_name: payload.driverName || null,
        quantity_name: payload.quantityName, quantity_kgs: payload.quantityKgs,
        total_gross_weight: payload.totalGrossWeight, empty_kgs: payload.emptyKgs,
        net_weight: payload.netWeight, divide_kgs: payload.divideKgs, numbers: payload.numbers,
        rate_type: payload.rateType, purchase_rate: payload.purchaseRate,
        purchase_currency: payload.purchaseCurrency, exchange_rate: payload.exchangeRate,
        local_currency: payload.localCurrency, purchase_cost: payload.purchaseCost,
        apply_tax: payload.applyTax || "No", tax_type: payload.taxType || "VAT",
        tax_percentage: payload.taxPercentage || 0, tax_amount: payload.taxAmount || 0,
        final_cost: payload.finalCost, updated_at: new Date().toISOString(),
      }).eq("id", id).is("deleted_at", null).eq("status", "draft").select().single();
      if (error) throw error;
      updated = data;
    }

    if (!updated) throw new ApiClientError("Local purchase record not found or no longer a draft", { status: 404, code: "NOT_FOUND" });

    try {
      const { syncRecordTranslations } = await import("@/lib/i18n/record-translation-sync");
      await syncRecordTranslations({ table: "local_purchases", recordId: updated.id, record: updated });
    } catch (i18nErr) {
      console.warn("Multilingual sync notice:", i18nErr);
    }

    return NextResponse.json({ ok: true, data: { purchase: updated } });
  } catch (err: any) {
    return handleApiError(err);
  }
}
