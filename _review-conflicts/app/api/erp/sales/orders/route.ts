import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { optionalUuidSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import postgres from "postgres";

async function ensureTableExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  const sqlClient = postgres(dbUrl, { max: 1, prepare: false });
  try {
    await sqlClient`
      ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS transfer_date text;
    `;
    await sqlClient`
      ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS transfer_user text;
    `;
    await sqlClient`
      ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS transfer_serial_number text;
    `;
  } catch (err) {
    console.error("Auto migration check for sales_orders failed:", err);
  } finally {
    await sqlClient.end();
  }
}

const salesOrderSchema = z.object({
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  customerAccountId: optionalUuidSchema,
  customerLedgerId: optionalUuidSchema,
  purchaseOrderId: optionalUuidSchema,
  salesOrderNo: z.string().trim().min(1).max(120).optional(),
  salesContractNo: z.string().trim().max(120).optional().nullable(),
  orderDate: z.string().date().optional(),
  customerName: z.string().trim().max(200).optional().nullable(),
  accountNumber: z.string().trim().max(120).optional().nullable(),
  manualReferenceNumber: z.string().trim().max(120).optional().nullable(),
  customerNumber: z.string().trim().max(120).optional().nullable(),
  countrySerialNumber: z.string().trim().max(120).optional().nullable(),
  branchSerialNumber: z.string().trim().max(120).optional().nullable(),
  productSummary: z.string().trim().max(1000).optional().nullable(),
  quantity: z.coerce.number().finite().min(0).default(0),
  totalWeight: z.coerce.number().finite().min(0).default(0),
  currencyCode: z.string().trim().min(2).max(10).default("USD"),
  exchangeRate: z.coerce.number().finite().positive().default(1),
  orderTotal: z.coerce.number().finite().min(0).default(0),
  paidAmount: z.coerce.number().finite().min(0).default(0),
  remainingAmount: z.coerce.number().finite().min(0).default(0),
  salesStatus: z.string().trim().max(80).default("draft"),
  paymentStatus: z.string().trim().max(80).default("pending"),
  deliveryStatus: z.string().trim().max(80).default("pending"),
  workflowState: z.unknown().optional(),
  formData: z.unknown().optional()
});

function orderNo() {
  const now = new Date();
  return `SO-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

function cleanSerialPrefix(val: string | null | undefined, fallback: string) {
  if (!val) return fallback;
  const clean = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean || fallback;
}

async function nextTransactionSerial(admin: any, scopeType: string, scopeKey: string, prefix: string) {
  const { data, error } = await admin.rpc("next_transaction_serial", {
    p_scope_type: scopeType,
    p_scope_key: scopeKey,
    p_prefix: prefix
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function resolveCountryCurrency(supabase: any, countryId: string | null | undefined, fallback = "USD") {
  if (!countryId) return fallback;
  const { data } = await supabase
    .from("countries")
    .select("currency_code")
    .eq("id", countryId)
    .maybeSingle();
  return data?.currency_code || fallback;
}

async function resolveEffectiveScope(input: {
  session: Awaited<ReturnType<typeof requireErpSession>>;
  requested: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null };
}) {
  const session = input.session;
  const req = input.requested;
  const supabase = await createApiSupabaseClient();

  const cityBranchId = req.cityBranchId || session.cityBranchIds[0] || null;
  if (cityBranchId) {
    const row = await requireSupabaseData(
      supabase
        .from("city_branches")
        .select("id, country_id, country_branch_id")
        .eq("id", cityBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? req.countryId ?? session.countryIds[0] ?? null,
      countryBranchId: (row as any)?.country_branch_id ?? req.countryBranchId ?? session.countryBranchIds[0] ?? null,
      cityBranchId
    };
  }

  const countryBranchId = req.countryBranchId || session.countryBranchIds[0] || null;
  if (countryBranchId) {
    const row = await requireSupabaseData(
      supabase
        .from("country_branches")
        .select("id, country_id")
        .eq("id", countryBranchId)
        .is("deleted_at", null)
        .maybeSingle()
    );
    return {
      countryId: (row as any)?.country_id ?? req.countryId ?? session.countryIds[0] ?? null,
      countryBranchId,
      cityBranchId: null
    };
  }

  return {
    countryId: req.countryId || session.countryIds[0] || null,
    countryBranchId: null,
    cityBranchId: null
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureTableExists();
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const countryId = params.get("countryId");
    const countryBranchId = params.get("countryBranchId");
    const cityBranchId = params.get("cityBranchId");

    authorizeApiScope(session, { resource: "sales", action: "read", countryId, countryBranchId, cityBranchId });

    const supabase = await createApiSupabaseClient();
    let query: any = supabase
      .from("sales_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(params.get("limit") || 100), 200));

    if (params.get("q")) {
      const term = String(params.get("q")).replace(/[%_]/g, "");
      query = query.or(`sales_order_no.ilike."%${term}%",account_number.ilike."%${term}%",manual_reference_number.ilike."%${term}%",customer_number.ilike."%${term}%",customer_name.ilike."%${term}%",super_admin_serial_number.ilike."%${term}%",country_transaction_serial_number.ilike."%${term}%",branch_transaction_serial_number.ilike."%${term}%"`);
    }
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    else if (!session.isSuperAdmin && session.cityBranchIds.length) query = query.in("city_branch_id", session.cityBranchIds);
    else if (countryBranchId) query = query.eq("country_branch_id", countryBranchId);
    else if (!session.isSuperAdmin && session.countryBranchIds.length) query = query.in("country_branch_id", session.countryBranchIds);
    else if (countryId) query = query.eq("country_id", countryId);
    else if (!session.isSuperAdmin) query = query.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);

    return apiOk({ salesOrders: await requireSupabaseData(query) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTableExists();
    const session = await requireErpSession();
    const body = salesOrderSchema.parse(await request.json());
    const effective = await resolveEffectiveScope({
      session,
      requested: {
        countryId: body.countryId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null
      }
    });

    authorizeApiScope(session, {
      resource: "sales",
      action: "create",
      countryId: effective.countryId,
      countryBranchId: effective.countryBranchId,
      cityBranchId: effective.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const admin = createSupabaseAdminClient() as any;
    const recordCurrencyCode = await resolveCountryCurrency(admin, effective.countryId, body.currencyCode);

    const superAdminSerialNumber = await nextTransactionSerial(admin, "global", "global", "SA");

    let countryPrefix = "CNT";
    if (effective.countryId) {
      const { data: country } = await admin.from("countries").select("iso2, iso3, name").eq("id", effective.countryId).maybeSingle();
      countryPrefix = cleanSerialPrefix(country?.iso2 || country?.iso3 || country?.name, "CNT");
    }

    let mainBranchPrefix = "MB";
    if (effective.countryBranchId) {
      const { data: branch } = await admin.from("country_branches").select("code, name").eq("id", effective.countryBranchId).maybeSingle();
      const branchNameWord = branch?.name ? String(branch.name).split(" ")[0].toUpperCase() : null;
      mainBranchPrefix = cleanSerialPrefix(branchNameWord || branch?.code || branch?.name, "MB");
    }

    let cityBranchPrefix = "CB";
    if (effective.cityBranchId) {
      const { data: branch } = await admin.from("city_branches").select("code, name").eq("id", effective.cityBranchId).maybeSingle();
      const branchNameWord = branch?.name ? String(branch.name).split(" ")[0].toUpperCase() : null;
      cityBranchPrefix = cleanSerialPrefix(branchNameWord || branch?.code || branch?.name, "CB");
    }

    const countryTransactionSerialNumber = effective.countryId
      ? await nextTransactionSerial(admin, "country", effective.countryId, countryPrefix)
      : null;
    const branchTransactionSerialNumber = effective.cityBranchId || effective.countryBranchId
      ? await nextTransactionSerial(
          admin,
          "branch",
          effective.cityBranchId || effective.countryBranchId || "",
          effective.cityBranchId ? cityBranchPrefix : mainBranchPrefix
        )
      : null;
    const generatedSalesOrderNo = body.salesOrderNo?.trim() || await nextTransactionSerial(admin, "module_sales", "global", "SO");
    const baseCurrencyAmount = Number(body.orderTotal || 0) * Number(body.exchangeRate || 1);

    const payload = {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      customer_account_id: body.customerAccountId ?? null,
      customer_ledger_id: body.customerLedgerId ?? null,
      purchase_order_id: body.purchaseOrderId ?? null,
      sales_order_no: generatedSalesOrderNo || orderNo(),
      sales_contract_no: body.salesContractNo ?? null,
      order_date: body.orderDate ?? new Date().toISOString().slice(0, 10),
      customer_name: body.customerName ?? null,
      account_number: body.accountNumber ?? null,
      manual_reference_number: body.manualReferenceNumber ?? null,
      customer_number: body.customerNumber ?? null,
      country_serial_number: body.countrySerialNumber ?? countryTransactionSerialNumber,
      branch_serial_number: body.branchSerialNumber ?? branchTransactionSerialNumber,
      product_summary: body.productSummary ?? null,
      quantity: body.quantity,
      total_weight: body.totalWeight,
      currency_code: recordCurrencyCode,
      exchange_rate: body.exchangeRate,
      original_currency_code: body.currencyCode,
      currency_name: recordCurrencyCode,
      base_currency_amount: baseCurrencyAmount,
      order_total: body.orderTotal,
      paid_amount: body.paidAmount,
      remaining_amount: body.remainingAmount,
      sales_status: body.salesStatus,
      payment_status: body.paymentStatus,
      delivery_status: body.deliveryStatus,
      workflow_state: body.workflowState ?? {},
      form_data: {
        ...(typeof body.formData === "object" && body.formData !== null ? body.formData : {}),
        traceability: {
          superAdminSerialNumber,
          countryTransactionSerialNumber,
          branchTransactionSerialNumber,
          originalCurrencyCode: body.currencyCode,
          currencyName: recordCurrencyCode,
          baseCurrencyAmount
        }
      },
      super_admin_serial_number: superAdminSerialNumber,
      country_transaction_serial_number: countryTransactionSerialNumber,
      branch_transaction_serial_number: branchTransactionSerialNumber,
      created_by: null,
      updated_by: null
    };

    const row = await requireSupabaseData(supabase.from("sales_orders").insert(payload).select("id, sales_order_no").single());

    await writeAuditLog({
      action: "create",
      entityTable: "sales_orders",
      entityId: (row as any).id,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiCreated({ salesOrderId: (row as any).id, salesOrderNo: (row as any).sales_order_no });
  } catch (error) {
    return handleApiError(error);
  }
}
