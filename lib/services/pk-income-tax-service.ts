/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pakistan Annual Income / Corporate Tax — mirrors the existing UAE Corporate
 * Tax module's architecture (lib/services/uae-corporate-tax-service.ts):
 * draft -> in_preparation -> ready_for_review -> reviewed -> filed -> paid,
 * four-eyes review, event audit trail. 'filed'/'paid' only RECORD the
 * FBR/IRIS reference — nothing is submitted to FBR and no accounting entry
 * is posted here.
 *
 * RATES (seed defaults, NOT trusted as authoritative without explicit
 * accountant confirmation — see accountant_confirmed on the return row):
 *   Source: Income Tax Ordinance, 2001, First Schedule Part I, Division II
 *   & Division IIB (fetched directly from FBR's document repository,
 *   consolidated text amended up to 20 Feb 2026).
 *   - Small company: 20%
 *   - Any other company: 29%
 *   - Banking company: 44% (tax year 2025), 43% (2026), 42% (2027 onward)
 *   - Super Tax on high earners (Section 4C, Division IIB): a graduated
 *     0-4% surcharge on "income under section 4C" (a different income base
 *     than regular taxable income) for entities with that income above
 *     Rs.150 million. This is NOT auto-computed here — the bracket table's
 *     precise application depends on facts the preparer must judge, so
 *     super_tax_amount is always a manually entered, accountant-reviewed
 *     figure, exactly like UAE CT never invents accounting profit.
 *   - Minimum tax (Section 113): 1.25% of turnover where normal tax
 *     liability is lower — this specific figure was corroborated only from
 *     secondary sources during this build, NOT independently verified
 *     against the primary Section 113 text, so it is flagged more strongly:
 *     the UI must show it as "verify against Income Tax Ordinance Section
 *     113 before relying on this" even after accountant_confirmed is set
 *     for the rate_applied field.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";
import { createTask } from "@/lib/user-tasks/service";

export const PK_CT_RATE_SMALL = 0.20;
export const PK_CT_RATE_OTHER = 0.29;
export const PK_CT_RATE_BANKING_BY_YEAR: Record<number, number> = { 2025: 0.44, 2026: 0.43 };
export const PK_CT_RATE_BANKING_DEFAULT = 0.42; // 2027 onward
export const PK_MINIMUM_TAX_TURNOVER_RATE = 0.0125; // Section 113 — see header, needs primary-source re-verification
export const PK_CT_RATE_SOURCE =
  "Income Tax Ordinance, 2001, First Schedule Part I, Division II & IIB (FBR consolidated text, amended up to 2026-02-20)";
export const PK_CT_DOC_KEYS = ["audited_financials", "tax_computation_working", "wealth_statement", "ntn_certificate"] as const;
export type PkCtAction = "start" | "ready" | "review" | "back" | "file" | "pay" | "cancel";

const r2 = (n: number) => Math.round(n * 100) / 100;
const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const notFound = () => new ApiClientError("Income Tax return not found.", { status: 404, code: "NOT_FOUND" });

export function rateForCompanyType(companyType: "small" | "banking" | "other", taxYear: number): number {
  if (companyType === "small") return PK_CT_RATE_SMALL;
  if (companyType === "banking") return PK_CT_RATE_BANKING_BY_YEAR[taxYear] ?? PK_CT_RATE_BANKING_DEFAULT;
  return PK_CT_RATE_OTHER;
}

/** Pure computation (unit-tested): only computes what the verified law directly specifies. */
export function computePkIncomeTax(i: {
  taxableIncome: number;
  companyType: "small" | "banking" | "other";
  taxYear: number;
  turnover: number | null;
  superTaxAmount: number;
}) {
  const rate = rateForCompanyType(i.companyType, i.taxYear);
  const normalTax = r2(Math.max(0, i.taxableIncome) * rate);
  const minimumTax = i.turnover != null ? r2(i.turnover * PK_MINIMUM_TAX_TURNOVER_RATE) : null;
  const baseTax = minimumTax != null ? Math.max(normalTax, minimumTax) : normalTax;
  const superTax = r2(Math.max(0, i.superTaxAmount || 0));
  const taxPayable = r2(baseTax + superTax);
  return { rate, normalTax, minimumTax, baseTax, superTaxAmount: superTax, taxPayable };
}

/** Annual return deadline — fixed statutory dates vary by taxpayer category; this uses the
 * standard company deadline (30 September following the tax year end for a June year-end
 * company). Flagged for accountant confirmation like everything else rate/deadline-related. */
export function filingDeadline(taxYear: number): string {
  return `${taxYear}-09-30`;
}

const inScope = (scope: UaeTaxScope, countryId: string | null) => scope.countryIds == null || (!!countryId && scope.countryIds.includes(countryId));

async function loadReturn(scope: UaeTaxScope, id: string) {
  const r = ((await withReadPg((sql) => sql`SELECT * FROM public.pk_income_tax_returns WHERE id = ${id}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!r || !inScope(scope, r.country_id)) throw notFound();
  return r;
}

async function event(sql: any, id: string, s: ErpSession, action: string, from: string | null, to: string | null, detail: Record<string, unknown> = {}) {
  await sql`INSERT INTO public.pk_income_tax_events (return_id, action, from_status, to_status, detail, actor_id, actor_name)
            VALUES (${id}::uuid, ${action}, ${from}, ${to}, ${sql.json(detail as any)}, ${s.userId}::uuid, ${s.fullName ?? null})`;
}

export async function listReturns(scope: UaeTaxScope) {
  return ((await withReadPg((sql) => sql`
    SELECT r.id, r.return_no, r.tax_entity_id, r.tax_year, r.filing_deadline, r.status, r.taxable_income, r.tax_payable,
           r.accountant_confirmed, r.filing_reference, r.paid_amount, r.responsible_user_id,
           e.legal_name, e.trn AS ntn, c.name AS company_name, p.full_name AS responsible_name,
           (r.filing_deadline - current_date) AS days_to_deadline
    FROM public.pk_income_tax_returns r
    JOIN public.uae_tax_entities e ON e.id = r.tax_entity_id
    LEFT JOIN public.companies c ON c.id = r.company_id
    LEFT JOIN public.profiles p ON p.id = r.responsible_user_id
    WHERE r.deleted_at IS NULL AND (${scope.countryIds == null} OR r.country_id = ANY(${scope.countryIds ?? []}::uuid[]))
    ORDER BY r.tax_year DESC, e.legal_name
  `)) ?? []) as any[];
}

export async function getReturn(scope: UaeTaxScope, id: string) {
  const r = await loadReturn(scope, id);
  const [events, meta] = await Promise.all([
    withReadPg((sql) => sql`SELECT * FROM public.pk_income_tax_events WHERE return_id = ${id}::uuid ORDER BY created_at DESC`),
    withReadPg((sql) => sql`
      SELECT e.legal_name, e.trn AS ntn, c.name AS company_name, c.company_code, p.full_name AS responsible_name
      FROM public.uae_tax_entities e LEFT JOIN public.companies c ON c.id = ${r.company_id ?? null}::uuid
      LEFT JOIN public.profiles p ON p.id = ${r.responsible_user_id ?? null}::uuid
      WHERE e.id = ${r.tax_entity_id}::uuid`),
  ]);
  return {
    pkReturn: r, events: events ?? [], meta: (meta as any[])?.[0] ?? null,
    editable: ["draft", "in_preparation"].includes(r.status),
  };
}

export async function createReturn(
  s: ErpSession, scope: UaeTaxScope,
  input: { taxEntityId: string; taxYear: number; companyType: "small" | "banking" | "other"; ntn?: string | null; responsibleUserId?: string | null }
) {
  const ent = ((await withReadPg((sql) => sql`SELECT id, country_id, company_id, legal_name FROM public.uae_tax_entities WHERE id = ${input.taxEntityId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!ent || !inScope(scope, ent.country_id)) throw new ApiClientError("Tax entity not found.", { status: 404, code: "NOT_FOUND" });
  if (!Number.isInteger(input.taxYear) || input.taxYear < 2020 || input.taxYear > 2100) throw bad("Enter a valid tax year.");
  const deadline = filingDeadline(input.taxYear);
  let created: { id: string; returnNo: string };
  try {
    created = (await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      const n = ((await tx`SELECT count(*)::int AS n FROM public.pk_income_tax_returns`) as any[])[0].n + 1;
      const no = `PKIT-${input.taxYear}-${String(n).padStart(5, "0")}`;
      const row = ((await tx`
        INSERT INTO public.pk_income_tax_returns (return_no, tax_entity_id, company_id, country_id, ntn, tax_year, company_type, filing_deadline, responsible_user_id, created_by)
        VALUES (${no}, ${ent.id}::uuid, ${ent.company_id ?? null}::uuid, ${ent.country_id}::uuid, ${input.ntn ?? null}, ${input.taxYear}, ${input.companyType}, ${deadline}::date,
                ${input.responsibleUserId ?? s.userId}::uuid, ${s.userId}::uuid)
        RETURNING id`) as any[])[0];
      await event(tx, row.id, s, "created", null, "draft", { taxYear: input.taxYear, deadline });
      return { id: row.id as string, returnNo: no };
    })))!;
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("An Income Tax return already exists for this entity and tax year.", { status: 409, code: "PKIT_EXISTS" });
    throw e;
  }
  let reminder: Record<string, unknown> = {};
  try {
    const due = new Date(`${deadline}T12:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() - 30);
    const dueAt = due.getTime() < Date.now() ? new Date(Date.now() + 86400000).toISOString() : due.toISOString();
    const t = await createTask(s, {
      title: `Pakistan Income Tax return ${created.returnNo} — ${ent.legal_name} (deadline ${deadline})`,
      assignedTo: input.responsibleUserId ?? s.userId, relatedModule: "tax_compliance", relatedRecordTable: "pk_income_tax_returns",
      relatedRecordId: created.id, relatedRecordLabel: `${created.returnNo} · ${ent.legal_name}`,
      relatedRoute: `/dashboard/tax-einvoicing/pakistan/income-tax?return=${created.id}`, priority: "high", dueAt, countryId: ent.country_id,
    });
    await withReadPg((sql) => sql`UPDATE public.pk_income_tax_returns SET reminder_task_id = ${t.id}::uuid WHERE id = ${created.id}::uuid`);
    reminder = { reminderTask: t.taskNo };
  } catch (e) {
    reminder = { reminderSkipped: (e as Error).message };
  }
  await withLocalPg((sql) => event(sql, created.id, s, "reminder", "draft", "draft", reminder));
  return { ...created, filingDeadline: deadline, rateSource: PK_CT_RATE_SOURCE, ...reminder };
}

export async function updateWorking(
  s: ErpSession, scope: UaeTaxScope, id: string,
  input: {
    taxableIncome?: number | null; taxableIncomeSource?: string | null; turnover?: number | null;
    superTaxIncome?: number | null; superTaxAmount?: number; companyType?: "small" | "banking" | "other";
    ntn?: string | null; notes?: string | null; responsibleUserId?: string | null;
  }
) {
  const r = await loadReturn(scope, id);
  if (!["draft", "in_preparation"].includes(r.status)) throw new ApiClientError("Only a draft or in-preparation return can be edited.", { status: 409, code: "NOT_EDITABLE" });
  return withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.pk_income_tax_returns SET
      taxable_income = ${input.taxableIncome !== undefined ? input.taxableIncome : r.taxable_income},
      taxable_income_source = ${input.taxableIncomeSource !== undefined ? input.taxableIncomeSource : r.taxable_income_source},
      turnover = ${input.turnover !== undefined ? input.turnover : r.turnover},
      super_tax_income = ${input.superTaxIncome !== undefined ? input.superTaxIncome : r.super_tax_income},
      super_tax_amount = ${input.superTaxAmount ?? r.super_tax_amount},
      company_type = ${input.companyType ?? r.company_type},
      ntn = ${input.ntn !== undefined ? input.ntn : r.ntn},
      notes = ${input.notes !== undefined ? input.notes : r.notes},
      responsible_user_id = ${input.responsibleUserId !== undefined ? input.responsibleUserId : r.responsible_user_id}::uuid,
      accountant_confirmed = false, accountant_confirmed_by = NULL, accountant_confirmed_at = NULL,
      status = CASE WHEN status = 'draft' THEN 'in_preparation' ELSE status END,
      updated_at = now()
      WHERE id = ${id}::uuid`;
    const fresh = ((await tx`SELECT * FROM public.pk_income_tax_returns WHERE id = ${id}::uuid`) as any[])[0];
    let computed: any = null;
    if (fresh.taxable_income != null) {
      computed = computePkIncomeTax({
        taxableIncome: Number(fresh.taxable_income), companyType: fresh.company_type, taxYear: fresh.tax_year,
        turnover: fresh.turnover == null ? null : Number(fresh.turnover), superTaxAmount: Number(fresh.super_tax_amount || 0),
      });
      await tx`UPDATE public.pk_income_tax_returns SET
        rate_applied = ${computed.rate}, rate_source_note = ${PK_CT_RATE_SOURCE},
        normal_tax = ${computed.normalTax}, minimum_tax = ${computed.minimumTax}, tax_payable = ${computed.taxPayable}, computed_at = now()
        WHERE id = ${id}::uuid`;
    }
    await event(tx, id, s, "updated", r.status, r.status === "draft" ? "in_preparation" : r.status, computed ? { taxPayable: computed.taxPayable, rate: computed.rate } : {});
    return { id, computed };
  }));
}

export async function confirmRates(s: ErpSession, scope: UaeTaxScope, id: string) {
  const r = await loadReturn(scope, id);
  if (!["draft", "in_preparation"].includes(r.status)) throw new ApiClientError("Rates can only be confirmed while the return is still being prepared.", { status: 409, code: "NOT_EDITABLE" });
  if (r.tax_payable == null) throw bad("Enter the taxable income so tax payable is computed before confirming the rate.", "NOT_COMPUTED");
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.pk_income_tax_returns SET accountant_confirmed = true, accountant_confirmed_by = ${s.userId}::uuid, accountant_confirmed_at = now(), updated_at = now() WHERE id = ${id}::uuid`;
    await event(tx, id, s, "rates_confirmed", r.status, r.status, { rateApplied: r.rate_applied, source: PK_CT_RATE_SOURCE });
  }));
  return { id, accountantConfirmed: true };
}

export async function actOnReturn(s: ErpSession, scope: UaeTaxScope, id: string, action: PkCtAction, input: { reference?: string | null; amount?: number | null; reason?: string | null } = {}) {
  const r = await loadReturn(scope, id);
  const T: Record<PkCtAction, { from: string[]; to: string }> = {
    start: { from: ["draft"], to: "in_preparation" },
    ready: { from: ["in_preparation"], to: "ready_for_review" },
    review: { from: ["ready_for_review"], to: "reviewed" },
    back: { from: ["ready_for_review", "reviewed"], to: "in_preparation" },
    file: { from: ["reviewed"], to: "filed" },
    pay: { from: ["filed"], to: "paid" },
    cancel: { from: ["draft", "in_preparation"], to: "cancelled" },
  };
  const t = T[action];
  if (!t.from.includes(r.status)) throw new ApiClientError(`A '${r.status}' return cannot move to '${t.to}'.`, { status: 409, code: "BAD_TRANSITION" });
  const ref = input.reference?.trim() || null;
  if (action === "ready") {
    if (r.tax_payable == null) throw bad("Enter the taxable income so tax payable is computed.", "NOT_COMPUTED");
    if (!r.accountant_confirmed) throw new ApiClientError("The rate applied must be confirmed by an accountant before this return can be marked ready for review.", { status: 400, code: "RATE_NOT_CONFIRMED" });
  }
  if (action === "review") {
    const prepared = ((await withReadPg((sql) => sql`SELECT actor_id FROM public.pk_income_tax_events WHERE return_id = ${id}::uuid AND to_status = 'ready_for_review' ORDER BY created_at DESC LIMIT 1`)) as any[] | null)?.[0];
    if (prepared?.actor_id === s.userId && !s.isSuperAdmin) throw new ApiClientError("A different person must review the return than the one who prepared it.", { status: 403, code: "FOUR_EYES" });
  }
  if (action === "file" && !ref) throw bad("Enter the FBR/IRIS filing reference.", "REFERENCE_REQUIRED");
  if (action === "pay") {
    if (!ref) throw bad("Enter the payment reference.", "REFERENCE_REQUIRED");
    if (!(Number(input.amount) > 0)) throw bad("Enter the amount paid.", "AMOUNT_REQUIRED");
  }
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    const u = (await tx`
      UPDATE public.pk_income_tax_returns SET status = ${t.to}, updated_at = now(),
        filing_reference = CASE WHEN ${action} = 'file' THEN ${ref} ELSE filing_reference END,
        filed_at = CASE WHEN ${action} = 'file' THEN now() ELSE filed_at END,
        filed_by = CASE WHEN ${action} = 'file' THEN ${s.userId}::uuid ELSE filed_by END,
        payment_reference = CASE WHEN ${action} = 'pay' THEN ${ref} ELSE payment_reference END,
        paid_amount = CASE WHEN ${action} = 'pay' THEN ${input.amount ?? null}::numeric ELSE paid_amount END,
        paid_at = CASE WHEN ${action} = 'pay' THEN now() ELSE paid_at END
      WHERE id = ${id}::uuid AND status = ${r.status} RETURNING id`) as any[];
    if (!u.length) throw new ApiClientError("The return changed meanwhile — reload and try again.", { status: 409, code: "CONFLICT" });
    await event(tx, id, s, action, r.status, t.to, { reference: ref, amount: input.amount ?? null, reason: input.reason ?? null });
  }));
  return { id, status: t.to };
}

export async function pkIncomeTaxDashboard(scope: UaeTaxScope) {
  const rows = await listReturns(scope);
  const open = rows.filter((r) => !["filed", "paid", "cancelled"].includes(r.status));
  return {
    total: rows.filter((r) => r.status !== "cancelled").length,
    open: open.length,
    dueIn60: open.filter((r) => Number(r.days_to_deadline) <= 60).length,
    overdue: open.filter((r) => Number(r.days_to_deadline) < 0).length,
    unconfirmedRates: open.filter((r) => !r.accountant_confirmed).length,
    taxPayableOpen: r2(open.reduce((a, r) => a + Number(r.tax_payable || 0), 0)),
    nextDeadline: open.map((r) => String(r.filing_deadline).slice(0, 10)).sort()[0] ?? null,
  };
}
