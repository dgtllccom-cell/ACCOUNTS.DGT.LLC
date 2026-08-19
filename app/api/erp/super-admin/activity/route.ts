/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession, ErpAuthError } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Super Admin "All Release Entries" — live ERP monitoring feed.
 * READ-ONLY, super-admin only, REAL data. A single server-side-paginated UNION across the main ERP
 * activity sources (roznamcha financial postings + purchase/sales orders + customers/companies/banks/
 * employees/warehouses/goods/users), normalized to a common shape, filtered and ordered server-side
 * so it stays fast at scale (the DB does the paging; the browser never loads the full history).
 */

// Normalized UNION of every activity source. Static SQL (no user input) — filters/paging applied outside.
const FEED_SQL = `
with rl as (
  select roznamcha_entry_id eid,
         coalesce(sum(debit),0) debit, coalesce(sum(credit),0) credit,
         max(currency) currency, max(account_number) account_no
  from roznamcha_lines group by roznamcha_entry_id
),
feed as (
  -- Financial postings (Journal / Cash / Bank / Purchase / Sale / Transfer)
  select
    e.id::text record_id, 'Roznamcha' source_module,
    (case
      when lower(coalesce(e.source_module,'')) like '%cash%' then 'Payment'
      when e.entry_category='bank' or lower(coalesce(e.source_module,'')) like '%bank%' then 'Bank'
      when lower(coalesce(e.source_module,'')) like '%purchase%' or lower(coalesce(e.source_transaction_type,'')) like '%purchase%' then 'Purchase'
      when lower(coalesce(e.source_module,'')) like '%sale%' or lower(coalesce(e.source_transaction_type,'')) like '%sale%' then 'Sale'
      when lower(coalesce(e.source_transaction_type,'')) like '%transfer%' then 'Transfer'
      when e.entry_category='invoice' then 'Purchase'
      else 'Journal' end) module,
    coalesce(e.source_transaction_type, e.type::text) txn_type,
    coalesce(e.voucher_no, e.journal_no, e.reference_no) entry_no,
    coalesce(e.reference_no, e.source_reference_no) reference,
    e.created_at ts, e.country_id, coalesce(e.city_branch_id, e.country_branch_id) branch_id,
    coalesce(e.narration, e.source_transaction_type, 'Roznamcha Entry') entry_name,
    rl.account_no party, rl.currency, rl.debit, rl.credit, e.status::text,
    cp.full_name created_by, ap.full_name approved_by, '/dashboard/roznamcha/reports/all' href
  from roznamcha_entries e
  left join rl on rl.eid = e.id
  left join profiles cp on cp.id = e.created_by
  left join profiles ap on ap.id = e.approved_by
  where e.deleted_at is null
  union all
  -- Purchase orders
  select po.id::text, 'Purchase', 'Purchase', 'Purchase Order', po.purchase_order_no, po.purchase_order_no,
    po.created_at, po.country_id, coalesce(po.city_branch_id, po.country_branch_id), 'Purchase Order',
    comp.name, po.currency_code, coalesce(po.order_total,0), 0, coalesce(po.payment_status::text,'-'),
    null, null, '/dashboard/purchase/purchase-booking-journal-report'
  from purchase_orders po left join companies comp on comp.id = po.supplier_company_id where po.deleted_at is null
  union all
  -- Sales orders
  select so.id::text, 'Sales', 'Sale', 'Sales Order', so.sales_order_no, so.sales_order_no,
    so.created_at, so.country_id, coalesce(so.city_branch_id, so.country_branch_id), 'Sales Order',
    so.customer_name, null, 0, 0, '-', null, null, '/dashboard/sales'
  from sales_orders so where so.deleted_at is null
  union all
  select c.id::text, 'Master', 'Customer', 'Customer', null, null, c.created_at, c.country_id, null,
    'Customer Added', coalesce(c.customer_name, c.company_name), null, 0, 0, 'Active', null, null,
    '/dashboard/settings/customers/' || c.id
  from customers c where c.deleted_at is null
  union all
  select co.id::text, 'Master', 'Company', 'Company', null, null, co.created_at, co.country_id, null,
    'Company Added', co.name, null, 0, 0, 'Active', null, null, '/dashboard/settings/companies'
  from companies co where co.deleted_at is null
  union all
  select b.id::text, 'Master', 'Bank', 'Bank Account', b.account_number, b.account_number, b.created_at,
    b.country_id, null, 'Bank / Account Added', b.bank_name, null, 0, 0, coalesce(b.account_status::text,'Active'),
    null, null, '/dashboard/settings/banks'
  from banks b where b.deleted_at is null
  union all
  select em.id::text, 'Master', 'Employee', 'Employee', em.employee_code, em.employee_code, em.created_at,
    em.country_id, coalesce(em.city_branch_id, em.country_branch_id), coalesce(em.designation,'Employee'),
    (select full_name from profiles pr where pr.id = em.person_master_id or pr.person_master_id = em.person_master_id limit 1),
    null, 0, 0, 'Active', null, null, '/dashboard/settings/employees'
  from employees em where em.deleted_at is null
  union all
  select w.id::text, 'Master', 'Warehouse', 'Warehouse', w.warehouse_code, w.warehouse_code, w.created_at,
    w.country_id, null, 'Warehouse', w.warehouse_name, null, 0, 0, coalesce(w.status::text,'Active'), null, null,
    '/dashboard/settings/warehouses'
  from warehouses w where w.deleted_at is null
  union all
  select g.id::text, 'Master', 'Goods', 'Goods', g.chs_code, g.chs_code, g.created_at, g.origin_country_id, null,
    'Goods / Stock Item', g.goods_name, null, 0, 0, case when g.is_active then 'Active' else 'Inactive' end,
    null, null, '/dashboard/settings/goods'
  from goods g where g.deleted_at is null
  union all
  select u.id::text, 'Master', 'User', 'User', u.user_code, u.user_code, u.created_at, null, null,
    'User / Login', u.full_name, null, 0, 0, 'Active', null, null, '/dashboard/new-entry/users/all'
  from profiles u where u.deleted_at is null
)`;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) throw new ErpAuthError("Super Admin access is required for the ERP activity monitor.");

    const p = request.nextUrl.searchParams;
    const moduleFilter = p.get("module")?.trim() || "all";
    const countryId = p.get("countryId")?.trim() || "";
    const branchId = p.get("branchId")?.trim() || "";
    const status = p.get("status")?.trim() || "";
    const currency = p.get("currency")?.trim() || "";
    const dateFrom = p.get("dateFrom")?.trim() || "";
    const dateTo = p.get("dateTo")?.trim() || "";
    const search = p.get("search")?.trim() || "";
    const page = Math.max(1, Number(p.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(p.get("pageSize")) || 25));
    const offset = (page - 1) * pageSize;

    const result = await withLocalPg(async (sql) => {
      // Summary (real)
      const [c] = await sql`select count(*)::int c from countries`;
      const [b] = await sql`select (select count(*) from country_branches where deleted_at is null)::int + (select count(*) from city_branches where deleted_at is null)::int c`;
      const [today] = await sql`select count(*)::int c from roznamcha_entries where deleted_at is null and (entry_date = current_date or created_at::date = current_date)`;
      const [tot] = await sql`select coalesce(sum(l.debit),0)::numeric d, coalesce(sum(l.credit),0)::numeric c from roznamcha_lines l join roznamcha_entries e on e.id=l.roznamcha_entry_id where e.deleted_at is null`;

      const safe = (v: string) => v.replace(/[%,]/g, "");
      const where = sql`
        where true
        and (${moduleFilter !== "all" ? sql`f.module = ${moduleFilter}` : sql`true`})
        and (${countryId ? sql`f.country_id = ${countryId}` : sql`true`})
        and (${branchId ? sql`f.branch_id = ${branchId}` : sql`true`})
        and (${status ? sql`lower(f.status) = lower(${status})` : sql`true`})
        and (${currency ? sql`f.currency = ${currency}` : sql`true`})
        and (${dateFrom ? sql`f.ts >= ${dateFrom}` : sql`true`})
        and (${dateTo ? sql`f.ts <= ${dateTo + " 23:59:59"}` : sql`true`})
        and (${search ? sql`(
              f.entry_name ilike ${"%" + safe(search) + "%"} or f.party ilike ${"%" + safe(search) + "%"}
              or f.reference ilike ${"%" + safe(search) + "%"} or f.entry_no ilike ${"%" + safe(search) + "%"}
              or f.module ilike ${"%" + safe(search) + "%"})` : sql`true`})`;

      const [countRow] = await sql`${sql.unsafe(FEED_SQL)} select count(*)::int total from feed f ${where}`;
      const rows = await sql`
        ${sql.unsafe(FEED_SQL)}
        select f.*, c2.name country_name, coalesce(cib.name, cb.name) branch_name
        from feed f
        left join countries c2 on c2.id = f.country_id
        left join city_branches cib on cib.id = f.branch_id
        left join country_branches cb on cb.id = f.branch_id
        ${where}
        order by f.ts desc nulls last
        limit ${pageSize} offset ${offset}`;

      return { c, b, today, tot, total: countRow.total, rows };
    });

    if (!result) return apiOk({ summary: null, entries: [], total: 0, page, pageSize, connected: false });

    const num = (n: any) => Number(n || 0);
    const entries = (result.rows as any[]).map((r, i) => ({
      sr: offset + i + 1,
      recordId: r.record_id,
      sourceModule: r.source_module,
      module: r.module,
      txnType: r.txn_type,
      entryNo: r.entry_no || "",
      reference: r.reference || "",
      date: r.ts,
      country: r.country_name || "",
      branch: r.branch_name || "",
      entryName: r.entry_name || "",
      party: r.party || "",
      currency: r.currency || "",
      debit: num(r.debit),
      credit: num(r.credit),
      status: r.status || "",
      createdBy: r.created_by || "",
      approvedBy: r.approved_by || "",
      href: r.href || "#"
    }));

    const summary = {
      countries: (result.c as any).c,
      branches: (result.b as any).c,
      todayEntries: (result.today as any).c,
      totalDebit: num((result.tot as any).d),
      totalCredit: num((result.tot as any).c),
      netMovement: num((result.tot as any).d) - num((result.tot as any).c)
    };

    return apiOk({
      summary, entries, total: result.total, page, pageSize, connected: true,
      connectedModules: ["Journal", "Payment", "Bank", "Purchase", "Sale", "Transfer", "Sales", "Customer", "Company", "Employee", "Warehouse", "Goods", "User"]
    });
  } catch (error) {
    return handleApiError(error);
  }
}
