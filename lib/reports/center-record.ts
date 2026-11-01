/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reports Center - the full, read-only document of ONE register record (what the View button opens).
 *
 * Every value is read from the original saved record (and its saved payments / lines / audit trail). A section the record has no data for is
 * simply empty - nothing is invented. Labels are returned as (i18n key, English fallback) pairs so the browser translates the chrome in all
 * five languages; business data (names, numbers, references) is never translated or altered.
 *
 * Scope: the record must lie inside the login's own country / branch scope (the same SQL rule as the register), a Shipping-only login never
 * opens a Business record and a Business-only login never opens a Shipping one, and a login that only sees its own work opens only its own records.
 * A record outside the scope answers "not found" - its existence is never confirmed.
 */

import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { paymentInPurchaseCurrency } from "@/lib/purchases/loaded-payable";
import { sessionReportDomains } from "@/lib/reports/report-access";
import { type CenterDomain, purchaseTotalInOrderCurrency } from "@/lib/reports/center-totals";

export type DocField = { key: string; label: string; value: string; strong?: boolean };
export type DocColumn = { key: string; labelKey: string; label: string; num?: boolean };
export type DocTable = { titleKey: string; title: string; columns: DocColumn[]; rows: Array<Record<string, string>>; totals?: Record<string, string> };
export type RecordDoc = {
  table: string;
  id: string;
  domain: CenterDomain;
  typeKey: string;
  typeLabel: string;
  entryNo: string;
  status: string;
  currency: string;
  general: DocField[];
  party: { titleKey: string; title: string; fields: DocField[] } | null;
  amounts: DocField[];
  tables: DocTable[];
  audit: Array<{ actor: string; action: string; at: string }>;
};

export const RECORD_TABLES = [
  "purchase_orders", "local_purchases", "sales_orders", "purchase_order_payments", "sales_order_payments", "roznamcha_entries",
  "clearing_customer_orders", "clearing_payment_bills", "clearing_bill_customer_charges", "customer_receipts"
] as const;
export type RecordTable = (typeof RECORD_TABLES)[number];
const SHIPPING_TABLES: readonly string[] = ["clearing_customer_orders", "clearing_payment_bills", "clearing_bill_customer_charges", "customer_receipts"];

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const money = (v: unknown) => num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? s(v).slice(0, 10) : d.toISOString().slice(0, 10); };
const fld = (key: string, label: string, value: unknown, strong = false): DocField => ({ key, label, value: s(value) === "" ? "—" : s(value), strong });
const col = (key: string, label: string, numeric = false): DocColumn => ({ key, labelKey: `rcd.col.${key}`, label, num: numeric });
const withCcy = (v: unknown, ccy: string) => `${money(v)}${ccy ? " " + ccy : ""}`;

async function auditOf(sql: any, table: string, id: string) {
  const rows = await sql`
    select a.action, a.created_at, ap.full_name actor
    from audit_logs a left join profiles ap on ap.id = a.actor_id
    where a.entity_table = ${table} and a.entity_id = ${id} order by a.created_at asc limit 100`;
  return (rows as any[]).map((a) => ({ actor: s(a.actor), action: s(a.action) || "Updated", at: a.created_at instanceof Date ? a.created_at.toISOString() : s(a.created_at) }));
}

/** The record's own scope columns (and owner), or null when it does not exist / lies outside the login's reach. */
async function scopedHead(session: ErpSession, sql: any, table: RecordTable, id: string): Promise<{ domain: CenterDomain; createdBy: string | null; agentId: string | null } | null> {
  const scope = sessionSqlScope(session);
  const roles: string[] = session.roles ?? [];
  const assignedOnly = !session.isSuperAdmin && (Boolean((session as any).isShippingScoped) || (roles.length > 0 && roles.every((r) => ["agent_user", "shipping_line_user", "shipping_line_admin"].includes(r))));
  const own = (alias: string) => (assignedOnly ? sql`and ${sql.unsafe(alias + ".created_by")} = ${session.userId}::uuid` : sql``);
  let rows: any[] = [];
  switch (table) {
    case "purchase_orders":
      rows = await sql`select po.created_by::text created_by from purchase_orders po where po.id = ${id}::uuid and po.deleted_at is null and (${sqlScopeCondition(sql, scope, "po")} or ${sqlScopeCondition(sql, scope, "po", { prefix: "dest_" })}) ${own("po")}`; break;
    case "sales_orders":
      rows = await sql`select so.created_by::text created_by from sales_orders so where so.id = ${id}::uuid and so.deleted_at is null and (${sqlScopeCondition(sql, scope, "so")} or ${sqlScopeCondition(sql, scope, "so", { prefix: "dest_" })}) ${own("so")}`; break;
    case "local_purchases":
      rows = await sql`select lp.created_by::text created_by from local_purchases lp where lp.id = ${id}::uuid and lp.deleted_at is null and ${sqlScopeCondition(sql, scope, "lp")} ${own("lp")}`; break;
    case "purchase_order_payments":
      rows = await sql`select pop.created_by::text created_by from purchase_order_payments pop join purchase_orders po on po.id = pop.purchase_order_id where pop.id = ${id}::uuid and pop.deleted_at is null and ${sqlScopeCondition(sql, scope, "po")} ${own("pop")}`; break;
    case "sales_order_payments":
      rows = await sql`select sp.created_by::text created_by from sales_order_payments sp join sales_orders so on so.id = sp.sales_order_id where sp.id = ${id}::uuid and sp.deleted_at is null and ${sqlScopeCondition(sql, scope, "so")} ${own("sp")}`; break;
    case "roznamcha_entries": {
      const r = await sql`select re.created_by::text created_by, coalesce(re.entry_category, re.operational_domain, 'business') dom from roznamcha_entries re where re.id = ${id}::uuid and re.deleted_at is null and ${sqlScopeCondition(sql, scope, "re")} ${own("re")}`;
      return r[0] ? { domain: s(r[0].dom) === "shipping" ? "shipping" : "business", createdBy: r[0].created_by, agentId: null } : null;
    }
    case "clearing_customer_orders":
      rows = await sql`select o.created_by::text created_by, o.clearing_agent_id::text agent from clearing_customer_orders o where o.id = ${id}::uuid and o.deleted_at is null and ${sqlScopeCondition(sql, scope, "o")}`;
      if (rows[0] && assignedOnly && !canAccessOrder(session, { created_by: rows[0].created_by, clearing_agent_id: rows[0].agent })) return null;
      return rows[0] ? { domain: "shipping", createdBy: rows[0].created_by, agentId: rows[0].agent } : null;
    case "clearing_payment_bills":
      rows = await sql`select b.created_by::text created_by from clearing_payment_bills b where b.id = ${id}::uuid and b.deleted_at is null and ${sqlScopeCondition(sql, scope, "b")} ${own("b")}`; break;
    case "clearing_bill_customer_charges":
      rows = await sql`select c.created_by::text created_by from clearing_bill_customer_charges c join clearing_customer_orders o on o.id = c.order_id where c.id = ${id}::uuid and c.deleted_at is null and ${sqlScopeCondition(sql, scope, "o")} ${assignedOnly ? sql`and (c.created_by = ${session.userId}::uuid or o.created_by = ${session.userId}::uuid)` : sql``}`; break;
    case "customer_receipts":
      rows = await sql`select r.created_by::text created_by from customer_receipts r where r.id = ${id}::uuid and r.deleted_at is null and ${sqlScopeCondition(sql, scope, "r")} ${own("r")}`; break;
  }
  if (!rows[0]) return null;
  return { domain: SHIPPING_TABLES.includes(table) ? "shipping" : "business", createdBy: rows[0].created_by ?? null, agentId: null };
}

export async function loadCenterRecord(session: ErpSession, table: RecordTable, id: string): Promise<RecordDoc | null> {
  const doc = await withLocalPg(async (sql) => {
    const head = await scopedHead(session, sql, table, id);
    if (!head) return null;
    const d = sessionReportDomains(session);
    if ((head.domain === "business" && !d.business) || (head.domain === "shipping" && !d.shipping)) return null;
    switch (table) {
      case "purchase_orders": return purchaseDoc(sql, id);
      case "local_purchases": return localPurchaseDoc(sql, id);
      case "sales_orders": return salesDoc(sql, id);
      case "purchase_order_payments": return purchasePaymentDoc(sql, id);
      case "sales_order_payments": return salesPaymentDoc(sql, id);
      case "roznamcha_entries": return roznamchaDoc(sql, id, head.domain);
      case "clearing_customer_orders": return shippingOrderDoc(sql, id);
      case "clearing_payment_bills": return clearingBillDoc(sql, id);
      case "clearing_bill_customer_charges": return customerBillDoc(sql, id);
      case "customer_receipts": return receiptDoc(sql, id);
    }
    return null;
  });
  return doc ?? null;
}

// ── purchase order ───────────────────────────────────────────────────────────────────────────────────────
function goodsTable(goods: any[], ccy: string, localCcy: string): DocTable | null {
  const list = (Array.isArray(goods) ? goods : []).filter((g) => g && typeof g === "object");
  if (!list.length) return null;
  const rows = list.map((g) => {
    const qty = num(g.qtyNo ?? g.quantity);
    const per = num(g.qtyKgs);
    const empty = num(g.emptyKgs);
    const gross = num(g.grossWeight) || qty * per;
    const net = num(g.netWeight) || qty * Math.max(0, per - empty);
    return {
      goods: s(g.goodsName || g.productName || g.name), qty: qty ? `${qty.toLocaleString("en-US")} ${s(g.qtyName || g.unit)}`.trim() : "", gross: gross ? money(gross) : "", net: net ? money(net) : "",
      price: num(g.coursePrice) ? `${money(g.coursePrice)}${ccy ? " " + ccy : ""}` : "", amount: num(g.totalAmount ?? g.amount) ? money(g.totalAmount ?? g.amount) : "",
      final: num(g.finalAmount ?? g.localAmount) ? money(g.finalAmount ?? g.localAmount) : ""
    };
  });
  const sum = (k: "amount" | "final") => list.reduce((a, g) => a + (k === "amount" ? num(g.totalAmount ?? g.amount) : num(g.finalAmount ?? g.localAmount)), 0);
  return {
    titleKey: "rcd.sec.goods", title: "Goods",
    columns: [col("goods", "Goods"), col("qty", "Quantity", true), col("gross", "Gross Weight (KG)", true), col("net", "Net Weight (KG)", true), col("price", "Price", true), col("amount", `Amount${ccy ? " (" + ccy + ")" : ""}`, true), ...(localCcy && localCcy !== ccy ? [col("final", `Final Amount (${localCcy})`, true)] : [])],
    rows, totals: { goods: "", amount: money(sum("amount")), ...(localCcy && localCcy !== ccy ? { final: money(sum("final")) } : {}) }
  };
}

async function purchasePaymentsTable(sql: any, where: any, orderTotal: number, ccy: string, rateToBase: number): Promise<DocTable | null> {
  const pays = (await sql`
    select pop.id::text id, pop.kind::text kind, pop.entry_date, pop.created_at, pop.amount, pop.currency_code, pop.exchange_rate, pop.base_currency_amount, pop.status::text status, pop.reference_no
    from purchase_order_payments pop where pop.deleted_at is null and pop.kind::text <> 'booking' and ${where}
    order by coalesce(pop.entry_date, pop.created_at::date), pop.created_at`) as any[];
  if (!pays.length) return null;
  let paid = 0;
  const rows = pays.map((p) => {
    const inBill = paymentInPurchaseCurrency({ amount: p.amount, currency_code: p.currency_code, exchange_rate: p.exchange_rate, base_currency_amount: p.base_currency_amount }, ccy, rateToBase);
    const counted = s(p.status).toLowerCase() === "posted";
    if (counted) paid += inBill;
    return {
      date: day(p.entry_date || p.created_at), kind: s(p.kind), reference: s(p.reference_no), paid: withCcy(p.amount, s(p.currency_code).toUpperCase()), rate: num(p.exchange_rate) ? String(num(p.exchange_rate)) : "",
      inBill: withCcy(inBill, ccy), balance: counted ? withCcy(Math.max(0, orderTotal - paid), ccy) : "", status: s(p.status)
    };
  });
  return {
    titleKey: "rcd.sec.payments", title: "Payments & balances",
    columns: [col("date", "Date"), col("kind", "Type"), col("reference", "Reference"), col("paid", "Paid", true), col("rate", "Rate", true), col("inBill", "In bill currency", true), col("balance", "Balance after", true), col("status", "Status")],
    rows
  };
}

async function purchaseDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [po] = await sql`
    select po.*, comp.name supplier_name, comp.legal_name supplier_legal, co.name country_name, co.currency_code local_currency, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from purchase_orders po
    left join companies comp on comp.id = po.supplier_company_id
    left join countries co on co.id = po.country_id
    left join city_branches cib on cib.id = po.city_branch_id
    left join country_branches cb on cb.id = po.country_branch_id
    left join profiles pr on pr.id = po.created_by
    where po.id = ${id}::uuid and po.deleted_at is null`;
  if (!po) return null;
  const fd = typeof po.form_data === "string" ? JSON.parse(po.form_data) : po.form_data ?? {};
  const form = fd?.form ?? {};
  const ccy = s(po.currency_code).toUpperCase();
  const local = s(po.local_currency).toUpperCase();
  const rate = num(po.exchange_rate);
  const total = purchaseTotalInOrderCurrency(po);
  const rateToBase = ccy === local ? 1 : rate || 1;
  const tables: DocTable[] = [];
  const goods = goodsTable(fd?.goodsEntries ?? [], ccy, local);
  if (goods) tables.push(goods);
  const pays = await purchasePaymentsTable(sql, sql`pop.purchase_order_id = ${id}::uuid`, total, ccy, rateToBase);
  if (pays) tables.push(pays);
  return {
    table: "purchase_orders", id, domain: "business", typeKey: "rc.type.purchase_booking", typeLabel: "Purchase Booking", entryNo: s(po.purchase_order_no), status: s(po.payment_status) || s(po.status), currency: ccy,
    general: [
      fld("rcd.f.entry_no", "Bill No.", po.purchase_order_no, true), fld("rcd.f.contract_no", "Contract No.", po.purchase_contract_no), fld("rcd.f.manual_bill", "Manual Bill No.", form.manualBillNumber),
      fld("rcd.f.date", "Date", day(po.created_at)), fld("rcd.f.country", "Country", po.country_name), fld("rcd.f.branch", "Branch", po.branch_name), fld("rcd.f.user", "Created by", po.user_name),
      fld("rcd.f.status", "Status", po.payment_status || po.status), fld("rcd.f.currency", "Currency", ccy), fld("rcd.f.rate", "Exchange rate", rate ? `1 ${ccy} = ${rate} ${local}` : "")
    ],
    party: s(po.supplier_name) ? { titleKey: "rcd.sec.supplier", title: "Supplier", fields: [fld("rcd.f.name", "Name", po.supplier_name, true), fld("rcd.f.legal_name", "Legal name", po.supplier_legal)] } : null,
    amounts: [
      fld("rcd.a.total", "Bill total", withCcy(total, ccy), true), fld("rcd.a.paid_adv", "Advance paid", withCcy(po.advance_paid, ccy)), fld("rcd.a.paid_rem", "Remaining paid", withCcy(po.remaining_paid, ccy)),
      fld("rcd.a.credit", "Credit", withCcy(po.credit_amount, ccy)), fld("rcd.a.due", "Still to pay", withCcy(po.remaining_due, ccy), true), ...(local && local !== ccy ? [fld("rcd.a.local_total", "Bill total (local)", withCcy(po.order_total, local))] : [])
    ],
    tables, audit: await auditOf(sql, "purchase_orders", id)
  };
}

async function localPurchaseDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [lp] = await sql`
    select lp.*, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from local_purchases lp left join countries co on co.id = lp.country_id left join city_branches cib on cib.id = lp.city_branch_id left join country_branches cb on cb.id = lp.country_branch_id left join profiles pr on pr.id = lp.created_by
    where lp.id = ${id}::uuid and lp.deleted_at is null`;
  if (!lp) return null;
  const ccy = s(lp.purchase_currency).toUpperCase();
  const local = s(lp.local_currency).toUpperCase();
  const tables: DocTable[] = [];
  const goods = goodsTable([{ goodsName: lp.goods_name, qtyNo: lp.numbers, qtyName: lp.quantity_name, qtyKgs: lp.quantity_kgs, emptyKgs: lp.empty_kgs, grossWeight: lp.total_gross_weight, netWeight: lp.net_weight, coursePrice: lp.purchase_rate, totalAmount: lp.purchase_cost, finalAmount: lp.final_cost }], ccy, local);
  if (goods) tables.push(goods);
  const pays = await purchasePaymentsTable(sql, sql`pop.local_purchase_id = ${id}::uuid`, num(lp.purchase_cost), ccy, ccy === local ? 1 : num(lp.exchange_rate) || 1);
  if (pays) tables.push(pays);
  return {
    table: "local_purchases", id, domain: "business", typeKey: "rc.type.local_purchase", typeLabel: "Local Purchase", entryNo: s(lp.manual_bill_no) || s(lp.id).slice(0, 8).toUpperCase(), status: s(lp.status), currency: ccy,
    general: [
      fld("rcd.f.entry_no", "Bill No.", lp.manual_bill_no, true), fld("rcd.f.contract_no", "Contract No.", lp.contract_no), fld("rcd.f.date", "Date", day(lp.created_at)), fld("rcd.f.country", "Country", lp.country_name),
      fld("rcd.f.branch", "Branch", lp.branch_name), fld("rcd.f.user", "Created by", lp.user_name), fld("rcd.f.status", "Status", lp.status), fld("rcd.f.currency", "Currency", ccy),
      fld("rcd.f.rate", "Exchange rate", num(lp.exchange_rate) ? `1 ${ccy} = ${num(lp.exchange_rate)} ${local}` : "")
    ],
    party: s(lp.supplier_name) ? { titleKey: "rcd.sec.supplier", title: "Supplier", fields: [fld("rcd.f.name", "Name", lp.supplier_name, true)] } : null,
    amounts: [fld("rcd.a.total", "Bill total", withCcy(lp.purchase_cost, ccy), true), fld("rcd.a.paid_adv", "Advance paid", withCcy(lp.advance_amount, ccy)), fld("rcd.a.due", "Still to pay", withCcy(lp.remaining_balance, ccy), true), ...(local && local !== ccy ? [fld("rcd.a.local_total", "Bill total (local)", withCcy(lp.final_cost, local))] : [])],
    tables, audit: await auditOf(sql, "local_purchases", id)
  };
}

// ── sales order ──────────────────────────────────────────────────────────────────────────────────────────
async function salesPaymentsTable(sql: any, orderId: string, total: number, ccy: string): Promise<DocTable | null> {
  const pays = (await sql`
    select sp.payment_kind::text kind, sp.payment_date, sp.created_at, sp.amount, sp.currency_code, sp.exchange_rate, sp.status::text status, sp.manual_reference_number
    from sales_order_payments sp where sp.sales_order_id = ${orderId}::uuid and sp.deleted_at is null and sp.payment_kind::text <> 'booking' order by coalesce(sp.payment_date, sp.created_at::date), sp.created_at`) as any[];
  if (!pays.length) return null;
  let paid = 0;
  const rows = pays.map((p) => {
    const sameCcy = s(p.currency_code).toUpperCase() === ccy;
    const inOrder = sameCcy ? num(p.amount) : num(p.exchange_rate) > 0 ? num(p.amount) / num(p.exchange_rate) : num(p.amount);
    const counted = s(p.status).toLowerCase() === "posted";
    if (counted) paid += inOrder;
    return { date: day(p.payment_date || p.created_at), kind: s(p.kind), reference: s(p.manual_reference_number), received: withCcy(p.amount, s(p.currency_code).toUpperCase()), rate: num(p.exchange_rate) ? String(num(p.exchange_rate)) : "", inBill: withCcy(inOrder, ccy), balance: counted ? withCcy(Math.max(0, total - paid), ccy) : "", status: s(p.status) };
  });
  return {
    titleKey: "rcd.sec.payments", title: "Payments & balances",
    columns: [col("date", "Date"), col("kind", "Type"), col("reference", "Reference"), col("received", "Received", true), col("rate", "Rate", true), col("inBill", "In bill currency", true), col("balance", "Balance after", true), col("status", "Status")], rows
  };
}

async function salesDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [so] = await sql`
    select so.*, co.name country_name, co.currency_code local_currency, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from sales_orders so left join countries co on co.id = so.country_id left join city_branches cib on cib.id = so.city_branch_id left join country_branches cb on cb.id = so.country_branch_id left join profiles pr on pr.id = so.created_by
    where so.id = ${id}::uuid and so.deleted_at is null`;
  if (!so) return null;
  const fd = typeof so.form_data === "string" ? JSON.parse(so.form_data) : so.form_data ?? {};
  const ccy = s(so.currency_code).toUpperCase();
  const local = s(so.local_currency).toUpperCase();
  const tables: DocTable[] = [];
  const goods = goodsTable(fd?.goodsEntries ?? [], ccy, local);
  if (goods) tables.push(goods);
  const pays = await salesPaymentsTable(sql, id, num(so.order_total), ccy);
  if (pays) tables.push(pays);
  return {
    table: "sales_orders", id, domain: "business", typeKey: "rc.type.sales_booking", typeLabel: "Sales Booking", entryNo: s(so.sales_order_no), status: s(so.payment_status) || s(so.sales_status), currency: ccy,
    general: [
      fld("rcd.f.entry_no", "Bill No.", so.sales_order_no, true), fld("rcd.f.contract_no", "Contract No.", so.sales_contract_no), fld("rcd.f.date", "Date", day(so.order_date || so.created_at)), fld("rcd.f.country", "Country", so.country_name),
      fld("rcd.f.branch", "Branch", so.branch_name), fld("rcd.f.user", "Created by", so.user_name), fld("rcd.f.status", "Status", so.payment_status || so.sales_status), fld("rcd.f.currency", "Currency", ccy),
      fld("rcd.f.rate", "Exchange rate", num(so.exchange_rate) ? `1 ${ccy} = ${num(so.exchange_rate)} ${local}` : ""), fld("rcd.f.delivery", "Delivery", so.delivery_status)
    ],
    party: s(so.customer_name) ? { titleKey: "rcd.sec.customer", title: "Customer", fields: [fld("rcd.f.name", "Name", so.customer_name, true), fld("rcd.f.account", "Account No.", so.account_number)] } : null,
    amounts: [fld("rcd.a.total", "Bill total", withCcy(so.order_total, ccy), true), fld("rcd.a.received", "Received", withCcy(so.paid_amount, ccy)), fld("rcd.a.due_receive", "Still to receive", withCcy(so.remaining_amount, ccy), true)],
    tables, audit: await auditOf(sql, "sales_orders", id)
  };
}

// ── payments ─────────────────────────────────────────────────────────────────────────────────────────────
async function purchasePaymentDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [p] = await sql`
    select pop.*, po.purchase_order_no, po.currency_code order_ccy, po.exchange_rate order_rate, po.order_total, po.total_goods_original, po.total_goods_usd, po.advance_paid, po.remaining_paid, po.remaining_due,
           comp.name supplier_name, co.name country_name, co.currency_code local_currency, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name, dl.name debit_name, cl.name credit_name
    from purchase_order_payments pop join purchase_orders po on po.id = pop.purchase_order_id
    left join companies comp on comp.id = po.supplier_company_id left join countries co on co.id = po.country_id left join city_branches cib on cib.id = po.city_branch_id left join country_branches cb on cb.id = po.country_branch_id
    left join profiles pr on pr.id = pop.created_by left join ledgers dl on dl.id = pop.debit_ledger_id left join ledgers cl on cl.id = pop.credit_ledger_id
    where pop.id = ${id}::uuid and pop.deleted_at is null`;
  if (!p) return null;
  const orderCcy = s(p.order_ccy).toUpperCase();
  const payCcy = s(p.currency_code).toUpperCase();
  const local = s(p.local_currency).toUpperCase();
  const total = purchaseTotalInOrderCurrency({ ...p, currency_code: p.order_ccy, exchange_rate: p.order_rate });
  const inBill = paymentInPurchaseCurrency({ amount: p.amount, currency_code: p.currency_code, exchange_rate: p.exchange_rate, base_currency_amount: p.base_currency_amount }, orderCcy, orderCcy === local ? 1 : num(p.order_rate) || 1);
  const kind = s(p.kind).toLowerCase();
  const typeKey = kind === "advance" || kind === "endorsement" ? "rc.type.advance_payment" : kind === "remaining" ? "rc.type.remaining_payment" : "rc.type.final_payment";
  const pays = await purchasePaymentsTable(sql, sql`pop.purchase_order_id = ${p.purchase_order_id}::uuid`, total, orderCcy, orderCcy === local ? 1 : num(p.order_rate) || 1);
  return {
    table: "purchase_order_payments", id, domain: "business", typeKey, typeLabel: kind === "remaining" ? "Remaining Payment" : kind === "advance" || kind === "endorsement" ? "Advance Payment" : "Final / Credit Payment",
    entryNo: s(p.reference_no) || s(p.source_reference_no) || s(p.id).slice(0, 8).toUpperCase(), status: s(p.status), currency: payCcy,
    general: [
      fld("rcd.f.voucher_no", "Voucher No.", p.reference_no || p.source_reference_no, true), fld("rcd.f.date", "Date", day(p.entry_date || p.created_at)), fld("rcd.f.bill", "Bill No.", p.purchase_order_no), fld("rcd.f.country", "Country", p.country_name),
      fld("rcd.f.branch", "Branch", p.branch_name), fld("rcd.f.user", "Created by", p.user_name), fld("rcd.f.status", "Status", p.status), fld("rcd.f.currency", "Currency", payCcy),
      fld("rcd.f.rate", "Exchange rate", num(p.exchange_rate) ? String(num(p.exchange_rate)) : ""), fld("rcd.f.debit", "Debit account", p.debit_name), fld("rcd.f.credit", "Credit account", p.credit_name), fld("rcd.f.narration", "Narration", p.narration)
    ],
    party: s(p.supplier_name) ? { titleKey: "rcd.sec.supplier", title: "Supplier", fields: [fld("rcd.f.name", "Name", p.supplier_name, true)] } : null,
    amounts: [
      fld("rcd.a.paid", "Paid", withCcy(p.amount, payCcy), true), ...(orderCcy && orderCcy !== payCcy ? [fld("rcd.a.in_bill", "In bill currency", withCcy(inBill, orderCcy))] : []),
      fld("rcd.a.total", "Bill total", withCcy(total, orderCcy)), fld("rcd.a.due", "Still to pay", withCcy(p.remaining_due, orderCcy), true)
    ],
    tables: pays ? [pays] : [], audit: await auditOf(sql, "purchase_order_payments", id)
  };
}

async function salesPaymentDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [p] = await sql`
    select sp.*, so.sales_order_no, so.currency_code order_ccy, so.order_total, so.remaining_amount, so.customer_name, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from sales_order_payments sp join sales_orders so on so.id = sp.sales_order_id left join countries co on co.id = so.country_id left join city_branches cib on cib.id = so.city_branch_id left join country_branches cb on cb.id = so.country_branch_id left join profiles pr on pr.id = sp.created_by
    where sp.id = ${id}::uuid and sp.deleted_at is null`;
  if (!p) return null;
  const orderCcy = s(p.order_ccy).toUpperCase();
  const payCcy = s(p.currency_code).toUpperCase();
  const kind = s(p.payment_kind).toLowerCase();
  const typeKey = kind === "advance" || kind === "endorsement" ? "rc.type.advance_payment" : kind === "remaining" ? "rc.type.remaining_payment" : "rc.type.final_payment";
  const pays = await salesPaymentsTable(sql, p.sales_order_id, num(p.order_total), orderCcy);
  return {
    table: "sales_order_payments", id, domain: "business", typeKey, typeLabel: kind === "remaining" ? "Remaining Payment" : kind === "advance" || kind === "endorsement" ? "Advance Payment" : "Final / Credit Payment",
    entryNo: s(p.manual_reference_number) || s(p.id).slice(0, 8).toUpperCase(), status: s(p.status), currency: payCcy,
    general: [
      fld("rcd.f.voucher_no", "Voucher No.", p.manual_reference_number, true), fld("rcd.f.date", "Date", day(p.payment_date || p.created_at)), fld("rcd.f.bill", "Bill No.", p.sales_order_no), fld("rcd.f.country", "Country", p.country_name),
      fld("rcd.f.branch", "Branch", p.branch_name), fld("rcd.f.user", "Created by", p.user_name), fld("rcd.f.status", "Status", p.status), fld("rcd.f.currency", "Currency", payCcy),
      fld("rcd.f.rate", "Exchange rate", num(p.exchange_rate) ? String(num(p.exchange_rate)) : ""), fld("rcd.f.remarks", "Remarks", p.remarks)
    ],
    party: s(p.customer_name) ? { titleKey: "rcd.sec.customer", title: "Customer", fields: [fld("rcd.f.name", "Name", p.customer_name, true)] } : null,
    amounts: [fld("rcd.a.received", "Received", withCcy(p.amount, payCcy), true), fld("rcd.a.total", "Bill total", withCcy(p.order_total, orderCcy)), fld("rcd.a.due_receive", "Still to receive", withCcy(p.remaining_amount, orderCcy), true)],
    tables: pays ? [pays] : [], audit: await auditOf(sql, "sales_order_payments", id)
  };
}

// ── Roznamcha voucher ────────────────────────────────────────────────────────────────────────────────────
async function roznamchaDoc(sql: any, id: string, domain: CenterDomain): Promise<RecordDoc | null> {
  const [re] = await sql`
    select re.*, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from roznamcha_entries re left join countries co on co.id = re.country_id left join city_branches cib on cib.id = re.city_branch_id left join country_branches cb on cb.id = re.country_branch_id left join profiles pr on pr.id = re.created_by
    where re.id = ${id}::uuid and re.deleted_at is null`;
  if (!re) return null;
  const lines = (await sql`
    select rl.description, rl.debit, rl.credit, rl.currency, l.name ledger_name, l.code ledger_code
    from roznamcha_lines rl left join ledgers l on l.id = rl.ledger_id where rl.roznamcha_entry_id = ${id}::uuid order by rl.id`) as any[];
  const ccy = s(re.original_currency_code).toUpperCase() || s(lines.find((l) => s(l.currency))?.currency).toUpperCase();
  const dr = lines.reduce((a, l) => a + num(l.debit), 0);
  const cr = lines.reduce((a, l) => a + num(l.credit), 0);
  const typeKey = re.bank_id ? "rc.type.bank_entry" : s(re.voucher_no || re.journal_no) ? "rc.type.cash_entry" : "rc.type.journal_entry";
  return {
    table: "roznamcha_entries", id, domain, typeKey, typeLabel: re.bank_id ? "Bank Entry" : "Cash Entry", entryNo: s(re.voucher_no) || s(re.journal_no), status: s(re.status), currency: ccy,
    general: [
      fld("rcd.f.voucher_no", "Voucher No.", re.voucher_no, true), fld("rcd.f.journal_no", "Journal No.", re.journal_no), fld("rcd.f.reference", "Reference", re.reference_no), fld("rcd.f.date", "Date", day(re.entry_date || re.created_at)),
      fld("rcd.f.country", "Country", re.country_name), fld("rcd.f.branch", "Branch", re.branch_name), fld("rcd.f.user", "Created by", re.user_name), fld("rcd.f.status", "Status", re.status), fld("rcd.f.narration", "Narration", re.narration)
    ],
    party: null,
    amounts: [fld("rcd.a.debit", "Total debit", withCcy(dr, ccy), true), fld("rcd.a.credit_total", "Total credit", withCcy(cr, ccy), true)],
    tables: lines.length ? [{
      titleKey: "rcd.sec.lines", title: "Voucher lines",
      columns: [col("account", "Account"), col("description", "Description"), col("debit", "Debit", true), col("credit", "Credit", true), col("currency", "Currency")],
      rows: lines.map((l) => ({ account: [s(l.ledger_code), s(l.ledger_name)].filter(Boolean).join(" · "), description: s(l.description), debit: num(l.debit) ? money(l.debit) : "", credit: num(l.credit) ? money(l.credit) : "", currency: s(l.currency).toUpperCase() })),
      totals: { account: "", debit: money(dr), credit: money(cr) }
    }] : [],
    audit: await auditOf(sql, "roznamcha_entries", id)
  };
}

// ── Shipping Line records ────────────────────────────────────────────────────────────────────────────────
async function shippingOrderDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [o] = await sql`
    select o.*, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from clearing_customer_orders o left join countries co on co.id = o.country_id left join city_branches cib on cib.id = o.city_branch_id left join country_branches cb on cb.id = o.country_branch_id left join profiles pr on pr.id = o.created_by
    where o.id = ${id}::uuid and o.deleted_at is null`;
  if (!o) return null;
  const bills = (await sql`select b.bill_no, b.bl_number, b.gd_number, b.total_amount, b.currency_code, b.remaining_balance, b.payment_status::text st from clearing_payment_bills b where b.order_id = ${id}::uuid and b.deleted_at is null order by b.created_at`) as any[];
  return {
    table: "clearing_customer_orders", id, domain: "shipping", typeKey: "rc.type.shipping_order", typeLabel: "Shipping Order", entryNo: s(o.order_no), status: s(o.status), currency: "",
    general: [
      fld("rcd.f.order", "Order No.", o.order_no, true), fld("rcd.f.date", "Date", day(o.created_at)), fld("rcd.f.country", "Country", o.country_name), fld("rcd.f.branch", "Branch", o.branch_name), fld("rcd.f.user", "Created by", o.user_name),
      fld("rcd.f.status", "Status", o.status), fld("rcd.f.stage", "Clearing stage", o.current_stage), fld("rcd.f.shipment", "Shipment", [s(o.shipment_type), s(o.transport_mode), s(o.movement_type)].filter(Boolean).join(" / ")), fld("rcd.f.route", "Route", o.route_name),
      fld("rcd.f.loading", "Loading", [s(o.loading_place), s(o.loading_port_name), s(o.loading_country_name)].filter(Boolean).join(", ")), fld("rcd.f.receiving", "Receiving", [s(o.receiving_place), s(o.destination_port_name), s(o.receiving_country_name)].filter(Boolean).join(", ")),
      fld("rcd.f.container", "Container", o.loading_source_container_ref), fld("rcd.f.truck", "Truck", [s(o.truck_number), s(o.truck_driver_name), s(o.truck_transport_company)].filter(Boolean).join(" · ")),
      fld("rcd.f.goods", "Goods", [s(o.goods_name), o.goods_quantity ? `${num(o.goods_quantity)} ${s(o.goods_unit)}` : "", o.goods_net_weight ? `net ${money(o.goods_net_weight)} KG` : ""].filter(Boolean).join(" · ")),
      fld("rcd.f.loading_customs", "Loading customs", s(o.loading_customs_required) === "true" || o.loading_customs_required ? [s(o.loading_customs_name), s(o.loading_customs_agent_account_name)].filter(Boolean).join(" · ") || "Required" : ""),
      fld("rcd.f.receiving_customs", "Receiving customs", s(o.receiving_customs_required) === "true" || o.receiving_customs_required ? [s(o.receiving_customs_name), s(o.receiving_customs_agent_account_name)].filter(Boolean).join(" · ") || "Required" : "")
    ],
    party: s(o.customer_name) ? { titleKey: "rcd.sec.customer", title: "Customer", fields: [fld("rcd.f.name", "Name", o.customer_name, true), fld("rcd.f.consignee", "Consignee", o.consignee_name), fld("rcd.f.exporter", "Exporter", o.exporter_name), fld("rcd.f.importer", "Importer", o.importer_name)] } : null,
    amounts: [],
    tables: bills.length ? [{
      titleKey: "rcd.sec.bills", title: "Clearing bills",
      columns: [col("bill", "Bill No."), col("bl", "BL No."), col("gd", "GD No."), col("total", "Total", true), col("balance", "Remaining", true), col("status", "Status")],
      rows: bills.map((b) => ({ bill: s(b.bill_no), bl: s(b.bl_number), gd: s(b.gd_number), total: withCcy(b.total_amount, s(b.currency_code).toUpperCase()), balance: withCcy(b.remaining_balance, s(b.currency_code).toUpperCase()), status: s(b.st) }))
    }] : [],
    audit: await auditOf(sql, "clearing_customer_orders", id)
  };
}

async function clearingBillDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [b] = await sql`
    select b.*, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from clearing_payment_bills b left join countries co on co.id = b.country_id left join city_branches cib on cib.id = b.city_branch_id left join country_branches cb on cb.id = b.country_branch_id left join profiles pr on pr.id = b.created_by
    where b.id = ${id}::uuid and b.deleted_at is null`;
  if (!b) return null;
  const ccy = s(b.currency_code).toUpperCase();
  return {
    table: "clearing_payment_bills", id, domain: "shipping", typeKey: "rc.type.clearing_bill", typeLabel: "Clearing / Payment Bill", entryNo: s(b.bill_no), status: s(b.payment_status) || s(b.status), currency: ccy,
    general: [
      fld("rcd.f.entry_no", "Bill No.", b.bill_no, true), fld("rcd.f.order", "Order No.", b.order_no), fld("rcd.f.bl", "BL No.", b.bl_number), fld("rcd.f.gd", "GD No.", b.gd_number), fld("rcd.f.date", "Date", day(b.created_at)),
      fld("rcd.f.country", "Country", b.country_name), fld("rcd.f.branch", "Branch", b.branch_name), fld("rcd.f.user", "Created by", b.user_name), fld("rcd.f.status", "Status", b.payment_status || b.status), fld("rcd.f.port", "Port", b.port_name),
      fld("rcd.f.currency", "Currency", ccy), fld("rcd.f.rate", "Exchange rate", num(b.exchange_rate) ? String(num(b.exchange_rate)) : ""), fld("rcd.f.method", "Payment method", b.payment_method)
    ],
    party: s(b.agent_name) ? { titleKey: "rcd.sec.agent", title: "Clearing agent", fields: [fld("rcd.f.name", "Name", b.agent_name, true)] } : null,
    amounts: [fld("rcd.a.total", "Bill total", withCcy(b.total_amount, ccy), true), fld("rcd.a.paid", "Paid", withCcy(b.paid_amount, ccy)), fld("rcd.a.due", "Remaining", withCcy(b.remaining_balance, ccy), true)],
    tables: [{
      titleKey: "rcd.sec.charges", title: "Charges",
      columns: [col("charge", "Charge"), col("amount", "Amount", true)],
      rows: [["customs_duty", "Customs duty"], ["port_charges", "Port charges"], ["demurrage_charges", "Demurrage"], ["clearance_fee", "Clearance fee"], ["freight_charges", "Freight"], ["other_charges", "Other"]]
        .filter(([k]) => num(b[k]) > 0).map(([k, label]) => ({ charge: label, amount: withCcy(b[k], ccy) })),
      totals: { charge: "", amount: withCcy(b.total_amount, ccy) }
    }].filter((t) => t.rows.length > 0),
    audit: await auditOf(sql, "clearing_payment_bills", id)
  };
}

async function customerBillDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [c] = await sql`
    select c.*, o.order_no, o.customer_name, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from clearing_bill_customer_charges c join clearing_customer_orders o on o.id = c.order_id left join countries co on co.id = o.country_id left join city_branches cib on cib.id = o.city_branch_id left join country_branches cb on cb.id = o.country_branch_id left join profiles pr on pr.id = c.created_by
    where c.id = ${id}::uuid and c.deleted_at is null`;
  if (!c) return null;
  const ccy = s(c.currency_code).toUpperCase();
  return {
    table: "clearing_bill_customer_charges", id, domain: "shipping", typeKey: "rc.type.customer_bill", typeLabel: "Customer Bill", entryNo: s(c.charge_type), status: s(c.posting_status), currency: ccy,
    general: [fld("rcd.f.charge", "Charge", c.charge_type, true), fld("rcd.f.order", "Order No.", c.order_no), fld("rcd.f.date", "Date", day(c.created_at)), fld("rcd.f.country", "Country", c.country_name), fld("rcd.f.branch", "Branch", c.branch_name), fld("rcd.f.user", "Created by", c.user_name), fld("rcd.f.status", "Status", c.posting_status), fld("rcd.f.currency", "Currency", ccy), fld("rcd.f.remarks", "Remarks", c.remarks)],
    party: s(c.customer_name) ? { titleKey: "rcd.sec.customer", title: "Customer", fields: [fld("rcd.f.name", "Name", c.customer_name, true)] } : null,
    amounts: [fld("rcd.a.total", "Amount", withCcy(c.amount, ccy), true)], tables: [], audit: await auditOf(sql, "clearing_bill_customer_charges", id)
  };
}

async function receiptDoc(sql: any, id: string): Promise<RecordDoc | null> {
  const [r] = await sql`
    select r.*, coalesce(nullif(cu.customer_name, ''), cu.company_name) customer_name, co.name country_name, coalesce(cib.name, cb.name) branch_name, pr.full_name user_name
    from customer_receipts r left join customers cu on cu.id = r.customer_id left join countries co on co.id = r.country_id left join city_branches cib on cib.id = r.city_branch_id left join country_branches cb on cb.id = r.country_branch_id left join profiles pr on pr.id = r.created_by
    where r.id = ${id}::uuid and r.deleted_at is null`;
  if (!r) return null;
  const ccy = s(r.currency_code).toUpperCase();
  return {
    table: "customer_receipts", id, domain: "shipping", typeKey: "rc.type.shipping_payment", typeLabel: "Shipping Payment (Receipt)", entryNo: s(r.receipt_no), status: s(r.status), currency: ccy,
    general: [fld("rcd.f.receipt_no", "Receipt No.", r.receipt_no, true), fld("rcd.f.date", "Date", day(r.receipt_date || r.created_at)), fld("rcd.f.country", "Country", r.country_name), fld("rcd.f.branch", "Branch", r.branch_name), fld("rcd.f.user", "Created by", r.user_name), fld("rcd.f.status", "Status", r.status), fld("rcd.f.currency", "Currency", ccy), fld("rcd.f.method", "Payment method", r.payment_method), fld("rcd.f.remarks", "Remarks", r.remarks)],
    party: s(r.customer_name) ? { titleKey: "rcd.sec.customer", title: "Customer", fields: [fld("rcd.f.name", "Name", r.customer_name, true)] } : null,
    amounts: [fld("rcd.a.received", "Received", withCcy(r.amount, ccy), true)], tables: [], audit: await auditOf(sql, "customer_receipts", id)
  };
}
