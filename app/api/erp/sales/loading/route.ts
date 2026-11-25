import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { apiCreated, apiOk, ApiClientError, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames, localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { createSalesLoadingSchema, loadingReadiness, LoadingValidationError, planSalesLoading, receivingSchema, toLoadingOrder, type LoadingRecord } from "@/lib/sales/loading-workflow";

export const dynamic = "force-dynamic";
const querySchema = z.object({ orderId: z.string().uuid().optional(), offset: z.coerce.number().int().min(0).max(100000).default(0), lang: z.enum(["en", "ur", "ar", "fa", "ps"]).optional() });
const updateSchema = receivingSchema.extend({ id: z.string().uuid() });
const PAGE_SIZE = 500;
const eligibleStatuses = ["posted", "transferred"];
const noDb = () => new ApiClientError("Sales Loading storage is not configured.", { status: 503, code: "STORAGE_UNAVAILABLE" });
const notFound = () => new ApiClientError("This transferred Sales Booking is not available.", { status: 404, code: "ORDER_NOT_FOUND" });

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
    const { orderId, offset, lang } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const viewerLanguage = await getRequestLanguage(lang);
    const result = await withReadPg(async sql => {
      const source = await sql`
        select o.id, o.sales_order_no, o.sales_contract_no, o.order_date::text as order_date, o.customer_name,
          o.form_data, o.order_total, o.total_goods_original, o.total_goods_usd, o.paid_amount, o.currency_code, o.ledger_posting_status, o.country_id, o.country_branch_id, o.city_branch_id,
          c.name as country_name, m.name as main_branch_name, coalesce(b.name, b.city_name) as city_branch_name,
          ${invoiceVerification(sql)} as invoice_finalized
        from public.sales_orders o
        left join public.countries c on c.id = o.country_id
        left join public.country_branches m on m.id = o.country_branch_id
        left join public.city_branches b on b.id = o.city_branch_id
        where o.deleted_at is null and o.ledger_posting_status = any(${eligibleStatuses}::text[])
          and (${sqlScopeCondition(sql, scope, "o")})
          and (${orderId ? sql`o.id = ${orderId}::uuid` : sql`true`})
        order by o.order_date desc nulls last, o.id limit ${PAGE_SIZE + 1} offset ${offset}`;
      const rows = source.slice(0, PAGE_SIZE);
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
        order by loading_date desc, entry_no desc` : [];
      return { orders, records, nextOffset: source.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
    });
    if (!result) throw noDb();
    if (orderId && !result.orders.length) throw notFound();
    return apiOk({ ...result, canLoad: Boolean(writer), financials: viewFinancials });
  } catch (error) { return handleApiError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "sales", action: "read" });
    authorizeApiScope(session, { resource: "sales", action: "update" });
    const scope = sessionSqlScope(session);
    const { orderId, containers } = createSalesLoadingSchema.parse(await req.json());
    const result = await withLocalPg(sql => sql.begin(async tx => {
      // Serialize writes for this booking before checking line balances and existing container IDs.
      const [order] = await tx`
        select o.id, o.sales_order_no, o.ledger_posting_status, o.form_data, o.order_total, o.total_goods_original, o.total_goods_usd,
          o.paid_amount, o.currency_code, ${invoiceVerification(tx)} as invoice_finalized
        from public.sales_orders o where o.id = ${orderId}::uuid and o.deleted_at is null
          and o.ledger_posting_status = any(${eligibleStatuses}::text[])
          and (${sqlScopeCondition(tx, scope, "o")}) for update of o`;
      if (!order || !order.sales_order_no) throw notFound();
      const readiness = loadingReadiness(order);
      if (readiness !== "ready") throw new ApiClientError("This booking has not met its loading requirements.", { status: 409, code: readiness.toUpperCase() });
      const existing = await tx<Pick<LoadingRecord, "goods" | "container_number">[]>`
        select goods, container_number from public.sales_loading_records where sales_order_id = ${orderId}::uuid`;
      const planned = planSalesLoading(toLoadingOrder(order, false).goods, existing, containers);
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
    const { id, receivedDate, receivedCountry, receivedPort } = updateSchema.parse(await req.json());
    const result = await withLocalPg(sql => sql.begin(async tx => {
      const [record] = await tx`
        select l.loading_date::text as loading_date from public.sales_loading_records l inner join public.sales_orders o on o.id = l.sales_order_id
        where l.id = ${id}::uuid and o.deleted_at is null and o.ledger_posting_status = any(${eligibleStatuses}::text[])
          and (${sqlScopeCondition(tx, scope, "o")}) for update of l`;
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
