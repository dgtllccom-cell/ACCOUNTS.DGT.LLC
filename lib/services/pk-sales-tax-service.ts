/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pakistan Monthly Sales Tax — mirrors the Pakistan Income Tax module's
 * architecture (pk-income-tax-service.ts), which itself mirrors the existing
 * UAE Corporate Tax module: draft -> in_preparation -> ready_for_review ->
 * reviewed -> filed -> paid, four-eyes review, event audit trail. 'filed'/
 * 'paid' only RECORD the FBR/IRIS reference — nothing is submitted to FBR.
 *
 * RATE (seed default, NOT trusted as authoritative without explicit
 * accountant confirmation — see accountant_confirmed on the return row):
 *   Source: Sales Tax Act, 1990, Section 3(1) (fetched directly from FBR's
 *   document repository, consolidated text updated up to 2025-26):
 *   "there shall be charged, levied and paid a tax known as sales tax at
 *   the rate of eighteen per cent" — footnoted "Substituted for seventeen
 *   vide Finance (Supplementary) Act, 2023."
 *
 * output_tax_amount / input_tax_amount are ALWAYS manually entered by the
 * preparer from their own real sales/purchase tax registers — this module
 * does not compute or invent them (no equivalent of UAE VAT's uae_tax_lines
 * transaction-level tracing exists for Pakistan yet). net_payable is the
 * one thing genuinely safe to compute: output minus input.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";
import { createTask } from "@/lib/user-tasks/service";

export const PK_SALES_TAX_STANDARD_RATE = 0.18;
export const PK_SALES_TAX_RATE_SOURCE = "Sales Tax Act, 1990, Section 3(1) (FBR consolidated text, updated up to 2025-26)";
export type PkStAction = "start" | "ready" | "review" | "back" | "file" | "pay" | "cancel";

const r2 = (n: number) => Math.round(n * 100) / 100;
const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const notFound = () => new ApiClientError("Sales Tax return not found.", { status: 404, code: "NOT_FOUND" });

/** Pure computation (unit-tested): net_payable = output - input; a negative value is a carry-forward credit. */
export function computePkSalesTax(i: { outputTaxAmount: number; inputTaxAmount: number }) {
  const netPayable = r2(Number(i.outputTaxAmount || 0) - Number(i.inputTaxAmount || 0));
  return { netPayable, isCredit: netPayable < 0 };
}

/** Monthly sales tax returns are due on the 18th of the following month (Sales Tax Rules — see module header for the Act's rate citation; the 18th-of-following-month filing date is the commonly cited FBR filing deadline and should be reconfirmed alongside rate confirmation). */
export function filingDeadline(periodYear: number, periodMonth: number): string {
  const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
  const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-18`;
}

const inScope = (scope: UaeTaxScope, countryId: string | null) => scope.countryIds == null || (!!countryId && scope.countryIds.includes(countryId));

async function loadReturn(scope: UaeTaxScope, id: string) {
  const r = ((await withReadPg((sql) => sql`SELECT * FROM public.pk_sales_tax_returns WHERE id = ${id}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!r || !inScope(scope, r.country_id)) throw notFound();
  return r;
}

async function event(sql: any, id: string, s: ErpSession, action: string, from: string | null, to: string | null, detail: Record<string, unknown> = {}) {
  await sql`INSERT INTO public.pk_sales_tax_events (return_id, action, from_status, to_status, detail, actor_id, actor_name)
            VALUES (${id}::uuid, ${action}, ${from}, ${to}, ${sql.json(detail as any)}, ${s.userId}::uuid, ${s.fullName ?? null})`;
}

export async function listReturns(scope: UaeTaxScope) {
  return ((await withReadPg((sql) => sql`
    SELECT r.id, r.return_no, r.tax_entity_id, r.period_year, r.period_month, r.filing_deadline, r.status,
           r.output_tax_amount, r.input_tax_amount, r.net_payable, r.accountant_confirmed, r.filing_reference, r.paid_amount,
           r.responsible_user_id, e.legal_name, e.trn AS strn, c.name AS company_name, p.full_name AS responsible_name,
           (r.filing_deadline - current_date) AS days_to_deadline
    FROM public.pk_sales_tax_returns r
    JOIN public.uae_tax_entities e ON e.id = r.tax_entity_id
    LEFT JOIN public.companies c ON c.id = r.company_id
    LEFT JOIN public.profiles p ON p.id = r.responsible_user_id
    WHERE r.deleted_at IS NULL AND (${scope.countryIds == null} OR r.country_id = ANY(${scope.countryIds ?? []}::uuid[]))
    ORDER BY r.period_year DESC, r.period_month DESC, e.legal_name
  `)) ?? []) as any[];
}

export async function getReturn(scope: UaeTaxScope, id: string) {
  const r = await loadReturn(scope, id);
  const [events, meta] = await Promise.all([
    withReadPg((sql) => sql`SELECT * FROM public.pk_sales_tax_events WHERE return_id = ${id}::uuid ORDER BY created_at DESC`),
    withReadPg((sql) => sql`
      SELECT e.legal_name, e.trn AS strn, c.name AS company_name, c.company_code, p.full_name AS responsible_name
      FROM public.uae_tax_entities e LEFT JOIN public.companies c ON c.id = ${r.company_id ?? null}::uuid
      LEFT JOIN public.profiles p ON p.id = ${r.responsible_user_id ?? null}::uuid
      WHERE e.id = ${r.tax_entity_id}::uuid`),
  ]);
  return { pkReturn: r, events: events ?? [], meta: (meta as any[])?.[0] ?? null, editable: ["draft", "in_preparation"].includes(r.status) };
}

export async function createReturn(
  s: ErpSession, scope: UaeTaxScope,
  input: { taxEntityId: string; periodYear: number; periodMonth: number; strn?: string | null; responsibleUserId?: string | null }
) {
  const ent = ((await withReadPg((sql) => sql`SELECT id, country_id, company_id, legal_name FROM public.uae_tax_entities WHERE id = ${input.taxEntityId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!ent || !inScope(scope, ent.country_id)) throw new ApiClientError("Tax entity not found.", { status: 404, code: "NOT_FOUND" });
  if (!Number.isInteger(input.periodMonth) || input.periodMonth < 1 || input.periodMonth > 12) throw bad("Enter a valid period month (1-12).");
  if (!Number.isInteger(input.periodYear) || input.periodYear < 2020 || input.periodYear > 2100) throw bad("Enter a valid period year.");
  const deadline = filingDeadline(input.periodYear, input.periodMonth);
  let created: { id: string; returnNo: string };
  try {
    created = (await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      const n = ((await tx`SELECT count(*)::int AS n FROM public.pk_sales_tax_returns`) as any[])[0].n + 1;
      const no = `PKST-${input.periodYear}${String(input.periodMonth).padStart(2, "0")}-${String(n).padStart(5, "0")}`;
      const row = ((await tx`
        INSERT INTO public.pk_sales_tax_returns (return_no, tax_entity_id, company_id, country_id, strn, period_year, period_month, filing_deadline, responsible_user_id, created_by)
        VALUES (${no}, ${ent.id}::uuid, ${ent.company_id ?? null}::uuid, ${ent.country_id}::uuid, ${input.strn ?? null}, ${input.periodYear}, ${input.periodMonth}, ${deadline}::date,
                ${input.responsibleUserId ?? s.userId}::uuid, ${s.userId}::uuid)
        RETURNING id`) as any[])[0];
      await event(tx, row.id, s, "created", null, "draft", { period: `${input.periodYear}-${input.periodMonth}`, deadline });
      return { id: row.id as string, returnNo: no };
    })))!;
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("A Sales Tax return already exists for this entity and period.", { status: 409, code: "PKST_EXISTS" });
    throw e;
  }
  let reminder: Record<string, unknown> = {};
  try {
    const due = new Date(`${deadline}T12:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() - 5);
    const dueAt = due.getTime() < Date.now() ? new Date(Date.now() + 86400000).toISOString() : due.toISOString();
    const t = await createTask(s, {
      title: `Pakistan Sales Tax return ${created.returnNo} — ${ent.legal_name} (deadline ${deadline})`,
      assignedTo: input.responsibleUserId ?? s.userId, relatedModule: "tax_compliance", relatedRecordTable: "pk_sales_tax_returns",
      relatedRecordId: created.id, relatedRecordLabel: `${created.returnNo} · ${ent.legal_name}`,
      relatedRoute: `/dashboard/tax-einvoicing/pakistan/sales-tax?return=${created.id}`, priority: "high", dueAt, countryId: ent.country_id,
    });
    await withReadPg((sql) => sql`UPDATE public.pk_sales_tax_returns SET reminder_task_id = ${t.id}::uuid WHERE id = ${created.id}::uuid`);
    reminder = { reminderTask: t.taskNo };
  } catch (e) {
    reminder = { reminderSkipped: (e as Error).message };
  }
  await withLocalPg((sql) => event(sql, created.id, s, "reminder", "draft", "draft", reminder));
  return { ...created, filingDeadline: deadline, rateSource: PK_SALES_TAX_RATE_SOURCE, ...reminder };
}

export async function updateWorking(
  s: ErpSession, scope: UaeTaxScope, id: string,
  input: {
    outputTaxAmount?: number | null; outputTaxSource?: string | null; inputTaxAmount?: number | null; inputTaxSource?: string | null;
    strn?: string | null; notes?: string | null; responsibleUserId?: string | null;
  }
) {
  const r = await loadReturn(scope, id);
  if (!["draft", "in_preparation"].includes(r.status)) throw new ApiClientError("Only a draft or in-preparation return can be edited.", { status: 409, code: "NOT_EDITABLE" });
  return withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.pk_sales_tax_returns SET
      output_tax_amount = ${input.outputTaxAmount !== undefined ? input.outputTaxAmount : r.output_tax_amount},
      output_tax_source = ${input.outputTaxSource !== undefined ? input.outputTaxSource : r.output_tax_source},
      input_tax_amount = ${input.inputTaxAmount !== undefined ? input.inputTaxAmount : r.input_tax_amount},
      input_tax_source = ${input.inputTaxSource !== undefined ? input.inputTaxSource : r.input_tax_source},
      strn = ${input.strn !== undefined ? input.strn : r.strn},
      notes = ${input.notes !== undefined ? input.notes : r.notes},
      responsible_user_id = ${input.responsibleUserId !== undefined ? input.responsibleUserId : r.responsible_user_id}::uuid,
      accountant_confirmed = false, accountant_confirmed_by = NULL, accountant_confirmed_at = NULL,
      status = CASE WHEN status = 'draft' THEN 'in_preparation' ELSE status END,
      updated_at = now()
      WHERE id = ${id}::uuid`;
    const fresh = ((await tx`SELECT * FROM public.pk_sales_tax_returns WHERE id = ${id}::uuid`) as any[])[0];
    let computed: any = null;
    if (fresh.output_tax_amount != null && fresh.input_tax_amount != null) {
      computed = computePkSalesTax({ outputTaxAmount: Number(fresh.output_tax_amount), inputTaxAmount: Number(fresh.input_tax_amount) });
      await tx`UPDATE public.pk_sales_tax_returns SET
        rate_applied = ${PK_SALES_TAX_STANDARD_RATE}, rate_source_note = ${PK_SALES_TAX_RATE_SOURCE},
        net_payable = ${computed.netPayable}, computed_at = now()
        WHERE id = ${id}::uuid`;
    }
    await event(tx, id, s, "updated", r.status, r.status === "draft" ? "in_preparation" : r.status, computed ? { netPayable: computed.netPayable } : {});
    return { id, computed };
  }));
}

export async function confirmRates(s: ErpSession, scope: UaeTaxScope, id: string) {
  const r = await loadReturn(scope, id);
  if (!["draft", "in_preparation"].includes(r.status)) throw new ApiClientError("Rates can only be confirmed while the return is still being prepared.", { status: 409, code: "NOT_EDITABLE" });
  if (r.net_payable == null) throw bad("Enter the output and input tax amounts so net payable is computed before confirming the rate.", "NOT_COMPUTED");
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.pk_sales_tax_returns SET accountant_confirmed = true, accountant_confirmed_by = ${s.userId}::uuid, accountant_confirmed_at = now(), updated_at = now() WHERE id = ${id}::uuid`;
    await event(tx, id, s, "rates_confirmed", r.status, r.status, { rateApplied: PK_SALES_TAX_STANDARD_RATE, source: PK_SALES_TAX_RATE_SOURCE });
  }));
  return { id, accountantConfirmed: true };
}

export async function actOnReturn(s: ErpSession, scope: UaeTaxScope, id: string, action: PkStAction, input: { reference?: string | null; amount?: number | null; reason?: string | null } = {}) {
  const r = await loadReturn(scope, id);
  const T: Record<PkStAction, { from: string[]; to: string }> = {
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
    if (r.net_payable == null) throw bad("Enter the output and input tax amounts so net payable is computed.", "NOT_COMPUTED");
    if (!r.accountant_confirmed) throw new ApiClientError("The rate applied must be confirmed by an accountant before this return can be marked ready for review.", { status: 400, code: "RATE_NOT_CONFIRMED" });
  }
  if (action === "review") {
    const prepared = ((await withReadPg((sql) => sql`SELECT actor_id FROM public.pk_sales_tax_events WHERE return_id = ${id}::uuid AND to_status = 'ready_for_review' ORDER BY created_at DESC LIMIT 1`)) as any[] | null)?.[0];
    if (prepared?.actor_id === s.userId && !s.isSuperAdmin) throw new ApiClientError("A different person must review the return than the one who prepared it.", { status: 403, code: "FOUR_EYES" });
  }
  if (action === "file" && !ref) throw bad("Enter the FBR/IRIS filing reference.", "REFERENCE_REQUIRED");
  if (action === "pay") {
    if (!ref) throw bad("Enter the payment reference.", "REFERENCE_REQUIRED");
    if (!(Number(input.amount) > 0)) throw bad("Enter the amount paid.", "AMOUNT_REQUIRED");
  }
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    const u = (await tx`
      UPDATE public.pk_sales_tax_returns SET status = ${t.to}, updated_at = now(),
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

export async function pkSalesTaxDashboard(scope: UaeTaxScope) {
  const rows = await listReturns(scope);
  const open = rows.filter((r) => !["filed", "paid", "cancelled"].includes(r.status));
  return {
    total: rows.filter((r) => r.status !== "cancelled").length,
    open: open.length,
    dueIn15: open.filter((r) => Number(r.days_to_deadline) <= 15).length,
    overdue: open.filter((r) => Number(r.days_to_deadline) < 0).length,
    unconfirmedRates: open.filter((r) => !r.accountant_confirmed).length,
    netPayableOpen: r2(open.reduce((a, r) => a + Number(r.net_payable || 0), 0)),
    nextDeadline: open.map((r) => String(r.filing_deadline).slice(0, 10)).sort()[0] ?? null,
  };
}
