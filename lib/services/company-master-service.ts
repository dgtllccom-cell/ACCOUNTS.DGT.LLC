/**
 * Company Master — legal-entity rules on top of the ONE `companies` master.
 *
 *   Company Master = legal identity, ownership, registration, tax identity, branch relationship,
 *   documents, contacts, status. It never creates bank accounts, ledgers or DR/CR postings:
 *   Bank Master registers banks → New Account creates accounts → Roznamcha/Journal posts.
 *   Company 360 only REFERENCES rows that already point at the company
 *   (banks.owner_company_id, enterprise_accounts.company_id, purchase_orders.supplier_company_id …).
 *
 *   Branches stay branches: an Internal company is linked to the branches that operate under it
 *   through the existing city_branches.company_id / country_branches.company_id columns.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { sessionSqlScope, sqlScopeCondition } from "@/lib/api/scope-middleware";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import { effectiveCompanyType } from "@/lib/repositories/companies-repository";

export const LEGAL_STRUCTURES = [
  "llc", "fzco", "fze", "sole_establishment", "partnership", "private_limited", "public_limited",
  "branch_of_foreign_company", "civil_company", "other",
] as const;
export const REGISTRATION_TYPES = [
  "trade_license", "commercial_registration", "certificate_of_incorporation", "free_zone_license",
  "professional_license", "other",
] as const;
export const COMPANY_STATUSES = ["active", "expired", "suspended", "closed"] as const;

type CompanyScopeRow = { id: string; country_id: string | null; city_branch_id?: string | null; country_branch_id?: string | null };

/**
 * Object-level scope for one company — same boundary as the list: companies are country master
 * data, so a non-global caller may open only companies of its own country(ies). A company with no
 * country is visible to Super Admin only.
 */
export function companyInSessionScope(session: ErpSession, company: CompanyScopeRow | null | undefined): boolean {
  if (!company) return false;
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) return true;
  return !!company.country_id && (session.countryIds ?? []).includes(company.country_id);
}

export async function loadCompanyScopeRow(id: string): Promise<CompanyScopeRow | null> {
  const rows = (await withLocalPg((sql) => sql`
    SELECT id, country_id, country_branch_id, city_branch_id FROM public.companies WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `)) as any[] | null;
  return rows?.[0] ?? null;
}

/** 404 (not 403) so an out-of-scope id is indistinguishable from a missing one. */
export async function assertCompanyAccess(session: ErpSession, id: string): Promise<CompanyScopeRow> {
  const row = await loadCompanyScopeRow(id);
  if (!row || !companyInSessionScope(session, row)) {
    throw new ApiClientError("Company not found", { status: 404, code: "NOT_FOUND" });
  }
  return row;
}

// ─── Duplicate protection ────────────────────────────────────────────────────

export type DuplicateReason = "same_name" | "same_registration_number" | "same_tax_number" | "same_owner_same_name";
export type CompanyDuplicate = {
  id: string;
  companyCode: string | null;
  name: string;
  legalName: string | null;
  ownerName: string | null;
  countryName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  reasons: DuplicateReason[];
};

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Likely duplicates of a company about to be created / edited. Registration number and TRN are
 * matched exactly (case-insensitive); names are matched on the normalised legal name within the
 * same country (or globally when no country is given). Scope-limited to what the caller may see.
 */
export async function findCompanyDuplicates(
  session: ErpSession,
  input: { name?: string | null; legalName?: string | null; registrationNumber?: string | null; taxNumber?: string | null; ownerPersonId?: string | null; countryId?: string | null; excludeId?: string | null }
): Promise<CompanyDuplicate[]> {
  const name = norm(input.legalName || input.name);
  const reg = (input.registrationNumber ?? "").trim().toLowerCase();
  const tax = (input.taxNumber ?? "").trim().toLowerCase();
  if (!name && !reg && !tax) return [];
  const rows = ((await withLocalPg((sql) => sql`
    SELECT id, company_code, name, legal_name, owner_name, owner_person_id, country_id, country_name,
           registration_number, tax_number
    FROM public.companies
    WHERE deleted_at IS NULL
      AND (${input.excludeId ?? null}::uuid IS NULL OR id <> ${input.excludeId ?? null}::uuid)
      AND (
        (${reg} <> '' AND lower(registration_number) = ${reg})
        OR (${tax} <> '' AND lower(tax_number) = ${tax})
        OR (${name} <> '' AND (${input.countryId ?? null}::uuid IS NULL OR country_id = ${input.countryId ?? null}::uuid)
            AND lower(coalesce(legal_name, name)) LIKE ${"%" + (name.split(" ").find((w) => w.length > 2) ?? name) + "%"})
      )
    LIMIT 50
  `)) ?? []) as any[];
  const out: CompanyDuplicate[] = [];
  for (const r of rows) {
    if (!companyInSessionScope(session, r)) continue;
    const reasons: DuplicateReason[] = [];
    if (reg && (r.registration_number ?? "").toLowerCase() === reg) reasons.push("same_registration_number");
    if (tax && (r.tax_number ?? "").toLowerCase() === tax) reasons.push("same_tax_number");
    const rn = norm(r.legal_name || r.name);
    if (name && (rn === name || norm(r.name) === name)) {
      reasons.push(input.ownerPersonId && r.owner_person_id === input.ownerPersonId ? "same_owner_same_name" : "same_name");
    }
    if (!reasons.length) continue;
    out.push({
      id: r.id, companyCode: r.company_code ?? null, name: r.name, legalName: r.legal_name ?? null, ownerName: r.owner_name ?? null,
      countryName: r.country_name ?? null, registrationNumber: r.registration_number ?? null, taxNumber: r.tax_number ?? null, reasons,
    });
  }
  return out;
}

// ─── Type rules ──────────────────────────────────────────────────────────────

export function assertCompanyTypeRules(input: { companyType?: string | null; ownerPersonId?: string | null; countryId?: string | null }) {
  if (input.companyType === "customer" && !input.ownerPersonId) {
    throw new ApiClientError("A Customer Company must be linked to an existing Customer / Owner.", { status: 400, code: "OWNER_REQUIRED" });
  }
  if (input.companyType === "internal" && !input.countryId) {
    throw new ApiClientError("An Internal / Branch Company must have a country.", { status: 400, code: "COUNTRY_REQUIRED" });
  }
}

// ─── Branch links (Internal companies) ───────────────────────────────────────

/**
 * Point the chosen branches at this legal company (city_branches.company_id /
 * country_branches.company_id). Branch rows are otherwise untouched — no branch is created,
 * copied or turned into a company. Branches of this company that were de-selected are unlinked.
 * Every branch must be in the company's country and inside the caller's scope.
 */
export async function setCompanyBranchLinks(
  session: ErpSession,
  companyId: string,
  input: { countryBranchIds?: string[]; cityBranchIds?: string[] }
) {
  if (!session.isSuperAdmin && !hasRolePermission(session, "branches", "update") && !hasRolePermission(session, "companies", "update")) {
    throw new ApiClientError("You do not have permission to link branches to a company.", { status: 403, code: "FORBIDDEN" });
  }
  const company = await loadCompanyScopeRow(companyId);
  if (!company) throw new ApiClientError("Company not found", { status: 404, code: "NOT_FOUND" });
  const cb = [...new Set(input.countryBranchIds ?? [])];
  const cty = [...new Set(input.cityBranchIds ?? [])];
  const scope = sessionSqlScope(session);
  await withLocalPg(async (sql) => {
    const found = (await sql`
      SELECT 'country' AS lvl, id, country_id, id AS country_branch_id, NULL::uuid AS city_branch_id, company_id FROM public.country_branches WHERE id = ANY(${cb}::uuid[])
      UNION ALL
      SELECT 'city', id, country_id, country_branch_id, id, company_id FROM public.city_branches WHERE id = ANY(${cty}::uuid[])
    `) as any[];
    if (found.length !== cb.length + cty.length) throw new ApiClientError("One or more branches were not found.", { status: 400, code: "BRANCH_NOT_FOUND" });
    for (const b of found) {
      if (company.country_id && b.country_id !== company.country_id) {
        throw new ApiClientError("A branch in another country cannot be linked to this company.", { status: 400, code: "BRANCH_COUNTRY_MISMATCH" });
      }
      if (!session.isSuperAdmin && !(session.countryIds ?? []).includes(b.country_id)) {
        throw new ApiClientError("This branch is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
      }
    }
    const before = (await sql`
      SELECT 'country' AS lvl, id FROM public.country_branches WHERE company_id = ${companyId}::uuid
      UNION ALL SELECT 'city', id FROM public.city_branches WHERE company_id = ${companyId}::uuid
    `) as any[];
    await sql`UPDATE public.country_branches SET company_id = NULL, updated_at = now() WHERE company_id = ${companyId}::uuid AND NOT (id = ANY(${cb}::uuid[]))`;
    await sql`UPDATE public.city_branches SET company_id = NULL, updated_at = now() WHERE company_id = ${companyId}::uuid AND NOT (id = ANY(${cty}::uuid[]))`;
    if (cb.length) await sql`UPDATE public.country_branches SET company_id = ${companyId}::uuid, updated_at = now() WHERE id = ANY(${cb}::uuid[])`;
    if (cty.length) await sql`UPDATE public.city_branches SET company_id = ${companyId}::uuid, updated_at = now() WHERE id = ANY(${cty}::uuid[])`;
    void scope;
    await writeRecordChangeHistory({
      recordTable: "companies",
      recordId: companyId,
      action: "update",
      actorId: session.userId,
      countryId: company.country_id,
      beforeData: { linked_branches: before },
      afterData: { linked_branches: [...cb.map((id) => ({ lvl: "country", id })), ...cty.map((id) => ({ lvl: "city", id }))] },
    });
  });
}

// ─── Company 360 ─────────────────────────────────────────────────────────────

const days = (d: string | null) => (d ? Math.round((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 86_400_000) : null);

/**
 * Everything linked to one company, read from the authoritative tables by reference.
 * Transactional lists are clamped to the caller's country/branch scope with the one scope rule.
 * Nothing here is copied, recalculated into a second balance, or written.
 */
export async function getCompany360(session: ErpSession, companyId: string) {
  await assertCompanyAccess(session, companyId);
  const scope = sessionSqlScope(session);
  const canSeeAccounts = session.isSuperAdmin || hasRolePermission(session, "accounts", "read") || hasRolePermission(session, "ledgers", "read");
  return withLocalPg(async (sql) => {
    const [company] = (await sql`SELECT * FROM public.companies WHERE id = ${companyId}::uuid AND deleted_at IS NULL`) as any[];
    const owner = company.owner_person_id
      ? ((await sql`SELECT id, customer_name, person_code, mobile, whatsapp, email FROM public.customers WHERE id = ${company.owner_person_id}::uuid LIMIT 1`) as any[])[0] ?? null
      : null;
    const sisters = company.owner_person_id
      ? ((await sql`
          SELECT id, company_code, name, legal_name, country_id, country_name, registration_number, tax_number, company_status, company_type, is_branch_operative, owner_person_id
          FROM public.companies WHERE owner_person_id = ${company.owner_person_id}::uuid AND id <> ${companyId}::uuid AND deleted_at IS NULL ORDER BY name
        `) as any[]).filter((c) => companyInSessionScope(session, c))
      : [];
    const branches = (await sql`
      SELECT 'country_branch' AS level, cb.id, cb.name, cb.code, cb.country_id, NULL::text AS city_name FROM public.country_branches cb WHERE cb.company_id = ${companyId}::uuid AND cb.deleted_at IS NULL
      UNION ALL
      SELECT 'city_branch', c.id, c.name, c.code, c.country_id, c.city_name FROM public.city_branches c WHERE c.company_id = ${companyId}::uuid AND c.deleted_at IS NULL
      ORDER BY 1, 3
    `) as any[];
    const bankMaster = (await sql`
      SELECT id, bank_name, branch_name, account_title, currency FROM public.banks WHERE owner_company_id = ${companyId}::uuid AND (is_active IS NULL OR is_active = true) ORDER BY bank_name LIMIT 50
    `) as any[];
    const accounts = canSeeAccounts
      ? ((await sql`
          SELECT ea.id, ea.code, ea.name, ea.currency, ea.scope, ea.status
          FROM public.enterprise_accounts ea
          WHERE ea.company_id = ${companyId}::uuid AND ea.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "ea")}
          ORDER BY ea.code LIMIT 100
        `)) as any[]
      : [];
    const documents = (await sql`
      SELECT id, title, file_name, document_type, category, created_at FROM public.office_documents
      WHERE company_id = ${companyId}::uuid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50
    `) as any[];
    const purchaseOrders = (await sql`
      SELECT po.id, po.purchase_order_no, po.purchase_contract_no, po.created_at, po.order_total, po.currency_code, po.status
      FROM public.purchase_orders po
      WHERE po.supplier_company_id = ${companyId}::uuid AND po.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "po")}
      ORDER BY po.created_at DESC LIMIT 50
    `) as any[];
    const invoices = (await sql`
      SELECT bi.id, bi.invoice_no, bi.document_date, bi.document_total_value, bi.document_currency, bi.status
      FROM public.business_edit_invoices bi
      WHERE bi.company_id = ${companyId}::uuid AND bi.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "bi")}
      ORDER BY bi.created_at DESC LIMIT 50
    `) as any[];
    const clearingOrders = (await sql`
      SELECT DISTINCT o.id, o.order_no, o.created_at, o.status
      FROM public.clearing_customer_order_parties p
      JOIN public.clearing_customer_orders o ON o.id = p.order_id
      WHERE p.party_company_id = ${companyId}::uuid AND o.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "o")}
      ORDER BY o.created_at DESC LIMIT 50
    `) as any[];
    const inquiries = (await sql`
      SELECT ci.id, ci.inquiry_no, ci.status, ci.inquiry_date, ci.created_at
      FROM public.customer_inquiries ci
      WHERE ci.company_id = ${companyId}::uuid AND ci.deleted_at IS NULL AND ${sqlScopeCondition(sql, scope, "ci")}
      ORDER BY ci.created_at DESC LIMIT 50
    `) as any[];
    const taxEntities = (await sql`
      SELECT id, trn, legal_name, registration_date, filing_frequency, is_active FROM public.uae_tax_entities WHERE company_id = ${companyId}::uuid AND deleted_at IS NULL LIMIT 10
    `) as any[];
    const history = (await sql`
      SELECT h.action, h.created_at, p.full_name AS actor_name FROM public.record_change_history h
      LEFT JOIN public.profiles p ON p.id = h.actor_id
      WHERE h.record_table = 'companies' AND h.record_id = ${companyId}::uuid ORDER BY h.created_at DESC LIMIT 20
    `) as any[];

    const expiryDays = days(company.license_expiry_date ? String(company.license_expiry_date instanceof Date ? company.license_expiry_date.toISOString().slice(0, 10) : company.license_expiry_date).slice(0, 10) : null);
    const compliance: Array<{ code: string; severity: "critical" | "needs_review" | "reminder" }> = [];
    if (expiryDays !== null && expiryDays < 0) compliance.push({ code: "license_expired", severity: "critical" });
    else if (expiryDays !== null && expiryDays <= 30) compliance.push({ code: "license_expiring", severity: "needs_review" });
    if (!company.registration_number) compliance.push({ code: "registration_number_missing", severity: "reminder" });
    if (!company.tax_number && (company.country_name ?? "").toLowerCase().includes("emirates")) compliance.push({ code: "trn_missing", severity: "reminder" });
    if (!documents.length) compliance.push({ code: "documents_missing", severity: "reminder" });

    return {
      company: { ...company, effective_company_type: effectiveCompanyType(company), license_expiry_in_days: expiryDays },
      owner,
      sisterCompanies: sisters,
      branches,
      bankMaster,
      accounts,
      documents,
      purchaseOrders,
      invoices,
      clearingOrders,
      inquiries,
      taxEntities,
      history,
      compliance,
      // Architecture guarantee surfaced to the UI: Company 360 is read-only references.
      accounting: { createsAccounts: false, postsEntries: false, accountCreationRoute: "/dashboard/accounts/setup", postingRoute: "/dashboard/roznamcha/cash-entry" },
    };
  });
}
