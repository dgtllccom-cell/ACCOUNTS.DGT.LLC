/**
 * Contract Intelligence — orchestration engine.
 *
 * Adds clause/risk/obligation analysis ON TOP OF the existing Central
 * Contract Control Center (erp_contract_register_v) and the existing AI
 * Document Intake engine (document_intake_jobs / getDocumentAiProvider) —
 * it does not replace or duplicate either.
 *
 * Document resolution order for a (sourceModule, sourceId) contract:
 *   1. A matched document_intake_jobs row (matched_source_module/
 *      matched_source_id — set when a user confirms a match in the existing
 *      Document Intake review screen).
 *   2. A contract_reference text match against the contract's contract_no /
 *      manual_contract_no (secondary heuristic for jobs not yet matched).
 *   3. A plain office_documents attachment for the same source record (the
 *      real primary path today for Purchase/Sales and the only path for
 *      Employee contracts, since document_intake_jobs has no employee
 *      linkage).
 *   4. None found -> analysis_status='pending', source_kind='none'.
 *
 * Deterministic tier always runs (zero AI config required). AI tier
 * (contract-intelligence-ai.ts) only enriches when configured, and never
 * overrides a deterministic fact.
 */

import crypto from "node:crypto";
import { withLocalPg } from "@/lib/db/local-postgres";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getDocumentAiProvider } from "@/lib/document-intelligence/providers";
import { readIntakeFile } from "@/lib/document-intelligence/storage";
import { readDocumentFileBuffer } from "@/lib/documents/document-storage";
import { CLAUSE_RULES, detectClausePresence, extractNoticePeriodDays } from "@/lib/document-intelligence/contract-clause-rules";
import { aiAnalyzeContract, type DeterministicClauseFinding } from "@/lib/document-intelligence/contract-intelligence-ai";

export type ContractIntelligenceResult = {
  id: string;
  sourceModule: string;
  sourceId: string;
  sourceKind: "document_intake" | "office_document" | "none";
  analysisStatus: "pending" | "running" | "completed" | "error" | "ai_unavailable";
  errorMessage: string | null;
  overallRiskLevel: "high" | "medium" | "low" | "unknown" | null;
  riskSummary: string | null;
  clauses: any[];
  obligations: any[];
  missingClauses: any[];
  renewal: any | null;
  termination: any | null;
  paymentWarnings: any[];
  keyDates: any[];
  deterministicOnly: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  analyzedAt: string | null;
};

function interpolate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template);
}

const REQUIRED_CONTRACT_TYPE_MAP: Record<string, string> = {
  purchase_order: "purchase_order",
  sales_order: "sales_order",
  hr_employee: "employment",
};

async function resolveDocumentSource(sourceModule: string, sourceId: string, contractRef: { contractNo: string | null; manualContractNo: string | null }) {
  return withLocalPg(async (sql) => {
    // 1. Matched Document Intake job
    const jobs = await sql`
      SELECT id, storage_key, doc_type_code, mime_type
      FROM public.document_intake_jobs
      WHERE matched_source_module = ${sourceModule} AND matched_source_id = ${sourceId}
        AND match_status <> 'out_of_scope' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (jobs[0]) return { kind: "document_intake" as const, job: jobs[0], officeDocId: null as string | null };

    // 2. contract_reference text match (secondary heuristic)
    const refs = [contractRef.contractNo, contractRef.manualContractNo].filter(Boolean) as string[];
    if (refs.length) {
      const byRef = await sql`
        SELECT id, storage_key, doc_type_code, mime_type
        FROM public.document_intake_jobs
        WHERE contract_reference = ANY(${refs}) AND match_status <> 'out_of_scope' AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `;
      if (byRef[0]) return { kind: "document_intake" as const, job: byRef[0], officeDocId: null as string | null };
    }

    // 3. Plain office_documents attachment (the real primary path today)
    const docs = await sql`
      SELECT id, storage_key
      FROM public.office_documents
      WHERE source_module = ${sourceModule} AND source_record_id = ${sourceId} AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (docs[0]) return { kind: "office_document" as const, job: null, officeDocId: docs[0].id as string, storageKey: docs[0].storage_key as string };

    return { kind: "none" as const, job: null, officeDocId: null };
  });
}

async function fetchIntakeFieldValue(jobId: string, fieldKey: string): Promise<string | null> {
  const res = await withLocalPg(async (sql) => {
    const rows = await sql`
      SELECT COALESCE(corrected_value, normalized_value, raw_value) AS v
      FROM public.document_intake_fields
      WHERE job_id = ${jobId} AND lower(field_key) = ${fieldKey.toLowerCase()}
      LIMIT 1
    `;
    return rows[0]?.v ?? null;
  });
  return res ?? null;
}

function buildDeterministicFindings(fullText: string): DeterministicClauseFinding[] {
  const presence = detectClausePresence(fullText);
  return CLAUSE_RULES.map((r) => {
    const found = presence.get(r.clauseKey);
    return { clauseKey: r.clauseKey, present: found?.present ?? false, excerpt: found?.excerpt ?? null };
  });
}

function riskFromFindings(findings: DeterministicClauseFinding[], contractType: string, remainingBalance: number, expiryDate: string | null, paymentTermsFound: boolean, lang: SupportedLanguage): { level: "high" | "medium" | "low"; missing: any[]; paymentWarnings: any[] } {
  const missing: any[] = [];
  let highCount = 0;
  let mediumCount = 0;

  // Missing-clause detection is driven by contract_standard_clause_library's
  // is_required/applies_to/severity, joined against the deterministic scan.
  // (Loaded by the caller and passed in — see analyzeContract.)
  for (const f of findings) {
    if (!f.present) {
      // severity resolved by caller from the DB library row
      missing.push({ clauseKey: f.clauseKey });
    }
  }

  const paymentWarnings: any[] = [];
  if (!paymentTermsFound) {
    paymentWarnings.push({ kind: "missing_payment_terms", severity: "high", message: t(lang, "contract.gen_warn_missing_payment_terms", "No payment terms clause was detected in the contract text.") });
    highCount++;
  }
  if (remainingBalance > 0 && expiryDate) {
    const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 30 && days >= 0) {
      paymentWarnings.push({ kind: "pending_payment_near_expiry", severity: "high", message: interpolate(t(lang, "contract.gen_warn_payment_near_expiry", "Remaining balance is outstanding with only {days} day(s) left before expiry."), { days: String(days) }) });
      highCount++;
    } else if (days < 0) {
      paymentWarnings.push({ kind: "pending_payment_after_expiry", severity: "high", message: t(lang, "contract.gen_warn_payment_after_expiry", "Contract has expired with a remaining balance still outstanding.") });
      highCount++;
    }
  }

  const requiredMissingHigh = missing.length > 0; // refined by caller with real severities
  if (highCount > 0) return { level: "high", missing, paymentWarnings };
  if (mediumCount > 0 || requiredMissingHigh) return { level: "medium", missing, paymentWarnings };
  return { level: "low", missing, paymentWarnings };
}

export async function analyzeContract(input: {
  sourceModule: string;
  sourceId: string;
  actorId?: string | null;
  actorName?: string | null;
  lang?: SupportedLanguage;
}): Promise<ContractIntelligenceResult | null> {
  const lang: SupportedLanguage = input.lang || "en";
  const contract = await withLocalPg(async (sql) => {
    const rows = await sql`
      SELECT r.contract_no, r.manual_contract_no, r.contract_type, r.remaining_balance, r.expiry_date
      FROM public.erp_contract_register_v r
      WHERE r.source_module = ${input.sourceModule} AND r.source_id = ${input.sourceId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
  if (!contract) return null;

  const resolved = await resolveDocumentSource(input.sourceModule, input.sourceId, {
    contractNo: contract.contract_no ?? null,
    manualContractNo: contract.manual_contract_no ?? null,
  });

  if (resolved?.kind === "none" || !resolved) {
    return upsertAnalysis({
      sourceModule: input.sourceModule,
      sourceId: input.sourceId,
      sourceKind: "none",
      documentIntakeJobId: null,
      officeDocumentId: null,
      analysisStatus: "pending",
      errorMessage: null,
      overallRiskLevel: null,
      riskSummary: null,
      clauses: [], obligations: [], missingClauses: [], renewal: null, termination: null, paymentWarnings: [], keyDates: [],
      deterministicOnly: true, aiProvider: null, aiModel: null, sourceTextSha256: null, generatedLang: lang,
      actorId: input.actorId ?? null, actorName: input.actorName ?? null,
    });
  }

  // Ingest the stored file's text (same engine the intake pipeline already uses).
  let buffer: Buffer | null = null;
  let docTypeCode: string | null = null;
  let mimeType = "application/pdf";
  try {
    if (resolved.kind === "document_intake" && resolved.job) {
      buffer = await readIntakeFile(resolved.job.storage_key);
      docTypeCode = resolved.job.doc_type_code ?? null;
      mimeType = resolved.job.mime_type || mimeType;
    } else if (resolved.kind === "office_document") {
      buffer = await readDocumentFileBuffer((resolved as any).storageKey);
    }
  } catch {
    buffer = null;
  }

  if (!buffer) {
    return upsertAnalysis({
      sourceModule: input.sourceModule, sourceId: input.sourceId,
      sourceKind: resolved.kind, documentIntakeJobId: resolved.job?.id ?? null, officeDocumentId: resolved.officeDocId,
      analysisStatus: "error", errorMessage: "Stored document could not be read.",
      overallRiskLevel: null, riskSummary: null,
      clauses: [], obligations: [], missingClauses: [], renewal: null, termination: null, paymentWarnings: [], keyDates: [],
      deterministicOnly: true, aiProvider: null, aiModel: null, sourceTextSha256: null, generatedLang: lang,
      actorId: input.actorId ?? null, actorName: input.actorName ?? null,
    });
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // Cache hit: unchanged document, already-completed analysis -> no re-ingest / re-AI-call.
  const existing = await withLocalPg(async (sql) => {
    const rows = await sql`
      SELECT * FROM public.contract_intelligence_analyses
      WHERE source_module = ${input.sourceModule} AND source_id = ${input.sourceId} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
  if (existing && existing.source_text_sha256 === sha256 && existing.analysis_status === "completed" && existing.generated_lang === lang) {
    return mapRow(existing);
  }

  const provider = getDocumentAiProvider();
  const ingested = await provider.ingest({ buffer, mimeType, filename: "contract" });
  const fullText = ingested.fullText || "";

  const findings = buildDeterministicFindings(fullText);
  const clauseLibrary = await withLocalPg(async (sql) => sql`
    SELECT clause_key, category, applies_to, is_required, severity_if_missing
    FROM public.contract_standard_clause_library WHERE is_active = true
  `) ?? [];

  const contractTypeForApplicability = REQUIRED_CONTRACT_TYPE_MAP[input.sourceModule] || contract.contract_type;
  const applicableLibrary = clauseLibrary.filter((c: any) =>
    c.applies_to?.includes("all") || c.applies_to?.includes(contract.contract_type) || c.applies_to?.includes(contractTypeForApplicability)
  );

  const paymentTermsFound = findings.find((f) => f.clauseKey === "payment_terms")?.present ?? false;
  const { paymentWarnings } = riskFromFindings(findings, contract.contract_type, Number(contract.remaining_balance) || 0, contract.expiry_date, paymentTermsFound, lang);

  const missingClauses: any[] = [];
  let highSeverityMissingCount = 0;
  for (const lib of applicableLibrary) {
    const f = findings.find((x) => x.clauseKey === lib.clause_key);
    if (lib.is_required && f && !f.present) {
      missingClauses.push({ clauseKey: lib.clause_key, category: lib.category, severity: lib.severity_if_missing });
      if (lib.severity_if_missing === "high") highSeverityMissingCount++;
    }
  }

  const noticeDays = extractNoticePeriodDays(fullText);
  const autoRenewalPresent = findings.find((f) => f.clauseKey === "auto_renewal")?.present ?? false;
  const renewal = {
    hasAutoRenewal: autoRenewalPresent,
    noticeDays,
    riskLevel: autoRenewalPresent && (noticeDays === null || noticeDays < 30) ? "high" : autoRenewalPresent ? "medium" : "low",
    explanation: autoRenewalPresent
      ? (noticeDays !== null
          ? interpolate(t(lang, "contract.gen_renewal_with_notice", "Auto-renewal clause found with a {days}-day notice period."), { days: String(noticeDays) })
          : t(lang, "contract.gen_renewal_no_notice", "Auto-renewal clause found, but no clear notice period could be detected."))
      : t(lang, "contract.gen_renewal_none", "No auto-renewal clause detected."),
  };

  const terminationPresent = findings.find((f) => f.clauseKey === "termination")?.present ?? false;
  const termination = {
    conditions: terminationPresent ? [findings.find((f) => f.clauseKey === "termination")?.excerpt].filter(Boolean) : [],
    noticePeriod: noticeDays,
    riskLevel: terminationPresent ? "low" : "high",
    explanation: terminationPresent
      ? t(lang, "contract.gen_termination_present", "Termination clause detected.")
      : t(lang, "contract.gen_termination_missing", "No termination clause was detected — this is a material gap."),
  };

  let overallRiskLevel: "high" | "medium" | "low" = "low";
  if (paymentWarnings.some((w) => w.severity === "high") || highSeverityMissingCount > 0 || !terminationPresent) overallRiskLevel = "high";
  else if (missingClauses.length > 0 || renewal.riskLevel !== "low") overallRiskLevel = "medium";

  let riskSummary = interpolate(t(lang, "contract.gen_risk_summary", "Deterministic scan: {found}/{total} standard clauses detected, {missing} required clause(s) missing, {warnings} payment warning(s)."), {
    found: String(findings.filter((f) => f.present).length), total: String(findings.length), missing: String(missingClauses.length), warnings: String(paymentWarnings.length),
  });
  let clausesOut: any[] = findings.filter((f) => f.present).map((f) => ({ clauseKey: f.clauseKey, present: true, riskLevel: "unknown", explanation: null, excerpt: f.excerpt }));
  let deterministicOnly = true;
  let aiProvider: string | null = null;
  let aiModel: string | null = null;
  let obligations: any[] = [];
  let keyDates: any[] = [];

  const enrichment = await aiAnalyzeContract({ fullText, clauseFindings: findings, docTypeCode, lang });
  if (enrichment) {
    deterministicOnly = false;
    aiProvider = (process.env.AI_TRANSLATE_PROVIDER || "").toLowerCase();
    aiModel = process.env.AI_TRANSLATE_MODEL || null;
    overallRiskLevel = enrichment.overallRiskLevel;
    riskSummary = enrichment.riskSummary;
    obligations = enrichment.obligations;
    keyDates = enrichment.keyDates;
    const byKey = new Map(enrichment.clauses.map((c) => [c.clauseKey, c]));
    clausesOut = clausesOut.map((c) => {
      const ai = byKey.get(c.clauseKey);
      return ai ? { ...c, riskLevel: ai.riskLevel, explanation: ai.explanation } : c;
    });
  }

  if (!keyDates.length) {
    if (contract.expiry_date) keyDates.push({ label: t(lang, "contract.gen_key_date_expiry", "Contract Expiry"), date: contract.expiry_date, kind: "expiry" });
  }

  return upsertAnalysis({
    sourceModule: input.sourceModule, sourceId: input.sourceId,
    sourceKind: resolved.kind, documentIntakeJobId: resolved.job?.id ?? null, officeDocumentId: resolved.officeDocId,
    analysisStatus: "completed", errorMessage: null,
    overallRiskLevel, riskSummary,
    clauses: clausesOut, obligations, missingClauses, renewal, termination, paymentWarnings, keyDates,
    deterministicOnly, aiProvider, aiModel, sourceTextSha256: sha256, generatedLang: lang,
    actorId: input.actorId ?? null, actorName: input.actorName ?? null,
  });
}

async function upsertAnalysis(a: {
  sourceModule: string; sourceId: string; sourceKind: string;
  documentIntakeJobId: string | null; officeDocumentId: string | null;
  analysisStatus: string; errorMessage: string | null;
  overallRiskLevel: string | null; riskSummary: string | null;
  clauses: any[]; obligations: any[]; missingClauses: any[]; renewal: any; termination: any; paymentWarnings: any[]; keyDates: any[];
  deterministicOnly: boolean; aiProvider: string | null; aiModel: string | null; sourceTextSha256: string | null; generatedLang: string;
  actorId: string | null; actorName: string | null;
}): Promise<ContractIntelligenceResult | null> {
  const res = await withLocalPg(async (sql) => {
    const rows = await sql`
      INSERT INTO public.contract_intelligence_analyses (
        source_module, source_id, source_kind, document_intake_job_id, office_document_id,
        analysis_status, error_message, overall_risk_level, risk_summary,
        clauses, obligations, missing_clauses, renewal, termination, payment_warnings, key_dates,
        deterministic_only, ai_provider, ai_model, source_text_sha256, generated_lang,
        analyzed_by, analyzed_at
      ) VALUES (
        ${a.sourceModule}, ${a.sourceId}, ${a.sourceKind}, ${a.documentIntakeJobId}, ${a.officeDocumentId},
        ${a.analysisStatus}, ${a.errorMessage}, ${a.overallRiskLevel}, ${a.riskSummary},
        ${sql.json(a.clauses)}, ${sql.json(a.obligations)}, ${sql.json(a.missingClauses)}, ${a.renewal ? sql.json(a.renewal) : null}, ${a.termination ? sql.json(a.termination) : null}, ${sql.json(a.paymentWarnings)}, ${sql.json(a.keyDates)},
        ${a.deterministicOnly}, ${a.aiProvider}, ${a.aiModel}, ${a.sourceTextSha256}, ${a.generatedLang},
        ${a.actorId}, ${a.analysisStatus === "completed" ? new Date().toISOString() : null}
      )
      ON CONFLICT (source_module, source_id) WHERE deleted_at IS NULL
      DO UPDATE SET
        source_kind = EXCLUDED.source_kind,
        document_intake_job_id = EXCLUDED.document_intake_job_id,
        office_document_id = EXCLUDED.office_document_id,
        analysis_status = EXCLUDED.analysis_status,
        error_message = EXCLUDED.error_message,
        overall_risk_level = EXCLUDED.overall_risk_level,
        risk_summary = EXCLUDED.risk_summary,
        clauses = EXCLUDED.clauses,
        obligations = EXCLUDED.obligations,
        missing_clauses = EXCLUDED.missing_clauses,
        renewal = EXCLUDED.renewal,
        termination = EXCLUDED.termination,
        payment_warnings = EXCLUDED.payment_warnings,
        key_dates = EXCLUDED.key_dates,
        deterministic_only = EXCLUDED.deterministic_only,
        ai_provider = EXCLUDED.ai_provider,
        ai_model = EXCLUDED.ai_model,
        source_text_sha256 = EXCLUDED.source_text_sha256,
        generated_lang = EXCLUDED.generated_lang,
        analyzed_by = EXCLUDED.analyzed_by,
        analyzed_at = EXCLUDED.analyzed_at,
        updated_at = now()
      RETURNING *
    `;
    if (rows[0]) {
      await sql`
        INSERT INTO public.contract_register_audit (source_module, source_id, action, detail, actor_id, actor_name)
        VALUES (${a.sourceModule}, ${a.sourceId}, 'intelligence_analyzed',
                ${sql.json({ status: a.analysisStatus, riskLevel: a.overallRiskLevel, deterministicOnly: a.deterministicOnly })},
                ${a.actorId}, ${a.actorName})
      `;
    }
    return rows[0] ?? null;
  });
  return res ? mapRow(res) : null;
}

function mapRow(row: any): ContractIntelligenceResult {
  return {
    id: row.id,
    sourceModule: row.source_module,
    sourceId: row.source_id,
    sourceKind: row.source_kind,
    analysisStatus: row.analysis_status,
    errorMessage: row.error_message,
    overallRiskLevel: row.overall_risk_level,
    riskSummary: row.risk_summary,
    clauses: row.clauses ?? [],
    obligations: row.obligations ?? [],
    missingClauses: row.missing_clauses ?? [],
    renewal: row.renewal ?? null,
    termination: row.termination ?? null,
    paymentWarnings: row.payment_warnings ?? [],
    keyDates: row.key_dates ?? [],
    deterministicOnly: row.deterministic_only,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    analyzedAt: row.analyzed_at,
  };
}

export async function getContractIntelligence(sourceModule: string, sourceId: string): Promise<ContractIntelligenceResult | null> {
  const res = await withLocalPg(async (sql) => {
    const rows = await sql`
      SELECT * FROM public.contract_intelligence_analyses
      WHERE source_module = ${sourceModule} AND source_id = ${sourceId} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  });
  return res ? mapRow(res) : null;
}

export async function getPortfolioRiskSummary(scope?: { countryIds?: string[] | null; cityBranchIds?: string[] | null }) {
  const res = await withLocalPg(async (sql) => {
    const parts: any[] = [];
    if (scope?.countryIds && scope.countryIds.length) parts.push(sql`r.country_id = ANY(${scope.countryIds})`);
    if (scope?.cityBranchIds && scope.cityBranchIds.length) parts.push(sql`(r.city_branch_id = ANY(${scope.cityBranchIds}) OR r.city_branch_id IS NULL)`);
    const whereScope = parts.length ? parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} AND ${p}`)) : sql`TRUE`;

    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE a.overall_risk_level = 'high')::int AS high,
        COUNT(*) FILTER (WHERE a.overall_risk_level = 'medium')::int AS medium,
        COUNT(*) FILTER (WHERE a.overall_risk_level = 'low')::int AS low,
        COUNT(*) FILTER (WHERE a.analysis_status = 'pending' OR a.analysis_status IS NULL)::int AS not_analyzed
      FROM public.erp_contract_register_v r
      LEFT JOIN public.contract_intelligence_analyses a
        ON a.source_module = r.source_module AND a.source_id = r.source_id AND a.deleted_at IS NULL
      WHERE ${whereScope}
    `;
    const attention = await sql`
      SELECT r.source_module, r.source_id, r.contract_no, r.booking_order_no, r.party_name, a.overall_risk_level
      FROM public.contract_intelligence_analyses a
      JOIN public.erp_contract_register_v r ON r.source_module = a.source_module AND r.source_id = a.source_id
      WHERE a.deleted_at IS NULL AND a.overall_risk_level = 'high' AND (${whereScope})
      ORDER BY a.analyzed_at DESC LIMIT 10
    `;
    return { counts, attention };
  });
  return res ?? { counts: { high: 0, medium: 0, low: 0, not_analyzed: 0 }, attention: [] };
}
