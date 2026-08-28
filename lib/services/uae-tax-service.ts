/* eslint-disable @typescript-eslint/no-explicit-any */
import { withLocalPg } from "@/lib/db/local-postgres";
import type {
  UaeDesignatedZone,
  UaeTaxDashboardKpis,
  UaeTaxEntity,
  UaeTaxLine,
  UaeTaxLineFilters,
  UaeTaxLineListResult,
  UaeTaxPeriod,
  UaeTaxRule,
} from "@/features/uae-tax/types/uae-tax";

/**
 * Server-side scope constraint. When `countryIds` is a non-empty array the
 * query is restricted to those countries (non-super-admin). `null`/`undefined`
 * = global (super admin). `withLocalPg` bypasses RLS, so every method that can
 * be reached by a scoped user MUST apply this in the WHERE clause.
 */
export interface UaeTaxScope {
  countryIds?: string[] | null;
  cityBranchIds?: string[] | null;
}

const EMPTY_LIST: UaeTaxLineListResult = { items: [], total: 0 };
const ZERO_KPIS: UaeTaxDashboardKpis = {
  output_taxable_aed: 0,
  output_vat_aed: 0,
  output_zero_rated_aed: 0,
  output_exempt_aed: 0,
  input_taxable_aed: 0,
  input_vat_aed: 0,
  input_recoverable_aed: 0,
  input_non_recoverable_aed: 0,
  expense_vat_aed: 0,
  import_vat_aed: 0,
  export_aed: 0,
  re_export_aed: 0,
  net_vat_aed: 0,
  lines_total: 0,
  lines_missing_document: 0,
  lines_needs_review: 0,
  lines_pending_recovery: 0,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export class UaeTaxService {
  // ---- Tax entities -------------------------------------------------------

  async listEntities(scope?: UaeTaxScope): Promise<UaeTaxEntity[]> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<UaeTaxEntity[]>`
        SELECT e.*,
               co.name AS country_name,
               (SELECT COUNT(*) FROM public.uae_tax_entity_branches b
                 WHERE b.tax_entity_id = e.id AND b.deleted_at IS NULL) AS branch_count
        FROM public.uae_tax_entities e
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE e.deleted_at IS NULL
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY e.created_at
      `;
      return rows;
    });
    return res ?? [];
  }

  async getEntity(id: string, scope?: UaeTaxScope): Promise<UaeTaxEntity | null> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql<UaeTaxEntity[]>`
        SELECT e.*, co.name AS country_name
        FROM public.uae_tax_entities e
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE e.id = ${id} AND e.deleted_at IS NULL
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
      `;
      return row ?? null;
    });
    return res ?? null;
  }

  async createEntity(input: {
    countryId: string;
    companyId?: string | null;
    trn: string;
    legalName: string;
    registeredName?: string | null;
    registrationDate?: string | null;
    filingFrequency: "monthly" | "quarterly";
    firstPeriodStart?: string | null;
    baseCurrency?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    createdBy: string;
  }): Promise<{ id: string }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`
        INSERT INTO public.uae_tax_entities
          (country_id, company_id, trn, legal_name, registered_name, registration_date,
           filing_frequency, first_period_start, base_currency, address, phone, email, created_by)
        VALUES
          (${input.countryId}, ${input.companyId ?? null}, ${input.trn}, ${input.legalName},
           ${input.registeredName ?? null}, ${input.registrationDate ?? null},
           ${input.filingFrequency}, ${input.firstPeriodStart ?? null},
           ${input.baseCurrency ?? "AED"}, ${input.address ?? null}, ${input.phone ?? null},
           ${input.email ?? null}, ${input.createdBy})
        RETURNING id
      `;
      return { id: String(row?.id ?? "") };
    });
    if (!res) throw new Error("Database is not configured");
    return res;
  }

  async updateEntity(
    id: string,
    patch: Record<string, unknown>,
    scope?: UaeTaxScope,
  ): Promise<{ updated: boolean }> {
    const allowed = [
      "company_id", "trn", "legal_name", "registered_name", "registration_date",
      "filing_frequency", "first_period_start", "base_currency", "address",
      "phone", "email", "is_active", "effective_to",
    ] as const;
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in patch) clean[k] = patch[k];
    }
    if (Object.keys(clean).length <= 1) return { updated: false };
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.uae_tax_entities
        SET ${sql(clean as any)}
        WHERE id = ${id} AND deleted_at IS NULL
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        RETURNING id
      `;
      return { updated: rows.length > 0 };
    });
    return res ?? { updated: false };
  }

  async listEntityBranches(taxEntityId: string): Promise<
    Array<{ id: string; country_branch_id: string | null; city_branch_id: string | null; city_branch_name: string | null; country_branch_name: string | null }>
  > {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT b.id, b.country_branch_id, b.city_branch_id,
               cib.name AS city_branch_name, cb.name AS country_branch_name
        FROM public.uae_tax_entity_branches b
        LEFT JOIN public.city_branches cib ON cib.id = b.city_branch_id
        LEFT JOIN public.country_branches cb ON cb.id = b.country_branch_id
        WHERE b.tax_entity_id = ${taxEntityId} AND b.deleted_at IS NULL
        ORDER BY cib.name NULLS LAST, cb.name
      `;
      return rows as any[];
    });
    return res ?? [];
  }

  async setEntityBranches(
    taxEntityId: string,
    branches: Array<{ countryBranchId?: string | null; cityBranchId?: string | null }>,
    createdBy: string,
  ): Promise<{ count: number }> {
    const res = await withLocalPg(async (sql) => {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE public.uae_tax_entity_branches
          SET deleted_at = NOW()
          WHERE tax_entity_id = ${taxEntityId} AND deleted_at IS NULL
        `;
        for (const b of branches) {
          await tx`
            INSERT INTO public.uae_tax_entity_branches
              (tax_entity_id, country_branch_id, city_branch_id, created_by)
            VALUES (${taxEntityId}, ${b.countryBranchId ?? null}, ${b.cityBranchId ?? null}, ${createdBy})
          `;
        }
      });
      return { count: branches.length };
    });
    return res ?? { count: 0 };
  }

  // ---- Regulatory config -------------------------------------------------

  async listRules(ruleType?: string): Promise<UaeTaxRule[]> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<UaeTaxRule[]>`
        SELECT * FROM public.uae_tax_rules
        WHERE deleted_at IS NULL
          AND (${ruleType ? sql`rule_type = ${ruleType}` : sql`TRUE`})
        ORDER BY rule_type, rule_key, effective_from DESC
      `;
      return rows;
    });
    return res ?? [];
  }

  async listDesignatedZones(): Promise<UaeDesignatedZone[]> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<UaeDesignatedZone[]>`
        SELECT * FROM public.uae_designated_zones
        WHERE deleted_at IS NULL
        ORDER BY zone_name
      `;
      return rows;
    });
    return res ?? [];
  }

  // ---- Periods ----------------------------------------------------------

  async listPeriods(taxEntityId?: string, scope?: UaeTaxScope): Promise<UaeTaxPeriod[]> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<UaeTaxPeriod[]>`
        SELECT p.*
        FROM public.uae_tax_periods p
        JOIN public.uae_tax_entities e ON e.id = p.tax_entity_id
        WHERE p.deleted_at IS NULL
          AND (${taxEntityId ? sql`p.tax_entity_id = ${taxEntityId}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY p.period_start DESC
      `;
      return rows;
    });
    return res ?? [];
  }

  // ---- Tax lines (the core list) --------------------------------------

  async listLines(
    filters: UaeTaxLineFilters,
    scope?: UaeTaxScope,
  ): Promise<UaeTaxLineListResult> {
    const res = await withLocalPg(async (sql) => {
      const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
      const offset = Math.max(filters.offset ?? 0, 0);

      const where = sql`
        tl.deleted_at IS NULL
        AND (${filters.taxEntityId ? sql`tl.tax_entity_id = ${filters.taxEntityId}` : sql`TRUE`})
        AND (${filters.countryId ? sql`tl.country_id = ${filters.countryId}` : sql`TRUE`})
        AND (${filters.countryBranchId ? sql`tl.country_branch_id = ${filters.countryBranchId}` : sql`TRUE`})
        AND (${filters.cityBranchId ? sql`tl.city_branch_id = ${filters.cityBranchId}` : sql`TRUE`})
        AND (${filters.periodId ? sql`tl.tax_period_id = ${filters.periodId}` : sql`TRUE`})
        AND (${filters.direction && filters.direction !== "all" ? sql`tl.direction = ${filters.direction}` : sql`TRUE`})
        AND (${filters.transactionCategory && filters.transactionCategory !== "all" ? sql`tl.transaction_category = ${filters.transactionCategory}` : sql`TRUE`})
        AND (${filters.taxCategory && filters.taxCategory !== "all" ? sql`tl.tax_category = ${filters.taxCategory}` : sql`TRUE`})
        AND (${filters.recoverability && filters.recoverability !== "all" ? sql`tl.recoverability = ${filters.recoverability}` : sql`TRUE`})
        AND (${filters.documentStatus && filters.documentStatus !== "all" ? sql`tl.document_status = ${filters.documentStatus}` : sql`TRUE`})
        AND (${filters.currency ? sql`tl.currency = ${filters.currency}` : sql`TRUE`})
        AND (${filters.fromDate ? sql`tl.source_date >= ${filters.fromDate}::date` : sql`TRUE`})
        AND (${filters.toDate ? sql`tl.source_date <= ${filters.toDate}::date` : sql`TRUE`})
        AND (${filters.party ? sql`(tl.party_name ILIKE ${"%" + filters.party + "%"} OR tl.party_trn ILIKE ${"%" + filters.party + "%"})` : sql`TRUE`})
        AND (${filters.search ? sql`(
          tl.source_reference_no ILIKE ${"%" + filters.search + "%"}
          OR tl.party_name ILIKE ${"%" + filters.search + "%"}
          OR tl.account_name ILIKE ${"%" + filters.search + "%"}
          OR tl.description ILIKE ${"%" + filters.search + "%"}
        )` : sql`TRUE`})
        AND (${
          scope?.countryIds && scope.countryIds.length
            ? sql`tl.country_id = ANY(${scope.countryIds})`
            : sql`TRUE`
        })
      `;

      const rows = await sql<UaeTaxLine[]>`
        SELECT * FROM public.uae_tax_lines_v tl
        WHERE ${where}
        ORDER BY tl.source_date DESC, tl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [countRow] = await sql`
        SELECT COUNT(*) AS total FROM public.uae_tax_lines_v tl WHERE ${where}
      `;
      return { items: rows, total: Number(countRow?.total ?? 0) };
    });
    return res ?? EMPTY_LIST;
  }

  async getLine(id: string, scope?: UaeTaxScope): Promise<UaeTaxLine | null> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql<UaeTaxLine[]>`
        SELECT * FROM public.uae_tax_lines_v tl
        WHERE tl.id = ${id}
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`tl.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
      `;
      return row ?? null;
    });
    return res ?? null;
  }

  // ---- Dashboard KPIs -------------------------------------------------

  async getDashboardKpis(params: {
    taxEntityId?: string | null;
    periodId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
  }): Promise<UaeTaxDashboardKpis> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`
        SELECT * FROM public.get_uae_tax_dashboard_kpis(
          ${params.taxEntityId ?? null}::uuid,
          ${params.periodId ?? null}::uuid,
          ${params.fromDate ?? null}::date,
          ${params.toDate ?? null}::date
        )
      `;
      if (!row) return ZERO_KPIS;
      return {
        output_taxable_aed: num(row.output_taxable_aed),
        output_vat_aed: num(row.output_vat_aed),
        output_zero_rated_aed: num(row.output_zero_rated_aed),
        output_exempt_aed: num(row.output_exempt_aed),
        input_taxable_aed: num(row.input_taxable_aed),
        input_vat_aed: num(row.input_vat_aed),
        input_recoverable_aed: num(row.input_recoverable_aed),
        input_non_recoverable_aed: num(row.input_non_recoverable_aed),
        expense_vat_aed: num(row.expense_vat_aed),
        import_vat_aed: num(row.import_vat_aed),
        export_aed: num(row.export_aed),
        re_export_aed: num(row.re_export_aed),
        net_vat_aed: num(row.net_vat_aed),
        lines_total: num(row.lines_total),
        lines_missing_document: num(row.lines_missing_document),
        lines_needs_review: num(row.lines_needs_review),
        lines_pending_recovery: num(row.lines_pending_recovery),
      } satisfies UaeTaxDashboardKpis;
    });
    return res ?? ZERO_KPIS;
  }

  /**
   * Phase 2 fills this in. Kept as a stable entry point so the /sync route and
   * its UI exist from Phase 1.
   */
  async syncFromErp(_options?: {
    fromDate?: string | null;
    taxEntityId?: string | null;
  }): Promise<{ synced: number; bySource: Record<string, number>; note?: string }> {
    return {
      synced: 0,
      bySource: {},
      note: "Ingestion sync functions are added in Phase 2 (expenses_bill_lines.tax_on, local_purchases.apply_tax).",
    };
  }
}

export const uaeTaxService = new UaeTaxService();
