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

  async upsertDesignatedZone(input: {
    id?: string;
    zoneName: string;
    emirate?: string | null;
    zoneType: "free_zone" | "designated_zone" | "mainland_special";
    isDesignated: boolean;
    status?: "active" | "inactive" | "superseded";
    sourceReference?: string | null;
    actor: string;
  }): Promise<{ id: string }> {
    const res = await withLocalPg(async (sql) => {
      if (input.id) {
        const [row] = await sql`
          UPDATE public.uae_designated_zones
          SET zone_name = ${input.zoneName}, emirate = ${input.emirate ?? null},
              zone_type = ${input.zoneType}, is_designated = ${input.isDesignated},
              status = ${input.status ?? "active"}, source_reference = ${input.sourceReference ?? null},
              updated_at = NOW()
          WHERE id = ${input.id} AND deleted_at IS NULL RETURNING id
        `;
        return { id: String(row?.id ?? "") };
      }
      const [row] = await sql`
        INSERT INTO public.uae_designated_zones (zone_name, emirate, zone_type, is_designated, status, source_reference, created_by)
        VALUES (${input.zoneName}, ${input.emirate ?? null}, ${input.zoneType}, ${input.isDesignated},
                ${input.status ?? "active"}, ${input.sourceReference ?? null}, ${input.actor}::uuid)
        RETURNING id
      `;
      return { id: String(row?.id ?? "") };
    });
    if (!res) throw new Error("Database is not configured");
    return res;
  }

  async proposePeriodPosting(periodId: string): Promise<{ postingId: string }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT public.uae_propose_period_vat_posting(${periodId}::uuid) AS id`;
      return { postingId: String(row?.id ?? "") };
    });
    return res ?? { postingId: "" };
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
   * Pull taxable lines from the ERP source modules into uae_tax_lines.
   * Idempotent — safe to run repeatedly (unique on the source key).
   */
  async syncFromErp(options?: {
    fromDate?: string | null;
    taxEntityId?: string | null;
  }): Promise<{ synced: number; bySource: Record<string, number>; note?: string }> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<Array<{ source: string; rows_synced: number }>>`
        SELECT source, rows_synced
        FROM public.sync_uae_tax_all(${options?.fromDate ?? null}::date, ${options?.taxEntityId ?? null}::uuid)
      `;
      const bySource: Record<string, number> = {};
      let synced = 0;
      for (const r of rows) {
        bySource[r.source] = Number(r.rows_synced ?? 0);
        // import_enrichment updates existing rows, so don't double-count it
        if (r.source !== "import_enrichment") synced += Number(r.rows_synced ?? 0);
      }
      return { synced, bySource };
    });
    return res ?? { synced: 0, bySource: {}, note: "Database is not configured." };
  }

  /**
   * Manual classification of a tax line by a reviewer (recoverability,
   * tax category, transaction category, review status).
   */
  async updateLineClassification(
    id: string,
    patch: {
      recoverability?: string;
      recoverableAmount?: number;
      taxCategory?: string;
      transactionCategory?: string;
      reviewStatus?: string;
      taxCodeId?: string | null;
    },
    scope?: UaeTaxScope,
  ): Promise<{ updated: boolean }> {
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.recoverability) clean.recoverability = patch.recoverability;
    if (patch.recoverableAmount !== undefined) clean.recoverable_amount = patch.recoverableAmount;
    if (patch.taxCategory) clean.tax_category = patch.taxCategory;
    if (patch.transactionCategory) clean.transaction_category = patch.transactionCategory;
    if (patch.reviewStatus) clean.review_status = patch.reviewStatus;
    if (patch.taxCodeId !== undefined) clean.tax_code_id = patch.taxCodeId;
    if (Object.keys(clean).length <= 1) return { updated: false };

    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.uae_tax_lines
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

  /**
   * Resolve the dashboard URL of the original transaction behind a tax line,
   * so the UI row click opens the source bill (never a copy).
   */
  sourceLink(line: Pick<UaeTaxLine, "source_module" | "source_id">): string {
    switch (line.source_module) {
      case "expenses_bill":
        return `/dashboard/roznamcha/expenses?bill=${line.source_id}`;
      case "local_purchase":
        return `/dashboard/purchase/local-purchase?id=${line.source_id}`;
      case "purchase_order":
        return `/dashboard/purchase/purchase-order?id=${line.source_id}`;
      case "sales_order":
        return `/dashboard/sales/sales-order?id=${line.source_id}`;
      default:
        return `/dashboard/tax-einvoicing/uae/vat-control`;
    }
  }

  // ---- Phase 3: documentation --------------------------------------------

  async attachEvidence(input: {
    officeDocumentId: string;
    sourceModule: string;
    sourceId: string;
    relationship?: string;
    actor: string;
  }): Promise<{ linked: number }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`
        SELECT public.uae_attach_tax_evidence(
          ${input.officeDocumentId}::uuid, ${input.sourceModule}, ${input.sourceId}::uuid,
          ${input.relationship ?? "source_invoice"}, ${input.actor}::uuid
        ) AS linked
      `;
      return { linked: Number(row?.linked ?? 0) };
    });
    return res ?? { linked: 0 };
  }

  async getCompleteness(taxEntityId?: string, periodId?: string): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT * FROM public.uae_tax_period_completeness_v
        WHERE (${taxEntityId ? sql`tax_entity_id = ${taxEntityId}` : sql`TRUE`})
          AND (${periodId ? sql`tax_period_id = ${periodId}` : sql`TRUE`})
        ORDER BY period_code DESC, direction, transaction_category
      `;
    });
    return res ?? [];
  }

  // ---- Phase 4: VAT return & recovery -----------------------------------

  async vatReturnPreview(periodId: string): Promise<any> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT * FROM public.uae_vat_return_preview(${periodId}::uuid)`;
      return row ?? null;
    });
    return res ?? null;
  }

  async generateVatReturn(periodId: string, actor: string): Promise<{ returnId: string }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT public.uae_generate_vat_return(${periodId}::uuid, ${actor}::uuid) AS id`;
      return { returnId: String(row?.id ?? "") };
    });
    if (!res) throw new Error("Database is not configured");
    return res;
  }

  async listVatReturns(taxEntityId?: string, scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT r.*, tp.period_code, e.legal_name AS tax_entity_name, e.trn AS tax_entity_trn
        FROM public.uae_vat_returns r
        JOIN public.uae_tax_periods tp ON tp.id = r.tax_period_id
        JOIN public.uae_tax_entities e ON e.id = r.tax_entity_id
        WHERE r.deleted_at IS NULL
          AND (${taxEntityId ? sql`r.tax_entity_id = ${taxEntityId}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY tp.period_start DESC
      `;
    });
    return res ?? [];
  }

  async fileVatReturn(returnId: string, ftaReference: string, actor: string): Promise<{ updated: boolean }> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        UPDATE public.uae_vat_returns
        SET status = 'filed', fta_reference = ${ftaReference}, filed_by = ${actor}::uuid, filed_at = NOW(), updated_at = NOW()
        WHERE id = ${returnId} AND deleted_at IS NULL AND status IN ('draft','ready')
        RETURNING id
      `;
      if (rows.length) {
        await sql`
          UPDATE public.uae_tax_periods SET status = 'filed', updated_at = NOW()
          WHERE filed_return_id = ${returnId}
        `;
      }
      return { updated: rows.length > 0 };
    });
    return res ?? { updated: false };
  }

  async listRecovery(taxEntityId?: string, scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT rec.*, tp.period_code, e.legal_name AS tax_entity_name
        FROM public.uae_vat_recovery rec
        JOIN public.uae_tax_entities e ON e.id = rec.tax_entity_id
        LEFT JOIN public.uae_tax_periods tp ON tp.id = rec.tax_period_id
        WHERE rec.deleted_at IS NULL
          AND (${taxEntityId ? sql`rec.tax_entity_id = ${taxEntityId}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY rec.created_at DESC
      `;
    });
    return res ?? [];
  }

  async upsertRecovery(input: {
    id?: string;
    taxEntityId: string;
    taxPeriodId?: string | null;
    status: string;
    amountAed: number;
    ftaReference?: string | null;
    notes?: string | null;
    actor: string;
  }): Promise<{ id: string }> {
    const res = await withLocalPg(async (sql) => {
      if (input.id) {
        const [row] = await sql`
          UPDATE public.uae_vat_recovery
          SET status = ${input.status}, amount_aed = ${input.amountAed},
              fta_reference = ${input.ftaReference ?? null}, notes = ${input.notes ?? null},
              requested_at = CASE WHEN ${input.status} = 'refund_requested' AND requested_at IS NULL THEN NOW() ELSE requested_at END,
              received_at  = CASE WHEN ${input.status} = 'refund_received'  AND received_at  IS NULL THEN NOW() ELSE received_at END,
              updated_at = NOW()
          WHERE id = ${input.id} RETURNING id
        `;
        return { id: String(row?.id ?? "") };
      }
      const [row] = await sql`
        INSERT INTO public.uae_vat_recovery (tax_entity_id, tax_period_id, status, amount_aed, fta_reference, notes, created_by)
        VALUES (${input.taxEntityId}::uuid, ${input.taxPeriodId ?? null}, ${input.status}, ${input.amountAed},
                ${input.ftaReference ?? null}, ${input.notes ?? null}, ${input.actor}::uuid)
        RETURNING id
      `;
      return { id: String(row?.id ?? "") };
    });
    if (!res) throw new Error("Database is not configured");
    return res;
  }

  // ---- Phase 5: control ledgers & reconciliation ----------------------

  async bootstrapLedgers(taxEntityId: string, actor: string): Promise<{ created: number }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT public.uae_tax_bootstrap_ledgers(${taxEntityId}::uuid, ${actor}::uuid) AS n`;
      return { created: Number(row?.n ?? 0) };
    });
    return res ?? { created: 0 };
  }

  async getReconciliation(scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT r.* FROM public.uae_tax_reconciliation_v r
        JOIN public.uae_tax_entities e ON e.id = r.tax_entity_id
        WHERE (${
          scope?.countryIds && scope.countryIds.length
            ? sql`e.country_id = ANY(${scope.countryIds})`
            : sql`TRUE`
        })
      `;
    });
    return res ?? [];
  }

  // ---- Phase 6: e-invoicing --------------------------------------------

  async listEInvoices(params: { taxEntityId?: string; status?: string; documentType?: string }, scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT i.*, e.legal_name AS tax_entity_name,
               (SELECT COUNT(*) FROM public.uae_e_invoice_events ev WHERE ev.e_invoice_id = i.id) AS event_count
        FROM public.uae_e_invoices i
        JOIN public.uae_tax_entities e ON e.id = i.tax_entity_id
        WHERE i.deleted_at IS NULL
          AND (${params.taxEntityId ? sql`i.tax_entity_id = ${params.taxEntityId}` : sql`TRUE`})
          AND (${params.status ? sql`i.status = ${params.status}` : sql`TRUE`})
          AND (${params.documentType ? sql`i.document_type = ${params.documentType}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`i.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY i.issue_date DESC NULLS LAST, i.created_at DESC
      `;
    });
    return res ?? [];
  }

  async listEInvoiceEvents(eInvoiceId: string): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT ev.*, p.full_name AS actor_name
        FROM public.uae_e_invoice_events ev
        LEFT JOIN public.profiles p ON p.id = ev.actor_id
        WHERE ev.e_invoice_id = ${eInvoiceId}
        ORDER BY ev.created_at DESC
      `;
    });
    return res ?? [];
  }

  async buildEInvoiceDrafts(taxEntityId?: string): Promise<{ built: number }> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT public.uae_build_einvoice_drafts(${taxEntityId ?? null}::uuid) AS n`;
      return { built: Number(row?.n ?? 0) };
    });
    return res ?? { built: 0 };
  }

  async getEInvoice(id: string): Promise<any | null> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`SELECT * FROM public.uae_e_invoices WHERE id = ${id} AND deleted_at IS NULL`;
      return row ?? null;
    });
    return res ?? null;
  }

  async updateEInvoice(id: string, patch: Record<string, unknown>): Promise<{ updated: boolean }> {
    const allowed = [
      "status", "pint_ae_payload", "validation_errors", "asp_provider", "asp_reference",
      "asp_response", "last_error", "retry_count", "invoice_number", "buyer_trn", "submitted_at", "submitted_by",
    ];
    const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if (Object.keys(clean).length <= 1) return { updated: false };
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`UPDATE public.uae_e_invoices SET ${sql(clean as any)} WHERE id = ${id} AND deleted_at IS NULL RETURNING id`;
      return { updated: rows.length > 0 };
    });
    return res ?? { updated: false };
  }

  async createCreditNote(input: {
    originalEInvoiceId: string;
    reason: string;
    totalExclVat: number;
    totalVat: number;
    actor: string;
  }): Promise<{ id: string }> {
    const res = await withLocalPg(async (sql) => {
      const [orig] = await sql`SELECT * FROM public.uae_e_invoices WHERE id = ${input.originalEInvoiceId} AND deleted_at IS NULL`;
      if (!orig) throw new Error("Original e-invoice not found");
      const [row] = await sql`
        INSERT INTO public.uae_e_invoices (
          tax_entity_id, country_id, city_branch_id, source_module, source_id, source_reference_no,
          document_type, issue_date, currency, total_excl_vat, total_vat, total_incl_vat,
          buyer_name, buyer_trn, status, related_e_invoice_id, created_by,
          validation_errors
        ) VALUES (
          ${orig.tax_entity_id}, ${orig.country_id}, ${orig.city_branch_id}, 'credit_note',
          ${orig.source_id}, ${orig.source_reference_no},
          'tax_credit_note', CURRENT_DATE, ${orig.currency},
          ${-Math.abs(input.totalExclVat)}, ${-Math.abs(input.totalVat)},
          ${-Math.abs(input.totalExclVat + input.totalVat)},
          ${orig.buyer_name}, ${orig.buyer_trn}, 'draft', ${input.originalEInvoiceId}::uuid, ${input.actor}::uuid,
          ${sql.json([{ reason: input.reason }])}
        ) RETURNING id
      `;
      return { id: String(row?.id ?? "") };
    });
    if (!res) throw new Error("Database is not configured");
    return res;
  }

  // ---- Phase 7: reports, audit, trace --------------------------------

  async reportSummary(taxEntityId?: string, periodId?: string, scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT v.* FROM public.uae_tax_report_summary_v v
        JOIN public.uae_tax_entities e ON e.id = v.tax_entity_id
        WHERE (${taxEntityId ? sql`v.tax_entity_id = ${taxEntityId}` : sql`TRUE`})
          AND (${periodId ? sql`v.tax_period_id = ${periodId}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`e.country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
        ORDER BY v.period_code DESC, v.direction, v.transaction_category
      `;
    });
    return res ?? [];
  }

  async traceLine(taxLineId: string, scope?: UaeTaxScope): Promise<any | null> {
    const res = await withLocalPg(async (sql) => {
      const [row] = await sql`
        SELECT * FROM public.uae_tax_trace_v
        WHERE tax_line_id = ${taxLineId}
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`country_id = ANY(${scope.countryIds})`
              : sql`TRUE`
          })
      `;
      return row ?? null;
    });
    return res ?? null;
  }

  async listAudit(params: { taxEntityId?: string; entityType?: string; limit?: number }, scope?: UaeTaxScope): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      const limit = Math.min(params.limit ?? 200, 500);
      return await sql`
        SELECT * FROM public.uae_tax_audit_log
        WHERE (${params.taxEntityId ? sql`tax_entity_id = ${params.taxEntityId}` : sql`TRUE`})
          AND (${params.entityType ? sql`entity_type = ${params.entityType}` : sql`TRUE`})
          AND (${
            scope?.countryIds && scope.countryIds.length
              ? sql`(country_id = ANY(${scope.countryIds}) OR country_id IS NULL)`
              : sql`TRUE`
          })
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    });
    return res ?? [];
  }

  async listLineDocuments(taxLineId: string): Promise<any[]> {
    const res = await withLocalPg(async (sql) => {
      return await sql`
        SELECT d.*, od.file_name, od.file_url, od.document_type, od.document_path, od.created_at AS uploaded_at
        FROM public.uae_tax_line_documents d
        JOIN public.office_documents od ON od.id = d.office_document_id
        WHERE d.tax_line_id = ${taxLineId} AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC
      `;
    });
    return res ?? [];
  }
}

export const uaeTaxService = new UaeTaxService();
