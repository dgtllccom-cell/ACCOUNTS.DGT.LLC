export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { deriveLocalPurchasePostingState } from "@/lib/services/local-purchase-posting-state";
import { z } from "zod";


// NOTE: Schema for local_purchases table is managed via Supabase migrations
// (see supabase/migrations/0076_local_purchases.sql and the main schema).
// Self-healing runtime migrations have been removed for production performance.


const listQuerySchema = z.object({
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().optional(),
  cityBranchId: z.string().uuid().optional(),
  status: z.enum(["draft", "accepted", "transferred", "posted"]).optional(),
});

const localPurchaseCreateSchema = z.object({
  companyId: z.string().uuid(),
  countryId: z.string().uuid(),
  countryBranchId: z.string().uuid(),
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

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);

    const params = listQuerySchema.parse({
      countryId: url.searchParams.get("countryId") || undefined,
      countryBranchId: url.searchParams.get("countryBranchId") || undefined,
      cityBranchId: url.searchParams.get("cityBranchId") || undefined,
      status: (url.searchParams.get("status") as any) || undefined,
    });

    authorizeApiScope(session, {
      resource: "purchases",
      action: "read",
      countryId: params.countryId ?? null,
      countryBranchId: params.countryBranchId ?? null,
      cityBranchId: params.cityBranchId ?? null,
    });

    const matchesScope = (row: any) => {
      if (params.cityBranchId) return String(row.city_branch_id || "") === params.cityBranchId;
      if (params.countryBranchId) return String(row.country_branch_id || "") === params.countryBranchId;
      if (params.countryId) return String(row.country_id || "") === params.countryId;

      if (session.isSuperAdmin) return true;
      const countryId = String(row.country_id || "");
      const countryBranchId = String(row.country_branch_id || "");
      const cityBranchId = String(row.city_branch_id || "");

      if (session.cityBranchIds.length > 0) {
        return (
          (cityBranchId && session.cityBranchIds.includes(cityBranchId)) ||
          (!cityBranchId && session.countryIds.includes(countryId)) ||
          (!cityBranchId && !countryBranchId && session.countryIds.includes(countryId))
        );
      }
      if (session.countryBranchIds.length > 0) {
        return session.countryBranchIds.includes(countryBranchId);
      }
      if (session.countryIds.length > 0) {
        return session.countryIds.includes(countryId);
      }
      return false;
    };

    const recordsViaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select *
        from local_purchases
        where deleted_at is null
        order by created_at desc;
      `;
      return rows
        .filter(matchesScope)
        .filter((row: any) => !params.status || String(row.status || "").toLowerCase() === params.status)
        .map((row: any) => {
          const postingState = deriveLocalPurchasePostingState(row);
          return {
            ...row,
            accounting_status: postingState.visualStatus,
            accounting_status_label: postingState.label,
            accounting_status_reason: postingState.reason,
          };
        });
    });

    if (recordsViaPg === null) {
      const supabase = createSupabaseAdminClient();
      let queryBuilder = (supabase as any).from("local_purchases")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (params.status) {
        queryBuilder = queryBuilder.eq("status", params.status);
      }
      if (params.countryId) {
        queryBuilder = queryBuilder.eq("country_id", params.countryId);
      }
      if (params.countryBranchId) {
        queryBuilder = queryBuilder.eq("country_branch_id", params.countryBranchId);
      }
      if (params.cityBranchId) {
        queryBuilder = queryBuilder.eq("city_branch_id", params.cityBranchId);
      }

      const { data: fallbackRecords, error } = await queryBuilder;
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        data: {
          purchases: (fallbackRecords ?? []).map((row: any) => {
            const postingState = deriveLocalPurchasePostingState(row);
            return {
              ...row,
              accounting_status: postingState.visualStatus,
              accounting_status_label: postingState.label,
              accounting_status_reason: postingState.reason,
            };
          })
        }
      });
    }

    return NextResponse.json({
      ok: true,
      data: { purchases: recordsViaPg }
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const payload = localPurchaseCreateSchema.parse(body);

    authorizeApiScope(session, {
      resource: "purchases",
      action: "create",
      countryId: payload.countryId,
      countryBranchId: payload.countryBranchId,
      cityBranchId: payload.cityBranchId ?? null,
    });

    const insertedViaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        insert into public.local_purchases (
          company_id, country_id, country_branch_id, city_branch_id,
          goods_id, purchase_account_no, sales_account_no, broker_account_no,
          brand, size, chassis_code, lot_no, goods_name, supplier_name,
          payment_mode, shipping_mode, origin_country_id, origin_country_name,
          advance_percentage, advance_amount, remaining_balance,
          warehouse_name, warehouse_id, supplier_person_id, warehouse_plot_no,
          transfer_date, truck_no, driver_name, quantity_name,
          quantity_kgs, total_gross_weight, empty_kgs, net_weight, divide_kgs, numbers,
          rate_type, purchase_rate, purchase_currency, exchange_rate, local_currency,
          purchase_cost, apply_tax, tax_type, tax_percentage, tax_amount, final_cost,
          status, created_by
        ) values (
          ${payload.companyId}, ${payload.countryId}, ${payload.countryBranchId},
          ${payload.cityBranchId || null}, ${payload.goodsId || null},
          ${payload.purchaseAccountNo || null}, ${payload.salesAccountNo || null},
          ${payload.brokerAccountNo || null}, ${payload.brand || null},
          ${payload.size || null}, ${payload.chassisCode || null}, ${payload.lotNo || null},
          ${payload.goodsName}, ${payload.supplierName || null},
          ${payload.paymentMode || "Cash"}, ${payload.shippingMode || "Local Market"},
          ${payload.originCountryId || null}, ${payload.originCountryName || "Local"},
          ${payload.advancePercentage || 0}, ${payload.advanceAmount || 0},
          ${payload.remainingBalance || 0}, ${payload.warehouseName || null},
          ${payload.warehouseId || null}, ${payload.supplierPersonId || null},
          ${payload.warehousePlotNo || null}, ${payload.transferDate || null},
          ${payload.truckNo || null}, ${payload.driverName || null}, ${payload.quantityName},
          ${payload.quantityKgs}, ${payload.totalGrossWeight}, ${payload.emptyKgs},
          ${payload.netWeight}, ${payload.divideKgs}, ${payload.numbers},
          ${payload.rateType}, ${payload.purchaseRate}, ${payload.purchaseCurrency},
          ${payload.exchangeRate}, ${payload.localCurrency}, ${payload.purchaseCost},
          ${payload.applyTax || "No"}, ${payload.taxType || "VAT"},
          ${payload.taxPercentage || 0}, ${payload.taxAmount || 0}, ${payload.finalCost},
          'draft', ${session.userId}
        )
        returning *
      `;
      return rows[0] ?? null;
    });

    let inserted = insertedViaPg;
    if (!inserted) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await (supabase as any).from("local_purchases").insert({
        company_id: payload.companyId, country_id: payload.countryId,
        country_branch_id: payload.countryBranchId, city_branch_id: payload.cityBranchId || null,
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
        final_cost: payload.finalCost, status: "draft", created_by: session.userId,
      }).select().single();
      if (error) throw error;
      inserted = data;
    }

    if (!inserted) throw new Error("Failed to insert local purchase record");

    // Synchronous 5-language database storage across dedicated tables
    try {
      const { syncRecordTranslations } = await import("@/lib/i18n/record-translation-sync");
      await syncRecordTranslations({
        table: "local_purchases",
        recordId: inserted.id,
        record: inserted,
      });
    } catch (i18nErr) {
      console.warn("Multilingual sync notice:", i18nErr);
    }

    return NextResponse.json({
      ok: true,
      data: { purchase: inserted }
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

const localGoodsReceiptSchema = z.object({
  purchaseId: z.string().uuid(),
  receiptType: z.enum(["warehouse", "loading", "export"]),
  status: z.string().min(1),
  details: z.record(z.string(), z.any()).default({}),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const payload = localGoodsReceiptSchema.parse(await request.json());

    let purchase = await withLocalPg(async (sql) => {
      const rows = await sql`
        select id, country_id, country_branch_id, city_branch_id
        from local_purchases
        where id = ${payload.purchaseId}
          and deleted_at is null
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (!purchase) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await (supabase as any).from("local_purchases")
        .select("id,country_id,country_branch_id,city_branch_id")
        .eq("id", payload.purchaseId)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      if (!data) throw new Error("Local purchase record not found");
      purchase = data;
    }

    if (!purchase) throw new Error("Local purchase record not found");

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: purchase.country_id ?? null,
      countryBranchId: purchase.country_branch_id ?? null,
      cityBranchId: purchase.city_branch_id ?? null,
    });

    const now = new Date().toISOString();
    const updated = await withLocalPg(async (sql) => {
      const rows = await sql`
        update local_purchases set
          goods_receipt_type   = ${payload.receiptType},
          goods_receipt_status = ${payload.status},
          goods_receipt_details = ${JSON.stringify(payload.details)}::jsonb,
          goods_received_at    = ${now},
          updated_at           = ${now}
        where id = ${payload.purchaseId}
        returning *
      `;
      return rows[0] ?? null;
    });

    if (!updated) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await (supabase as any).from("local_purchases")
        .update({
          goods_receipt_type: payload.receiptType,
          goods_receipt_status: payload.status,
          goods_receipt_details: payload.details,
          goods_received_at: now,
          updated_at: now,
        })
        .eq("id", payload.purchaseId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, data: { purchase: data } });
    }

    return NextResponse.json({ ok: true, data: { purchase: updated } });
  } catch (err: any) {
    return handleApiError(err);
  }
}
