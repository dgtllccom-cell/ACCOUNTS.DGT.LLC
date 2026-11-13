export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, recordInSessionScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { billDetailOf, loadDetailOf, transferDetailOf } from "@/lib/stock/register-detail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/erp/stock/warehouse-register/detail?kind=bill&type=booking|local&id=  -> one purchase bill with all its entries
 * GET /api/erp/stock/warehouse-register/detail?kind=loading&id=                  -> one loading entry with its history
 * GET /api/erp/stock/warehouse-register/detail?kind=transfer&id=                 -> one stock transfer
 * Reads the existing purchase, lane, transfer and event tables only. Writes nothing. Out-of-scope records return NOT_FOUND.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId: null, countryBranchId: null, cityBranchId: null });
    void (await getRequestLanguage(request.nextUrl.searchParams.get("lang")));
    const sp = request.nextUrl.searchParams;
    const kind = sp.get("kind");
    const id = sp.get("id") ?? "";
    if (!UUID.test(id)) return apiError("INVALID_ID", "A valid record id is required", 400);

    if (kind === "bill") {
      const type = sp.get("type") === "local" ? "local" : "booking";
      const data = await withLocalPg(async (sql) => {
        const [bill] = type === "booking"
          ? await sql`select o.id, o.purchase_order_no, o.created_at, o.purchase_currency, o.currency_code, o.exchange_rate, o.order_total,
                             o.status, o.payment_status, o.form_data, o.country_id, o.country_branch_id, o.city_branch_id,
                             coalesce(c.name, '') as country_name,
                             nullif(concat_ws(' / ', nullif(cb.name, ''), nullif(coalesce(cib.name, cib.city_name), '')), '') as branch_label
                      from public.purchase_orders o
                      left join public.countries c on c.id = o.country_id
                      left join public.country_branches cb on cb.id = o.country_branch_id
                      left join public.city_branches cib on cib.id = o.city_branch_id
                      where o.id = ${id} and o.deleted_at is null`
          : await sql`select lp.id, lp.journal_serial_no, lp.manual_bill_no, lp.supplier_name, lp.sales_account_no, lp.goods_name,
                             lp.quantity_name, lp.quantity_kgs, lp.total_gross_weight, lp.net_weight, lp.purchase_cost, lp.final_cost,
                             lp.purchase_currency, lp.exchange_rate, lp.status, lp.payment_mode, lp.created_at,
                             lp.country_id, lp.country_branch_id, lp.city_branch_id,
                             coalesce(c.name, '') as country_name,
                             nullif(concat_ws(' / ', nullif(cb.name, ''), nullif(coalesce(cib.name, cib.city_name), '')), '') as branch_label
                      from public.local_purchases lp
                      left join public.countries c on c.id = lp.country_id
                      left join public.country_branches cb on cb.id = lp.country_branch_id
                      left join public.city_branches cib on cib.id = lp.city_branch_id
                      where lp.id = ${id} and lp.deleted_at is null`;
        if (!bill) return null;
        const loads = type === "booking"
          ? await sql`select * from public.purchase_lane_loads where purchase_order_id = ${id} and deleted_at is null order by loading_date nulls last, loading_record_no nulls last`
          : await sql`select * from public.purchase_lane_loads where local_purchase_id = ${id} and deleted_at is null order by loading_date nulls last, loading_record_no nulls last`;
        const transfers = type === "booking"
          ? await sql`select t.*, w.warehouse_name as warehouse_label from public.journal_stock_transfers t left join public.warehouses w on w.id = t.warehouse_id where t.purchase_order_id = ${id} and t.deleted_at is null order by t.transfer_date nulls last`
          : await sql`select t.*, w.warehouse_name as warehouse_label from public.journal_stock_transfers t left join public.warehouses w on w.id = t.warehouse_id where t.local_purchase_id = ${id} and t.deleted_at is null order by t.transfer_date nulls last`;
        return { bill, loads, transfers };
      });
      if (!data) return apiError("NOT_FOUND", "Purchase record not found", 404);
      if (!recordInSessionScope(session, data.bill as never)) return apiError("NOT_FOUND", "Purchase record not found", 404);
      const warehouseNames = new Map<string, string>();
      for (const t of data.transfers as Record<string, unknown>[]) {
        if (t.warehouse_id && t.warehouse_label) warehouseNames.set(String(t.warehouse_id), String(t.warehouse_label));
      }
      const detail = billDetailOf(type, data.bill as Record<string, unknown>, data.loads as Record<string, unknown>[], data.transfers as Record<string, unknown>[], warehouseNames);
      return apiOk({ detail });
    }

    if (kind === "loading") {
      const data = await withLocalPg(async (sql) => {
        const [lane] = await sql`select * from public.purchase_lane_loads where id = ${id} and deleted_at is null`;
        if (!lane) return null;
        const events = await sql`select * from public.purchase_lane_events where lane_load_id = ${id} order by created_at`;
        return { lane, events };
      });
      if (!data || !recordInSessionScope(session, data.lane as never)) return apiError("NOT_FOUND", "Loading entry not found", 404);
      return apiOk({ detail: loadDetailOf(data.lane as Record<string, unknown>, data.events as Record<string, unknown>[]) });
    }

    if (kind === "transfer") {
      const data = await withLocalPg(async (sql) => {
        const [t] = await sql`select t.*, w.warehouse_name as warehouse_label, lo.loading_record_no as loading_label
                              from public.journal_stock_transfers t
                              left join public.warehouses w on w.id = t.warehouse_id
                              left join public.purchase_loading_records lo on lo.id = t.loading_record_id
                              where t.id = ${id} and t.deleted_at is null`;
        if (!t) return null;
        const [po] = t.purchase_order_id ? await sql`select purchase_order_no as ref from public.purchase_orders where id = ${t.purchase_order_id}` : [];
        const [lp] = !po && t.local_purchase_id ? await sql`select journal_serial_no as ref from public.local_purchases where id = ${t.local_purchase_id}` : [];
        return { t, ref: (po?.ref ?? lp?.ref ?? "") as string, billType: t.purchase_order_id ? "booking" : t.local_purchase_id ? "local" : null, billId: t.purchase_order_id ?? t.local_purchase_id ?? null };
      });
      if (!data || !recordInSessionScope(session, data.t as never)) return apiError("NOT_FOUND", "Transfer not found", 404);
      const detail = transferDetailOf(
        data.t as Record<string, unknown>,
        String((data.t as Record<string, unknown>).warehouse_label ?? ""),
        data.billType as "booking" | "local" | null,
        data.billId ? String(data.billId) : null,
        data.ref || "—"
      );
      return apiOk({ detail });
    }

    return apiError("INVALID_KIND", "kind must be bill, loading or transfer", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
