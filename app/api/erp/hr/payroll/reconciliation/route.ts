import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Payroll ↔ Accounting ↔ Tax reconciliation report.
 * Read-only projection of hr_payroll_reconciliation_v (payroll register →
 * salary due → roznamcha accrual/payment → Dr/Cr balance check). No posting.
 */
export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const runId = sp.get("runId") || undefined;
    const periodMonth = sp.get("periodMonth") || undefined;

    const data = await withLocalPg(async (sql) => {
      const where: any[] = [sql`1=1`];
      if (runId) where.push(sql`v.run_id = ${runId}`);
      if (periodMonth) where.push(sql`v.period_month = ${periodMonth}`);
      if (scope.countryIds !== null) where.push(sql`(v.country_id = ANY(${scope.countryIds}) OR v.country_id IS NULL)`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      const rows = await sql`SELECT v.* FROM public.hr_payroll_reconciliation_v v WHERE ${w} ORDER BY v.period_month DESC, v.run_no, v.employee_code LIMIT 2000`;
      const summary = await sql`
        SELECT
          count(*)::int AS lines,
          count(*) FILTER (WHERE v.accrual_balance_check = 'balanced')::int AS balanced,
          count(*) FILTER (WHERE v.accrual_balance_check = 'unbalanced')::int AS unbalanced,
          count(*) FILTER (WHERE v.accrual_balance_check = 'not_posted')::int AS not_posted,
          round(coalesce(sum(v.gross_salary), 0), 2) AS total_gross,
          round(coalesce(sum(v.tax_employee), 0), 2) AS total_tax,
          round(coalesce(sum(v.net_salary), 0), 2) AS total_net,
          round(coalesce(sum(v.accrual_dr_minus_cr), 0), 2) AS total_dr_minus_cr
        FROM public.hr_payroll_reconciliation_v v WHERE ${w}`;
      return { rows: rows ?? [], summary: summary?.[0] ?? {} };
    });
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
