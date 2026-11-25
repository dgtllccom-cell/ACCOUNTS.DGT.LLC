import { NextRequest } from "next/server";
import { reserveForOrder } from "@/lib/sales/managed-lot-sales";
import { z } from "zod";
import { ApiClientError, apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { sqlLocalSalesSource } from "@/lib/sales/local-sales-source";
import { assertFinancialAccess } from "@/lib/permissions/middleware";
import { isCountryLevelRole } from "@/lib/permissions/enterprise-roles";
import { assertBusinessCityBranch } from "@/lib/api/branch-scope-guard";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { optionalUuidSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allocateFormSerials } from "@/lib/services/form-serials";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import postgres from "postgres";
import { normalizeLanguage, saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { parseRegisterPage, splitRegisterPage } from "@/lib/sales/register-pagination";
import { localizeRecordNames, trustedTranslationMap } from "@/lib/i18n/localize-records";
import { salesOrderTranslationFields } from "@/lib/i18n/sales-order-translations";
import { assertBookingCurrency, assertConfiguredSalesSettlement, assertSalesWithinStock, resolveSalesCountryCurrency } from "@/lib/sales/booking-rules";


async function attachSalesOrderTranslations(rows: any[]) {
  const ids = rows.map((order) => order.id).filter(Boolean);
  if (!ids.length) return rows;
  // record_translations sits over per-language base tables with RLS gated on
  // auth.uid()/is_super_admin(), always NULL under this app's temp-session bootstrap —
  // the Supabase admin client silently returns zero rows here (same root cause fixed in
  // lib/services/ledger-report-service.ts). Try direct Postgres first.
  const viaPg = await withLocalPg(async (sql) => sql`
    select record_id, field_name, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text, translation_status, translated_by_engine, source::text as source, corrected_by
    from public.record_translations
    where record_table = 'sales_orders' and record_id = any(${ids}::uuid[]) and deleted_at is null
  `);
  let translationRows: any[] | null = viaPg;
  if (!translationRows) {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.from("record_translations")
      .select("record_id, field_name, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text, translation_status, translated_by_engine, source, corrected_by")
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
      order.translations[row.field_name] = trustedTranslationMap("sales_orders", row.field_name, row.original_text, row);
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
  // Country-to-Country Sale: optional destination scope, mirrors the existing
  // Country-to-Country Purchase pattern (app/api/erp/purchases/orders/route.ts).
  destCountryId: optionalUuidSchema,
  destCountryBranchId: optionalUuidSchema,
  destCityBranchId: optionalUuidSchema,
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
  totalGoodsOriginal: z.coerce.number().finite().min(0).default(0),
  totalGoodsLocal: z.coerce.number().finite().min(0).default(0),
  totalGoodsUsd: z.coerce.number().finite().min(0).default(0),
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
  if (request.nextUrl.searchParams.get("transferred") === "1") return listTransferredSalesOrders(request);
  try {
    if (request.nextUrl.searchParams.get("registerPage") !== "1") await ensureTableExists();
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const page = parseRegisterPage(params);
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
    const limit = page.enabled ? z.coerce.number().int().min(1).max(200).parse(params.get("limit") || 100)
      : Math.min(Number(params.get("limit") || 100), 200);
    const fetchLimit = limit + Number(page.enabled);
    const rawTerm = params.get("q") ? String(params.get("q")).replace(/[%_]/g, "") : null;
    const viaPg = await (page.enabled ? withReadPg : withLocalPg)(async (sql) => {
      const cityIds = !session.isSuperAdmin ? session.cityBranchIds : [];
      const countryBranchIds = !session.isSuperAdmin ? session.countryBranchIds : [];
      const countryIds = !session.isSuperAdmin ? session.countryIds : [];
      return await sql`
        select * ${page.enabled ? sql`, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as register_cursor_timestamp` : sql``}
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
          and (${page.cursor ? sql`(created_at, id) < (${page.cursor.at}::timestamptz, ${page.cursor.id}::uuid)` : sql`true`})
        order by created_at desc ${page.enabled ? sql`, id desc` : sql``}
        limit ${fetchLimit}
      `;
    });

    const lang = normalizeLanguage(params.get("lang"), "en");

    if (viaPg) {
      const register = splitRegisterPage(viaPg as any[], limit, page.enabled);
      const resolved = await localizeRecordNames(register.rows, "sales_orders", "customer_name", lang);
      return apiOk({ salesOrders: resolved, ...(page.enabled ? { nextCursor: register.nextCursor } : {}) });
    }

    const supabase = await createApiSupabaseClient();
    let query: any = supabase
      .from("sales_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (page.enabled) query = query.order("id", { ascending: false });
    if (page.cursor) {
      const { at, id } = page.cursor;
      query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
    }

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
    const register = splitRegisterPage((fallbackRows ?? []) as any[], limit, page.enabled);
    const resolvedFallback = await localizeRecordNames(register.rows, "sales_orders", "customer_name", lang);
    return apiOk({ salesOrders: resolvedFallback, ...(page.enabled ? { nextCursor: register.nextCursor } : {}) });
  } catch (error) {
    return handleApiError(error);
  }
}

async function listTransferredSalesOrders(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const localSale = params.get("source") === "local";
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
    const requestedLimit = Number(params.get("limit") || 100);
    const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 100;
    const requestedOffset = Number(params.get("offset") || 0);
    const offset = Number.isSafeInteger(requestedOffset) ? Math.max(0, Math.min(requestedOffset, Number.MAX_SAFE_INTEGER - 200)) : 0;
    assertFinancialAccess(session);
    const rawCursor = params.get("cursor") || "";
    const [cursorTimestamp, cursorId, unexpectedCursorSuffix] = rawCursor.split("~");
    if (rawCursor && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursorTimestamp)
      || !Number.isFinite(Date.parse(cursorTimestamp)) || new Date(cursorTimestamp).toISOString().slice(0, 23) !== cursorTimestamp.slice(0, 23)
      || !z.string().uuid().safeParse(cursorId).success || unexpectedCursorSuffix !== undefined)) {
      throw new ApiClientError("Invalid sales transfer cursor.", { status: 400, code: "INVALID_TRANSFER_CURSOR" });
    }
    const countryLevel = session.roles.some(isCountryLevelRole) && session.countryIds.length > 0;
    const rawTerm = params.get("q") ? String(params.get("q")).replace(/[%_]/g, "") : null;
    const transferTerm = (rawTerm || "").replace(/\\/g, "").trim().slice(0, 120);
    const transferSearchField = params.get("searchField") || "all";
    const bookingDate = params.get("bookingDate") || null;
    const dateFrom = params.get("dateFrom") || null;
    const dateTo = params.get("dateTo") || null;
    if ([bookingDate, dateFrom, dateTo].some(value => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))
      || (dateFrom && dateTo && dateFrom > dateTo)) {
      throw new ApiClientError("Invalid booking date filter.", { status: 400, code: "INVALID_TRANSFER_DATE" });
    }
    const originCountry = params.get("originCountry")?.slice(0, 120);
    const originPort = params.get("originPort")?.slice(0, 120);
    const destCountry = params.get("destinationCountry")?.slice(0, 120);
    const destPort = params.get("destinationPort")?.slice(0, 120);
    const filterTerm = (key: string) => (params.get(key) || "").replace(/[\\%_]/g, "").trim().slice(0, 120);
    const goodsFilter = filterTerm("goods");
    const lotFilter = filterTerm("lot");
    const accountFilter = filterTerm("account");
    const currency = filterTerm("currency");
    const paymentType = filterTerm("paymentType");
    const paymentStatus = filterTerm("paymentStatus");
    const cityIds = session.isSuperAdmin ? [] : session.cityBranchIds;
    const countryBranchIds = session.isSuperAdmin ? [] : session.countryBranchIds;
    const countryIds = session.isSuperAdmin ? [] : session.countryIds;
    const scopePredicate = (sql: postgres.Sql) => session.isSuperAdmin
      ? sql`true`
      : countryLevel ? sql`country_id = any(${countryIds}::uuid[])`
      : cityIds.length ? sql`city_branch_id = any(${cityIds}::uuid[])`
      : countryBranchIds.length ? sql`country_branch_id = any(${countryBranchIds}::uuid[])`
      : countryIds.length ? sql`country_id = any(${countryIds}::uuid[])`
      : sql`false`;

    if (params.get("facets") === "1") {
      // Only distinct dropdown metadata leaves the database. A country/branch
      // doesn't disappear from the search just because its bills aren't on page 1.
      const facets = await withReadPg(sql => sql`
        with scope as (
          select country_id, country_branch_id, city_branch_id, currency_code, payment_status, form_data->'form' as form
          from public.sales_orders
          where deleted_at is null and ledger_posting_status in ('posted','transferred')
            and (${localSale ? sqlLocalSalesSource(sql, sql`form_data`) : sql`true`})
            and (${scopePredicate(sql)})
            and (${countryId ? sql`country_id = ${countryId}::uuid` : sql`true`})
            and (${countryBranchId ? sql`country_branch_id = ${countryBranchId}::uuid` : sql`true`})
            and (${cityBranchId ? sql`city_branch_id = ${cityBranchId}::uuid` : sql`true`})
        )
        select field, value, coalesce(min(nullif(label, '')), value) as label
        from scope
        cross join lateral (values
          ('countryId', country_id::text, form->>'branchCountry'),
          ('countryBranchId', country_branch_id::text, coalesce(form->>'countryBranchName', form->>'branchName')),
          ('cityBranchId', city_branch_id::text, coalesce(form->>'cityBranchName', form->>'branchName')),
          ('currency', upper(currency_code), upper(currency_code)),
          ('paymentStatus', payment_status, payment_status),
          ('paymentType', form->>'paymentType', form->>'paymentType'),
          ('originCountry', form->>'loadingCountry', form->>'loadingCountry'),
          ('originPort', form->>'loadingPort', form->>'loadingPort'),
          ('destinationCountry', coalesce(form->>'receivedCountry', form->>'destinationCountry'), coalesce(form->>'receivedCountry', form->>'destinationCountry')),
          ('destinationPort', form->>'receivedPort', form->>'receivedPort')
        ) facet(field,value,label)
        where value <> ''
        group by field, value
        order by field, label, value
      `);
      if (!facets) throw new ApiClientError("Sales Transfer search is unavailable.", { status: 503, code: "TRANSFER_SEARCH_UNAVAILABLE" });
      return apiOk({ facets });
    }

    const viaPg = await withReadPg(async (sql) => {
      const authorizedRows = scopePredicate(sql);
      const term = `%${transferTerm}%`;
      const byBooking = sql`(sales_order_no ilike ${term} or manual_reference_number ilike ${term} or super_admin_serial_number ilike ${term} or country_transaction_serial_number ilike ${term} or branch_transaction_serial_number ilike ${term})`;
      const byTransfer = sql`(form_data #>> '{transferTrace,voucherNo}' ilike ${term} or form_data #>> '{transferTrace,referenceNo}' ilike ${term} or form_data #>> '{transferTrace,journalNo}' ilike ${term} or form_data #>> '{transferVerification,voucherNo}' ilike ${term} or form_data #>> '{workflow,referenceNo}' ilike ${term})`;
      const byCustomer = sql`(customer_name ilike ${term} or customer_number ilike ${term} or account_number ilike ${term} or form_data #>> '{form,customerAccountName}' ilike ${term} or form_data #>> '{form,customerAccountNo}' ilike ${term})`;
      const goods = sql`case when jsonb_typeof(form_data->'goodsEntries') = 'array' then form_data->'goodsEntries' else '[]'::jsonb end`;
      const byGoods = sql`(product_summary ilike ${term} or form_data #>> '{form,goodsName}' ilike ${term} or exists (select 1 from jsonb_array_elements(${goods}) as item(value) where coalesce(item.value->>'goodsName', item.value->>'productName') ilike ${term}))`;
      const byLot = sql`(form_data #>> '{form,stockLotNo}' ilike ${term} or form_data #>> '{form,allotName}' ilike ${term} or exists (select 1 from jsonb_array_elements(${goods}) as item(value) where item.value->>'lotName' ilike ${term} or item.value->>'lotNo' ilike ${term} or item.value->>'stockLotNo' ilike ${term} or item.value->>'lotRef' ilike ${term} or item.value->>'allotName' ilike ${term}))`;
      const transferSearch = !transferTerm ? sql`true` : transferSearchField === "booking" ? byBooking : transferSearchField === "transfer" ? byTransfer
        : transferSearchField === "customer" ? byCustomer : transferSearchField === "goods" ? byGoods : transferSearchField === "lot" ? byLot
          : sql`(${byBooking} or ${byTransfer} or ${byCustomer} or ${byGoods} or ${byLot})`;
      return await sql`
        select *, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as transfer_cursor_at
        from public.sales_orders
        where deleted_at is null
          and ledger_posting_status in ('posted', 'transferred')
          and (${localSale ? sqlLocalSalesSource(sql, sql`form_data`) : sql`true`})
          and (${transferSearch})
          and (${goodsFilter ? sql`(product_summary ilike ${"%" + goodsFilter + "%"} or form_data #>> '{form,goodsName}' ilike ${"%" + goodsFilter + "%"}
            or exists (select 1 from jsonb_array_elements(${goods}) as item(value) where coalesce(item.value->>'goodsName', item.value->>'productName') ilike ${"%" + goodsFilter + "%"}))` : sql`true`})
          and (${lotFilter ? sql`(form_data #>> '{form,stockLotNo}' ilike ${"%" + lotFilter + "%"} or form_data #>> '{form,allotName}' ilike ${"%" + lotFilter + "%"}
            or exists (select 1 from jsonb_array_elements(${goods}) as item(value)
              where concat_ws(' ', item.value->>'lotName', item.value->>'lotNo', item.value->>'stockLotNo', item.value->>'lotRef', item.value->>'allotName') ilike ${"%" + lotFilter + "%"}))` : sql`true`})
          and (${accountFilter ? sql`concat_ws(' ', account_number, customer_number, customer_name, form_data #>> '{form,customerAccountNo}',
            form_data #>> '{form,customerAccountName}', form_data #>> '{form,salesAccountNo}', form_data #>> '{form,salesAccountName}') ilike ${"%" + accountFilter + "%"}` : sql`true`})
          and (${currency ? sql`upper(currency_code) = upper(${currency})` : sql`true`})
          and (${paymentType ? sql`lower(form_data #>> '{form,paymentType}') = lower(${paymentType})` : sql`true`})
          and (${paymentStatus ? sql`lower(payment_status) = lower(${paymentStatus})` : sql`true`})
          and (${bookingDate ? sql`order_date = ${bookingDate}::date` : sql`true`})
          and (${dateFrom ? sql`order_date >= ${dateFrom}::date` : sql`true`})
          and (${dateTo ? sql`order_date <= ${dateTo}::date` : sql`true`})
          and (${originCountry ? sql`lower(form_data #>> '{form,loadingCountry}') = lower(${originCountry})` : sql`true`})
          and (${originPort ? sql`lower(form_data #>> '{form,loadingPort}') = lower(${originPort})` : sql`true`})
          and (${destCountry ? sql`lower(coalesce(form_data #>> '{form,receivedCountry}', form_data #>> '{form,destinationCountry}')) = lower(${destCountry})` : sql`true`})
          and (${destPort ? sql`lower(form_data #>> '{form,receivedPort}') = lower(${destPort})` : sql`true`})
          and (${countryId ? sql`country_id = ${countryId}::uuid` : sql`true`})
          and (${countryBranchId ? sql`country_branch_id = ${countryBranchId}::uuid` : sql`true`})
          and (${cityBranchId ? sql`city_branch_id = ${cityBranchId}::uuid` : sql`true`})
          and (${authorizedRows})
          and (${rawCursor ? sql`(created_at,id) < (${cursorTimestamp}::timestamptz,${cursorId}::uuid)` : sql`true`})
        order by created_at desc, id desc
        limit ${limit + 1} offset ${rawCursor ? 0 : offset}
      `;
    });

    const lang = normalizeLanguage(params.get("lang"), "en");

    if (viaPg) {
      const nextOffset = viaPg.length > limit ? offset + limit : null;
      const last = nextOffset === null ? null : viaPg[limit - 1];
      const nextCursor = last?.transfer_cursor_at && last?.id ? `${last.transfer_cursor_at}~${last.id}` : null;
      const sourceRows = (viaPg as any[]).slice(0, limit).map(({ transfer_cursor_at: _, ...row }) => row);
      {
        const receiptOrders = sourceRows.filter(row => row.form_data?.transferTrace?.paymentId || row.form_data?.transferVerification?.journalId).map(row => row.id);
        if (receiptOrders.length > 0) {
          const summaries = await withReadPg(sql => sql`
            select p.sales_order_id,
                   case when count(p.payment_kind) filter (where p.payment_kind = 'advance' and p.received is null) = 0
                        then coalesce(sum(p.received) filter (where p.payment_kind = 'advance'), 0) end as advance,
                   case when count(p.payment_kind) filter (where p.received is null) = 0
                        then coalesce(sum(p.received), 0) end as received
            from (
              select o.id as sales_order_id, p.payment_kind,
                     case when upper(p.currency_code) = upper(o.currency_code) then p.amount else p.base_currency_amount end as received
              from sales_orders o
              left join sales_order_payments p on p.sales_order_id = o.id
                and p.status = 'posted' and p.deleted_at is null
                and p.payment_kind <> 'booking'
                and p.id::text is distinct from o.form_data->'transferTrace'->>'paymentId'
                and p.roznamcha_entry_id::text is distinct from o.form_data->'transferVerification'->>'journalId'
                and p.roznamcha_entry_id is not null
                and exists (select 1 from public.roznamcha_entries r where r.id = p.roznamcha_entry_id
                  and r.status = 'posted' and r.deleted_at is null
                  and coalesce(r.operational_domain, 'business') = 'business')
              where o.id = any(${receiptOrders}::uuid[])
            ) p
            group by p.sales_order_id
          `);
          const byOrder = new Map((summaries ?? []).map(row => [row.sales_order_id, row]));
          for (const row of sourceRows) row.transferReceiptSummary = byOrder.get(row.id);
        }
      }
      const resolved = await localizeRecordNames(sourceRows, "sales_orders", "customer_name", lang);
      return apiOk({ salesOrders: resolved, nextOffset, ...(nextCursor ? { nextCursor } : {}) });
    }

    // The transfer-specific JSON/financial filters are never silently bypassed.
    throw new ApiClientError("Sales Transfer search is unavailable.", { status: 503, code: "TRANSFER_SEARCH_UNAVAILABLE" });
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
    // transfer_date/transfer_user/transfer_serial_number are applied via
    // migrations, not per-request — confirmed already present in the DB.
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
    // a conversion needs a real rate, and goods taken from stock may not exceed what is left (open bookings of every branch counted)
    assertBookingCurrency(body.formData);
    await assertSalesWithinStock(session, body.formData);
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
    // Business transaction — reject shipping/clearing/agent branches passed directly.
    await assertBusinessCityBranch(effective.cityBranchId);

    const supabase = await createApiSupabaseClient();
    const admin = createSupabaseAdminClient() as any;

    // â”€â”€ Rule 1: Country Scope Validation â”€â”€
    if (body.customerAccountId) {
      await validateAccountCountryScope(session, body.customerAccountId, effective.countryId, admin);
    }
    if (body.customerLedgerId) {
      await validateLedgerCountryScope(session, body.customerLedgerId, effective.countryId, admin);
    }
    const recordCurrencyCode = await resolveSalesCountryCurrency(admin, effective.countryId, body.currencyCode);
    assertConfiguredSalesSettlement(body.formData, recordCurrencyCode);

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
    // orderTotal is already converted to the local/base currency by the booking wizard
    // (see the currency double-conversion fix in app/api/erp/purchases/orders/[id]/transfer
    // and app/api/erp/sales/orders/[id]/transfer) — multiplying it by exchangeRate again
    // here inflated base_currency_amount by the same factor. totalGoodsLocal is the same
    // already-converted figure under its unambiguous name; fall back to orderTotal as-is
    // (no further multiplication) for any caller that hasn't been updated to send it yet.
    const baseCurrencyAmount = Number(body.totalGoodsLocal || body.orderTotal || 0);

    const payload = {
      country_id: effective.countryId,
      country_branch_id: effective.countryBranchId,
      city_branch_id: effective.cityBranchId,
      // Country-to-Country Sale: optional destination scope, distinct from the selling
      // scope above. Left null for a plain same-country sale.
      dest_country_id: body.destCountryId ?? null,
      dest_country_branch_id: body.destCountryBranchId ?? null,
      dest_city_branch_id: body.destCityBranchId ?? null,
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
      total_goods_original: body.totalGoodsOriginal ?? 0,
      total_goods_local: body.totalGoodsLocal ?? 0,
      total_goods_usd: body.totalGoodsUsd ?? 0,
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

    // Goods picked from managed lots are RESERVED by the draft (never deducted until final billing). If the
    // reservation cannot be made (e.g. not enough available quantity) the just-created draft is withdrawn.
    try {
      await reserveForOrder({
        salesOrderId: (row as any).id,
        salesOrderNo: (row as any).sales_order_no,
        formData: payload.form_data,
        countryId: effective.countryId,
        userId: session.userId,
      });
    } catch (reserveError) {
      await withLocalPg((sql) => sql`UPDATE public.sales_orders SET deleted_at = now() WHERE id = ${(row as any).id}::uuid`);
      throw reserveError;
    }

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
          // UAE line-level output VAT: explicit sync in addition to the
          // AFTER-write trigger on sales_order_items (guarantees booking-sale
          // output VAT materialises even if trigger fire order varies).
          await sql`select public.sync_uae_tax_from_sales_orders(null, null, ${soId}::uuid)`.catch(() => undefined);
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
