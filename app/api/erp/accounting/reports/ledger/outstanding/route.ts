import { assertNotShippingOnly } from "@/lib/permissions/shipping-explicit-gate";
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { assertFinancialAccess } from "@/lib/permissions/middleware";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

/**
 * Outstanding / Recovery ledger report.
 * Reads the ledger_outstanding_v view with joined branch, country, and account metadata.
 * Scoped to the caller's country/branch according to ERP RBAC rules.
 *
 *   GET /api/erp/accounting/reports/ledger/outstanding
 *        ?countryId=<uuid>      (optional filter; super admin cross-country)
 *        &branchId=<uuid>       (optional filter)
 *        &overdueDays=<n>       (optional; only rows aged >= n days)
 *        &side=all|debit|credit (optional; receivable=debit, payable=credit)
 */
const querySchema = z.object({
  countryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  overdueDays: z.coerce.number().int().min(0).optional(),
  side: z.enum(["all", "debit", "credit"]).optional().default("all"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertFinancialAccess(session);
    assertNotShippingOnly(session);
    authorizeApiScope(session, { resource: "reports", action: "read" });
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const q = querySchema.parse({
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      branchId: request.nextUrl.searchParams.get("branchId") ?? undefined,
      overdueDays: request.nextUrl.searchParams.get("overdueDays") ?? undefined,
      side: request.nextUrl.searchParams.get("side") ?? undefined,
    });

    const rowsRaw = await withLocalPg(async (sql) => {
      // Build RBAC scope condition
      const scopeCond = session.isSuperAdmin
        ? (q.countryId ? sql`v.country_id = ${q.countryId}` : sql`true`)
        : sql`(
            v.country_id = any(${session.countryIds}::uuid[])
            or v.country_branch_id = any(${session.countryBranchIds}::uuid[])
            or v.city_branch_id = any(${session.cityBranchIds}::uuid[])
          )`;

      const branchCond = q.branchId
        ? sql`(v.city_branch_id = ${q.branchId} or v.country_branch_id = ${q.branchId})`
        : sql`true`;

      return sql`
        select
          v.id,
          v.scope,
          v.country_id,
          c.name as country_name,
          v.country_branch_id,
          cb.name as country_branch_name,
          cb.code as country_branch_code,
          v.city_branch_id,
          cib.name as city_branch_name,
          cib.code as city_branch_code,
          v.account_id,
          ea.account_number,
          ea.kind as account_type,
          ea.status as account_status,
          ea.contacts,
          v.code,
          v.name,
          v.currency,
          v.opening_balance,
          v.current_balance,
          v.debit_total,
          v.credit_total,
          v.last_movement_date,
          v.days_since_movement
        from public.ledger_outstanding_v v
        left join public.countries c on c.id = v.country_id
        left join public.country_branches cb on cb.id = v.country_branch_id
        left join public.city_branches cib on cib.id = v.city_branch_id
        left join public.enterprise_accounts ea on ea.id = v.account_id
        where ${scopeCond} and ${branchCond}
        order by v.days_since_movement desc nulls last, v.current_balance desc
      `;
    });

    let rows: any[] = [];

    if (rowsRaw && Array.isArray(rowsRaw)) {
      rows = rowsRaw.map((r: any) => {
        const bal = Number(r.current_balance ?? 0);
        const debitTotal = Number(r.debit_total ?? 0);
        const creditTotal = Number(r.credit_total ?? 0);
        const branchName = r.city_branch_name || r.country_branch_name || "All Branches";
        const branchCode = r.city_branch_code || r.country_branch_code || null;

        // Parse contacts
        let contactPhone = "";
        let contactEmail = "";
        let contactPerson = "";
        if (r.contacts) {
          if (typeof r.contacts === "object") {
            contactPhone = r.contacts.phone || r.contacts.mobile || "";
            contactEmail = r.contacts.email || "";
            contactPerson = r.contacts.contact_person || r.contacts.name || "";
          } else if (typeof r.contacts === "string") {
            contactPhone = r.contacts;
          }
        }

        return {
          id: r.id,
          code: r.code,
          accountNumber: r.account_number || r.code,
          name: r.name,
          currency: r.currency,
          countryId: r.country_id,
          countryName: r.country_name || "—",
          countryBranchId: r.country_branch_id,
          cityBranchId: r.city_branch_id,
          branchName,
          branchCode,
          accountType: r.account_type ? String(r.account_type).replace(/_/g, " ").toUpperCase() : "GENERAL",
          accountStatus: r.account_status ? String(r.account_status).toUpperCase() : "ACTIVE",
          contactPhone,
          contactEmail,
          contactPerson,
          scope: r.scope,
          openingBalance: Number(r.opening_balance ?? 0),
          outstanding: bal,
          finalBalance: Math.abs(bal),
          balanceDirection: bal > 0 ? "DR" : bal < 0 ? "CR" : "—",
          side: bal > 0 ? "debit" : bal < 0 ? "credit" : "zero", // debit balance = receivable
          debitTotal,
          creditTotal,
          lastMovementDate: r.last_movement_date,
          daysOutstanding: r.days_since_movement !== null && r.days_since_movement !== undefined ? Number(r.days_since_movement) : null,
        };
      });
    } else {
      // Fallback: Supabase client query
      const admin = createSupabaseAdminClient() as any;
      let view = admin
        .from("ledger_outstanding_v")
        .select(
          "id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, last_movement_date, days_since_movement"
        );

      if (!session.isSuperAdmin) {
        const conditions: string[] = [];
        if (session.cityBranchIds?.length) conditions.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
        if (session.countryBranchIds?.length) conditions.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
        if (session.countryIds?.length) conditions.push(`country_id.in.(${session.countryIds.join(",")})`);
        view = conditions.length ? view.or(conditions.join(",")) : view.eq("id", "00000000-0000-0000-0000-000000000000");
      } else if (q.countryId) {
        view = view.eq("country_id", q.countryId);
      }

      const { data, error } = await view.order("days_since_movement", { ascending: false, nullsFirst: false });
      if (error) throw new Error(error.message);

      rows = (data ?? []).map((r: any) => {
        const bal = Number(r.current_balance ?? 0);
        return {
          id: r.id,
          code: r.code,
          accountNumber: r.code,
          name: r.name,
          currency: r.currency,
          countryId: r.country_id,
          countryName: "—",
          countryBranchId: r.country_branch_id,
          cityBranchId: r.city_branch_id,
          branchName: "—",
          branchCode: null,
          accountType: "GENERAL",
          accountStatus: "ACTIVE",
          contactPhone: "",
          contactEmail: "",
          contactPerson: "",
          scope: r.scope,
          openingBalance: Number(r.opening_balance ?? 0),
          outstanding: bal,
          finalBalance: Math.abs(bal),
          balanceDirection: bal > 0 ? "DR" : bal < 0 ? "CR" : "—",
          side: bal > 0 ? "debit" : bal < 0 ? "credit" : "zero",
          debitTotal: Number(r.debit_total ?? 0),
          creditTotal: Number(r.credit_total ?? 0),
          lastMovementDate: r.last_movement_date,
          daysOutstanding: r.days_since_movement !== null && r.days_since_movement !== undefined ? Number(r.days_since_movement) : null,
        };
      });
    }

    if (q.side === "debit") rows = rows.filter((x: any) => x.outstanding > 0);
    else if (q.side === "credit") rows = rows.filter((x: any) => x.outstanding < 0);

    const overdueThreshold = typeof q.overdueDays === "number" ? q.overdueDays : 10;
    if (typeof q.overdueDays === "number") {
      rows = rows.filter((x: any) => (x.daysOutstanding ?? 0) >= q.overdueDays!);
    }

    try {
      rows = await localizeRecordFields<any>(rows, "ledgers", ["name"], lang);
    } catch {
      // keep original names
    }

    const totalReceivable = rows.filter((x: any) => x.outstanding > 0).reduce((s: number, x: any) => s + x.outstanding, 0);
    const totalPayable = rows.filter((x: any) => x.outstanding < 0).reduce((s: number, x: any) => s + Math.abs(x.outstanding), 0);
    const overdueRows = rows.filter((x: any) => (x.daysOutstanding ?? 0) >= overdueThreshold);
    const overdueAmounts = overdueRows.reduce((s: number, x: any) => s + Math.abs(x.outstanding), 0);

    const summary = {
      totalAccounts: rows.length,
      accounts: rows.length,
      totalReceivable,
      totalPayable,
      netOutstanding: totalReceivable - totalPayable,
      clearedEntries: 0,
      remainingEntries: rows.filter((x: any) => x.outstanding !== 0).length,
      overdueAccounts: overdueRows.length,
      overdueAmounts,
      overdue10: rows.filter((x: any) => (x.daysOutstanding ?? 0) > 10).length,
    };

    return apiOk({ rows, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
