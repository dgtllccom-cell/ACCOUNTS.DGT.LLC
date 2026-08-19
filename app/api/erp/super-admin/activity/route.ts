/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession, ErpAuthError } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Super Admin "All ERP Activity / All Release Entries" live monitoring feed.
 * READ-ONLY aggregation across ERP modules from REAL data (no dummy figures). Super-admin only.
 * Financial activity comes from roznamcha_entries (the posting ledger, which carries country/branch/
 * debit/credit/status/reference); master activity comes from recently-created master records. Every
 * row includes an `href` to the originating ERP record for drill-down / "Open Full Module".
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      throw new ErpAuthError("Super Admin access is required for the ERP activity monitor.");
    }

    const params = request.nextUrl.searchParams;
    const moduleFilter = params.get("module")?.trim() || "all";
    const countryFilter = params.get("countryId")?.trim() || "";
    const branchFilter = params.get("branchId")?.trim() || "";
    const limit = Math.min(300, Math.max(20, Number(params.get("limit")) || 150));

    const data = await withLocalPg(async (sql) => {
      // ---- Live summary (real DB) ----
      const [countriesRow] = await sql`select count(*)::int c from countries`;
      const [branchesRow] = await sql`
        select (select count(*) from country_branches where deleted_at is null)::int
             + (select count(*) from city_branches where deleted_at is null)::int c`;
      const [todayRow] = await sql`
        select count(*)::int c from roznamcha_entries
        where deleted_at is null and (entry_date = current_date or created_at::date = current_date)`;
      const [totalsRow] = await sql`
        select coalesce(sum(l.debit),0)::numeric d, coalesce(sum(l.credit),0)::numeric c
        from roznamcha_lines l join roznamcha_entries e on e.id = l.roznamcha_entry_id
        where e.deleted_at is null`;

      // ---- Financial activity feed from roznamcha_entries (rich real data) ----
      const entryRows = await sql`
        select
          e.id, e.entry_category, e.source_module, e.source_transaction_type, e.reference_no,
          e.source_reference_no, e.narration, e.status, e.entry_date, e.created_at,
          c.name as country_name, cb.name as country_branch_name, cib.name as city_branch_name,
          (select jsonb_build_object(
              'debit', coalesce(sum(rl.debit),0),
              'credit', coalesce(sum(rl.credit),0),
              'currency', max(rl.currency),
              'ledger', max(l.name),
              'account', max(rl.account_number))
           from roznamcha_lines rl left join ledgers l on l.id = rl.ledger_id
           where rl.roznamcha_entry_id = e.id) as agg
        from roznamcha_entries e
        left join countries c on c.id = e.country_id
        left join country_branches cb on cb.id = e.country_branch_id
        left join city_branches cib on cib.id = e.city_branch_id
        where e.deleted_at is null
          and (${countryFilter ? sql`e.country_id = ${countryFilter}` : sql`true`})
          and (${branchFilter ? sql`(e.city_branch_id = ${branchFilter} or e.country_branch_id = ${branchFilter})` : sql`true`})
        order by e.created_at desc
        limit ${limit}`;

      // ---- Recent master activity (real created_at) ----
      const customers = await sql`select id, customer_name, company_name, created_at, country_id from customers where deleted_at is null order by created_at desc limit 15`;
      const companies = await sql`select id, name, created_at, country_id from companies where deleted_at is null order by created_at desc limit 10`;
      const banks = await sql`select id, bank_name, account_number, created_at, country_id from banks where deleted_at is null order by created_at desc limit 10`;

      return { countriesRow, branchesRow, todayRow, totalsRow, entryRows, customers, companies, banks };
    });

    if (!data) {
      return apiOk({ summary: null, entries: [], connected: false });
    }

    const moduleOf = (e: any): string => {
      const sm = String(e.source_module || "").toLowerCase();
      const cat = String(e.entry_category || "").toLowerCase();
      const stt = String(e.source_transaction_type || "").toLowerCase();
      if (sm.includes("cash")) return "Payment";
      if (cat === "bank" || sm.includes("bank")) return "Bank";
      if (sm.includes("purchase") || stt.includes("purchase")) return "Purchase";
      if (sm.includes("sale") || stt.includes("sale")) return "Sale";
      if (stt.includes("transfer")) return "Transfer";
      if (cat === "invoice") return "Purchase";
      return "Journal";
    };

    const num = (n: any) => Number(n || 0);
    let entries = (data.entryRows as any[]).map((e) => {
      const agg = e.agg || {};
      return {
        id: e.id,
        module: moduleOf(e),
        country: e.country_name || "",
        branch: e.city_branch_name || e.country_branch_name || "",
        entryName: e.narration || e.source_transaction_type || "Roznamcha Entry",
        party: agg.ledger || agg.account || "",
        bank: agg.account || "",
        reference: e.reference_no || e.source_reference_no || "",
        currency: agg.currency || "",
        debit: num(agg.debit),
        credit: num(agg.credit),
        final: e.status,
        status: e.status,
        date: e.created_at || e.entry_date,
        href: "/dashboard/roznamcha/reports/all"
      };
    });

    // fold in master activity events
    const push = (arr: any[], mod: string, mapper: (r: any) => any) => {
      for (const r of arr) entries.push({ module: mod, debit: 0, credit: 0, currency: "", bank: "", ...mapper(r) });
    };
    push(data.customers as any[], "Customer", (r) => ({ id: r.id, country: "", branch: "", entryName: "Customer Added", party: r.customer_name || r.company_name, reference: "", final: "Active", status: "Active", date: r.created_at, href: `/dashboard/settings/customers/${r.id}` }));
    push(data.companies as any[], "Company", (r) => ({ id: r.id, country: "", branch: "", entryName: "Company Added", party: r.name, reference: "", final: "Active", status: "Active", date: r.created_at, href: "/dashboard/settings/companies" }));
    push(data.banks as any[], "Bank", (r) => ({ id: r.id, country: "", branch: "", entryName: "Bank / Account Added", party: r.bank_name, reference: r.account_number || "", final: "Active", status: "Active", date: r.created_at, href: "/dashboard/settings/banks" }));

    entries.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    if (moduleFilter !== "all") entries = entries.filter((e) => e.module === moduleFilter);
    entries = entries.slice(0, limit).map((e, i) => ({ sr: i + 1, ...e }));

    const summary = {
      countries: (data.countriesRow as any).c,
      branches: (data.branchesRow as any).c,
      todayEntries: (data.todayRow as any).c,
      totalDebit: num((data.totalsRow as any).d),
      totalCredit: num((data.totalsRow as any).c),
      netMovement: num((data.totalsRow as any).d) - num((data.totalsRow as any).c)
    };

    // Which modules currently have a real data source wired (for the honest coverage matrix).
    const connectedModules = ["Journal", "Payment", "Bank", "Purchase", "Sale", "Transfer", "Customer", "Company"];
    return apiOk({ summary, entries, connected: true, connectedModules });
  } catch (error) {
    return handleApiError(error);
  }
}
