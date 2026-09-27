/* eslint-disable @typescript-eslint/no-explicit-any */
import { sqlScopeCondition, type SqlScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

export type SettlementTransactionRow = {
  id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  source_module: string;
  source_table: string;
  source_id: string;
  source_reference_no: string | null;
  source_date: string;
  direction: "cr" | "dr";
  settlement_type: string;
  local_currency: string;
  local_amount: number;
  original_usd_rate: number;
  original_usd_amount: number;
  settlement_status: "settled" | "partially_settled" | "unsettled" | "difference" | "needs_review";
  settled_local_amount: number;
  settled_usd_amount: number;
  remaining_local: number;
  remaining_usd: number;
  party_name: string | null;
  party_account_no: string | null;
  narration: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type SettlementLinkRow = {
  id: string;
  cr_settlement_id: string;
  dr_settlement_id: string;
  linked_local_amount: number;
  linked_usd_amount: number;
  cr_usd_rate: number;
  dr_usd_rate: number;
  fx_difference_local: number;
  fx_difference_usd: number;
  fx_direction: "gain" | "loss" | "neutral";
  settlement_date: string;
  settled_by: string | null;
  remarks: string | null;
  is_auto_matched: boolean;
  created_at: string;
  // Joined fields
  cr_reference_no?: string;
  dr_reference_no?: string;
  cr_party?: string;
  dr_party?: string;
  currency?: string;
};

export class SettlementService {
  /**
   * Sync transactions from ERP source modules into settlement_transactions
   */
  async syncFromErp(options?: { fromDate?: string; countryId?: string }): Promise<{
    roznamchaCount: number;
    purchaseCount: number;
    salesCount: number;
    totalSynced: number;
  }> {
    const res = await withLocalPg(async (sql) => {
      const fromDate = options?.fromDate || null;
      const countryId = options?.countryId || null;

      const [r1] = await sql`SELECT public.sync_settlement_from_roznamcha(${fromDate}, ${countryId}) as count`;
      const [r2] = await sql`SELECT public.sync_settlement_from_purchases(${fromDate}, ${countryId}) as count`;
      const [r3] = await sql`SELECT public.sync_settlement_from_sales(${fromDate}, ${countryId}) as count`;

      const roznamchaCount = Number(r1?.count ?? 0);
      const purchaseCount = Number(r2?.count ?? 0);
      const salesCount = Number(r3?.count ?? 0);

      return {
        roznamchaCount,
        purchaseCount,
        salesCount,
        totalSynced: roznamchaCount + purchaseCount + salesCount
      };
    });

    return res ?? { roznamchaCount: 0, purchaseCount: 0, salesCount: 0, totalSynced: 0 };
  }

  /**
   * List settlement transactions with filters & pagination
   */
  async listTransactions(params: {
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    direction?: "cr" | "dr" | "all";
    status?: string | null;
    module?: string | null;
    party?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    isFlagged?: boolean;
    search?: string | null;
    limit?: number;
    offset?: number;
    /** Caller's session scope (sessionSqlScope) — always required. */
    scope: SqlScope;
  }): Promise<{ items: SettlementTransactionRow[]; total: number }> {
    if (params.scope.kind === "none") return { items: [], total: 0 };
    const res = await withLocalPg(async (sql) => {
      const scopeCond = sqlScopeCondition(sql, params.scope, "st");
      const limit = Math.min(params.limit || 50, 200);
      const offset = params.offset || 0;

      const rows = await sql<SettlementTransactionRow[]>`
        SELECT 
          st.*,
          c.name as country_name,
          cb.name as branch_name,
          cib.name as city_branch_name
        FROM public.settlement_transactions st
        LEFT JOIN public.countries c ON c.id = st.country_id
        LEFT JOIN public.country_branches cb ON cb.id = st.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = st.city_branch_id
        WHERE st.deleted_at IS NULL
          AND ${scopeCond}
          AND (${params.countryId ? sql`st.country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.countryBranchId ? sql`st.country_branch_id = ${params.countryBranchId}` : sql`TRUE`})
          AND (${params.cityBranchId ? sql`st.city_branch_id = ${params.cityBranchId}` : sql`TRUE`})
          AND (${params.direction && params.direction !== 'all' ? sql`st.direction = ${params.direction}` : sql`TRUE`})
          AND (${params.status ? sql`st.settlement_status = ${params.status}` : sql`TRUE`})
          AND (${params.module ? sql`st.source_module = ${params.module}` : sql`TRUE`})
          AND (${params.fromDate ? sql`st.source_date >= ${params.fromDate}::date` : sql`TRUE`})
          AND (${params.toDate ? sql`st.source_date <= ${params.toDate}::date` : sql`TRUE`})
          AND (${params.isFlagged !== undefined ? sql`st.is_flagged = ${params.isFlagged}` : sql`TRUE`})
          AND (${params.party ? sql`(st.party_name ILIKE ${'%' + params.party + '%'} OR st.party_account_no ILIKE ${'%' + params.party + '%'})` : sql`TRUE`})
          AND (${params.search ? sql`(
            st.source_reference_no ILIKE ${'%' + params.search + '%'} 
            OR st.party_name ILIKE ${'%' + params.search + '%'}
            OR st.party_account_no ILIKE ${'%' + params.search + '%'}
            OR st.narration ILIKE ${'%' + params.search + '%'}
          )` : sql`TRUE`})
        ORDER BY st.source_date DESC, st.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [countRow] = await sql`
        SELECT COUNT(*) as total
        FROM public.settlement_transactions st
        WHERE st.deleted_at IS NULL
          AND ${scopeCond}
          AND (${params.countryId ? sql`st.country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.countryBranchId ? sql`st.country_branch_id = ${params.countryBranchId}` : sql`TRUE`})
          AND (${params.cityBranchId ? sql`st.city_branch_id = ${params.cityBranchId}` : sql`TRUE`})
          AND (${params.direction && params.direction !== 'all' ? sql`st.direction = ${params.direction}` : sql`TRUE`})
          AND (${params.status ? sql`st.settlement_status = ${params.status}` : sql`TRUE`})
          AND (${params.module ? sql`st.source_module = ${params.module}` : sql`TRUE`})
          AND (${params.fromDate ? sql`st.source_date >= ${params.fromDate}::date` : sql`TRUE`})
          AND (${params.toDate ? sql`st.source_date <= ${params.toDate}::date` : sql`TRUE`})
          AND (${params.isFlagged !== undefined ? sql`st.is_flagged = ${params.isFlagged}` : sql`TRUE`})
          AND (${params.party ? sql`(st.party_name ILIKE ${'%' + params.party + '%'} OR st.party_account_no ILIKE ${'%' + params.party + '%'})` : sql`TRUE`})
          AND (${params.search ? sql`(
            st.source_reference_no ILIKE ${'%' + params.search + '%'} 
            OR st.party_name ILIKE ${'%' + params.search + '%'}
            OR st.party_account_no ILIKE ${'%' + params.search + '%'}
            OR st.narration ILIKE ${'%' + params.search + '%'}
          )` : sql`TRUE`})
      `;

      return {
        items: rows,
        total: Number(countRow?.total ?? 0)
      };
    });

    return res ?? { items: [], total: 0 };
  }

  /**
   * Create a CR->DR link with FX calculation
   */
  async createLink(input: {
    crSettlementId: string;
    drSettlementId: string;
    linkAmount: number;
    settledBy: string;
    remarks?: string;
    isAuto?: boolean;
  }): Promise<{ linkId: string }> {
    const res = await withLocalPg(async (sql) => {
      const [res] = await sql`
        SELECT public.create_settlement_link(
          ${input.crSettlementId}::uuid,
          ${input.drSettlementId}::uuid,
          ${input.linkAmount}::numeric,
          ${input.settledBy}::uuid,
          ${input.remarks ?? null},
          ${input.isAuto ?? false}
        ) as link_id
      `;
      return { linkId: String(res?.link_id ?? "") };
    });

    return res ?? { linkId: "" };
  }

  /**
   * Scope (country/branch) of a single settlement_transactions row, for
   * authorizing a link/unlink before it touches records outside the
   * caller's assigned scope.
   */
  async getTransactionScope(settlementId: string): Promise<{ country_id: string | null; country_branch_id: string | null; city_branch_id: string | null } | null> {
    const result = await withLocalPg(async (sql) => {
      const [row] = await sql`
        SELECT country_id, country_branch_id, city_branch_id
        FROM public.settlement_transactions
        WHERE id = ${settlementId}::uuid
        LIMIT 1
      `;
      return row ?? null;
    });
    return (result as any) ?? null;
  }

  /**
   * Scope of both sides (cr + dr) of an existing link, for authorizing unlink.
   */
  async getLinkScope(linkId: string): Promise<{
    cr: { country_id: string | null; country_branch_id: string | null; city_branch_id: string | null } | null;
    dr: { country_id: string | null; country_branch_id: string | null; city_branch_id: string | null } | null;
  }> {
    return withLocalPg(async (sql) => {
      const [row] = await sql`
        SELECT
          cr.country_id AS cr_country_id, cr.country_branch_id AS cr_country_branch_id, cr.city_branch_id AS cr_city_branch_id,
          dr.country_id AS dr_country_id, dr.country_branch_id AS dr_country_branch_id, dr.city_branch_id AS dr_city_branch_id
        FROM public.settlement_links sl
        JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
        JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
        WHERE sl.id = ${linkId}::uuid
        LIMIT 1
      `;
      if (!row) return { cr: null, dr: null };
      return {
        cr: { country_id: row.cr_country_id, country_branch_id: row.cr_country_branch_id, city_branch_id: row.cr_city_branch_id },
        dr: { country_id: row.dr_country_id, country_branch_id: row.dr_country_branch_id, city_branch_id: row.dr_city_branch_id }
      };
    }) as any;
  }

  /**
   * Unlink a settlement link
   */
  async removeLink(input: {
    linkId: string;
    actorId: string;
    reason?: string;
  }): Promise<void> {
    await withLocalPg(async (sql) => {
      await sql`
        SELECT public.remove_settlement_link(
          ${input.linkId}::uuid,
          ${input.actorId}::uuid,
          ${input.reason ?? null}
        )
      `;
    });
  }

  /**
   * Get Dashboard KPI Totals
   */
  async getDashboardKpis(params: {
    countryId?: string | null;
    branchId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    scope: SqlScope;
  }) {
    const res = await withLocalPg(async (sql) => {
      // Same totals as public.get_settlement_dashboard_kpis, computed here so the caller's
      // country/branch scope applies (the SQL function only accepts one country / branch).
      const txScope = sqlScopeCondition(sql, params.scope, "t");
      const linkFilter = sql`sl.deleted_at IS NULL
        AND ${sqlScopeCondition(sql, params.scope, "cr")}
        AND ${sqlScopeCondition(sql, params.scope, "dr")}
        AND (${params.fromDate ? sql`sl.settlement_date >= ${params.fromDate}::date` : sql`TRUE`})
        AND (${params.toDate ? sql`sl.settlement_date <= ${params.toDate}::date` : sql`TRUE`})`;
      const [kpi] = await sql`
        SELECT
          SUM(CASE WHEN t.direction = 'cr' THEN t.local_amount ELSE 0 END) AS total_cr_local,
          SUM(CASE WHEN t.direction = 'dr' THEN t.local_amount ELSE 0 END) AS total_dr_local,
          SUM(CASE WHEN t.direction = 'cr' THEN t.original_usd_amount ELSE 0 END) AS total_cr_usd,
          SUM(CASE WHEN t.direction = 'dr' THEN t.original_usd_amount ELSE 0 END) AS total_dr_usd,
          SUM(CASE WHEN t.direction = 'cr' THEN t.remaining_local ELSE 0 END) AS remaining_cr_local,
          SUM(CASE WHEN t.direction = 'dr' THEN t.remaining_local ELSE 0 END) AS remaining_dr_local,
          SUM(CASE WHEN t.direction = 'cr' THEN t.remaining_usd ELSE 0 END) AS remaining_cr_usd,
          SUM(CASE WHEN t.direction = 'dr' THEN t.remaining_usd ELSE 0 END) AS remaining_dr_usd,
          COUNT(CASE WHEN t.settlement_status = 'settled' THEN 1 END) AS count_settled,
          COUNT(CASE WHEN t.settlement_status = 'partially_settled' THEN 1 END) AS count_partial,
          COUNT(CASE WHEN t.settlement_status = 'unsettled' THEN 1 END) AS count_unsettled,
          COUNT(CASE WHEN t.is_flagged = TRUE THEN 1 END) AS count_flagged,
          COALESCE((SELECT SUM(sl.fx_difference_usd) FROM public.settlement_links sl
             JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
             JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
             WHERE ${linkFilter} AND sl.fx_direction = 'gain'), 0) AS total_fx_gain_usd,
          COALESCE((SELECT SUM(ABS(sl.fx_difference_usd)) FROM public.settlement_links sl
             JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
             JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
             WHERE ${linkFilter} AND sl.fx_direction = 'loss'), 0) AS total_fx_loss_usd,
          COALESCE((SELECT SUM(CASE WHEN sl.fx_direction = 'gain' THEN sl.fx_difference_usd
                                    WHEN sl.fx_direction = 'loss' THEN -ABS(sl.fx_difference_usd) ELSE 0 END)
             FROM public.settlement_links sl
             JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
             JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
             WHERE ${linkFilter}), 0) AS net_fx_usd
        FROM public.settlement_transactions t
        WHERE t.deleted_at IS NULL
          AND ${txScope}
          AND (${params.countryId ? sql`t.country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.branchId ? sql`t.city_branch_id = ${params.branchId}` : sql`TRUE`})
          AND (${params.fromDate ? sql`t.source_date >= ${params.fromDate}::date` : sql`TRUE`})
          AND (${params.toDate ? sql`t.source_date <= ${params.toDate}::date` : sql`TRUE`})
      `;

      return {
        totalCrLocal: Number(kpi?.total_cr_local ?? 0),
        totalDrLocal: Number(kpi?.total_dr_local ?? 0),
        totalCrUsd: Number(kpi?.total_cr_usd ?? 0),
        totalDrUsd: Number(kpi?.total_dr_usd ?? 0),
        remainingCrLocal: Number(kpi?.remaining_cr_local ?? 0),
        remainingDrLocal: Number(kpi?.remaining_dr_local ?? 0),
        remainingCrUsd: Number(kpi?.remaining_cr_usd ?? 0),
        remainingDrUsd: Number(kpi?.remaining_dr_usd ?? 0),
        countSettled: Number(kpi?.count_settled ?? 0),
        countPartial: Number(kpi?.count_partial ?? 0),
        countUnsettled: Number(kpi?.count_unsettled ?? 0),
        countFlagged: Number(kpi?.count_flagged ?? 0),
        totalFxGainUsd: Number(kpi?.total_fx_gain_usd ?? 0),
        totalFxLossUsd: Number(kpi?.total_fx_loss_usd ?? 0),
        netFxUsd: Number(kpi?.net_fx_usd ?? 0)
      };
    });

    return res ?? {
      totalCrLocal: 0,
      totalDrLocal: 0,
      totalCrUsd: 0,
      totalDrUsd: 0,
      remainingCrLocal: 0,
      remainingDrLocal: 0,
      remainingCrUsd: 0,
      remainingDrUsd: 0,
      countSettled: 0,
      countPartial: 0,
      countUnsettled: 0,
      countFlagged: 0,
      totalFxGainUsd: 0,
      totalFxLossUsd: 0,
      netFxUsd: 0
    };
  }

  /**
   * Get links for a specific transaction (either as CR or DR)
   */
  async getTransactionLinks(settlementId: string, scope: SqlScope): Promise<SettlementLinkRow[]> {
    const res = await withLocalPg(async (sql) => {
      return sql<SettlementLinkRow[]>`
        SELECT 
          sl.*,
          cr.source_reference_no as cr_reference_no,
          dr.source_reference_no as dr_reference_no,
          cr.party_name as cr_party,
          dr.party_name as dr_party,
          cr.local_currency as currency
        FROM public.settlement_links sl
        JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
        JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
        WHERE sl.deleted_at IS NULL
          AND (sl.cr_settlement_id = ${settlementId} OR sl.dr_settlement_id = ${settlementId})
          AND ${sqlScopeCondition(sql, scope, "cr")}
          AND ${sqlScopeCondition(sql, scope, "dr")}
        ORDER BY sl.settlement_date DESC, sl.created_at DESC
      `;
    });

    return res ?? [];
  }

  /**
   * Get Exceptions / Flagged transactions
   */
  async getExceptions(params: {
    countryId?: string | null;
    cityBranchId?: string | null;
    limit?: number;
    scope: SqlScope;
  }) {
    return withLocalPg(async (sql) => {
      const limit = Math.min(params.limit || 50, 100);
      return sql`
        SELECT ev.*
        FROM public.settlement_exceptions_v ev
        WHERE ${sqlScopeCondition(sql, params.scope, "ev")}
          AND (${params.countryId ? sql`country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.cityBranchId ? sql`city_branch_id = ${params.cityBranchId}` : sql`TRUE`})
        ORDER BY days_outstanding DESC, created_at DESC
        LIMIT ${limit}
      `;
    });
  }

  /**
   * Toggle flag on a settlement transaction
   */
  async toggleFlag(input: {
    settlementId: string;
    isFlagged: boolean;
    reason?: string;
    reviewerId: string;
  }) {
    return withLocalPg(async (sql) => {
      await sql`
        UPDATE public.settlement_transactions SET
          is_flagged = ${input.isFlagged},
          flag_reason = ${input.reason ?? null},
          reviewed_by = ${input.reviewerId}::uuid,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${input.settlementId}::uuid
      `;

      await sql`
        INSERT INTO public.settlement_audit_log (
          settlement_id, actor_id, action, reason
        ) VALUES (
          ${input.settlementId}::uuid,
          ${input.reviewerId}::uuid,
          ${input.isFlagged ? 'flagged' : 'reviewed'},
          ${input.reason ?? null}
        )
      `;
    });
  }

  /**
   * Get Audit History
   */
  async getAuditHistory(params: {
    settlementId?: string | null;
    countryId?: string | null;
    limit?: number;
    scope: SqlScope;
  }) {
    return withLocalPg(async (sql) => {
      const limit = Math.min(params.limit || 50, 200);
      // Audit rows are scoped through their settlement transaction; unlinked system rows are Super Admin only.
      const auditScope = params.scope.kind === "all" ? sql`TRUE` : sql`(st.id IS NOT NULL AND ${sqlScopeCondition(sql, params.scope, "st")})`;
      return sql`
        SELECT 
          sal.*,
          p.full_name as actor_name,
          c.name as country_name,
          cb.name as city_branch_name,
          st.source_reference_no,
          st.party_name
        FROM public.settlement_audit_log sal
        LEFT JOIN public.profiles p ON p.id = sal.actor_id
        LEFT JOIN public.countries c ON c.id = sal.country_id
        LEFT JOIN public.city_branches cb ON cb.id = sal.city_branch_id
        LEFT JOIN public.settlement_transactions st ON st.id = sal.settlement_id
        WHERE ${auditScope}
          AND (${params.settlementId ? sql`sal.settlement_id = ${params.settlementId}` : sql`TRUE`})
          AND (${params.countryId ? sql`sal.country_id = ${params.countryId}` : sql`TRUE`})
        ORDER BY sal.created_at DESC
        LIMIT ${limit}
      `;
    });
  }

  /**
   * Get Daily Summary report for a branch
   */
  async getDailySummary(params: {
    countryId?: string | null;
    cityBranchId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    scope: SqlScope;
  }) {
    return withLocalPg(async (sql) => {
      return sql`
        SELECT sv.*
        FROM public.settlement_summary_v sv
        WHERE ${sqlScopeCondition(sql, params.scope, "sv")}
          AND (${params.countryId ? sql`country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.cityBranchId ? sql`city_branch_id = ${params.cityBranchId}` : sql`TRUE`})
          AND (${params.fromDate ? sql`txn_date >= ${params.fromDate}::date` : sql`TRUE`})
          AND (${params.toDate ? sql`txn_date <= ${params.toDate}::date` : sql`TRUE`})
        ORDER BY txn_date DESC, country_name, city_branch_name
      `;
    });
  }

  /**
   * FX Analysis breakdown
   */
  async getFxAnalysis(params: {
    countryId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    scope: SqlScope;
  }) {
    return withLocalPg(async (sql) => {
      return sql`
        SELECT
          sl.id as link_id,
          sl.cr_settlement_id,
          sl.dr_settlement_id,
          sl.settlement_date,
          sl.linked_local_amount,
          sl.linked_usd_amount,
          sl.cr_usd_rate,
          sl.dr_usd_rate,
          sl.fx_difference_local,
          sl.fx_difference_usd,
          sl.fx_direction,
          cr.country_id,
          cr.source_module as cr_module,
          cr.source_reference_no as cr_ref,
          cr.party_name as cr_party,
          cr.local_currency,
          dr.source_module as dr_module,
          dr.source_reference_no as dr_ref,
          dr.party_name as dr_party,
          c.name as country_name
        FROM public.settlement_links sl
        JOIN public.settlement_transactions cr ON cr.id = sl.cr_settlement_id
        JOIN public.settlement_transactions dr ON dr.id = sl.dr_settlement_id
        LEFT JOIN public.countries c ON c.id = cr.country_id
        WHERE sl.deleted_at IS NULL
          AND ${sqlScopeCondition(sql, params.scope, "cr")}
          AND ${sqlScopeCondition(sql, params.scope, "dr")}
          AND (${params.countryId ? sql`cr.country_id = ${params.countryId}` : sql`TRUE`})
          AND (${params.fromDate ? sql`sl.settlement_date >= ${params.fromDate}::date` : sql`TRUE`})
          AND (${params.toDate ? sql`sl.settlement_date <= ${params.toDate}::date` : sql`TRUE`})
        ORDER BY sl.settlement_date DESC
      `;
    });
  }
}

export const settlementService = new SettlementService();
