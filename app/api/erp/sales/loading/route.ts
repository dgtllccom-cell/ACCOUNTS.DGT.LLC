import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { apiCreated, apiOk, ApiClientError, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames, localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { sqlLocalSalesSource } from "@/lib/sales/local-sales-source";
import { SALES_LOADING_MAX_RECORDS, SALES_LOADING_PAGE_SIZE, type LoadingRegisterLocation } from "@/lib/sales/loading-pagination";
import { ACCOUNT_TRANSFER_LOADING_LABELS, IMMEDIATE_LOADING_LABELS, INVOICE_LOADING_LABELS, createSalesLoadingSchema, loadingReadiness, LoadingValidationError, planSalesLoading, receivingSchema, salesLoadingSource, toLoadingOrder, type LoadingRecord, type SalesLoadingSource } from "@/lib/sales/loading-workflow";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid().optional();
const querySchema = z.object({
  source: salesLoadingSource, orderId: uuid, countryId: uuid, mainBranchId: uuid, cityBranchId: uuid,
  booking: z.string().trim().min(1).max(140).optional(), container: z.string().trim().min(1).max(160).optional(),
  fromDate: z.string().date().optional(), toDate: z.string().date().optional(), receivedDate: z.string().date().optional(),
  cursor: z.string().max(512).optional(), lang: z.enum(["en", "ur", "ar", "fa", "ps"]).optional(),
});
const preciseDate = z.string().datetime({ precision: 6 });
const cursorSchema = z.object({ created: preciseDate, id: z.string().uuid(), snapshot: preciseDate, scopeKey: z.string().length(64) });
const updateSchema = receivingSchema.extend({ source: salesLoadingSource, id: z.string().uuid() });
const eligibleStatuses = ["posted", "transferred"];
const noDb = () => new ApiClientError("Sales Loading storage is not configured.", { status: 503, code: "STORAGE_UNAVAILABLE" });
const notFound = () => new ApiClientError("This transferred sales document is not available.", { status: 404, code: "ORDER_NOT_FOUND" });

function documentScope(sql: any, source: SalesLoadingSource) {
  const isLocal = sqlLocalSalesSource(sql, sql`o.form_data`);
  return source === "local" ? isLocal : sql`not ${isLocal}`;
}

function paymentEligibility(sql: any) {
  const recorded = sql`coalesce(nullif(lower(btrim(o.form_data->'transferTrace'->>'paymentKind')), ''),
    nullif(lower(btrim(o.form_data->'workflow'->>'paymentKind')), ''))`;
  const labelAtTransfer = sql`coalesce(nullif(lower(btrim(o.form_data->'transferTrace'->>'paymentType')), ''),
    nullif(lower(btrim(o.form_data->'form'->'transferAudit'->>'paymentType')), ''),
    nullif(lower(btrim(o.form_data->'form'->>'paymentType')), ''),
    nullif(lower(btrim(o.form_data->>'paymentType')), ''),
    nullif(lower(btrim(o.form_data->'form'->>'paymentCondition')), ''),
    lower(btrim(o.form_data->>'paymentCondition')))`;
  const label = sql`(case when ${recorded} = 'advance' and ${labelAtTransfer} = any(${[...ACCOUNT_TRANSFER_LOADING_LABELS]}::text[])
    then ${labelAtTransfer} else coalesce(${recorded}, ${labelAtTransfer}) end)`;
  return sql`(${label} = any(${[...IMMEDIATE_LOADING_LABELS]}::text[]) or
    (${label} = any(${[...INVOICE_LOADING_LABELS]}::text[]) and ${invoiceVerification(sql)}))`;
}

function invoiceVerification(sql: any) {
  return sql`exists (select 1 from public.business_edit_invoices i
     where i.source_id = o.id and i.source_table = 'sales_orders' and i.txn_kind = 'sales'
      and i.status = 'finalized' and i.deleted_at is null
      and i.doc_type in ('commercial_invoice', 'export_invoice', 'tax_invoice'))`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "sales", action: "read" });
    const scope = sessionSqlScope(session);
    const viewFinancials = !!(session.isSuperAdmin || session.canViewFinancials);
    // The session can have distinct assignments for read vs update. Dry-authorize the
    // update on a copy, then project row-level write capabilities without widening read scope.
    let writer = hasRolePermission(session, "sales", "update") ? structuredClone(session) : null;
    if (writer) {
      try { authorizeApiScope(writer, { resource: "sales", action: "update" }); }
      catch (error) { if (!(error instanceof ErpPermissionError)) throw error; writer = null; }
    }
    const { cursor: rawCursor, lang, ...filters } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const { source: documentSource, orderId, countryId, mainBranchId, cityBranchId, booking, container, fromDate, toDate, receivedDate } = filters;
    const viewerLanguage = await getRequestLanguage(lang);
    if (fromDate && toDate && fromDate > toDate) {
      throw new ApiClientError(translateHeader(viewerLanguage, "To date must not precede from date"), { status: 400, code: "INVALID_DATE_RANGE" });
    }
    // This identifies a read scope, not an authorization token. Every chunk is re-authorized
    // and SQL independently binds the user's permitted location(s).
    const scopeKey = createHash("sha256").update(JSON.stringify({ user: session.userId, scope, writer: writer && sessionSqlScope(writer), viewFinancials, viewerLanguage, filters })).digest("hex");
    let cursor: z.infer<typeof cursorSchema> | null = null;
    if (rawCursor) {
      try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"))); }
      catch { throw new ApiClientError("Invalid Sales Loading cursor."); }
      if (cursor.scopeKey !== scopeKey) throw new ApiClientError("Sales Loading scope changed. Refresh and try again.", { status: 409, code: "SALES_LOADING_SCOPE_CHANGED" });
    }
    const snapshot = cursor?.snapshot ?? new Date().toISOString().replace(/Z$/, "000Z");
    const result = await withReadPg(async sql => {
      const source = await sql`
        select o.id, to_char(o.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_created_at,
          o.sales_order_no, o.sales_contract_no, o.order_date::text as order_date, o.customer_name,
          o.form_data, o.order_total, o.total_goods_original, o.total_goods_usd, o.paid_amount, o.currency_code, o.ledger_posting_status, o.country_id, o.country_branch_id, o.city_branch_id,
          c.name as country_name, m.name as main_branch_name, coalesce(b.name, b.city_name) as city_branch_name,
          ${invoiceVerification(sql)} as invoice_finalized
        from public.sales_orders o
        left join public.countries c on c.id = o.country_id
        left join public.country_branches m on m.id = o.country_branch_id
        left join public.city_branches b on b.id = o.city_branch_id
        where o.deleted_at is null and o.ledger_posting_status in ('posted', 'transferred')
          and (${sqlScopeCondition(sql, scope, "o")})
          and (${documentScope(sql, documentSource)})
          and ${paymentEligibility(sql)}
          and o.created_at <= ${snapshot}::timestamptz
          and (${cursor ? sql`(o.created_at, o.id) < (${cursor.created}::timestamptz, ${cursor.id}::uuid)` : sql`true`})
          and (${orderId ? sql`o.id = ${orderId}::uuid` : sql`true`})
          and (${countryId ? sql`o.country_id = ${countryId}::uuid` : sql`true`})
          and (${mainBranchId ? sql`o.country_branch_id = ${mainBranchId}::uuid` : sql`true`})
          and (${cityBranchId ? sql`o.city_branch_id = ${cityBranchId}::uuid` : sql`true`})
          and (${booking ? sql`(strpos(lower(o.sales_order_no), lower(${booking})) > 0 or strpos(lower(o.sales_contract_no), lower(${booking})) > 0)` : sql`true`})
          and (${container || fromDate || toDate || receivedDate ? sql`exists (
            select 1 from public.sales_loading_records l where l.sales_order_id = o.id
              and (${container ? sql`strpos(lower(l.container_number), lower(${container})) > 0` : sql`true`})
              and (${fromDate ? sql`l.loading_date >= ${fromDate}::date` : sql`true`})
              and (${toDate ? sql`l.loading_date <= ${toDate}::date` : sql`true`})
              and (${receivedDate ? sql`l.received_date = ${receivedDate}::date` : sql`true`})
          )` : sql`true`})
        order by o.created_at desc, o.id desc limit ${SALES_LOADING_PAGE_SIZE + 1}`;
      const rows = source.slice(0, SALES_LOADING_PAGE_SIZE);
      const localizedCustomer = await localizeRecordNames(rows.map(row => ({
        ...row,
        id: String(row.id),
        customer_name: row.customer_name,
        country_id: typeof row.country_id === "string" ? row.country_id : null,
        country_branch_id: typeof row.country_branch_id === "string" ? row.country_branch_id : null,
        city_branch_id: typeof row.city_branch_id === "string" ? row.city_branch_id : null,
      })), "sales_orders", "customer_name", viewerLanguage);
      const localized = await localizeJoinedNames(localizedCustomer, viewerLanguage, [
        { idField: "country_id", nameField: "country_name", table: "countries" },
        { idField: "country_branch_id", nameField: "main_branch_name", table: "country_branches" },
        { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches" },
      ]);
      const orders = localized.map(row => ({ ...toLoadingOrder(row, viewFinancials), readiness: loadingReadiness(row), canLoad: Boolean(writer && recordInSessionScope(writer, row)) }));
      const orderIds = orders.map(o => o.id);
      const records = orderIds.length ? await sql<LoadingRecord[]>`
        select id, entry_no, sales_order_id, sales_booking_no, container_number, container_type,
          loading_date::text as loading_date, received_date::text as received_date, details, goods, created_by_name
        from public.sales_loading_records where sales_order_id = any(${orderIds}::uuid[])
        order by loading_date desc, entry_no desc limit ${SALES_LOADING_MAX_RECORDS + 1}` : [];
      // Distinct authorized locations are independent of the selected page or filters;
      // a quieter branch is always selectable, even if its booking isn't in the first chunk.
      let locations: LoadingRegisterLocation[] | null = null;
      if (!cursor) {
        const distinct = await sql`
          select loc.*, c.name as country_name, m.name as main_branch_name, coalesce(b.name,b.city_name) as city_branch_name
          from (
            select distinct o.country_id, o.country_branch_id, o.city_branch_id
            from public.sales_orders o
            where o.deleted_at is null and o.ledger_posting_status in ('posted','transferred')
              and (${sqlScopeCondition(sql, scope, "o")})
              and (${documentScope(sql, documentSource)})
              and ${paymentEligibility(sql)}
          ) loc
          left join public.countries c on c.id = loc.country_id
          left join public.country_branches m on m.id = loc.country_branch_id
          left join public.city_branches b on b.id = loc.city_branch_id`;
        const readable = await localizeJoinedNames(distinct, viewerLanguage, [
          { idField: "country_id", nameField: "country_name", table: "countries" },
          { idField: "country_branch_id", nameField: "main_branch_name", table: "country_branches" },
          { idField: "city_branch_id", nameField: "city_branch_name", table: "city_branches" },
        ]);
        locations = readable.map(r => ({ countryId: String(r.country_id ?? ""), country: String(r.country_name ?? ""), mainBranchId: String(r.country_branch_id ?? ""), mainBranch: String(r.main_branch_name ?? ""), cityBranchId: String(r.city_branch_id ?? ""), cityBranch: String(r.city_branch_name ?? "") }));
      }
      if (records.length > SALES_LOADING_MAX_RECORDS) return { orders: [], records: [], nextCursor: null, scopeKey, locations, limitReached: true };
      const last = rows.at(-1);
      const nextCursor = source.length > SALES_LOADING_PAGE_SIZE && last ? Buffer.from(JSON.stringify({ created: last.cursor_created_at, id: last.id, snapshot, scopeKey })).toString("base64url") : null;
      return { orders, records, nextCursor, scopeKey, locations };
    });
    if (!result) throw noDb();
    if (orderId && !result.orders.length && !result.limitReached) throw notFound();
    return apiOk({ ...result, canLoad: Boolean(writer), financials: viewFinancials }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "sales", action: "read" });
    authorizeApiScope(session, { resource: "sales", action: "update" });
    const scope = sessionSqlScope(session);
    const { source: documentSource, orderId, containers } = createSalesLoadingSchema.parse(await req.json());
    const result = await withLocalPg(sql => sql.begin(async tx => {
      // Serialize writes for this booking before checking line balances and existing container IDs.
      const [order] = await tx`
        select o.id, o.sales_order_no, o.ledger_posting_status, o.form_data, o.order_total, o.total_goods_original, o.total_goods_usd,
          o.paid_amount, o.currency_code, ${invoiceVerification(tx)} as invoice_finalized
        from public.sales_orders o where o.id = ${orderId}::uuid and o.deleted_at is null
          and o.ledger_posting_status = any(${eligibleStatuses}::text[])
          and (${sqlScopeCondition(tx, scope, "o")})
          and (${documentScope(tx, documentSource)})
          and ${paymentEligibility(tx)} for update of o`;
      if (!order || !order.sales_order_no) throw notFound();
      const readiness = loadingReadiness(order);
      if (readiness !== "ready") throw new ApiClientError("This booking has not met its loading requirements.", { status: 409, code: readiness.toUpperCase() });
      const existing = await tx<Pick<LoadingRecord, "goods" | "container_number">[]>`
        select goods, container_number from public.sales_loading_records where sales_order_id = ${orderId}::uuid`;
      const planned = planSalesLoading(toLoadingOrder(order, false).goods, existing, containers);
      // A registered truck must be an active truck of the central Truck Registration; its number, driver and owner are
      // taken from the registry (never trusted from the form). A temporary truck keeps what the operator typed.
      const truckIds = [...new Set(planned.filter(c => c.truckRegistrationType === "registered").map(c => c.truckId))];
      if (truckIds.length) {
        const trucks = await tx<{ id: string; truck_number: string; driver_name: string | null; driver_mobile: string | null; owner_name: string | null; transport_company: string | null }[]>`
          select id::text as id, truck_number, driver_name, driver_mobile, owner_name, transport_company
          from public.trucks where id = any(${truckIds}::uuid[]) and status = 'active' and coalesce(is_active, true)`;
        const byId = new Map(trucks.map(t => [t.id, t]));
        for (const c of planned) {
          if (c.truckRegistrationType !== "registered") continue;
          const t = byId.get(c.truckId);
          if (!t) throw new ApiClientError("The selected truck is not an active registered truck.", { status: 409, code: "TRUCK_NOT_REGISTERED" });
          Object.assign(c, { vehicle: t.truck_number, driver: t.driver_name || c.driver, driverMobile: t.driver_mobile || c.driverMobile,
            truckOwner: t.owner_name || "", transportCompany: t.transport_company || "" });
        }
      }
      const saved = [];
      for (const { items, containerNumber, containerType, loadingDate, receivedDate, ...details } of planned) {
        const [row] = await tx`
          insert into public.sales_loading_records
            (sales_order_id, sales_booking_no, container_number, container_type, loading_date,
              received_date, details, goods, created_by, created_by_name)
          values (${orderId}::uuid, ${order.sales_order_no}, ${containerNumber}, ${containerType},
            ${loadingDate}::date, ${receivedDate}::date, ${tx.json(details)}, ${tx.json(items)},
            ${session.userId}::uuid, ${session.fullName || session.email || null})
          returning id, entry_no, container_number`;
        saved.push(row);
      }
      return saved;
    }));
    if (!result) throw noDb();
    return apiCreated({ records: result });
  } catch (error) {
    if (error instanceof LoadingValidationError) return handleApiError(new ApiClientError(error.message, { status: 409, code: error.reason }));
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "sales", action: "read" });
    authorizeApiScope(session, { resource: "sales", action: "update" });
    const scope = sessionSqlScope(session);
    const { source: documentSource, id, receivedDate, receivedCountry, receivedPort } = updateSchema.parse(await req.json());
    const result = await withLocalPg(sql => sql.begin(async tx => {
      const [record] = await tx`
        select l.loading_date::text as loading_date from public.sales_loading_records l inner join public.sales_orders o on o.id = l.sales_order_id
        where l.id = ${id}::uuid and o.deleted_at is null and o.ledger_posting_status = any(${eligibleStatuses}::text[])
          and (${sqlScopeCondition(tx, scope, "o")})
          and (${documentScope(tx, documentSource)})
          and ${paymentEligibility(tx)} for update of l`;
      if (!record) throw notFound();
      if (receivedDate && receivedDate < String(record.loading_date).slice(0, 10)) {
        throw new ApiClientError("Received date cannot precede loading date.");
      }
      const [updated] = await tx`
        update public.sales_loading_records
        set received_date = ${receivedDate}::date,
          details = details || ${tx.json({ receivedCountry, receivedPort })}, updated_at = now()
        where id = ${id}::uuid returning id, received_date::text as received_date`;
      return updated;
    }));
    if (!result) throw noDb();
    return apiOk({ record: result });
  } catch (error) { return handleApiError(error); }
}
