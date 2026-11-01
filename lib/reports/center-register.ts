/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The Reports Center register: ONE server-side loader for the Business and the Shipping Line domain.
 *
 * Reads the original saved ERP records (purchase / local purchase / sales orders, their payments, Roznamcha vouchers; Shipping orders, clearing
 * bills, customer bills, receipts) - nothing is invented: a value the record does not carry is empty, never a placeholder.
 * Row scope is the one shared SQL scope rule (sessionSqlScope): Super Admin everything, country roles their country, branch roles their branch;
 * an explicit country / branch / user filter can only narrow it (a filter outside the login's scope is a 403). Business and Shipping stay apart:
 * a Shipping-only login never gets Business rows (they carry Business amounts) and the other way round.
 * Money is never added across currencies (see center-totals.ts).
 */

import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { assertExplicitScopeAllowed, sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ErpPermissionError, canAccessCityBranch, canAccessCountryBranch, isGlobalSession } from "@/lib/permissions/middleware";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { reportScopeLevel, sessionReportDomains } from "@/lib/reports/report-access";
import { type CenterDomain, type CenterRow, CENTER_TYPES, purchaseTotalInOrderCurrency } from "@/lib/reports/center-totals";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type CenterFilters = {
  domain: CenterDomain;
  search?: string;
  type?: string;
  countryId?: string;
  branchId?: string;
  userId?: string;
  from?: string;
  to?: string;
  status?: string;
  currency?: string;
};

export const PER_SOURCE_LIMIT = 1000;

const ASSIGNED_ONLY_ROLES = ["agent_user", "shipping_line_user", "shipping_line_admin"];
const isoDay = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
};
const n = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const s = (v: unknown) => (v == null ? "" : String(v).trim());
const stat = (v: unknown) => s(v).toLowerCase();

function blank(partial: Partial<CenterRow> & Pick<CenterRow, "key" | "domain" | "type" | "source">): CenterRow {
  return {
    serial: 0, date: "", entryNo: "", referenceNo: "", party: "", countryName: "", branchName: "", userName: "", currency: "", amount: null, balance: null,
    status: "", counted: true, blNumber: "", container: "", truck: "", shipment: "", clearingStatus: "", ...partial
  };
}

/** Throws a 403 when the requested domain is not one this login may report on. */
export function assertDomainAllowed(session: ErpSession, domain: CenterDomain) {
  const d = sessionReportDomains(session);
  if (domain === "business" && !d.business) throw new ErpPermissionError("Business reports are not available to a Shipping-only login.");
  if (domain === "shipping" && !d.shipping) throw new ErpPermissionError("Shipping Line reports are not available to a Business-only login.");
}

/** The domain a login opens by default (Business first when it has both). */
export function defaultDomain(session: ErpSession): CenterDomain {
  const d = sessionReportDomains(session);
  return d.business ? "business" : "shipping";
}

export async function loadCenterRows(session: ErpSession, f: CenterFilters): Promise<{ rows: CenterRow[]; truncated: boolean; statuses: string[]; currencies: string[] }> {
  assertDomainAllowed(session, f.domain);
  if (f.countryId) assertExplicitScopeAllowed(session, { countryId: f.countryId });
  if (f.branchId && !isGlobalSession(session) && !canAccessCityBranch(session, f.branchId) && !canAccessCountryBranch(session, f.branchId)) {
    throw new ErpPermissionError("This branch is outside your authorized scope.");
  }

  const scope = sessionSqlScope(session);
  const roles: string[] = session.roles ?? [];
  const assignedOnly = !session.isSuperAdmin && (Boolean((session as any).isShippingScoped) || (roles.length > 0 && roles.every((r) => ASSIGNED_ONLY_ROLES.includes(r))));
  const search = s(f.search).toLowerCase();
  const like = search ? `%${search.replace(/[%_\\]/g, (c) => "\\" + c)}%` : null;
  const wantType = (t: string) => !f.type || f.type === "all" || f.type === t;

  const out = await withLocalPg(async (sql) => {
    const rows: CenterRow[] = [];
    let truncated = false;
    // every source is queried at once (one pipelined connection): the register costs one round trip, not one per source
    const jobs: Array<Promise<void>> = [];
    const place = (a: string, opts: { dest?: boolean } = {}) => {
      const base = sqlScopeCondition(sql, scope, a);
      const own = opts.dest ? sql`(${base} OR ${sqlScopeCondition(sql, scope, a, { prefix: "dest_" })})` : base;
      return sql`${own}
        ${f.countryId ? sql`AND ${sql.unsafe(a + ".country_id")} = ${f.countryId}::uuid` : sql``}
        ${f.branchId ? sql`AND (${sql.unsafe(a + ".city_branch_id")} = ${f.branchId}::uuid OR ${sql.unsafe(a + ".country_branch_id")} = ${f.branchId}::uuid)` : sql``}
        ${f.userId ? sql`AND ${sql.unsafe(a + ".created_by")} = ${f.userId}::uuid` : sql``}
        ${assignedOnly ? sql`AND ${sql.unsafe(a + ".created_by")} = ${session.userId}::uuid` : sql``}`;
    };
    const between = (col: string) => sql`${f.from ? sql`AND ${sql.unsafe(col)} >= ${f.from}::date` : sql``} ${f.to ? sql`AND ${sql.unsafe(col)} <= ${f.to}::date` : sql``}`;
    const cap = (list: any[]) => { if (list.length >= PER_SOURCE_LIMIT) truncated = true; return list; };

    if (f.domain === "business") {
      // ── purchase orders (Purchase Booking) ───────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("purchase_booking")) {
        const list = cap(await sql`
          select po.id::text id, po.purchase_order_no, po.purchase_contract_no, po.currency_code, po.exchange_rate, po.order_total, po.total_goods_original, po.total_goods_usd,
                 po.remaining_due, po.payment_status::text payment_status, po.status::text status, po.created_at,
                 po.form_data->'form'->>'manualBillNumber' manual_bill, po.form_data->'form'->>'supplierName' form_supplier,
                 comp.name supplier_name, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from purchase_orders po
          left join companies comp on comp.id = po.supplier_company_id
          left join countries co on co.id = po.country_id
          left join city_branches cib on cib.id = po.city_branch_id
          left join country_branches cb on cb.id = po.country_branch_id
          left join profiles pr on pr.id = po.created_by
          where po.deleted_at is null and ${place("po", { dest: true })} ${between("po.created_at::date")}
            ${like ? sql`and (lower(po.purchase_order_no) like ${like} or lower(coalesce(po.purchase_contract_no,'')) like ${like} or lower(coalesce(comp.name, po.form_data->'form'->>'supplierName','')) like ${like})` : sql``}
          order by po.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          const total = purchaseTotalInOrderCurrency(r);
          rows.push(blank({
            key: `purchase_orders:${r.id}`, domain: "business", type: "purchase_booking", source: { table: "purchase_orders", id: r.id },
            date: isoDay(r.created_at), entryNo: s(r.purchase_order_no), referenceNo: s(r.purchase_contract_no) || s(r.manual_bill), party: s(r.supplier_name) || s(r.form_supplier),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.currency_code).toUpperCase(), amount: total,
            balance: n(r.remaining_due), status: s(r.payment_status) || s(r.status)
          }));
        }
      }
      })());

      // ── local purchases ──────────────────────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("local_purchase")) {
        const list = cap(await sql`
          select lp.id::text id, lp.manual_bill_no, lp.contract_no, lp.supplier_name, lp.purchase_cost, lp.purchase_currency, lp.remaining_balance, lp.status::text status, lp.created_at,
                 co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from local_purchases lp
          left join countries co on co.id = lp.country_id
          left join city_branches cib on cib.id = lp.city_branch_id
          left join country_branches cb on cb.id = lp.country_branch_id
          left join profiles pr on pr.id = lp.created_by
          where lp.deleted_at is null and ${place("lp")} ${between("lp.created_at::date")}
            ${like ? sql`and (lower(coalesce(lp.manual_bill_no,'')) like ${like} or lower(coalesce(lp.contract_no,'')) like ${like} or lower(coalesce(lp.supplier_name,'')) like ${like})` : sql``}
          order by lp.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          rows.push(blank({
            key: `local_purchases:${r.id}`, domain: "business", type: "local_purchase", source: { table: "local_purchases", id: r.id },
            date: isoDay(r.created_at), entryNo: s(r.manual_bill_no) || s(r.id).slice(0, 8).toUpperCase(), referenceNo: s(r.contract_no), party: s(r.supplier_name),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.purchase_currency).toUpperCase(), amount: n(r.purchase_cost),
            balance: n(r.remaining_balance), status: s(r.status)
          }));
        }
      }
      })());

      // ── sales orders (Sales Booking / Local Sales) ───────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("sales_booking") || wantType("local_sales")) {
        const list = cap(await sql`
          select so.id::text id, so.sales_order_no, so.sales_contract_no, so.customer_name, so.currency_code, so.order_total, so.remaining_amount, so.sales_status::text sales_status,
                 so.payment_status::text payment_status, coalesce(so.order_date::timestamp, so.created_at) dated, so.form_data->'form'->>'salesType' sales_type,
                 co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from sales_orders so
          left join countries co on co.id = so.country_id
          left join city_branches cib on cib.id = so.city_branch_id
          left join country_branches cb on cb.id = so.country_branch_id
          left join profiles pr on pr.id = so.created_by
          where so.deleted_at is null and ${place("so", { dest: true })} ${between("coalesce(so.order_date, so.created_at::date)")}
            ${like ? sql`and (lower(so.sales_order_no) like ${like} or lower(coalesce(so.sales_contract_no,'')) like ${like} or lower(coalesce(so.customer_name,'')) like ${like})` : sql``}
          order by so.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          const local = stat(r.sales_type) === "local" || /^LS-/i.test(s(r.sales_order_no));
          const type = local ? "local_sales" : "sales_booking";
          if (!wantType(type)) continue;
          rows.push(blank({
            key: `sales_orders:${r.id}`, domain: "business", type, source: { table: "sales_orders", id: r.id },
            date: isoDay(r.dated), entryNo: s(r.sales_order_no), referenceNo: s(r.sales_contract_no), party: s(r.customer_name),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.currency_code).toUpperCase(), amount: n(r.order_total),
            balance: n(r.remaining_amount), status: s(r.payment_status) || s(r.sales_status)
          }));
        }
      }
      })());

      // ── purchase payments (Advance / Remaining / Final) ──────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("advance_payment") || wantType("remaining_payment") || wantType("final_payment")) {
        const list = cap(await sql`
          select pop.id::text id, pop.kind::text kind, pop.entry_date, pop.amount, pop.currency_code, pop.status::text status, pop.reference_no, pop.source_reference_no, pop.created_at,
                 po.purchase_order_no, coalesce(comp.name, po.form_data->'form'->>'supplierName') party, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from purchase_order_payments pop
          join purchase_orders po on po.id = pop.purchase_order_id and po.deleted_at is null
          left join companies comp on comp.id = po.supplier_company_id
          left join countries co on co.id = po.country_id
          left join city_branches cib on cib.id = po.city_branch_id
          left join country_branches cb on cb.id = po.country_branch_id
          left join profiles pr on pr.id = pop.created_by
          where pop.deleted_at is null and pop.kind::text in ('advance','remaining','credit','endorsement','final')
            and ${sqlScopeCondition(sql, scope, "po")}
            ${f.countryId ? sql`and po.country_id = ${f.countryId}::uuid` : sql``}
            ${f.branchId ? sql`and (po.city_branch_id = ${f.branchId}::uuid or po.country_branch_id = ${f.branchId}::uuid)` : sql``}
            ${f.userId ? sql`and pop.created_by = ${f.userId}::uuid` : sql``}
            ${assignedOnly ? sql`and pop.created_by = ${session.userId}::uuid` : sql``}
            ${between("coalesce(pop.entry_date, pop.created_at::date)")}
            ${like ? sql`and (lower(po.purchase_order_no) like ${like} or lower(coalesce(pop.reference_no,'')) like ${like} or lower(coalesce(comp.name, po.form_data->'form'->>'supplierName','')) like ${like})` : sql``}
          order by coalesce(pop.entry_date, pop.created_at::date) desc, pop.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          const kind = stat(r.kind);
          const type = kind === "advance" || kind === "endorsement" ? "advance_payment" : kind === "remaining" ? "remaining_payment" : "final_payment";
          if (!wantType(type)) continue;
          rows.push(blank({
            key: `purchase_order_payments:${r.id}`, domain: "business", type, source: { table: "purchase_order_payments", id: r.id },
            date: isoDay(r.entry_date || r.created_at), entryNo: s(r.reference_no) || s(r.source_reference_no) || s(r.id).slice(0, 8).toUpperCase(), referenceNo: s(r.purchase_order_no), party: s(r.party),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.currency_code).toUpperCase(), amount: n(r.amount),
            status: s(r.status), counted: stat(r.status) === "posted"
          }));
        }
      }
      })());

      // ── sales payments ───────────────────────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("advance_payment") || wantType("remaining_payment") || wantType("final_payment")) {
        const list = cap(await sql`
          select sp.id::text id, sp.payment_kind::text kind, sp.payment_date, sp.amount, sp.currency_code, sp.status::text status, sp.manual_reference_number, sp.created_at,
                 so.sales_order_no, so.customer_name party, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from sales_order_payments sp
          join sales_orders so on so.id = sp.sales_order_id and so.deleted_at is null
          left join countries co on co.id = so.country_id
          left join city_branches cib on cib.id = so.city_branch_id
          left join country_branches cb on cb.id = so.country_branch_id
          left join profiles pr on pr.id = sp.created_by
          where sp.deleted_at is null and sp.payment_kind::text in ('advance','remaining','credit','endorsement','final')
            and ${sqlScopeCondition(sql, scope, "so")}
            ${f.countryId ? sql`and so.country_id = ${f.countryId}::uuid` : sql``}
            ${f.branchId ? sql`and (so.city_branch_id = ${f.branchId}::uuid or so.country_branch_id = ${f.branchId}::uuid)` : sql``}
            ${f.userId ? sql`and sp.created_by = ${f.userId}::uuid` : sql``}
            ${assignedOnly ? sql`and sp.created_by = ${session.userId}::uuid` : sql``}
            ${between("coalesce(sp.payment_date, sp.created_at::date)")}
            ${like ? sql`and (lower(so.sales_order_no) like ${like} or lower(coalesce(sp.manual_reference_number,'')) like ${like} or lower(coalesce(so.customer_name,'')) like ${like})` : sql``}
          order by coalesce(sp.payment_date, sp.created_at::date) desc, sp.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          const kind = stat(r.kind);
          const type = kind === "advance" || kind === "endorsement" ? "advance_payment" : kind === "remaining" ? "remaining_payment" : "final_payment";
          if (!wantType(type)) continue;
          rows.push(blank({
            key: `sales_order_payments:${r.id}`, domain: "business", type, source: { table: "sales_order_payments", id: r.id },
            date: isoDay(r.payment_date || r.created_at), entryNo: s(r.manual_reference_number) || s(r.id).slice(0, 8).toUpperCase(), referenceNo: s(r.sales_order_no), party: s(r.party),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.currency_code).toUpperCase(), amount: n(r.amount),
            status: s(r.status), counted: stat(r.status) === "posted"
          }));
        }
      }
      })());

      // ── Roznamcha vouchers that are NOT the posting of a purchase / sales payment (those are the payment rows above - never counted twice) ─
      jobs.push((async () => {
      if (wantType("cash_entry") || wantType("bank_entry") || wantType("journal_entry")) {
        const list = cap(await sql`
          select re.id::text id, re.voucher_no, re.journal_no, re.reference_no, re.narration, re.entry_date, re.status::text status, re.bank_id, re.created_at,
                 (select coalesce(sum(rl.debit),0) from roznamcha_lines rl where rl.roznamcha_entry_id = re.id) amount,
                 coalesce(nullif(re.original_currency_code,''), (select rl.currency from roznamcha_lines rl where rl.roznamcha_entry_id = re.id and rl.currency is not null limit 1)) currency,
                 re.source_module, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from roznamcha_entries re
          left join countries co on co.id = re.country_id
          left join city_branches cib on cib.id = re.city_branch_id
          left join country_branches cb on cb.id = re.country_branch_id
          left join profiles pr on pr.id = re.created_by
          where re.deleted_at is null and ${place("re")}
            and coalesce(re.entry_category, re.operational_domain, 'business') <> 'shipping'
            and coalesce(re.source_module,'') not in ('purchase','sales','local_purchase','local_sales')
            ${between("coalesce(re.entry_date, re.created_at::date)")}
            ${like ? sql`and (lower(coalesce(re.voucher_no,'')) like ${like} or lower(coalesce(re.journal_no,'')) like ${like} or lower(coalesce(re.reference_no,'')) like ${like} or lower(coalesce(re.narration,'')) like ${like})` : sql``}
          order by coalesce(re.entry_date, re.created_at::date) desc, re.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          const type = r.bank_id ? "bank_entry" : s(r.voucher_no || r.journal_no) ? "cash_entry" : "journal_entry";
          if (!wantType(type)) continue;
          rows.push(blank({
            key: `roznamcha_entries:${r.id}`, domain: "business", type, source: { table: "roznamcha_entries", id: r.id },
            date: isoDay(r.entry_date || r.created_at), entryNo: s(r.voucher_no) || s(r.journal_no), referenceNo: s(r.reference_no), party: s(r.narration).slice(0, 80),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), currency: s(r.currency).toUpperCase(), amount: n(r.amount),
            status: s(r.status), counted: stat(r.status) === "posted"
          }));
        }
      }
      })());
    } else {
      // ── Shipping orders ──────────────────────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("shipping_order")) {
        const list = cap(await sql`
          select o.id::text id, o.order_no, o.customer_name, o.shipment_type, o.transport_mode, o.movement_type, o.status::text status, o.current_stage, o.truck_number,
                 o.loading_source_container_ref, o.route_name, o.created_by::text created_by, o.clearing_agent_id::text clearing_agent_id, o.created_at,
                 o.loading_country_name, o.receiving_country_name, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from clearing_customer_orders o
          left join countries co on co.id = o.country_id
          left join city_branches cib on cib.id = o.city_branch_id
          left join country_branches cb on cb.id = o.country_branch_id
          left join profiles pr on pr.id = o.created_by
          where o.deleted_at is null and ${sqlScopeCondition(sql, scope, "o")}
            ${f.countryId ? sql`and o.country_id = ${f.countryId}::uuid` : sql``}
            ${f.branchId ? sql`and (o.city_branch_id = ${f.branchId}::uuid or o.country_branch_id = ${f.branchId}::uuid)` : sql``}
            ${f.userId ? sql`and o.created_by = ${f.userId}::uuid` : sql``}
            ${between("o.created_at::date")}
            ${like ? sql`and (lower(o.order_no) like ${like} or lower(coalesce(o.customer_name,'')) like ${like} or lower(coalesce(o.truck_number,'')) like ${like} or lower(coalesce(o.loading_source_container_ref,'')) like ${like})` : sql``}
          order by o.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          // the order's own assignment rules (assigned-only logins open only their orders) are the final gate
          if (!canAccessOrder(session, { created_by: r.created_by, clearing_agent_id: r.clearing_agent_id, country_id: null })) {
            if (assignedOnly) continue;
          }
          rows.push(blank({
            key: `clearing_customer_orders:${r.id}`, domain: "shipping", type: "shipping_order", source: { table: "clearing_customer_orders", id: r.id },
            date: isoDay(r.created_at), entryNo: s(r.order_no), referenceNo: s(r.route_name), party: s(r.customer_name),
            countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name), status: s(r.status),
            container: s(r.loading_source_container_ref), truck: s(r.truck_number), shipment: [s(r.shipment_type), s(r.transport_mode)].filter(Boolean).join(" / "), clearingStatus: s(r.current_stage)
          }));
        }
      }
      })());

      // ── clearing / payment bills ─────────────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("clearing_bill")) {
        const list = cap(await sql`
          select b.id::text id, b.bill_no, b.order_no, b.bl_number, b.gd_number, b.agent_name, b.total_amount, b.currency_code, b.remaining_balance, b.payment_status::text payment_status,
                 b.status::text status, b.created_at, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from clearing_payment_bills b
          left join countries co on co.id = b.country_id
          left join city_branches cib on cib.id = b.city_branch_id
          left join country_branches cb on cb.id = b.country_branch_id
          left join profiles pr on pr.id = b.created_by
          where b.deleted_at is null and ${place("b")} ${between("b.created_at::date")}
            ${like ? sql`and (lower(coalesce(b.bill_no,'')) like ${like} or lower(coalesce(b.order_no,'')) like ${like} or lower(coalesce(b.bl_number,'')) like ${like} or lower(coalesce(b.agent_name,'')) like ${like})` : sql``}
          order by b.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          rows.push(blank({
            key: `clearing_payment_bills:${r.id}`, domain: "shipping", type: "clearing_bill", source: { table: "clearing_payment_bills", id: r.id },
            date: isoDay(r.created_at), entryNo: s(r.bill_no), referenceNo: s(r.order_no), party: s(r.agent_name), countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name),
            currency: s(r.currency_code).toUpperCase(), amount: n(r.total_amount), balance: n(r.remaining_balance), status: s(r.payment_status) || s(r.status), blNumber: s(r.bl_number)
          }));
        }
      }
      })());

      // ── customer bills (customer charges) ────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("customer_bill")) {
        const list = cap(await sql`
          select c.id::text id, c.charge_type, c.amount, c.currency_code, c.posting_status::text posting_status, c.created_at, o.order_no, o.customer_name,
                 co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from clearing_bill_customer_charges c
          join clearing_customer_orders o on o.id = c.order_id and o.deleted_at is null
          left join countries co on co.id = o.country_id
          left join city_branches cib on cib.id = o.city_branch_id
          left join country_branches cb on cb.id = o.country_branch_id
          left join profiles pr on pr.id = c.created_by
          where c.deleted_at is null and ${sqlScopeCondition(sql, scope, "o")}
            ${f.countryId ? sql`and o.country_id = ${f.countryId}::uuid` : sql``}
            ${f.branchId ? sql`and (o.city_branch_id = ${f.branchId}::uuid or o.country_branch_id = ${f.branchId}::uuid)` : sql``}
            ${f.userId ? sql`and c.created_by = ${f.userId}::uuid` : sql``}
            ${assignedOnly ? sql`and (c.created_by = ${session.userId}::uuid or o.created_by = ${session.userId}::uuid)` : sql``}
            ${between("c.created_at::date")}
            ${like ? sql`and (lower(coalesce(o.order_no,'')) like ${like} or lower(coalesce(o.customer_name,'')) like ${like} or lower(coalesce(c.charge_type,'')) like ${like})` : sql``}
          order by c.created_at desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          rows.push(blank({
            key: `clearing_bill_customer_charges:${r.id}`, domain: "shipping", type: "customer_bill", source: { table: "clearing_bill_customer_charges", id: r.id },
            date: isoDay(r.created_at), entryNo: s(r.charge_type), referenceNo: s(r.order_no), party: s(r.customer_name), countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name),
            currency: s(r.currency_code).toUpperCase(), amount: n(r.amount), status: s(r.posting_status), counted: stat(r.posting_status) !== "cancelled"
          }));
        }
      }
      })());

      // ── receipts (Shipping payments) ─────────────────────────────────────────────────────────────────
      jobs.push((async () => {
      if (wantType("shipping_payment")) {
        const list = cap(await sql`
          select r.id::text id, r.receipt_no, r.receipt_date, r.amount, r.currency_code, r.status::text status, r.payment_method, r.created_at,
                 coalesce(nullif(cu.customer_name, ''), cu.company_name) party, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
          from customer_receipts r
          left join customers cu on cu.id = r.customer_id
          left join countries co on co.id = r.country_id
          left join city_branches cib on cib.id = r.city_branch_id
          left join country_branches cb on cb.id = r.country_branch_id
          left join profiles pr on pr.id = r.created_by
          where r.deleted_at is null and ${place("r")} ${between("coalesce(r.receipt_date, r.created_at::date)")}
            ${like ? sql`and (lower(coalesce(r.receipt_no,'')) like ${like} or lower(coalesce(cu.customer_name, cu.company_name,'')) like ${like})` : sql``}
          order by coalesce(r.receipt_date, r.created_at::date) desc limit ${PER_SOURCE_LIMIT}`);
        for (const r of list) {
          rows.push(blank({
            key: `customer_receipts:${r.id}`, domain: "shipping", type: "shipping_payment", source: { table: "customer_receipts", id: r.id },
            date: isoDay(r.receipt_date || r.created_at), entryNo: s(r.receipt_no), referenceNo: s(r.payment_method), party: s(r.party), countryName: s(r.country_name), branchName: s(r.branch_name), userName: s(r.user_name),
            currency: s(r.currency_code).toUpperCase(), amount: n(r.amount), status: s(r.status), counted: stat(r.status) !== "cancelled"
          }));
        }
      }
      })());
    }
    await Promise.all(jobs);
    return { rows, truncated };
  });

  let rows = out?.rows ?? [];
  // the status / currency pick-lists describe everything the scope holds for this selection, before those two filters narrow it
  const statuses = [...new Set(rows.map((r) => r.status).filter(Boolean))].sort();
  const currencies = [...new Set(rows.map((r) => r.currency).filter(Boolean))].sort();
  const status = stat(f.status);
  if (status && status !== "all") rows = rows.filter((r) => stat(r.status) === status);
  const currency = s(f.currency).toUpperCase();
  if (currency && currency !== "ALL") rows = rows.filter((r) => r.currency === currency);
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.entryNo.localeCompare(b.entryNo));
  rows.forEach((r, i) => { r.serial = i + 1; });
  return { rows, truncated: Boolean(out?.truncated), statuses, currencies };
}


export type CenterFilterOptions = {
  countries: Array<{ id: string; name: string }>;
  mainBranches: Array<{ id: string; name: string; countryId: string }>;
  cityBranches: Array<{ id: string; name: string; countryId: string; mainBranchId: string | null }>;
  users: Array<{ id: string; name: string; code: string }>;
};

/**
 * The filter lists a login may pick from: only its own scope. A Branch Admin never sees another country's or branch's names, a normal user
 * only itself. (The register query itself re-applies the same scope, so a forged id in the URL is refused or returns nothing.)
 */
export async function loadCenterFilterOptions(session: ErpSession, domain: CenterDomain): Promise<CenterFilterOptions> {
  assertDomainAllowed(session, domain);
  const scope = sessionSqlScope(session);
  const level = reportScopeLevel(session);

  const out = await withLocalPg(async (sql) => {
    const countryIds: string[] | null =
      scope.kind === "all" ? null
      : scope.kind === "country" ? scope.ids
      : scope.kind === "countryBranch" ? ((await sql`select distinct country_id::text id from country_branches where id = any(${scope.ids}::uuid[])`) as any[]).map((r) => r.id)
      : scope.kind === "cityBranch" ? ((await sql`select distinct country_id::text id from city_branches where id = any(${scope.ids}::uuid[])`) as any[]).map((r) => r.id)
      : [];
    const inCountries = (col: string) => (countryIds === null ? sql`true` : sql`${sql.unsafe(col)} = any(${countryIds}::uuid[])`);

    const countries = (await sql`select co.id::text id, co.name from countries co where co.deleted_at is null and ${inCountries("co.id")} order by co.name limit 300`) as any[];

    // main / city branches inside the login's reach
    const ownMain = scope.kind === "countryBranch" ? scope.ids : scope.kind === "cityBranch" ? scope.ownCountryBranchIds ?? [] : [];
    const mainBranches = (await sql`
      select cb.id::text id, cb.name, cb.country_id::text country_id from country_branches cb
      where cb.deleted_at is null and ${scope.kind === "countryBranch" || (scope.kind === "cityBranch") ? sql`cb.id = any(${ownMain}::uuid[])` : inCountries("cb.country_id")}
      order by cb.name limit 500`) as any[];
    const cityBranches = (await sql`
      select ci.id::text id, ci.name, ci.country_id::text country_id, ci.country_branch_id::text main_id from city_branches ci
      where ci.deleted_at is null and ${
        scope.kind === "cityBranch" ? sql`ci.id = any(${scope.ids}::uuid[])`
        : scope.kind === "countryBranch" ? sql`ci.country_branch_id = any(${scope.ids}::uuid[])`
        : inCountries("ci.country_id")}
      order by ci.name limit 800`) as any[];

    // the people a login may filter by: everyone inside its scope for an admin, only itself for a normal user
    const users = level === "own"
      ? ((await sql`select p.id::text id, p.full_name name, coalesce(p.user_code,'') code from profiles p where p.id = ${session.userId}::uuid`) as any[])
      : ((await sql`
          select distinct p.id::text id, p.full_name name, coalesce(p.user_code,'') code
          from profiles p
          join user_role_assignments a on a.user_id = p.id and a.is_active = true and a.deleted_at is null
          where p.deleted_at is null and ${sqlScopeCondition(sql, scope, "a")}
            and coalesce(a.operational_domain, 'business') in (${domain}, 'both')
          order by name limit 500`) as any[]);

    return { countries, mainBranches, cityBranches, users };
  });

  return {
    countries: (out?.countries ?? []).map((r: any) => ({ id: r.id, name: s(r.name) })),
    mainBranches: (out?.mainBranches ?? []).map((r: any) => ({ id: r.id, name: s(r.name), countryId: r.country_id })),
    cityBranches: (out?.cityBranches ?? []).map((r: any) => ({ id: r.id, name: s(r.name), countryId: r.country_id, mainBranchId: r.main_id ?? null })),
    users: (out?.users ?? []).map((r: any) => ({ id: r.id, name: s(r.name), code: s(r.code) }))
  };
}

export const CENTER_TYPE_KEYS = CENTER_TYPES.map((t) => t.key);

/**
 * Country and branch names of one page of rows in the viewer's language (approved stored translations). The register query carries names only, so the
 * ids are resolved from the (unique) names first; an ambiguous or unknown name simply stays as saved. Amounts, references and party names are never touched.
 */
export async function localizeCenterRows(rows: CenterRow[], lang: string): Promise<CenterRow[]> {
  if (!rows.length || lang === "en") return rows;
  const ids = await withLocalPg(async (sql) => {
    const countries = (await sql`select id::text id, name from countries where deleted_at is null`) as any[];
    const city = (await sql`select id::text id, name from city_branches where deleted_at is null`) as any[];
    const main = (await sql`select id::text id, name from country_branches where deleted_at is null`) as any[];
    const unique = (list: any[]) => { const m = new Map<string, string | null>(); for (const r of list) m.set(r.name, m.has(r.name) ? null : r.id); return m; };
    return { countries: unique(countries), city: unique(city), main: unique(main) };
  });
  if (!ids) return rows;
  const work = rows.map((r) => ({
    ...r,
    id: r.key,
    _countryId: ids.countries.get(r.countryName) ?? "",
    _cityId: ids.city.get(r.branchName) ?? "",
    _mainId: ids.city.get(r.branchName) ? "" : ids.main.get(r.branchName) ?? ""
  }));
  const out = await localizeJoinedNames(work as any[], lang as SupportedLanguage, [
    { idField: "_countryId", nameField: "countryName", table: "countries" },
    { idField: "_cityId", nameField: "branchName", table: "city_branches" },
    { idField: "_mainId", nameField: "branchName", table: "country_branches" }
  ]);
  return (out as any[]).map(({ id: _id, _countryId, _cityId, _mainId, ...r }) => r as CenterRow);
}
