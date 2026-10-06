/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UAE Corporate Tax — part of the existing UAE Tax & E-Invoicing module.
 *
 * One CT return working per tax entity (uae_tax_entities: company + TRN) per financial year:
 *   accounting profit ± adjustments → taxable income → loss relief (≤ 75%) → 9% above AED 375,000
 *   (Small Business Relief: nil if revenue ≤ AED 3,000,000; Qualifying Free Zone Person: 0% on
 *   qualifying income, 9% on the rest). Deadline = 9 months after the financial year end.
 * draft → in_preparation → ready_for_review → reviewed → filed → paid (cancel before review).
 * 'filed' / 'paid' only RECORD the EmaraTax reference — nothing is sent to the FTA and no
 * accounting entry is posted here. Evidence lives in the Document Manager; the deadline reminder
 * is an existing User Task.
 */
import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg, withReadPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";
import { createTask } from "@/lib/user-tasks/service";

export const CT_RATE = 0.09;
export const CT_THRESHOLD = 375_000;
export const SBR_REVENUE_LIMIT = 3_000_000;
export const LOSS_RELIEF_CAP = 0.75;
export const CT_DOC_KEYS = [
  "audited_financials", "trial_balance", "fixed_asset_register", "related_party_schedule",
  "transfer_pricing_disclosure", "ct_registration_certificate", "free_zone_evidence", "sbr_revenue_evidence",
] as const;
export type CtAction = "start" | "ready" | "review" | "back" | "file" | "pay" | "cancel";
type Adj = { category: "add_back" | "deduction" | "exempt_income"; amount: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const bad = (m: string, code = "VALIDATION") => new ApiClientError(m, { status: 400, code });
const notFound = () => new ApiClientError("Corporate Tax return not found.", { status: 404, code: "NOT_FOUND" });
const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? "").slice(0, 10));

/** Pure CT computation (unit-tested). */
export function computeCt(i: {
  accountingProfit: number; adjustments: Adj[]; smallBusinessRelief: boolean; revenue: number | null;
  qualifyingFreeZone: boolean; qualifyingIncome: number; lossesBroughtForward: number;
}) {
  const sum = (c: Adj["category"]) => r2(i.adjustments.filter((a) => a.category === c).reduce((x, a) => x + Number(a.amount || 0), 0));
  const addBacks = sum("add_back"), deductions = sum("deduction"), exempt = sum("exempt_income");
  const adjusted = r2(i.accountingProfit + addBacks - deductions - exempt);
  if (i.smallBusinessRelief) {
    if (i.revenue == null) throw bad("Enter the financial-year revenue to claim Small Business Relief.", "SBR_REVENUE_REQUIRED");
    if (i.revenue > SBR_REVENUE_LIMIT) throw bad("Small Business Relief needs revenue of AED 3,000,000 or less.", "SBR_NOT_ELIGIBLE");
    return { regime: "small_business_relief", addBacks, deductions, exempt, adjusted, taxableIncome: 0, lossReliefUsed: 0, taxPayable: 0, lossCarriedForward: adjusted < 0 ? -adjusted : 0 };
  }
  if (adjusted <= 0) {
    return { regime: i.qualifyingFreeZone ? "qualifying_free_zone" : "standard", addBacks, deductions, exempt, adjusted, taxableIncome: 0, lossReliefUsed: 0, taxPayable: 0, lossCarriedForward: r2(-adjusted + i.lossesBroughtForward) };
  }
  if (i.qualifyingFreeZone) {
    const nonQualifying = Math.max(0, r2(adjusted - i.qualifyingIncome));
    const relief = r2(Math.min(i.lossesBroughtForward, nonQualifying * LOSS_RELIEF_CAP));
    const taxable = r2(nonQualifying - relief);
    return { regime: "qualifying_free_zone", addBacks, deductions, exempt, adjusted, taxableIncome: taxable, lossReliefUsed: relief, taxPayable: r2(taxable * CT_RATE), lossCarriedForward: r2(i.lossesBroughtForward - relief) };
  }
  const relief = r2(Math.min(i.lossesBroughtForward, adjusted * LOSS_RELIEF_CAP));
  const taxable = r2(adjusted - relief);
  return { regime: "standard", addBacks, deductions, exempt, adjusted, taxableIncome: taxable, lossReliefUsed: relief, taxPayable: r2(Math.max(0, taxable - CT_THRESHOLD) * CT_RATE), lossCarriedForward: r2(i.lossesBroughtForward - relief) };
}

export function filingDeadline(fyEnd: string): string {
  const [y, m, d] = fyEnd.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + 9, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

// ── access ──────────────────────────────────────────────────────────────────

const inScope = (scope: UaeTaxScope, countryId: string | null) => scope.countryIds == null || (!!countryId && scope.countryIds.includes(countryId));

async function loadReturn(scope: UaeTaxScope, id: string) {
  const r = ((await withReadPg((sql) => sql`SELECT * FROM public.uae_ct_returns WHERE id = ${id}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!r || !inScope(scope, r.country_id)) throw notFound();
  return r;
}

async function event(sql: any, id: string, s: ErpSession, action: string, from: string | null, to: string | null, detail: Record<string, unknown> = {}) {
  await sql`INSERT INTO public.uae_ct_events (return_id, action, from_status, to_status, detail, actor_id, actor_name)
            VALUES (${id}::uuid, ${action}, ${from}, ${to}, ${sql.json(detail as any)}, ${s.userId}::uuid, ${s.fullName ?? null})`;
}

// ── queries ─────────────────────────────────────────────────────────────────

export async function listReturns(scope: UaeTaxScope) {
  return ((await withReadPg((sql) => sql`
    SELECT r.id, r.return_no, r.tax_entity_id, r.fy_start, r.fy_end, r.filing_deadline, r.status, r.taxable_income, r.tax_payable,
           r.filing_reference, r.paid_amount, r.responsible_user_id, e.legal_name, e.trn, c.name AS company_name, p.full_name AS responsible_name,
           (SELECT count(*) FROM public.uae_ct_documents d WHERE d.return_id = r.id AND d.status = 'missing')::int AS missing_docs,
           (r.filing_deadline - current_date) AS days_to_deadline
    FROM public.uae_ct_returns r
    JOIN public.uae_tax_entities e ON e.id = r.tax_entity_id
    LEFT JOIN public.companies c ON c.id = r.company_id
    LEFT JOIN public.profiles p ON p.id = r.responsible_user_id
    WHERE r.deleted_at IS NULL AND (${scope.countryIds == null} OR r.country_id = ANY(${scope.countryIds ?? []}::uuid[]))
    ORDER BY r.fy_end DESC, e.legal_name
  `)) ?? []) as any[];
}

export async function getReturn(scope: UaeTaxScope, id: string) {
  const r = await loadReturn(scope, id);
  const [adj, docs, events, meta] = await Promise.all([
    withReadPg((sql) => sql`SELECT * FROM public.uae_ct_adjustments WHERE return_id = ${id}::uuid ORDER BY sort_order, created_at`),
    withReadPg((sql) => sql`SELECT d.*, od.title AS document_title FROM public.uae_ct_documents d LEFT JOIN public.office_documents od ON od.id = d.document_id WHERE d.return_id = ${id}::uuid ORDER BY d.doc_key`),
    withReadPg((sql) => sql`SELECT * FROM public.uae_ct_events WHERE return_id = ${id}::uuid ORDER BY created_at DESC`),
    withReadPg((sql) => sql`
      SELECT e.legal_name, e.trn, c.name AS company_name, c.company_code, p.full_name AS responsible_name, t.task_no AS reminder_task_no, t.status AS reminder_task_status
      FROM public.uae_tax_entities e LEFT JOIN public.companies c ON c.id = ${r.company_id ?? null}::uuid
      LEFT JOIN public.profiles p ON p.id = ${r.responsible_user_id ?? null}::uuid
      LEFT JOIN public.user_tasks t ON t.id = ${r.reminder_task_id ?? null}::uuid
      WHERE e.id = ${r.tax_entity_id}::uuid`),
  ]);
  const docsArr = (docs ?? []) as any[];
  return {
    ctReturn: r, adjustments: adj ?? [], documents: docsArr, events: events ?? [], meta: (meta as any[])?.[0] ?? null,
    missingDocuments: docsArr.filter((d) => d.status === "missing").map((d) => d.doc_key),
    editable: ["draft", "in_preparation"].includes(r.status),
  };
}

// ── commands ────────────────────────────────────────────────────────────────

export async function createReturn(
  s: ErpSession, scope: UaeTaxScope,
  input: { taxEntityId: string; fyStart: string; fyEnd: string; ctTrn?: string | null; responsibleUserId?: string | null }
) {
  const ent = ((await withReadPg((sql) => sql`SELECT id, country_id, company_id, legal_name FROM public.uae_tax_entities WHERE id = ${input.taxEntityId}::uuid AND deleted_at IS NULL`)) as any[] | null)?.[0];
  if (!ent || !inScope(scope, ent.country_id)) throw new ApiClientError("Tax entity not found.", { status: 404, code: "NOT_FOUND" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fyStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.fyEnd) || input.fyEnd <= input.fyStart) throw bad("Enter a valid financial year (start before end).");
  const months = (Number(input.fyEnd.slice(0, 4)) - Number(input.fyStart.slice(0, 4))) * 12 + Number(input.fyEnd.slice(5, 7)) - Number(input.fyStart.slice(5, 7));
  if (months > 18) throw bad("A Corporate Tax period cannot exceed 18 months.");
  if (input.ctTrn && !/^\d{15}$/.test(input.ctTrn)) throw bad("Corporate Tax TRN must be 15 digits.", "CT_TRN");
  const deadline = filingDeadline(input.fyEnd);
  let created: { id: string; returnNo: string };
  try {
    created = (await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
      const n = ((await tx`SELECT count(*)::int AS n FROM public.uae_ct_returns`) as any[])[0].n + 1;
      const no = `CT-${input.fyEnd.slice(0, 4)}-${String(n).padStart(5, "0")}`;
      const row = ((await tx`
        INSERT INTO public.uae_ct_returns (return_no, tax_entity_id, company_id, country_id, ct_trn, fy_start, fy_end, filing_deadline, responsible_user_id, created_by)
        VALUES (${no}, ${ent.id}::uuid, ${ent.company_id ?? null}::uuid, ${ent.country_id}::uuid, ${input.ctTrn ?? null}, ${input.fyStart}::date, ${input.fyEnd}::date,
                ${deadline}::date, ${input.responsibleUserId ?? s.userId}::uuid, ${s.userId}::uuid)
        RETURNING id`) as any[])[0];
      for (const k of CT_DOC_KEYS) {
        const na = k === "free_zone_evidence" || k === "sbr_revenue_evidence";
        await tx`INSERT INTO public.uae_ct_documents (return_id, doc_key, status) VALUES (${row.id}::uuid, ${k}, ${na ? "not_applicable" : "missing"})`;
      }
      await event(tx, row.id, s, "created", null, "draft", { fy: `${input.fyStart}..${input.fyEnd}`, deadline });
      return { id: row.id as string, returnNo: no };
    })))!;
  } catch (e: any) {
    if (String(e?.code) === "23505") throw new ApiClientError("A Corporate Tax return already exists for this entity and financial year.", { status: 409, code: "CT_EXISTS" });
    throw e;
  }
  // Deadline reminder on the existing User Tasks (30 days before the deadline, or today if later).
  let reminder: Record<string, unknown> = {};
  try {
    const due = new Date(`${deadline}T12:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() - 30);
    const dueAt = due.getTime() < Date.now() ? new Date(Date.now() + 86400000).toISOString() : due.toISOString();
    const t = await createTask(s, {
      title: `Corporate Tax return ${created.returnNo} — ${ent.legal_name} (deadline ${deadline})`,
      assignedTo: input.responsibleUserId ?? s.userId, relatedModule: "tax_compliance", relatedRecordTable: "uae_ct_returns",
      relatedRecordId: created.id, relatedRecordLabel: `${created.returnNo} · ${ent.legal_name}`,
      relatedRoute: `/dashboard/tax-einvoicing/uae/corporate-tax?return=${created.id}`, priority: "high", dueAt, countryId: ent.country_id,
    });
    await withReadPg((sql) => sql`UPDATE public.uae_ct_returns SET reminder_task_id = ${t.id}::uuid WHERE id = ${created.id}::uuid`);
    reminder = { reminderTask: t.taskNo };
  } catch (e) {
    reminder = { reminderSkipped: (e as Error).message };
  }
  await withLocalPg((sql) => event(sql, created.id, s, "reminder", "draft", "draft", reminder));
  return { ...created, filingDeadline: deadline, ...reminder };
}

export async function updateWorking(
  s: ErpSession, scope: UaeTaxScope, id: string,
  input: {
    accountingProfit?: number | null; accountingProfitSource?: string | null; revenue?: number | null; smallBusinessRelief?: boolean;
    qualifyingFreeZone?: boolean; qualifyingIncome?: number; taxLossesBroughtForward?: number; ctTrn?: string | null; notes?: string | null;
    responsibleUserId?: string | null;
    adjustments?: Array<{ category: Adj["category"]; description: string; amount: number; reference?: string | null }>;
  }
) {
  const r = await loadReturn(scope, id);
  if (!["draft", "in_preparation"].includes(r.status)) throw new ApiClientError("Only a draft or in-preparation return can be edited.", { status: 409, code: "NOT_EDITABLE" });
  if (input.ctTrn && !/^\d{15}$/.test(input.ctTrn)) throw bad("Corporate Tax TRN must be 15 digits.", "CT_TRN");
  if (input.smallBusinessRelief && input.qualifyingFreeZone) throw bad("Small Business Relief and Qualifying Free Zone Person cannot both apply.", "RELIEF_CONFLICT");
  return withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.uae_ct_returns SET
      accounting_profit = ${input.accountingProfit !== undefined ? input.accountingProfit : r.accounting_profit},
      accounting_profit_source = ${input.accountingProfitSource !== undefined ? input.accountingProfitSource : r.accounting_profit_source},
      revenue = ${input.revenue !== undefined ? input.revenue : r.revenue},
      small_business_relief = ${input.smallBusinessRelief ?? r.small_business_relief},
      qualifying_free_zone = ${input.qualifyingFreeZone ?? r.qualifying_free_zone},
      qualifying_income = ${input.qualifyingIncome ?? r.qualifying_income},
      tax_losses_brought_forward = ${input.taxLossesBroughtForward ?? r.tax_losses_brought_forward},
      ct_trn = ${input.ctTrn !== undefined ? input.ctTrn : r.ct_trn},
      notes = ${input.notes !== undefined ? input.notes : r.notes},
      responsible_user_id = ${input.responsibleUserId !== undefined ? input.responsibleUserId : r.responsible_user_id}::uuid,
      status = CASE WHEN status = 'draft' THEN 'in_preparation' ELSE status END,
      updated_at = now()
      WHERE id = ${id}::uuid`;
    if (input.adjustments) {
      await tx`DELETE FROM public.uae_ct_adjustments WHERE return_id = ${id}::uuid`;
      let i = 0;
      for (const a of input.adjustments) {
        if (!a.description?.trim()) throw bad("Every adjustment needs a description.");
        if (!(Number(a.amount) >= 0)) throw bad("Adjustment amounts are entered as positive numbers; the category sets the direction.");
        await tx`INSERT INTO public.uae_ct_adjustments (return_id, category, description, amount, reference, sort_order)
                 VALUES (${id}::uuid, ${a.category}, ${a.description.trim()}, ${Number(a.amount)}, ${a.reference ?? null}, ${i++})`;
      }
    }
    const fresh = ((await tx`SELECT * FROM public.uae_ct_returns WHERE id = ${id}::uuid`) as any[])[0];
    // Relief-specific evidence becomes required only when that relief is claimed.
    await tx`UPDATE public.uae_ct_documents SET status = CASE WHEN ${fresh.qualifying_free_zone} THEN (CASE WHEN status = 'not_applicable' THEN 'missing' ELSE status END) ELSE 'not_applicable' END
             WHERE return_id = ${id}::uuid AND doc_key = 'free_zone_evidence'`;
    await tx`UPDATE public.uae_ct_documents SET status = CASE WHEN ${fresh.small_business_relief} THEN (CASE WHEN status = 'not_applicable' THEN 'missing' ELSE status END) ELSE 'not_applicable' END
             WHERE return_id = ${id}::uuid AND doc_key = 'sbr_revenue_evidence'`;
    let computed: any = null;
    if (fresh.accounting_profit != null) {
      const adj = (await tx`SELECT category, amount FROM public.uae_ct_adjustments WHERE return_id = ${id}::uuid`) as any[];
      computed = computeCt({
        accountingProfit: Number(fresh.accounting_profit), adjustments: adj.map((a) => ({ category: a.category, amount: Number(a.amount) })),
        smallBusinessRelief: fresh.small_business_relief, revenue: fresh.revenue == null ? null : Number(fresh.revenue),
        qualifyingFreeZone: fresh.qualifying_free_zone, qualifyingIncome: Number(fresh.qualifying_income || 0), lossesBroughtForward: Number(fresh.tax_losses_brought_forward || 0),
      });
      await tx`UPDATE public.uae_ct_returns SET taxable_income = ${computed.taxableIncome}, loss_relief_used = ${computed.lossReliefUsed}, tax_payable = ${computed.taxPayable}, computed_at = now() WHERE id = ${id}::uuid`;
    }
    await event(tx, id, s, "updated", r.status, r.status === "draft" ? "in_preparation" : r.status, computed ? { taxableIncome: computed.taxableIncome, taxPayable: computed.taxPayable, regime: computed.regime } : {});
    return { id, computed };
  }));
}

export async function setDocument(s: ErpSession, scope: UaeTaxScope, id: string, input: { docKey: string; status: "missing" | "received" | "not_applicable"; documentId?: string | null; notes?: string | null }) {
  const r = await loadReturn(scope, id);
  if (["filed", "paid", "cancelled"].includes(r.status)) throw new ApiClientError("The document checklist is locked after filing.", { status: 409, code: "LOCKED" });
  if (!(CT_DOC_KEYS as readonly string[]).includes(input.docKey)) throw bad("Unknown document.");
  if (input.documentId) {
    const doc = ((await withReadPg((sql) => sql`SELECT id FROM public.office_documents WHERE id = ${input.documentId ?? null}::uuid`)) as any[] | null)?.[0];
    if (!doc) throw bad("That document is not in the Document Manager.", "DOC_NOT_FOUND");
  }
  if (input.status === "received" && !input.documentId && !input.notes?.trim()) throw bad("Link the Document Manager file or note where the evidence is kept.", "EVIDENCE_REQUIRED");
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    await tx`UPDATE public.uae_ct_documents SET status = ${input.status}, document_id = ${input.documentId ?? null}::uuid, notes = ${input.notes ?? null}, updated_by = ${s.userId}::uuid, updated_at = now()
             WHERE return_id = ${id}::uuid AND doc_key = ${input.docKey}`;
    await event(tx, id, s, "document", r.status, r.status, { docKey: input.docKey, status: input.status, documentId: input.documentId ?? null });
  }));
  return { id, docKey: input.docKey, status: input.status };
}

export async function actOnReturn(s: ErpSession, scope: UaeTaxScope, id: string, action: CtAction, input: { reference?: string | null; amount?: number | null; reason?: string | null } = {}) {
  const r = await loadReturn(scope, id);
  const T: Record<CtAction, { from: string[]; to: string }> = {
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
    if (r.taxable_income == null) throw bad("Enter the accounting profit so the taxable income is computed.", "NOT_COMPUTED");
    const missing = ((await withReadPg((sql) => sql`SELECT doc_key FROM public.uae_ct_documents WHERE return_id = ${id}::uuid AND status = 'missing'`)) ?? []) as any[];
    if (missing.length) throw new ApiClientError("Some required documents are still missing.", { status: 400, code: "DOCS_MISSING", details: { missing: missing.map((m) => m.doc_key) } });
  }
  if (action === "review") {
    const prepared = ((await withReadPg((sql) => sql`SELECT actor_id FROM public.uae_ct_events WHERE return_id = ${id}::uuid AND to_status = 'ready_for_review' ORDER BY created_at DESC LIMIT 1`)) as any[] | null)?.[0];
    if (prepared?.actor_id === s.userId && !s.isSuperAdmin) throw new ApiClientError("A different person must review the return than the one who prepared it.", { status: 403, code: "FOUR_EYES" });
  }
  if (action === "file" && !ref) throw bad("Enter the EmaraTax filing reference.", "REFERENCE_REQUIRED");
  if (action === "pay") {
    if (!ref) throw bad("Enter the payment reference.", "REFERENCE_REQUIRED");
    if (!(Number(input.amount) > 0)) throw bad("Enter the amount paid.", "AMOUNT_REQUIRED");
  }
  await withLocalPg(async (sql) => sql.begin(async (tx: any) => {
    const u = (await tx`
      UPDATE public.uae_ct_returns SET status = ${t.to}, updated_at = now(),
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

export async function ctDashboard(scope: UaeTaxScope) {
  const rows = await listReturns(scope);
  const open = rows.filter((r) => !["filed", "paid", "cancelled"].includes(r.status));
  return {
    total: rows.filter((r) => r.status !== "cancelled").length,
    open: open.length,
    dueIn60: open.filter((r) => Number(r.days_to_deadline) <= 60).length,
    overdue: open.filter((r) => Number(r.days_to_deadline) < 0).length,
    missingDocs: open.reduce((a, r) => a + Number(r.missing_docs || 0), 0),
    taxPayableOpen: r2(open.reduce((a, r) => a + Number(r.tax_payable || 0), 0)),
    nextDeadline: open.map((r) => iso(r.filing_deadline)).sort()[0] ?? null,
  };
}
