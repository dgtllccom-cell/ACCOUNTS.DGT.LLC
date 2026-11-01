import { withLocalPg } from "@/lib/db/local-postgres";
import { type HrScope } from "@/lib/services/hr-api";
import { sqlScopeCondition } from "@/lib/api/scope-middleware";
import { ErpPermissionError } from "@/lib/permissions/middleware";

/**
 * HRM employee KYC / QVC service.
 *
 * Files stay in office_documents; this manages hr_employee_kyc_documents (one row
 * per employee+requirement) and reads hr_employee_kyc_status_v for the queue.
 * Scope repeated in every WHERE.
 */

/**
 * ONE scope rule for every KYC query (alias `v` = hr_employee_kyc_status_v, `e` = employees).
 *   - a login without an HR role sees ONLY its own employee profile (employees.user_id);
 *   - everybody else is limited by the shared scope rule (sessionSqlScope): country / main branch / city branch.
 *     An employee with NO country used to match every scoped login (`OR country_id IS NULL`); such a record is global and is now Super Admin only.
 */
function scopeWhere(sql: any, scope: HrScope, alias = "v", idCol = "employee_id") {
  if (scope.ownUserId) {
    return sql`${sql(`${alias}.${idCol}`)} IN (SELECT id FROM public.employees WHERE user_id = ${scope.ownUserId}::uuid AND deleted_at IS NULL)`;
  }
  return sqlScopeCondition(sql, scope.sqlScope, alias);
}

async function assertEmployeeInScope(employeeId: string, scope: HrScope) {
  if (scope.sqlScope.kind === "all" && !scope.ownUserId) return;
  const ok = await withLocalPg(async (sql) => {
    const r = await sql`SELECT 1 FROM public.employees e
      WHERE e.id = ${employeeId}::uuid AND e.deleted_at IS NULL AND ${scopeWhere(sql, scope, "e", "id")} LIMIT 1`;
    return (r?.length ?? 0) > 0;
  });
  if (!ok) throw new ErpPermissionError("Employee is outside your authorized scope.");
}

/** 1234567890 -> ******7890 (the last four characters only). */
export function maskIdentifier(v: unknown): string | null {
  const t = String(v ?? "").trim();
  if (!t) return null;
  return t.length <= 4 ? "****" : "*".repeat(t.length - 4) + t.slice(-4);
}

export type KycDocInput = {
  employeeId: string;
  requirementCode: string;
  documentType?: string;
  documentNumber?: string | null;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
  officeDocumentId?: string | null;
  notes?: string | null;
};

export class HrKycService {
  async requirements(countryId?: string | null) {
    const rows = await withLocalPg(async (sql) =>
      sql`SELECT * FROM public.hr_employee_kyc_requirements
          WHERE deleted_at IS NULL AND is_active
            AND (country_id IS NULL ${countryId ? sql`OR country_id = ${countryId}` : sql``})
          ORDER BY rank_order ASC`,
    );
    return rows ?? [];
  }

  /** The KYC / QVC Pending Verification queue. */
  async queue(scope: HrScope, filters: { status?: string; countryId?: string; search?: string } = {}) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scopeWhere(sql, scope)];
      if (filters.status) where.push(sql`v.kyc_status = ${filters.status}`);
      if (filters.countryId) where.push(sql`v.country_id = ${filters.countryId}`);
      if (filters.search) where.push(sql`(v.employee_name ILIKE ${"%" + filters.search + "%"} OR v.employee_code ILIKE ${"%" + filters.search + "%"})`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`SELECT v.* FROM public.hr_employee_kyc_status_v v WHERE ${w} ORDER BY
        CASE v.kyc_status WHEN 'incomplete' THEN 0 WHEN 'expired' THEN 1 WHEN 'pending_verification' THEN 2 ELSE 3 END,
        v.employee_name ASC`;
    });
    return rows ?? [];
  }

  async kpis(scope: HrScope) {
    const r = await withLocalPg(async (sql) => {
      const w = scopeWhere(sql, scope);
      return sql`SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE kyc_status = 'verified')::int AS verified,
        count(*) FILTER (WHERE kyc_status = 'pending_verification')::int AS pending,
        count(*) FILTER (WHERE kyc_status = 'incomplete')::int AS incomplete,
        count(*) FILTER (WHERE kyc_status = 'expired')::int AS expired,
        COALESCE(sum(expiring_soon_count),0)::int AS docs_expiring_30d
        FROM public.hr_employee_kyc_status_v v WHERE ${w}`;
    });
    return r?.[0] ?? { total: 0, verified: 0, pending: 0, incomplete: 0, expired: 0, docs_expiring_30d: 0 };
  }

  /** One employee's full checklist (requirement rows joined to their document rows). */
  async employeeChecklist(employeeId: string, scope: HrScope, opts: { identifiers?: boolean } = {}) {
    const showIdentifiers = opts.identifiers !== false;
    await assertEmployeeInScope(employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT e.id, e.employee_code, e.country_id,
          COALESCE(c.customer_name, c.company_name, e.employee_code) AS name, co.name AS country_name
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE e.id = ${employeeId}`)?.[0];
      const items = await sql`
        SELECT r.id AS requirement_id, r.code, r.label, r.is_mandatory, r.requires_expiry, r.requires_number, r.rank_order,
               d.id AS document_id, d.document_number, d.issuing_authority, d.issue_date, d.expiry_date,
               d.file_url, d.office_document_id, d.status, d.verified_by, d.verified_at, d.rejection_reason, d.notes
        FROM public.hr_employee_kyc_requirements r
        LEFT JOIN public.hr_employee_kyc_documents d
          ON d.employee_id = ${employeeId} AND lower(d.requirement_code) = lower(r.code) AND d.deleted_at IS NULL
        WHERE r.deleted_at IS NULL AND r.is_active
          AND (r.country_id IS NULL OR r.country_id = ${emp?.country_id ?? null})
        ORDER BY r.rank_order ASC`;
      // read-only HR roles see ID / passport numbers masked and never the file reference (only maintainers and the employee himself get them in full)
      const safe = (items ?? []).map((it: any) =>
        showIdentifiers
          ? it
          : { ...it, document_number: maskIdentifier(it.document_number), file_url: null, office_document_id: null, file_hidden: Boolean(it.file_url || it.office_document_id) }
      );
      return { employee: emp, items: safe };
    });
  }

  async upsertDocument(input: KycDocInput, actorId: string, scope: HrScope) {
    await assertEmployeeInScope(input.employeeId, scope);
    return withLocalPg(async (sql) => {
      const emp = (await sql`SELECT country_id, country_branch_id, city_branch_id FROM public.employees WHERE id = ${input.employeeId}`)?.[0];
      const rows = await sql`
        INSERT INTO public.hr_employee_kyc_documents
          (employee_id, requirement_code, document_type, document_number, issuing_authority, issue_date, expiry_date,
           file_url, office_document_id, status, notes, country_id, country_branch_id, city_branch_id, created_by)
        VALUES
          (${input.employeeId}, ${input.requirementCode}, ${input.documentType ?? input.requirementCode},
           ${input.documentNumber ?? null}, ${input.issuingAuthority ?? null}, ${input.issueDate ?? null}, ${input.expiryDate ?? null},
           ${input.fileUrl ?? null}, ${input.officeDocumentId ?? null}, 'submitted', ${input.notes ?? null},
           ${emp?.country_id ?? null}, ${emp?.country_branch_id ?? null}, ${emp?.city_branch_id ?? null}, ${actorId})
        ON CONFLICT (employee_id, lower(requirement_code)) WHERE deleted_at IS NULL DO UPDATE SET
          document_type     = EXCLUDED.document_type,
          document_number   = EXCLUDED.document_number,
          issuing_authority = EXCLUDED.issuing_authority,
          issue_date        = EXCLUDED.issue_date,
          expiry_date       = EXCLUDED.expiry_date,
          file_url          = COALESCE(EXCLUDED.file_url, public.hr_employee_kyc_documents.file_url),
          office_document_id= COALESCE(EXCLUDED.office_document_id, public.hr_employee_kyc_documents.office_document_id),
          notes             = EXCLUDED.notes,
          status            = CASE WHEN public.hr_employee_kyc_documents.status = 'verified' THEN 'verified' ELSE 'submitted' END,
          updated_at        = now()
        RETURNING id`;
      return rows?.[0] ?? null;
    });
  }

  async verifyDocument(documentId: string, decision: "verified" | "rejected", actorId: string, scope: HrScope, reason?: string, opts: { allowSelf?: boolean } = {}) {
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT * FROM public.hr_employee_kyc_documents WHERE id = ${documentId}::uuid AND deleted_at IS NULL`)?.[0];
      if (!row) throw new ErpPermissionError("KYC document is outside your authorized scope.");
      await assertEmployeeInScope(row.employee_id, scope);
      // nobody approves or rejects their own identity documents (Super Admin excepted)
      if (!opts.allowSelf) {
        const own = await sql`SELECT 1 FROM public.employees WHERE id = ${row.employee_id}::uuid AND user_id = ${actorId}::uuid LIMIT 1`;
        if (own.length > 0) throw new ErpPermissionError("You cannot verify or reject your own KYC documents.");
      }
      await sql`
        UPDATE public.hr_employee_kyc_documents SET
          status = ${decision},
          verified_by = ${actorId},
          verified_at = now(),
          rejection_reason = ${decision === "rejected" ? (reason ?? "Rejected") : null},
          updated_at = now()
        WHERE id = ${documentId}`;
      return { id: documentId, status: decision };
    });
  }

  /** The office_documents id behind one KYC document, or null when the document does not exist, is not stored as a file, or lies outside the scope. */
  async fileOfficeDocumentId(documentId: string, scope: HrScope): Promise<string | null> {
    return withLocalPg(async (sql) => {
      const row = (await sql`SELECT employee_id::text AS employee_id, office_document_id::text AS office_document_id
        FROM public.hr_employee_kyc_documents WHERE id = ${documentId}::uuid AND deleted_at IS NULL`)?.[0];
      if (!row?.office_document_id) return null;
      if (!(scope.sqlScope.kind === "all" && !scope.ownUserId)) {
        const ok = await sql`SELECT 1 FROM public.employees e WHERE e.id = ${row.employee_id}::uuid AND e.deleted_at IS NULL AND ${scopeWhere(sql, scope, "e", "id")} LIMIT 1`;
        if (ok.length === 0) return null;
      }
      return row.office_document_id as string;
    });
  }

  /** Expire any KYC document whose expiry_date has passed (idempotent housekeeping). */
  async markExpired() {
    const r = await withLocalPg(async (sql) => {
      const res = await sql`
        UPDATE public.hr_employee_kyc_documents
        SET status = 'expired', updated_at = now()
        WHERE deleted_at IS NULL AND expiry_date IS NOT NULL AND expiry_date < current_date AND status <> 'expired'
        RETURNING id`;
      return res?.length ?? 0;
    });
    return { expired: r };
  }
}

export const hrKycService = new HrKycService();
