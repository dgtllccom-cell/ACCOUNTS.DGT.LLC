export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import postgres from "postgres";

const migrationSql = `
CREATE TABLE IF NOT EXISTS local_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  country_id uuid REFERENCES countries(id),
  country_branch_id uuid REFERENCES country_branches(id),
  city_branch_id uuid REFERENCES city_branches(id),
  goods_id uuid REFERENCES goods(id),
  purchase_account_no text,
  sales_account_no text,
  broker_account_no text,
  brand text,
  size text,
  chassis_code text,
  goods_name text NOT NULL,
  supplier_name text,
  payment_mode text DEFAULT 'Cash',
  shipping_mode text DEFAULT 'Local Market',
  origin_country_id uuid REFERENCES countries(id),
  origin_country_name text DEFAULT 'Local',
  advance_percentage numeric(5, 2) DEFAULT 0,
  advance_amount numeric(18, 4) DEFAULT 0,
  remaining_balance numeric(18, 4) DEFAULT 0,
  warehouse_name text,
  warehouse_plot_no text,
  transfer_date text,
  truck_no text,
  driver_name text,
  quantity_name text NOT NULL DEFAULT 'Bags',
  quantity_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  total_gross_weight numeric(18, 4) NOT NULL DEFAULT 0,
  empty_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  net_weight numeric(18, 4) NOT NULL DEFAULT 0,
  divide_kgs numeric(18, 4) NOT NULL DEFAULT 0,
  numbers numeric(18, 4) NOT NULL DEFAULT 0,
  rate_type text NOT NULL DEFAULT 'per_kg',
  purchase_rate numeric(18, 4) NOT NULL DEFAULT 0,
  purchase_currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(18, 8) NOT NULL DEFAULT 1,
  local_currency text NOT NULL DEFAULT 'PKR',
  purchase_cost numeric(18, 4) NOT NULL DEFAULT 0,
  apply_tax text DEFAULT 'No',
  tax_type text DEFAULT 'VAT',
  tax_percentage numeric(5, 2) DEFAULT 0,
  tax_amount numeric(18, 4) DEFAULT 0,
  final_cost numeric(18, 4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  manual_bill_no text,
  journal_serial_no text,
  country_serial_no text,
  branch_serial_no text,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES profiles(id),
  transferred_at timestamptz,
  journal_entry_id uuid,
  roznamcha_entry_id uuid,
  goods_receipt_type text,
  goods_receipt_status text DEFAULT 'Pending Receipt',
  goods_receipt_details jsonb DEFAULT '{}'::jsonb,
  goods_received_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE local_purchases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'local_purchases' 
    AND policyname = 'local_purchases_all'
  ) THEN
    CREATE POLICY local_purchases_all ON local_purchases FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
`;

async function ensureTableExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  const sqlClient = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const res = await sqlClient`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'local_purchases'
      );
    `;
    if (!res[0]?.exists) {
      await sqlClient.unsafe(migrationSql);
      console.log("local_purchases table created through self-healing migration.");
    } else {
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS purchase_account_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS sales_account_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS broker_account_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS brand text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS size text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS chassis_code text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'Cash';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS shipping_mode text DEFAULT 'Local Market';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS origin_country_id uuid;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS origin_country_name text DEFAULT 'Local';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS advance_percentage numeric(5, 2) DEFAULT 0;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS advance_amount numeric(18, 4) DEFAULT 0;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS remaining_balance numeric(18, 4) DEFAULT 0;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS warehouse_name text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS warehouse_plot_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS transfer_date text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS truck_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS driver_name text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS lot_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS apply_tax text DEFAULT 'No';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'VAT';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS tax_percentage numeric(5, 2) DEFAULT 0;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS tax_amount numeric(18, 4) DEFAULT 0;
      `;
      // Phase 1: Workflow status & serial number columns
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS manual_bill_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS journal_serial_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS country_serial_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS branch_serial_no text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS accepted_by uuid;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS transferred_at timestamptz;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS roznamcha_entry_id uuid;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS debit_journal_serial text;
      `;
      await sqlClient`
        ALTER TABLE local_purchases ADD COLUMN IF NOT EXISTS credit_journal_serial text;
      `;
    }
  } catch (err) {
    console.error("Auto migration check failed:", err);
  } finally {
    await sqlClient.end();
  }
}

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
    await ensureTableExists();
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
    await ensureTableExists();
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
    await ensureTableExists();
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
