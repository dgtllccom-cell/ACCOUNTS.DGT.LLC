import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Central Contract Control Center service.
 *
 * Reads the linked register `erp_contract_register_v` (a live projection of
 * purchase_orders / sales_orders / employees — never a copy) and manages the
 * only new data: `contract_followups` (cross-module follow-up state) and the
 * append-only `contract_register_audit`.
 *
 * `withLocalPg` bypasses RLS, so every read repeats the scope filter in its
 * WHERE clause. `scope.countryIds === null` = global (super admin).
 */

export type ContractScope = { countryIds?: string[] | null; cityBranchIds?: string[] | null };

export type ContractFilters = {
  contractType?: string;
  sourceModule?: string;
  status?: string;
  party?: string;
  countryId?: string;
  countryBranchId?: string;
  cityBranchId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function scopeWhere(sql: any, scope?: ContractScope) {
  const parts: any[] = [];
  if (scope?.countryIds && scope.countryIds.length) {
    parts.push(sql`r.country_id = ANY(${scope.countryIds})`);
  }
  if (scope?.cityBranchIds && scope.cityBranchIds.length) {
    parts.push(sql`(r.city_branch_id = ANY(${scope.cityBranchIds}) OR r.city_branch_id IS NULL)`);
  }
  if (!parts.length) return sql`TRUE`;
  return parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} AND ${p}`));
}

const STATUS_EXPR = (sql: any) => sql`public.contract_register_status(
  r.source_module, r.source_status, r.payment_status, r.ledger_posting_status, r.expiry_date
)`;

export class ContractRegisterService {
  async list(filters: ContractFilters, scope?: ContractScope): Promise<{ rows: any[]; total: number }> {
    const res = await withLocalPg(async (sql) => {
      const where: any[] = [scopeWhere(sql, scope)];
      if (filters.contractType) where.push(sql`r.contract_type = ${filters.contractType}`);
      if (filters.sourceModule) where.push(sql`r.source_module = ${filters.sourceModule}`);
      if (filters.countryId) where.push(sql`r.country_id = ${filters.countryId}`);
      if (filters.countryBranchId) where.push(sql`r.country_branch_id = ${filters.countryBranchId}`);
      if (filters.cityBranchId) where.push(sql`r.city_branch_id = ${filters.cityBranchId}`);
      if (filters.fromDate) where.push(sql`r.contract_date >= ${filters.fromDate}`);
      if (filters.toDate) where.push(sql`r.contract_date <= ${filters.toDate}`);
      if (filters.party) where.push(sql`r.party_name ILIKE ${"%" + filters.party + "%"}`);
      if (filters.search) {
        const q = "%" + filters.search + "%";
        where.push(sql`(
          r.party_name ILIKE ${q} OR r.contract_no ILIKE ${q} OR r.booking_order_no ILIKE ${q}
          OR r.manual_contract_no ILIKE ${q} OR r.global_serial ILIKE ${q}
        )`);
      }
      if (filters.status) where.push(sql`${STATUS_EXPR(sql)} = ${filters.status}`);
      const whereSql = where.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} AND ${p}`));

      const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
      const offset = Math.max(Number(filters.offset) || 0, 0);

      const rows = await sql`
        SELECT r.*, ${STATUS_EXPR(sql)} AS contract_status,
               p.full_name AS created_by_name
        FROM public.erp_contract_register_v r
        LEFT JOIN public.profiles p ON p.id = r.created_by
        WHERE ${whereSql}
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [{ total }] = await sql`
        SELECT COUNT(*)::int AS total FROM public.erp_contract_register_v r WHERE ${whereSql}
      `;
      return { rows, total };
    });
    return res ?? { rows: [], total: 0 };
  }

  async get(sourceModule: string, sourceId: string, scope?: ContractScope): Promise<any | null> {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT r.*, ${STATUS_EXPR(sql)} AS contract_status, p.full_name AS created_by_name
        FROM public.erp_contract_register_v r
        LEFT JOIN public.profiles p ON p.id = r.created_by
        WHERE r.source_module = ${sourceModule} AND r.source_id = ${sourceId}
          AND (${scopeWhere(sql, scope)})
        LIMIT 1
      `;
      if (!rows[0]) return null;
      const audit = await sql`
        SELECT id, action, detail, actor_name, created_at
        FROM public.contract_register_audit
        WHERE source_module = ${sourceModule} AND source_id = ${sourceId}
        ORDER BY created_at DESC LIMIT 50
      `;
      const documents = await sql`
        SELECT id, title, document_type, file_name, file_url, created_at
        FROM public.office_documents
        WHERE deleted_at IS NULL AND source_module = ${sourceModule} AND source_record_id = ${sourceId}
        ORDER BY created_at DESC
      `;
      return { ...rows[0], audit, documents };
    });
    return res ?? null;
  }

  async kpis(scope?: ContractScope): Promise<Record<string, number>> {
    const res = await withLocalPg(async (sql) => {
      const [k] = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE r.contract_type LIKE 'purchase%')::int AS purchase,
          COUNT(*) FILTER (WHERE r.contract_type LIKE 'sales%')::int AS sales,
          COUNT(*) FILTER (WHERE r.contract_type = 'employment')::int AS employment,
          COUNT(*) FILTER (WHERE r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + 30)::int AS expiring_30d,
          COUNT(*) FILTER (WHERE r.attachment_count = 0 AND r.contract_type <> 'employment')::int AS missing_attachment,
          COUNT(*) FILTER (WHERE COALESCE(r.remaining_balance,0) > 0)::int AS pending_payment,
          COUNT(*) FILTER (WHERE ${STATUS_EXPR(sql)} = 'Pending Approval')::int AS pending_approval,
          COUNT(*) FILTER (WHERE r.next_action_date IS NOT NULL AND r.next_action_date <= current_date)::int AS action_due
        FROM public.erp_contract_register_v r
        WHERE ${scopeWhere(sql, scope)}
      `;
      return k as Record<string, number>;
    });
    return res ?? {};
  }

  async upsertFollowup(input: {
    sourceModule: string;
    sourceId: string;
    contractReference?: string | null;
    countryId?: string | null;
    countryBranchId?: string | null;
    cityBranchId?: string | null;
    followupNote?: string | null;
    nextActionDate?: string | null;
    nextActionNote?: string | null;
    watchStatus?: string | null;
    actorId?: string | null;
    actorName?: string | null;
  }): Promise<{ ok: true }> {
    await withLocalPg(async (sql) => {
      await sql`
        INSERT INTO public.contract_followups (
          source_module, source_table, source_id, contract_reference,
          country_id, country_branch_id, city_branch_id,
          watch_status, last_followup_at, last_followup_note, next_action_date, next_action_note,
          created_by, updated_by
        ) VALUES (
          ${input.sourceModule},
          ${input.sourceModule === "hr_employee" ? "employees" : input.sourceModule === "sales_order" ? "sales_orders" : "purchase_orders"},
          ${input.sourceId}, ${input.contractReference ?? null},
          ${input.countryId ?? null}, ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null},
          ${input.watchStatus ?? "watching"},
          ${input.followupNote ? new Date().toISOString() : null}, ${input.followupNote ?? null},
          ${input.nextActionDate ?? null}, ${input.nextActionNote ?? null},
          ${input.actorId ?? null}, ${input.actorId ?? null}
        )
        ON CONFLICT (source_module, source_id) WHERE deleted_at IS NULL
        DO UPDATE SET
          contract_reference = COALESCE(EXCLUDED.contract_reference, contract_followups.contract_reference),
          watch_status = COALESCE(NULLIF(EXCLUDED.watch_status,''), contract_followups.watch_status),
          last_followup_at = COALESCE(EXCLUDED.last_followup_at, contract_followups.last_followup_at),
          last_followup_note = COALESCE(EXCLUDED.last_followup_note, contract_followups.last_followup_note),
          next_action_date = COALESCE(EXCLUDED.next_action_date, contract_followups.next_action_date),
          next_action_note = COALESCE(EXCLUDED.next_action_note, contract_followups.next_action_note),
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
      `;
      await sql`
        INSERT INTO public.contract_register_audit (source_module, source_id, contract_reference, action, detail, actor_id, actor_name, country_id)
        VALUES (${input.sourceModule}, ${input.sourceId}, ${input.contractReference ?? null},
                ${input.followupNote ? "followup_added" : input.nextActionDate ? "next_action_set" : "watch_changed"},
                ${sql.json({ note: input.followupNote, nextActionDate: input.nextActionDate, watch: input.watchStatus })},
                ${input.actorId ?? null}, ${input.actorName ?? null}, ${input.countryId ?? null})
      `;
    });
    return { ok: true };
  }

  async recordView(sourceModule: string, sourceId: string, actorId?: string | null, actorName?: string | null) {
    await withLocalPg(async (sql) => {
      await sql`
        INSERT INTO public.contract_register_audit (source_module, source_id, action, actor_id, actor_name)
        VALUES (${sourceModule}, ${sourceId}, 'viewed', ${actorId ?? null}, ${actorName ?? null})
      `;
    });
  }

  async syncReminders(daysAhead = 30): Promise<{ created: number }> {
    const res = await withLocalPg(async (sql) => {
      const [{ n }] = await sql`SELECT public.sync_contract_reminders(${daysAhead}) AS n`;
      return { created: Number(n) || 0 };
    });
    return res ?? { created: 0 };
  }
}

export const contractRegisterService = new ContractRegisterService();
