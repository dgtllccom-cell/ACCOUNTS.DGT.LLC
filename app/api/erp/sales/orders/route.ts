import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { optionalUuidSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { withLocalPg } from "@/lib/db/local-postgres";
import postgres from "postgres";
import { normalizeLanguage, saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { salesOrderTranslationFields } from "@/lib/i18n/sales-order-translations";


async function attachSalesOrderTranslations(rows: any[]) {
  const ids = rows.map((order) => order.id).filter(Boolean);
  if (!ids.length) return rows;
  // record_translations sits over per-language base tables with RLS gated on
  // auth.uid()/is_super_admin(), always NULL under this app's temp-session bootstrap —
  // the Supabase admin client silently returns zero rows here (same root cause fixed in
  // lib/services/ledger-report-service.ts). Try direct Postgres first.
  const viaPg = await withLocalPg(async (sql) => sql`
    select record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where record_table = 'sales_orders' and record_id = any(${ids}::uuid[]) and deleted_at is null
  `);
  let translationRows: any[] | null = viaPg;
  if (!translationRows) {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.from("record_translations")
      .select("record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text")
      .eq("record_table", "sales_orders")
      .in("record_id", ids)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    translationRows = data;
  }
  for (const row of translationRows || []) {
    const order = rows.find((item) => item.id === row.record_id);
    if (order) {
      order.translations ||= {};
      order.translations[row.field_name] = { en: row.english_text, ur: row.urdu_text, ar: row.arabic_text, fa: row.persian_text, ps: row.pashto_text };
    }
  }
  return rows;
}
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
  formData: z.unknown().optional(),
  translations: z.record(z.string(), z.any()).optional(),
  originalLanguage: z.enum(["en", "ur", "ar", "fa", "ps"]).default("en")
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

    // Root-cause bypass (see lib/db/local-postgres.ts): sales_orders_scope_read gates on
    // is_super_admin()/can_access_country(), both keyed off auth.uid(), which is always
    // NULL under this app's temp-session bootstrap login — so the Supabase-client query
    // below silently returns zero rows even for orders that exist. Try a direct-Postgres
    // read first (bypasses RLS via DATABASE_URL); fall back to the Supabase-client path
    // only when DATABASE_URL isn't configured.
    const limit = Math.min(Number(params.get("limit") || 100), 200);
    const rawTerm = params.get("q") ? String(params.get("q")).replace(/[%_]/g, "") : null;
    const viaPg = await withLocalPg(async (sql) => {
      const cityIds = !session.isSuperAdmin ? session.cityBranchIds : [];
      const countryBranchIds = !session.isSuperAdmin ? session.countryBranchIds : [];
      const countryIds = !session.isSuperAdmin ? session.countryIds : [];
      return await sql`
        select *
        from public.sales_orders
        where deleted_at is null
          and (${rawTerm ? sql`(
                sales_order_no ilike ${"%" + rawTerm + "%"}
                or account_number ilike ${"%" + rawTerm + "%"}
                or manual_reference_number ilike ${"%" + rawTerm + "%"}
                or customer_number ilike ${"%" + rawTerm + "%"}
                or customer_name ilike ${"%" + rawTerm + "%"}
                or super_admin_serial_number ilike ${"%" + rawTerm + "%"}
                or country_transaction_serial_number ilike ${"%" + rawTerm + "%"}
                or branch_transaction_serial_number ilike ${"%" + rawTerm + "%"}
              )` : sql`true`})
          and (${cityBranchId
            ? sql`city_branch_id = ${cityBranchId}`
            : !session.isSuperAdmin && cityIds.length
            ? sql`city_branch_id = any(${cityIds})`
            : countryBranchId
            ? sql`country_branch_id = ${countryBranchId}`
            : !session.isSuperAdmin && countryBranchIds.length
            ? sql`country_branch_id = any(${countryBranchIds})`
            : countryId
            ? sql`country_id = ${countryId}`
            : !session.isSuperAdmin
            ? sql`country_id = any(${countryIds.length ? countryIds : ["00000000-0000-0000-0000-000000000000"]})`
            : sql`true`})
        order by created_at desc
        limit ${limit}
      `;
    });

    const lang = normalizeLanguage(params.get("lang"), "en");

    if (viaPg) {
      const resolved = await localizeRecordNames(viaPg as any[], "sales_orders", "customer_name", lang);
      return apiOk({ salesOrders: resolved });
    }

    const supabase = await createApiSupabaseClient();
    let query: any = supabase
      .from("sales_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (rawTerm) {
      query = query.or(`sales_order_no.ilike."%${rawTerm}%",account_number.ilike."%${rawTerm}%",manual_reference_number.ilike."%${rawTerm}%",customer_number.ilike."%${rawTerm}%",customer_name.ilike."%${rawTerm}%",super_admin_serial_number.ilike."%${rawTerm}%",country_transaction_serial_number.ilike."%${rawTerm}%",branch_transaction_serial_number.ilike."%${rawTerm}%"`);
    }
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    else if (!session.isSuperAdmin && session.cityBranchIds.length) query = query.in("city_branch_id", session.cityBranchIds);
    else if (countryBranchId) query = query.eq("country_branch_id", countryBranchId);
    else if (!session.isSuperAdmin && session.countryBranchIds.length) query = query.in("country_branch_id", session.countryBranchIds);
    else if (countryId) query = query.eq("country_id", countryId);
    else if (!session.isSuperAdmin) query = query.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);

    const fallbackRows = await requireSupabaseData(query);
    const resolvedFallback = await localizeRecordNames((fallbackRows ?? []) as any[], "sales_orders", "customer_name", lang);
    return apiOk({ salesOrders: resolvedFallback });
  } catch (error) {
    return handleApiError(error);
  }
}

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { validateAccountCountryScope, validateLedgerCountryScope } from "@/lib/api/country-scope-validator";

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    await ensureTableExists();
    const session = await requireErpSession();
    const rawJson = await request.json();

    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "SALES_ORDER",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      businessReference: rawJson?.salesOrderNo || rawJson?.salesContractNo,
      payload: rawJson
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 201, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return handleApiError(new Error("A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    const body = salesOrderSchema.parse(rawJson);
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

    // â”€â”€ Rule 1: Country Scope Validation â”€â”€
    if (body.customerAccountId) {
      await validateAccountCountryScope(session, body.customerAccountId, effective.countryId, admin);
    }
    if (body.customerLedgerId) {
      await validateLedgerCountryScope(session, body.customerLedgerId, effective.countryId, admin);
    }
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

    // sales_orders has scoped RLS (sales_orders_scope_insert) and this app's Supabase client
    // is not guaranteed to carry a real service-role key that bypasses RLS on its own
    // (confirmed live: this insert failed with "new row violates row-level security policy").
    // Insert via a direct Postgres connection when available (same proven bypass as
    // banks-repository.ts/customers-repository.ts), falling back to the Supabase client.
    const viaPgInsert = await withLocalPg(async (sql) => {
      const rows = await sql`INSERT INTO public.sales_orders ${sql(payload as any)} RETURNING id, sales_order_no`;
      return rows[0] as { id: string; sales_order_no: string };
    });
    const row = viaPgInsert ?? await requireSupabaseData(supabase.from("sales_orders").insert(payload).select("id, sales_order_no").single());

    let translationStatus: { status: "complete" | "pending"; fields: Record<string, unknown> } = { status: "pending", fields: {} };
    try {
      const fields = salesOrderTranslationFields({ formData: body.formData, customerName: body.customerName, productSummary: body.productSummary })
        .map((field) => ({ ...field, translations: body.translations?.[field.fieldName] }));
      const translationResults = await saveVerifiedEnterpriseRecordTranslations({
        recordTable: "sales_orders",
        recordId: (row as any).id,
        originalLanguage: body.originalLanguage,
        actorId: session.userId,
        fields,
        source: "auto"
      });
      translationStatus = {
        status: translationResults.every((result) => result.status === "complete") ? "complete" : "pending",
        fields: Object.fromEntries(translationResults.map((result) => [result.fieldName, { status: result.status, missingLanguages: result.missingLanguages }]))
      };
      await admin.from("sales_orders").update({ form_data: {
        ...(payload.form_data || {}),
        translations: Object.fromEntries(translationResults.map((result) => [result.fieldName, result.translations])),
        translationStatus,
        translationOriginalLanguage: body.originalLanguage
      } }).eq("id", (row as any).id);
    } catch (translationError) {
      console.warn("Sales-order translations remain pending because persistence failed:", translationError);
    }

    // 4-level serial (Global/Country/Branch/Entry) — additive metadata only, AFTER
    // the order row is created. Does NOT touch posting/ledger logic.
    try {
      const s = await allocateFormSerials("sales", { countryId: effective.countryId, branchKey: effective.countryBranchId ?? effective.cityBranchId ?? null });
      const serialPatch = { super_admin_serial: s.superAdminSerial, country_serial: s.countrySerial, branch_serial: s.branchSerial, entry_serial: s.entrySerial };
      const viaPgSerial = await withLocalPg(async (sql) => {
        await sql`UPDATE public.sales_orders SET ${sql(serialPatch)} WHERE id = ${(row as any).id}::uuid`;
        return true;
      });
      if (!viaPgSerial) {
        await admin.from("sales_orders").update(serialPatch).eq("id", (row as any).id);
      }
    } catch { /* non-fatal — never blocks the order/posting */ }

    // Persist normalised sales line items (used by the UAE Tax engine for
    // line-level Output VAT). Non-fatal; the order + posting never depend on it.
    try {
      const b = body as any;
      const goodsEntries: any[] = Array.isArray(b?.formData?.goodsEntries)
        ? b.formData.goodsEntries
        : Array.isArray(b?.items)
          ? b.items
          : [];
      if (goodsEntries.length > 0) {
        const soId = (row as any).id;
        const itemRows = goodsEntries.map((g: any, i: number) => {
          const totalLocal = Number(g.finalAmount ?? g.totalLocal ?? g.totalAmount ?? 0);
          const isTaxable = g.isTaxable !== false;
          const vatRate = Number(g.vatRate ?? 5) || 0;
          const taxableAmount = isTaxable ? totalLocal : 0;
          const vatAmount = isTaxable ? Math.round(taxableAmount * (vatRate / 100) * 100) / 100 : 0;
          return {
            sales_order_id: soId,
            row_serial: i + 1,
            goods_name: g.goodsName || g.goods_name || "Item",
            hs_code: g.hsCode || g.hs_code || null,
            brand: g.brand || null,
            size: g.size || null,
            quantity: Number(g.qtyNo ?? g.quantity ?? 0),
            unit_name: g.qtyName || g.unitName || null,
            net_weight: Number(g.netWeight ?? g.net_weight ?? 0),
            rate_original: Number(g.coursePrice ?? g.rateOriginal ?? 0),
            rate_local: Number(g.rateLocal ?? g.coursePrice ?? 0),
            total_original: Number(g.totalAmount ?? g.totalOriginal ?? 0),
            total_local: totalLocal,
            is_taxable: isTaxable,
            tax_code_id: g.taxCodeId || null,
            vat_rate: vatRate,
            taxable_amount: taxableAmount,
            vat_amount: vatAmount,
          };
        });
        await withLocalPg(async (sql) => {
          await sql`DELETE FROM public.sales_order_items WHERE sales_order_id = ${soId}::uuid`;
          await sql`INSERT INTO public.sales_order_items ${sql(itemRows as any)}`;
          return true;
        });
      }
    } catch (itemsError) {
      console.warn("sales_order_items persistence skipped:", itemsError);
    }

    await writeAuditLog({
      action: "create",
      entityTable: "sales_orders",
      entityId: (row as any).id,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    const resData = { salesOrderId: (row as any).id, salesOrderNo: (row as any).sales_order_no, translationStatus };

    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, resData);
    }

    return apiCreated(resData);
  } catch (error) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    return handleApiError(error);
  }
}
