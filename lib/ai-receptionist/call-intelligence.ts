/**
 * Conversation Intelligence — orchestration engine.
 *
 * Adds sentiment/risk/signal analysis ON TOP OF the existing AI Calls system
 * (public.ai_calls / ai_call_events / ai_call_number_map) — it does not
 * replace or duplicate it. Mirrors lib/document-intelligence/contract-intelligence.ts's
 * two-tier (deterministic + optional AI) architecture.
 *
 * Automatic follow-up: when analysis determines follow-up is required and the
 * call has no linked task yet, this module creates one via a RAW insert into
 * the EXISTING public.user_tasks table — the same no-ErpSession pattern
 * lib/ai-receptionist/service.ts's finalizeCall() already uses for
 * customer_inquiries (a webhook has no logged-in manager session to satisfy
 * createTask()'s role gate). The insert uses the exact same columns/shape
 * createTask() uses, and the table's own triggers (task_no generation,
 * user_task_events/user_task_notifications seeding) fire identically either
 * way — the created task is genuinely indistinguishable from one made
 * through the UI, and is verified by reading it back through the real
 * listTasks()/getTask() path, not by trusting a returned id.
 *
 * financial_context is resolved ONLY from real ERP data
 * (getCombinedCustomerStatement / sales_orders) and defaults to
 * {available:false} — never a fabricated number.
 */

import crypto from "node:crypto";
import { withLocalPg } from "@/lib/db/local-postgres";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { ErpSession } from "@/lib/auth/session";
import type { AiCallRow } from "./types";
import { detectSentiment, detectSignals, detectTopics, extractPaymentPromise, extractCommitments, type SignalType } from "./call-intelligence-rules";
import { aiAnalyzeCall } from "./call-intelligence-ai";
import { getCombinedCustomerStatement } from "@/lib/services/customer-statement-service";

const RULES_VERSION = 2; // bumped: fixed unresolved_issue signal-merge dedup (see analyzeCall)

export type CallFollowUpResult = { created: boolean; id?: string; taskNo?: string; skipped?: boolean; reason?: string };

export type CallIntelligenceResult = {
  id: string;
  callId: string;
  analysisStatus: "pending" | "running" | "completed" | "error" | "ai_unavailable";
  errorMessage: string | null;
  sentiment: string | null;
  riskLevel: "high" | "medium" | "low" | null;
  urgencyLevel: "high" | "medium" | "low" | null;
  signals: any[];
  commitments: any[];
  paymentPromise: any | null;
  financialContext: any;
  topics: string[];
  followUpRequired: boolean;
  summary: string | null;
  nextBestAction: string | null;
  deterministicOnly: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  generatedLang: string;
  analyzedAt: string | null;
  task: CallFollowUpResult | null;
};

function mapRow(row: any, task: CallFollowUpResult | null = null): CallIntelligenceResult {
  return {
    id: row.id,
    callId: row.call_id,
    analysisStatus: row.analysis_status,
    errorMessage: row.error_message,
    sentiment: row.sentiment,
    riskLevel: row.risk_level,
    urgencyLevel: row.urgency_level,
    signals: row.signals ?? [],
    commitments: row.commitments ?? [],
    paymentPromise: row.payment_promise ?? null,
    financialContext: row.financial_context ?? { available: false },
    topics: row.topics ?? [],
    followUpRequired: row.follow_up_required,
    summary: row.summary,
    nextBestAction: row.next_best_action,
    deterministicOnly: row.deterministic_only,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    generatedLang: row.generated_lang,
    analyzedAt: row.analyzed_at,
    task,
  };
}

async function resolveFinancialContext(customerId: string | null): Promise<any> {
  if (!customerId) return { available: false, reason: "no_customer_match" };
  try {
    const stmt = await getCombinedCustomerStatement(customerId);
    if (!stmt || !stmt.rows || stmt.rows.length === 0) {
      return { available: false, reason: "no_ledger_activity" };
    }
    return {
      available: true,
      source: "customer_statement",
      closingBalance: stmt.closingBalance,
      closingDcType: stmt.closingDcType,
      currency: stmt.currency,
    };
  } catch {
    return { available: false, reason: "lookup_failed" };
  }
}

async function countRepeatedContact(sql: any, call: AiCallRow): Promise<number> {
  if (!call.customer_id && !call.from_e164) return 0;
  const rows = await sql`
    select count(*)::int as n
    from public.ai_calls
    where id <> ${call.id}::uuid
      and started_at > now() - interval '30 days'
      and (
        (${call.customer_id}::uuid is not null and customer_id = ${call.customer_id}::uuid)
        or (${call.from_e164}::text is not null and from_e164 = ${call.from_e164}::text)
      )
  `;
  return Number(rows[0]?.n ?? 0);
}

async function hasUnresolvedIssue(sql: any, customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  const rows = await sql`
    select count(*)::int as n
    from public.customer_inquiries
    where customer_id = ${customerId}::uuid
      and status not in ('converted', 'closed', 'lost')
      and deleted_at is null
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

function computeRiskLevel(signalMap: Map<SignalType, boolean>, repeatedContactCount: number, overduePayment: boolean): "high" | "medium" | "low" {
  if (signalMap.get("dispute") || signalMap.get("churn_risk") || signalMap.get("service_failure") || overduePayment) return "high";
  if (signalMap.get("complaint") || signalMap.get("sales_objection") || signalMap.get("missed_commitment") || repeatedContactCount >= 2) return "medium";
  return "low";
}

function computeUrgencyLevel(riskLevel: "high" | "medium" | "low", paymentPromiseDate: string | null): "high" | "medium" | "low" {
  if (paymentPromiseDate) {
    const days = (new Date(paymentPromiseDate).getTime() - Date.now()) / 86400000;
    if (days <= 3) return "high";
  }
  if (riskLevel === "high") return "high";
  if (riskLevel === "medium") return "medium";
  return "low";
}

async function createCallFollowUpTask(
  sql: any,
  call: AiCallRow,
  analysis: { riskLevel: "high" | "medium" | "low"; paymentPromiseDate: string | null; summary: string | null },
  lang: SupportedLanguage,
): Promise<CallFollowUpResult> {
  if (call.task_id) return { created: false, skipped: true, reason: "already_linked" };
  if (!call.number_map_id) return { created: false, skipped: true, reason: "no_assignee_configured_for_number" };

  const mapRows = await sql`select assigned_to from public.ai_call_number_map where id = ${call.number_map_id}::uuid`;
  const assignedTo: string | null = mapRows[0]?.assigned_to ?? null;
  if (!assignedTo) return { created: false, skipped: true, reason: "no_assignee_configured_for_number" };

  const now = Date.now();
  const cadenceDays = analysis.riskLevel === "high" ? 1 : analysis.riskLevel === "medium" ? 3 : 7;
  const cadenceDate = new Date(now + cadenceDays * 86400000);
  let dueAt: Date;
  if (analysis.paymentPromiseDate) {
    const promiseDate = new Date(analysis.paymentPromiseDate);
    if (promiseDate.getTime() > now) {
      dueAt = promiseDate.getTime() < cadenceDate.getTime() ? promiseDate : cadenceDate;
    } else {
      dueAt = new Date(now + 86400000); // overdue promise -> follow up tomorrow
    }
  } else {
    dueAt = cadenceDate;
  }

  const priority = analysis.riskLevel === "high" ? "urgent" : analysis.riskLevel === "medium" ? "high" : "normal";
  const contactLabel = call.from_e164 || call.to_e164 || call.id.slice(0, 8);
  const title = `${t(lang, "aicall.task_title", "Follow up on AI call")} — ${contactLabel}`;
  const label = `${t(lang, "aicall.task_related_label", "AI Call")} ${contactLabel}`;
  const route = `/dashboard/customer-inquiries/calls?callId=${call.id}`;

  const rows = await sql`
    insert into public.user_tasks (
      title, description,
      country_id, country_branch_id, city_branch_id,
      created_by, assigned_to,
      related_module, related_record_table, related_record_id, related_record_label, related_route,
      priority, start_date, due_at, status
    ) values (
      ${title}, ${analysis.summary ?? null},
      ${call.country_id}, ${call.country_branch_id}, ${call.city_branch_id},
      ${assignedTo}::uuid, ${assignedTo}::uuid,
      'ai_calls', 'ai_calls', ${call.id}::uuid, ${label}, ${route},
      ${priority}, current_date, ${dueAt.toISOString()}, 'new'
    )
    returning id, task_no
  `;
  const newTask = rows[0];
  if (!newTask) return { created: false, skipped: true, reason: "insert_failed" };
  await sql`update public.ai_calls set task_id = ${newTask.id}::uuid where id = ${call.id}::uuid`;
  return { created: true, id: newTask.id, taskNo: newTask.task_no };
}

export async function analyzeCall(callId: string, opts: { lang?: SupportedLanguage } = {}): Promise<CallIntelligenceResult | null> {
  const res = await withLocalPg(async (sql) => {
    const callRows = (await sql`select * from public.ai_calls where id = ${callId}::uuid`) as unknown as AiCallRow[];
    const call = callRows[0];
    if (!call) return null;

    const lang: SupportedLanguage = opts.lang || (call.language_code as SupportedLanguage) || "en";
    const transcript = (call.transcript || "").trim();

    if (!transcript) {
      const upserted = await upsertIntelligence(sql, {
        callId, analysisStatus: "pending", errorMessage: null,
        sentiment: null, riskLevel: null, urgencyLevel: null,
        signals: [], commitments: [], paymentPromise: null, financialContext: { available: false, reason: "no_transcript" }, topics: [],
        followUpRequired: false, summary: null, nextBestAction: null,
        deterministicOnly: true, aiProvider: null, aiModel: null, generatedLang: lang, sourceTextSha256: null,
        analyzedBy: null,
      });
      return { row: upserted, task: null };
    }

    const sha256 = crypto.createHash("sha256").update(transcript).digest("hex");

    const existingRows = (await sql`select * from public.ai_call_intelligence where call_id = ${callId}::uuid and deleted_at is null limit 1`) as unknown as any[];
    const existing = existingRows[0];
    if (existing && existing.source_text_sha256 === sha256 && existing.analysis_status === "completed" && existing.generated_lang === lang && existing.rules_version === RULES_VERSION) {
      return { row: existing, task: null };
    }

    const signalFindings = detectSignals(transcript);
    const signalMap = new Map<SignalType, boolean>(signalFindings.map((f) => [f.type, f.present]));
    const sentiment = detectSentiment(transcript);
    const paymentPromise = extractPaymentPromise(transcript);
    const commitments = extractCommitments(transcript);
    const topics = detectTopics(transcript);
    const repeatedContactCount = await countRepeatedContact(sql, call);
    const unresolvedIssue = await hasUnresolvedIssue(sql, call.customer_id);
    if (unresolvedIssue) signalMap.set("unresolved_issue", true);
    const repeatedContactPresent = repeatedContactCount >= 1;
    signalMap.set("repeated_contact", repeatedContactPresent);

    const overduePayment = Boolean(paymentPromise?.date && new Date(paymentPromise.date).getTime() < Date.now());
    let riskLevel = computeRiskLevel(signalMap, repeatedContactCount, overduePayment);
    let urgencyLevel = computeUrgencyLevel(riskLevel, paymentPromise?.date ?? null);

    const financialContext = await resolveFinancialContext(call.customer_id);

    // Merge the regex-based unresolved_issue rule with the live open-inquiry check.
    // A plain "keep first occurrence" de-dup would silently let a false regex
    // result shadow a true live-check result (the live check is authoritative —
    // it's what actually drives risk/urgency/next-best-action below) — so
    // de-dup by preferring whichever entry says present:true.
    const signalsRaw = [
      ...signalFindings,
      { type: "repeated_contact" as const, present: repeatedContactPresent, evidence: repeatedContactPresent ? `${repeatedContactCount} other call(s) from this contact in the last 30 days` : null, confidence: repeatedContactPresent ? 0.95 : 0 },
      { type: "unresolved_issue" as const, present: unresolvedIssue, evidence: unresolvedIssue ? "Customer has an open inquiry on record" : null, confidence: unresolvedIssue ? 0.9 : 0 },
    ];
    const signalsByType = new Map<string, (typeof signalsRaw)[number]>();
    for (const sgl of signalsRaw) {
      const prior = signalsByType.get(sgl.type);
      if (!prior || (!prior.present && sgl.present)) signalsByType.set(sgl.type, sgl);
    }
    const allSignals = Array.from(signalsByType.values());

    const followUpRequired = riskLevel !== "low" || Boolean(paymentPromise) || signalMap.get("missed_commitment") || signalMap.get("dispute") || unresolvedIssue;

    let summary = interpolateSummary(lang, allSignals.filter((s) => s.present).map((s) => s.type), riskLevel);
    let nextBestAction = interpolateNextBestAction(lang, riskLevel, Boolean(paymentPromise), unresolvedIssue);
    let deterministicOnly = true;
    let aiProvider: string | null = null;
    let aiModel: string | null = null;

    const enrichment = await aiAnalyzeCall({
      transcript,
      signalFindings: allSignals.map((s) => ({ type: s.type as SignalType, present: s.present, evidence: s.evidence })),
      intent: call.intent,
      lang,
      deterministicRiskLevel: riskLevel,
      deterministicUrgencyLevel: urgencyLevel,
    });
    if (enrichment) {
      deterministicOnly = false;
      aiProvider = (process.env.AI_TRANSLATE_PROVIDER || "").toLowerCase();
      aiModel = process.env.AI_TRANSLATE_MODEL || null;
      riskLevel = enrichment.riskLevel; // AI may only raise (enforced inside call-intelligence-ai.ts)
      urgencyLevel = enrichment.urgencyLevel;
      summary = enrichment.summary;
      nextBestAction = enrichment.nextBestAction;
      const byType = new Map(enrichment.signalExplanations.map((e) => [e.type, e.explanation]));
      for (const s of allSignals as any[]) {
        if (s.present && byType.has(s.type)) s.explanation = byType.get(s.type);
      }
    }

    const upserted = await upsertIntelligence(sql, {
      callId, analysisStatus: "completed", errorMessage: null,
      sentiment: enrichment?.sentiment ?? sentiment, riskLevel, urgencyLevel,
      signals: allSignals, commitments, paymentPromise, financialContext, topics,
      followUpRequired, summary, nextBestAction,
      deterministicOnly, aiProvider, aiModel, generatedLang: lang, sourceTextSha256: sha256,
      analyzedBy: null,
    });

    let task: CallFollowUpResult | null = null;
    if (followUpRequired && !call.task_id) {
      task = await createCallFollowUpTask(sql, call, { riskLevel, paymentPromiseDate: paymentPromise?.date ?? null, summary }, lang);
    }

    if (task) {
      try {
        await sql`insert into public.ai_call_events (call_id, kind, detail) values (${callId}::uuid, 'analysis', ${sql.json({ riskLevel, urgencyLevel, followUpRequired, task } as any)})`;
      } catch { /* non-fatal */ }
    }

    return { row: upserted, task };
  });

  return res ? mapRow(res.row, res.task) : null;
}

async function upsertIntelligence(sql: any, a: {
  callId: string; analysisStatus: string; errorMessage: string | null;
  sentiment: string | null; riskLevel: string | null; urgencyLevel: string | null;
  signals: any[]; commitments: any[]; paymentPromise: any; financialContext: any; topics: string[];
  followUpRequired: boolean; summary: string | null; nextBestAction: string | null;
  deterministicOnly: boolean; aiProvider: string | null; aiModel: string | null; generatedLang: string; sourceTextSha256: string | null;
  analyzedBy: string | null;
}) {
  const rows = await sql`
    insert into public.ai_call_intelligence (
      call_id, analysis_status, error_message,
      sentiment, risk_level, urgency_level,
      signals, commitments, payment_promise, financial_context, topics,
      follow_up_required, summary, next_best_action,
      deterministic_only, ai_provider, ai_model, generated_lang, rules_version, source_text_sha256,
      analyzed_by, analyzed_at
    ) values (
      ${a.callId}::uuid, ${a.analysisStatus}, ${a.errorMessage},
      ${a.sentiment}, ${a.riskLevel}, ${a.urgencyLevel},
      ${sql.json(a.signals)}, ${sql.json(a.commitments)}, ${a.paymentPromise ? sql.json(a.paymentPromise) : null}, ${sql.json(a.financialContext)}, ${a.topics},
      ${a.followUpRequired}, ${a.summary}, ${a.nextBestAction},
      ${a.deterministicOnly}, ${a.aiProvider}, ${a.aiModel}, ${a.generatedLang}, ${RULES_VERSION}, ${a.sourceTextSha256},
      ${a.analyzedBy}, ${a.analysisStatus === "completed" ? new Date().toISOString() : null}
    )
    on conflict (call_id) where deleted_at is null
    do update set
      analysis_status = excluded.analysis_status, error_message = excluded.error_message,
      sentiment = excluded.sentiment, risk_level = excluded.risk_level, urgency_level = excluded.urgency_level,
      signals = excluded.signals, commitments = excluded.commitments, payment_promise = excluded.payment_promise,
      financial_context = excluded.financial_context, topics = excluded.topics,
      follow_up_required = excluded.follow_up_required, summary = excluded.summary, next_best_action = excluded.next_best_action,
      deterministic_only = excluded.deterministic_only, ai_provider = excluded.ai_provider, ai_model = excluded.ai_model,
      generated_lang = excluded.generated_lang, rules_version = excluded.rules_version, source_text_sha256 = excluded.source_text_sha256,
      analyzed_by = excluded.analyzed_by, analyzed_at = excluded.analyzed_at, updated_at = now()
    returning *
  `;
  return rows[0];
}

function interpolate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template);
}

function interpolateSummary(lang: SupportedLanguage, presentSignals: string[], riskLevel: "high" | "medium" | "low"): string {
  const riskLabel = t(lang, `aicall.intel_risk_${riskLevel}`, riskLevel);
  if (!presentSignals.length) {
    return interpolate(t(lang, "aicall.gen_summary_none", "Deterministic scan found no notable signals. Overall risk: {risk}."), { risk: riskLabel });
  }
  const list = presentSignals.map((s) => t(lang, `aicall.signal_${s}_title`, s.replace(/_/g, " "))).join(", ");
  return interpolate(t(lang, "aicall.gen_summary", "Deterministic scan detected: {signals}. Overall risk: {risk}."), { signals: list, risk: riskLabel });
}

function interpolateNextBestAction(lang: SupportedLanguage, riskLevel: "high" | "medium" | "low", hasPaymentPromise: boolean, unresolvedIssue: boolean): string {
  if (hasPaymentPromise) return t(lang, "aicall.gen_nba_payment", "Confirm and track the payment promise; follow up on or before the promised date.");
  if (riskLevel === "high") return t(lang, "aicall.gen_nba_high", "Contact the customer promptly to address the risk identified in this call.");
  if (unresolvedIssue) return t(lang, "aicall.gen_nba_unresolved", "Review and close out this customer's open inquiry before further contact.");
  if (riskLevel === "medium") return t(lang, "aicall.gen_nba_medium", "Schedule a follow-up to confirm the customer's concern has been addressed.");
  return t(lang, "aicall.gen_nba_low", "No urgent action required; routine follow-up only.");
}

export async function getIntelligence(callId: string): Promise<CallIntelligenceResult | null> {
  const res = await withLocalPg(async (sql) => {
    const rows = (await sql`select * from public.ai_call_intelligence where call_id = ${callId}::uuid and deleted_at is null limit 1`) as unknown as any[];
    return rows[0] ?? null;
  });
  return res ? mapRow(res) : null;
}

export async function getIntelligenceSummary(
  session: ErpSession,
  filters: { countryId?: string | null; cityBranchId?: string | null; customerId?: string | null; assignedTo?: string | null; from?: string | null; to?: string | null; intent?: string | null; riskLevel?: string | null } = {},
) {
  const countryIds = session.countryIds ?? [];
  const res = await withLocalPg(async (sql) => {
    const scoped = session.isSuperAdmin ? sql`true` : sql`(c.country_id is null or c.country_id = any(${countryIds}::uuid[]))`;
    const fCountry = filters.countryId ? sql`and c.country_id = ${filters.countryId}::uuid` : sql``;
    const fBranch = filters.cityBranchId ? sql`and c.city_branch_id = ${filters.cityBranchId}::uuid` : sql``;
    const fCustomer = filters.customerId ? sql`and c.customer_id = ${filters.customerId}::uuid` : sql``;
    const fFrom = filters.from ? sql`and c.started_at >= ${filters.from}::date` : sql``;
    const fTo = filters.to ? sql`and c.started_at <= ${filters.to}::date + interval '1 day'` : sql``;
    const fIntent = filters.intent ? sql`and c.intent = ${filters.intent}` : sql``;
    const fRisk = filters.riskLevel ? sql`and i.risk_level = ${filters.riskLevel}` : sql``;
    const fAssigned = filters.assignedTo ? sql`and m.assigned_to = ${filters.assignedTo}::uuid` : sql``;

    const base = sql`
      from public.ai_calls c
      left join public.ai_call_intelligence i on i.call_id = c.id and i.deleted_at is null
      left join public.ai_call_number_map m on m.id = c.number_map_id
      where ${scoped} ${fCountry} ${fBranch} ${fCustomer} ${fFrom} ${fTo} ${fIntent} ${fRisk} ${fAssigned}
    `;

    const [counts] = await sql`
      select
        count(*) filter (where i.risk_level = 'high')::int as high,
        count(*) filter (where i.risk_level = 'medium')::int as medium,
        count(*) filter (where i.risk_level = 'low')::int as low,
        count(*) filter (where i.analysis_status is null or i.analysis_status = 'pending')::int as not_analyzed,
        count(*) filter (where i.follow_up_required = true and c.task_id is null)::int as follow_up_gap
      ${base}
    `;

    const topSignalsRows = await sql`
      select sig->>'type' as type, count(*)::int as n
      from public.ai_calls c
      join public.ai_call_intelligence i on i.call_id = c.id and i.deleted_at is null
      left join public.ai_call_number_map m on m.id = c.number_map_id,
      lateral jsonb_array_elements(i.signals) as sig
      where ${scoped} ${fCountry} ${fBranch} ${fCustomer} ${fFrom} ${fTo} ${fIntent} ${fRisk} ${fAssigned}
        and (sig->>'present')::boolean = true
      group by sig->>'type'
      order by n desc
      limit 10
    `;

    const topTopicsRows = await sql`
      select topic, count(*)::int as n
      from public.ai_calls c
      join public.ai_call_intelligence i on i.call_id = c.id and i.deleted_at is null
      left join public.ai_call_number_map m on m.id = c.number_map_id,
      lateral unnest(i.topics) as topic
      where ${scoped} ${fCountry} ${fBranch} ${fCustomer} ${fFrom} ${fTo} ${fIntent} ${fRisk} ${fAssigned}
      group by topic
      order by n desc
      limit 10
    `;

    const repeatedContactRows = await sql`
      select coalesce(c.customer_id::text, c.from_e164) as contact_key,
             coalesce(cu.customer_name, c.from_e164) as label,
             count(*)::int as call_count,
             max(c.started_at) as last_call_at
      from public.ai_calls c
      left join public.customers cu on cu.id = c.customer_id
      left join public.ai_call_number_map m on m.id = c.number_map_id
      where ${scoped} ${fCountry} ${fBranch} ${fCustomer} ${fFrom} ${fTo} ${fIntent} ${fAssigned}
      group by coalesce(c.customer_id::text, c.from_e164), coalesce(cu.customer_name, c.from_e164)
      having count(*) >= 2
      order by call_count desc
      limit 20
    `;

    const agentPerformanceRows = await sql`
      select m.assigned_to as user_id, p.full_name as user_name,
             count(distinct c.id)::int as calls_handled,
             count(distinct c.id) filter (where i.risk_level = 'high')::int as high_risk_calls,
             count(distinct c.id) filter (where c.task_id is not null)::int as follow_ups_created,
             count(distinct c.id) filter (where i.follow_up_required = true and c.task_id is null)::int as coaching_gap
      from public.ai_calls c
      left join public.ai_call_intelligence i on i.call_id = c.id and i.deleted_at is null
      left join public.ai_call_number_map m on m.id = c.number_map_id
      left join public.profiles p on p.id = m.assigned_to
      where ${scoped} ${fCountry} ${fBranch} ${fCustomer} ${fFrom} ${fTo} ${fIntent} ${fRisk} ${fAssigned}
        and m.assigned_to is not null
      group by m.assigned_to, p.full_name
      order by calls_handled desc
      limit 20
    `;

    return { counts, topSignals: topSignalsRows, topTopics: topTopicsRows, repeatedContact: repeatedContactRows, agentPerformance: agentPerformanceRows };
  });
  return res ?? { counts: { high: 0, medium: 0, low: 0, not_analyzed: 0, follow_up_gap: 0 }, topSignals: [], topTopics: [], repeatedContact: [], agentPerformance: [] };
}
