import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM Phase 6 — payroll tax / statutory contribution configuration service.
 * Per-country, versioned by effective_from. Separate from Purchase/Sales VAT.
 * Scope repeated in every WHERE.
 */

function scopeWhere(sql: any, scope: HrScope) {
  if (scope.countryIds === null) return sql`TRUE`;
  return sql`t.country_id = ANY(${scope.countryIds})`;
}

export type PayrollTaxInput = {
  countryId: string;
  name: string;
  componentType: string;
  payer: "employee" | "employer";
  calcMethod?: "flat_percent" | "fixed_amount" | "slab";
  appliesTo?: "gross" | "basic" | "taxable";
  ratePercent?: number;
  fixedAmount?: number;
  slabs?: Array<{ up_to: number; percent: number; plus_fixed?: number }>;
  monthlyExemption?: number;
  annualExemption?: number;
  currency?: string;
  ledgerId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  filingFrequency?: "monthly" | "quarterly" | "annual";
  isActive?: boolean;
  sourceReference?: string | null;
  notes?: string | null;
};

export class HrPayrollTaxService {
  async list(scope: HrScope, opts: { countryId?: string; componentType?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scopeWhere(sql, scope)];
      if (opts.countryId) where.push(sql`t.country_id = ${opts.countryId}`);
      if (opts.componentType) where.push(sql`t.component_type = ${opts.componentType}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT t.* FROM public.hr_payroll_tax_config_v t WHERE ${w}
        ORDER BY t.country_name ASC, t.component_type ASC, t.effective_from DESC`;
    });
    return rows ?? [];
  }

  async upsert(input: PayrollTaxInput, id: string | null, actorId: string, scope: HrScope) {
    if (scope.countryIds && !scope.countryIds.includes(input.countryId)) throw new Error("Country outside your scope.");
    return withLocalPg(async (sql) => {
      if (id) {
        await sql`UPDATE public.hr_payroll_tax_config SET
          name = COALESCE(${input.name ?? null}, name),
          component_type = COALESCE(${input.componentType ?? null}, component_type),
          payer = COALESCE(${input.payer ?? null}, payer),
          calc_method = COALESCE(${input.calcMethod ?? null}, calc_method),
          applies_to = COALESCE(${input.appliesTo ?? null}, applies_to),
          rate_percent = COALESCE(${input.ratePercent ?? null}, rate_percent),
          fixed_amount = COALESCE(${input.fixedAmount ?? null}, fixed_amount),
          slabs = COALESCE(${input.slabs ? sql.json(input.slabs) : null}, slabs),
          monthly_exemption = COALESCE(${input.monthlyExemption ?? null}, monthly_exemption),
          annual_exemption = COALESCE(${input.annualExemption ?? null}, annual_exemption),
          currency = COALESCE(${input.currency ?? null}, currency),
          ledger_id = ${input.ledgerId === undefined ? sql`ledger_id` : input.ledgerId},
          effective_from = COALESCE(${input.effectiveFrom ?? null}, effective_from),
          effective_to = ${input.effectiveTo === undefined ? sql`effective_to` : input.effectiveTo},
          filing_frequency = COALESCE(${input.filingFrequency ?? null}, filing_frequency),
          is_active = COALESCE(${input.isActive ?? null}, is_active),
          source_reference = ${input.sourceReference === undefined ? sql`source_reference` : input.sourceReference},
          notes = ${input.notes === undefined ? sql`notes` : input.notes},
          updated_by = ${actorId}, updated_at = now()
          WHERE id = ${id} AND deleted_at IS NULL`;
        return { id };
      }
      const r = await sql`INSERT INTO public.hr_payroll_tax_config
        (country_id, name, component_type, payer, calc_method, applies_to, rate_percent, fixed_amount, slabs,
         monthly_exemption, annual_exemption, currency, ledger_id, effective_from, effective_to,
         filing_frequency, is_active, source_reference, notes, created_by, updated_by)
        VALUES (${input.countryId}, ${input.name}, ${input.componentType}, ${input.payer},
          ${input.calcMethod ?? "flat_percent"}, ${input.appliesTo ?? "gross"}, ${input.ratePercent ?? 0}, ${input.fixedAmount ?? 0},
          ${sql.json(input.slabs ?? [])}, ${input.monthlyExemption ?? 0}, ${input.annualExemption ?? 0},
          ${input.currency ?? "USD"}, ${input.ledgerId ?? null}, ${input.effectiveFrom ?? new Date().toISOString().slice(0, 10)},
          ${input.effectiveTo ?? null}, ${input.filingFrequency ?? "monthly"}, ${input.isActive ?? true},
          ${input.sourceReference ?? null}, ${input.notes ?? null}, ${actorId}, ${actorId})
        RETURNING id`;
      return r?.[0] ?? null;
    });
  }

  async remove(id: string, actorId: string, scope: HrScope) {
    await withLocalPg(async (sql) => {
      const row = (await sql`SELECT country_id FROM public.hr_payroll_tax_config WHERE id = ${id} AND deleted_at IS NULL`)?.[0];
      if (!row) throw new Error("Config not found.");
      if (scope.countryIds !== null && !scope.countryIds.includes(row.country_id)) throw new Error("Out of scope.");
      await sql`UPDATE public.hr_payroll_tax_config SET deleted_at = now(), updated_by = ${actorId} WHERE id = ${id}`;
    });
    return { id };
  }

  /** Payroll-tax report: employee tax + employer contributions per run/period. */
  async report(scope: HrScope, opts: { periodMonth?: string; countryId?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [
        scope.countryIds === null ? sql`TRUE` : sql`r.country_id = ANY(${scope.countryIds})`,
        sql`r.deleted_at IS NULL`,
        sql`r.status IN ('posted','paid','reversed')`,
      ];
      if (opts.periodMonth) where.push(sql`r.period_month = ${opts.periodMonth}`);
      if (opts.countryId) where.push(sql`r.country_id = ${opts.countryId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT r.run_no, r.period_month, co.name AS country_name, r.status,
               count(l.*) AS employees,
               COALESCE(sum(l.tax_employee),0) AS employee_tax,
               COALESCE(sum(l.employer_contributions),0) AS employer_contributions,
               COALESCE(sum(l.tax_employee + l.employer_contributions),0) AS total_statutory
        FROM public.hr_payroll_runs r
        JOIN public.hr_payroll_run_lines l ON l.run_id = r.id AND l.status <> 'excluded'
        LEFT JOIN public.countries co ON co.id = r.country_id
        WHERE ${w}
        GROUP BY r.run_no, r.period_month, co.name, r.status
        ORDER BY r.period_month DESC, r.run_no`;
    });
    return rows ?? [];
  }
}

export const hrPayrollTaxService = new HrPayrollTaxService();
