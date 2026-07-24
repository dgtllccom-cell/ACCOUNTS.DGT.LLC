export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

    const { data: records, error } = await queryBuilder;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: { purchases: records }
    });
  } catch (err: any) {
    console.error("[GET /api/erp/purchases/local-purchase] Error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err.message || "Failed to fetch local purchases" } },
      { status: 500 }
    );
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

    const supabase = createSupabaseAdminClient();
    const { data: inserted, error } = await (supabase as any).from("local_purchases")
      .insert({
        company_id: payload.companyId,
        country_id: payload.countryId,
        country_branch_id: payload.countryBranchId,
        city_branch_id: payload.cityBranchId || null,
        goods_id: payload.goodsId || null,
        purchase_account_no: payload.purchaseAccountNo || null,
        sales_account_no: payload.salesAccountNo || null,
        broker_account_no: payload.brokerAccountNo || null,
        brand: payload.brand || null,
        size: payload.size || null,
        chassis_code: payload.chassisCode || null,
        lot_no: payload.lotNo || null,
        goods_name: payload.goodsName,
        supplier_name: payload.supplierName || null,
        payment_mode: payload.paymentMode || "Cash",
        shipping_mode: payload.shippingMode || "Local Market",
        origin_country_id: payload.originCountryId || null,
        origin_country_name: payload.originCountryName || "Local",
        advance_percentage: payload.advancePercentage || 0,
        advance_amount: payload.advanceAmount || 0,
        remaining_balance: payload.remainingBalance || 0,
        warehouse_name: payload.warehouseName || null,
        warehouse_plot_no: payload.warehousePlotNo || null,
        transfer_date: payload.transferDate || null,
        truck_no: payload.truckNo || null,
        driver_name: payload.driverName || null,
        quantity_name: payload.quantityName,
        quantity_kgs: payload.quantityKgs,
        total_gross_weight: payload.totalGrossWeight,
        empty_kgs: payload.emptyKgs,
        net_weight: payload.netWeight,
        divide_kgs: payload.divideKgs,
        numbers: payload.numbers,
        rate_type: payload.rateType,
        purchase_rate: payload.purchaseRate,
        purchase_currency: payload.purchaseCurrency,
        exchange_rate: payload.exchangeRate,
        local_currency: payload.localCurrency,
        purchase_cost: payload.purchaseCost,
        apply_tax: payload.applyTax || "No",
        tax_type: payload.taxType || "VAT",
        tax_percentage: payload.taxPercentage || 0,
        tax_amount: payload.taxAmount || 0,
        final_cost: payload.finalCost,
        status: "draft",
        created_by: session.userId,
      })
      .select()
      .single();

    if (error) throw error;

    // NOTE: Journal posting has been moved to the /accept and /transfer endpoints.
    // Bills are saved as 'draft' here. The workflow is:
    // Draft → Accept (generates serial numbers) → Transfer (posts to journal/roznamcha/ledger)

    return NextResponse.json({
      ok: true,
      data: { purchase: inserted }
    });
  } catch (err: any) {
    console.error("[POST /api/erp/purchases/local-purchase] Error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err.message || "Failed to save local purchase" } },
      { status: 500 }
    );
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
    const supabase = createSupabaseAdminClient();

    const { data: purchase, error: fetchError } = await (supabase as any).from("local_purchases")
      .select("id,country_id,country_branch_id,city_branch_id")
      .eq("id", payload.purchaseId)
      .is("deleted_at", null)
      .single();

    if (fetchError) throw fetchError;

    authorizeApiScope(session, {
      resource: "purchases",
      action: "update",
      countryId: purchase.country_id ?? null,
      countryBranchId: purchase.country_branch_id ?? null,
      cityBranchId: purchase.city_branch_id ?? null,
    });

    const { data: updated, error } = await (supabase as any).from("local_purchases")
      .update({
        goods_receipt_type: payload.receiptType,
        goods_receipt_status: payload.status,
        goods_receipt_details: payload.details,
        goods_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.purchaseId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data: { purchase: updated } });
  } catch (err: any) {
    console.error("[PATCH /api/erp/purchases/local-purchase] Error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err.message || "Failed to update local goods receipt" } },
      { status: 500 }
    );
  }
}
