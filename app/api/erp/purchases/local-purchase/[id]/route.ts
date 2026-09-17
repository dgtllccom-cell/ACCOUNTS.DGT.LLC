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
  purchaseAccountNo: z.string().trim().min(1, "A debit purchase ledger is required."),
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
}).refine(
  (value) => Boolean(value.salesAccountNo?.trim() || value.brokerAccountNo?.trim()),
  { path: ["salesAccountNo"], message: "A credit sales/payable ledger is required." },
);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    const payload = localPurchaseUpdateSchema.parse(await request.json());

    const isSuperAdmin = Boolean(
      session.isSuperAdmin ||
      (session as any).scopes?.isSuperAdmin ||
      session.roles?.includes("super_admin") ||
      (session as any).role === "super_admin"
    );

    const existing = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, country_id, country_branch_id, city_branch_id, status,
               roznamcha_entry_id, journal_entry_id, journal_serial_no
        from public.local_purchases
        where id = ${id}::uuid and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });
    if (!existing) throw new ApiClientError("Local purchase record not found", { status: 404, code: "NOT_FOUND" });

    const isDraft = String((existing as any).status || "").toLowerCase() === "draft";
    if (!isDraft && !isSuperAdmin) {
      throw new ApiClientError(
        "Only a draft purchase can be edited. Accepted or transferred records require Super Admin privileges.",
        { status: 403, code: "SUPER_ADMIN_REQUIRED" }
      );
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
      const statusFilter = isSuperAdmin ? sql`` : sql`and status = 'draft'`;
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
        where id = ${id}::uuid and deleted_at is null ${statusFilter}
        returning *
      `;
      return rows[0] ?? null;
    });

    let updated = updatedViaPg;
    if (!updated) {
      const supabase = createSupabaseAdminClient();
      let query = (supabase as any).from("local_purchases").update({
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
      }).eq("id", id).is("deleted_at", null);

      if (!isSuperAdmin) {
        query = query.eq("status", "draft");
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      updated = data;
    }

    if (!updated) throw new ApiClientError("Local purchase record not found or update not permitted", { status: 404, code: "NOT_FOUND" });

    // Cascade updates to downstream Roznamcha and Journal records if this purchase was already transferred/posted
    const rozEntryId = (existing as any).roznamcha_entry_id || (updated as any).roznamcha_entry_id;
    if (rozEntryId) {
      try {
        const finalCost = Number(payload.finalCost || 0);
        const exchangeRate = Number(payload.exchangeRate || 1);
        const baseAmount = finalCost * exchangeRate;
        const rozDesc = `Local Purchase: ${payload.goodsName} - ${payload.supplierName || "Local Vendor"} | ${payload.localCurrency} ${finalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} [${payload.paymentMode || "Cash"}]`;

        await withLocalPg(async (sql) => {
          await sql`
            update public.roznamcha_entries
            set base_currency_amount = ${baseAmount},
                narration = ${rozDesc},
                updated_at = now()
            where id = ${rozEntryId}::uuid
          `;
          await sql`
            update public.roznamcha_lines
            set debit = ${finalCost},
                description = ${`DR: Local Purchase - ${payload.goodsName}`}
            where roznamcha_entry_id = ${rozEntryId}::uuid and debit > 0
          `;
          await sql`
            update public.roznamcha_lines
            set credit = ${finalCost},
                description = ${`CR: Payable - ${payload.supplierName || "Local Vendor"}`}
            where roznamcha_entry_id = ${rozEntryId}::uuid and credit > 0
          `;
        });
      } catch (rozSyncErr) {
        console.warn("[LocalPurchase PATCH] Roznamcha cascade sync warning:", rozSyncErr);
      }
    }

    const jEntryId = (existing as any).journal_entry_id || (updated as any).journal_entry_id;
    if (jEntryId) {
      try {
        const finalCost = Number(payload.finalCost || 0);
        const jMemo = `Local Purchase - ${payload.supplierName || "Local Vendor"} (${payload.goodsName}) [${payload.paymentMode || "Cash"}]`;

        await withLocalPg(async (sql) => {
          await sql`
            update public.journal_entries
            set memo = ${jMemo},
                updated_at = now()
            where id = ${jEntryId}::uuid
          `;
          await sql`
            update public.journal_lines
            set debit = ${finalCost},
                description = ${`DR: Local Purchase - ${payload.goodsName}`}
            where journal_entry_id = ${jEntryId}::uuid and debit > 0
          `;
          await sql`
            update public.journal_lines
            set credit = ${finalCost},
                description = ${`CR: Payable - ${payload.supplierName || "Local Vendor"} [${payload.paymentMode || "Cash"}]`}
            where journal_entry_id = ${jEntryId}::uuid and credit > 0
          `;
        });
      } catch (jSyncErr) {
        console.warn("[LocalPurchase PATCH] Journal cascade sync warning:", jSyncErr);
      }
    }

    try {
      const { syncRecordTranslations } = await import("@/lib/i18n/record-translation-sync");
      await syncRecordTranslations({ table: "local_purchases", recordId: updated.id, record: updated });
    } catch (i18nErr) {
      console.warn("Multilingual sync notice:", i18nErr);
    }

    return NextResponse.json({ ok: true, data: { purchase: updated, cascaded: Boolean(rozEntryId || jEntryId) } });
  } catch (err: any) {
    return handleApiError(err);
  }
}
