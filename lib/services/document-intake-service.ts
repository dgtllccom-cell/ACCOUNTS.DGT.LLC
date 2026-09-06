import crypto from "node:crypto";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getDocumentAiProvider } from "@/lib/document-intelligence/providers";
import type { RegistryDocType } from "@/lib/document-intelligence/types";
import {
  validateUpload, malwareScan, saveIntakeFile, readIntakeFile, MAX_PAGES, DocumentValidationError,
} from "@/lib/document-intelligence/storage";
import {
  buildCompositeIdentity, jobScopeWhere, assertRowInScope, type IntakeScope, type OperationalDomain,
} from "@/lib/document-intelligence/scope";
import { runScopedMatching } from "@/lib/document-intelligence/matching";
import { buildPreparedDraft, DRAFTABLE_MODULES } from "@/lib/document-intelligence/draft-mapping";

/**
 * AI Document Intake service.
 *
 * The AI prepares a REVIEWED DRAFT only. It never posts to Journal / Roznamcha /
 * GL / Ledger / Tax / Settlement / Stock, and never links a document to a source
 * record without an authorized in-scope match. Final posting is done by the
 * existing authorized module services (see confirmDraft / handoff routes).
 */

export type CreateJobInput = {
  operationalDomain: OperationalDomain;
  companyId?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  clearingAgentId?: string | null;
  shippingCustomerId?: string | null;
  purchaseOrderId?: string | null;
  salesOrderId?: string | null;
  sourceModuleHint?: string | null;
  contractReference?: string | null;
  documentReference?: string | null;
  containerReference?: string | null;
  blReference?: string | null;
  uploadMethod?: "web" | "scanner_bridge" | "mobile" | "api";
  idempotencyKey?: string | null;
};

async function loadRegistry(countryId?: string | null): Promise<RegistryDocType[]> {
  const rows = await withLocalPg(async (sql) =>
    sql`SELECT code, name, operational_domain, category, target_module, classifier_keywords,
               min_confidence::float AS min_confidence, requires_qvc, expected_fields
        FROM public.document_type_registry
        WHERE deleted_at IS NULL AND is_active
          AND (country_id IS NULL ${countryId ? sql`OR country_id = ${countryId}` : sql``})
        ORDER BY rank_order ASC`,
  );
  return (rows ?? []) as RegistryDocType[];
}

async function event(sql: any, jobId: string, action: string, detail: unknown, actorId: string | null, actorName: string | null) {
  await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
    VALUES (${jobId}, ${action}, ${sql.json(detail ?? {})}, ${actorId}, ${actorName})`;
}

export class DocumentIntakeService {
  // ── queue / detail ─────────────────────────────────────────────────────
  async list(scope: IntakeScope, filters: { status?: string; domain?: string; docType?: string; search?: string; limit?: number } = {}) {
    try {
      const rows = await withLocalPg(async (sql) => {
        const where: any[] = [jobScopeWhere(sql, scope)];
        if (filters.status) where.push(sql`j.status = ${filters.status}`);
        if (filters.domain) where.push(sql`j.operational_domain = ${filters.domain}`);
        if (filters.docType) where.push(sql`j.doc_type_code = ${filters.docType}`);
        if (filters.search) {
          const q = "%" + filters.search + "%";
          where.push(sql`(j.job_no ILIKE ${q} OR j.original_filename ILIKE ${q} OR j.contract_reference ILIKE ${q}
            OR j.document_reference ILIKE ${q} OR j.bl_reference ILIKE ${q} OR j.draft_reference ILIKE ${q})`);
        }
        const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
        const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 300);
        return sql`SELECT j.* FROM public.document_intake_queue_v j WHERE ${w} ORDER BY j.created_at DESC LIMIT ${limit}`;
      });
      return rows ?? [];
    } catch (err) {
      console.warn("document_intake_queue_v notice:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  async kpis(scope: IntakeScope) {
    try {
      const r = await withLocalPg(async (sql) => {
        const w = jobScopeWhere(sql, scope);
        return sql`SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE j.status = 'review')::int AS in_review,
          count(*) FILTER (WHERE j.status = 'qvc')::int AS in_qvc,
          count(*) FILTER (WHERE j.status = 'draft_ready')::int AS draft_ready,
          count(*) FILTER (WHERE j.status = 'linked')::int AS linked,
          count(*) FILTER (WHERE j.status IN ('error','rejected'))::int AS failed,
          count(*) FILTER (WHERE j.match_status = 'out_of_scope')::int AS out_of_scope
          FROM public.document_intake_queue_v j WHERE ${w}`;
      });
      return r?.[0] ?? {};
    } catch (err) {
      console.warn("document_intake_queue_v kpis notice:", err instanceof Error ? err.message : String(err));
      return {};
    }
  }

  async get(jobId: string, scope: IntakeScope) {
    try {
      return await withLocalPg(async (sql) => {
        const job = (await sql`SELECT * FROM public.document_intake_queue_v WHERE id = ${jobId}`)?.[0];
        if (!job) return null;
        assertRowInScope(scope, job);
        const fields = await sql`SELECT * FROM public.document_intake_fields WHERE job_id = ${jobId} ORDER BY field_key`;
        const lineItems = await sql`SELECT * FROM public.document_intake_line_items WHERE job_id = ${jobId} ORDER BY line_no`;
        const matches = await sql`SELECT * FROM public.document_intake_matches WHERE job_id = ${jobId} ORDER BY match_kind, score DESC`;
        const events = await sql`SELECT * FROM public.document_intake_events WHERE job_id = ${jobId} ORDER BY created_at DESC LIMIT 100`;
        return { job, fields: fields ?? [], lineItems: lineItems ?? [], matches: matches ?? [], events: events ?? [] };
      });
    } catch (err) {
      console.warn("document_intake_queue_v get notice:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async fileBuffer(jobId: string, scope: IntakeScope): Promise<{ buffer: Buffer; mime: string; filename: string } | null> {
    const meta = await withLocalPg(async (sql) => {
      const j = (await sql`SELECT storage_key, mime_type, original_filename, country_id, city_branch_id, clearing_agent_id, operational_domain
        FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      return j ?? null;
    });
    if (!meta) return null;
    assertRowInScope(scope, meta);
    const buffer = await readIntakeFile(meta.storage_key);
    return { buffer, mime: meta.mime_type, filename: meta.original_filename };
  }

  // ── create ────────────────────────────────────────────────────────────
  async createJob(
    input: CreateJobInput,
    file: { buffer: Buffer; declaredMime: string; filename: string },
    actorId: string,
    actorName: string | null,
    scope: IntakeScope,
  ) {
    // domain / scope guard on the declared placement
    if (scope.domain && scope.domain !== input.operationalDomain) {
      throw new DocumentValidationError(`Your login is restricted to the ${scope.domain} domain.`);
    }
    if (scope.countryIds && input.countryId && !scope.countryIds.includes(input.countryId)) {
      throw new DocumentValidationError("Country is outside your assigned scope.");
    }
    if (scope.clearingAgentIds && input.clearingAgentId && !scope.clearingAgentIds.includes(input.clearingAgentId)) {
      throw new DocumentValidationError("Clearing agent is outside your assigned scope.");
    }

    const validated = validateUpload(file.buffer, file.declaredMime, file.filename);
    const scan = await malwareScan(validated);
    if (!scan.ok) throw new DocumentValidationError(`File rejected by the security scan: ${scan.reason}`);

    return withLocalPg(async (sql) => {
      // idempotency
      if (input.idempotencyKey) {
        const existing = await sql`SELECT id, job_no FROM public.document_intake_jobs WHERE idempotency_key = ${input.idempotencyKey} AND deleted_at IS NULL LIMIT 1`;
        if (existing?.length) return { id: existing[0].id, jobNo: existing[0].job_no, deduped: true };
      }
      // same-file duplicate detection within scope
      const dup = await sql`SELECT id, job_no FROM public.document_intake_jobs
        WHERE file_sha256 = ${validated.sha256} AND deleted_at IS NULL
          AND operational_domain = ${input.operationalDomain}
          AND (country_id IS NOT DISTINCT FROM ${input.countryId ?? null})
        ORDER BY created_at DESC LIMIT 1`;

      const seq = (await sql`SELECT count(*)::int n FROM public.document_intake_jobs`)?.[0]?.n ?? 0;
      const jobNo = `DI-${new Date().getUTCFullYear()}-${String(seq + 1).padStart(5, "0")}`;
      const composite = buildCompositeIdentity({
        operationalDomain: input.operationalDomain,
        companyId: input.companyId, countryId: input.countryId, countryBranchId: input.countryBranchId,
        cityBranchId: input.cityBranchId, clearingAgentId: input.clearingAgentId, shippingCustomerId: input.shippingCustomerId,
        sourceModule: input.sourceModuleHint, purchaseOrderId: input.purchaseOrderId, salesOrderId: input.salesOrderId,
        contractReference: input.contractReference, documentReference: input.documentReference,
        containerReference: input.containerReference, blReference: input.blReference,
      });

      const rows = await sql`
        INSERT INTO public.document_intake_jobs
          (job_no, operational_domain, company_id, country_id, country_branch_id, city_branch_id, clearing_agent_id,
           shipping_customer_id, source_module_hint, purchase_order_id, sales_order_id, contract_reference,
           document_reference, container_reference, bl_reference, scope_composite_id,
           uploaded_by, uploaded_by_name, upload_method, original_filename, mime_type, file_size, storage_key,
           file_sha256, status, idempotency_key)
        VALUES
          (${jobNo}, ${input.operationalDomain}, ${input.companyId ?? null}, ${input.countryId ?? null},
           ${input.countryBranchId ?? null}, ${input.cityBranchId ?? null}, ${input.clearingAgentId ?? null},
           ${input.shippingCustomerId ?? null}, ${input.sourceModuleHint ?? null}, ${input.purchaseOrderId ?? null},
           ${input.salesOrderId ?? null}, ${input.contractReference ?? null}, ${input.documentReference ?? null},
           ${input.containerReference ?? null}, ${input.blReference ?? null}, ${composite},
           ${actorId}, ${actorName}, ${input.uploadMethod ?? "web"}, ${file.filename}, ${validated.mimeType},
           ${validated.size}, ${"__pending__"}, ${validated.sha256}, 'uploaded', ${input.idempotencyKey ?? null})
        RETURNING id`;
      const jobId = rows?.[0]?.id;
      const storageKey = await saveIntakeFile(jobId, validated);
      await sql`UPDATE public.document_intake_jobs SET storage_key = ${storageKey}, updated_at = now() WHERE id = ${jobId}`;
      await event(sql, jobId, "uploaded", { jobNo, filename: file.filename, size: validated.size, sha256: validated.sha256, duplicateOf: dup?.[0]?.job_no ?? null }, actorId, actorName);
      if (dup?.length) {
        await sql`UPDATE public.document_intake_jobs SET qvc_reason = ${`Possible duplicate of ${dup[0].job_no}`} WHERE id = ${jobId}`;
      }
      return { id: jobId, jobNo, duplicateOf: dup?.[0]?.job_no ?? null };
    });
  }

  // ── process (OCR → classify → extract → match) ────────────────────────
  async processJob(jobId: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    const job = await withLocalPg(async (sql) => (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0]);
    if (!job) throw new Error("Job not found.");
    assertRowInScope(scope, job);
    if (["linked", "cancelled"].includes(job.status)) throw new Error(`Job is ${job.status}.`);

    const provider = getDocumentAiProvider();
    const buffer = await readIntakeFile(job.storage_key);

    await withLocalPg(async (sql) => { await sql`UPDATE public.document_intake_jobs SET status = 'ocr', updated_at = now() WHERE id = ${jobId}`; });

    let ingest;
    try {
      ingest = await provider.ingest({ buffer, mimeType: job.mime_type, filename: job.original_filename });
    } catch (e) {
      await withLocalPg(async (sql) => {
        await sql`UPDATE public.document_intake_jobs SET status = 'error', error = ${(e as Error).message}, updated_at = now() WHERE id = ${jobId}`;
        await event(sql, jobId, "ocr_failed", { error: (e as Error).message }, actorId, actorName);
      });
      throw e;
    }

    if (ingest.pageCount > MAX_PAGES) {
      await withLocalPg(async (sql) => {
        await sql`UPDATE public.document_intake_jobs SET status = 'qvc', qvc_reason = ${`Document has ${ingest.pageCount} pages (limit ${MAX_PAGES}).`}, updated_at = now() WHERE id = ${jobId}`;
        await event(sql, jobId, "page_limit", { pageCount: ingest.pageCount }, actorId, actorName);
      });
      return { jobId, status: "qvc", reason: "page_limit" };
    }

    const unreadable = !ingest.fullText || ingest.fullText.replace(/\s/g, "").length < 20;
    const registry = await loadRegistry(job.country_id);
    const cls = unreadable
      ? { code: "other_document", name: "Other / Unclassified", confidence: 0, domain: "both" as const, category: "other", targetModule: null, requiresQvc: true, scores: [] }
      : await provider.classify(ingest.fullText, registry, job.operational_domain);

    const docTypeDef = registry.find((d) => d.code === cls.code) ?? registry.find((d) => d.code === "other_document")!;
    const extraction = unreadable ? { fields: [], lineItems: [], summary: {} } : await provider.extract({ text: ingest.fullText, pages: ingest.pages, docType: docTypeDef });

    // scope-constrained master matching (no contract-number-alone)
    const matchResult = await runScopedMatching({
      job, scope, docTypeCode: cls.code, fields: extraction.fields,
    });

    await withLocalPg(async (sql) => {
      await sql`BEGIN`;
      try {
        await sql`DELETE FROM public.document_intake_fields WHERE job_id = ${jobId}`;
        for (const f of extraction.fields) {
          await sql`INSERT INTO public.document_intake_fields
            (job_id, field_key, field_label, raw_value, normalized_value, confidence, page_number, bbox, validation_status, validation_message)
            VALUES (${jobId}, ${f.key}, ${f.label}, ${f.rawValue}, ${f.normalizedValue}, ${f.confidence},
              ${f.pageNumber}, ${f.bbox ? sql.json(f.bbox) : null}, ${f.validationStatus}, ${f.validationMessage})`;
        }
        await sql`DELETE FROM public.document_intake_line_items WHERE job_id = ${jobId}`;
        for (const li of extraction.lineItems) {
          await sql`INSERT INTO public.document_intake_line_items
            (job_id, line_no, description, hs_code, brand, quantity, unit, packages, gross_weight, net_weight, unit_price, amount, currency, confidence, page_number)
            VALUES (${jobId}, ${li.lineNo}, ${li.description}, ${li.hsCode}, ${li.brand}, ${li.quantity}, ${li.unit},
              ${li.packages}, ${li.grossWeight}, ${li.netWeight}, ${li.unitPrice}, ${li.amount}, ${li.currency}, ${li.confidence}, ${li.pageNumber})`;
        }
        await sql`DELETE FROM public.document_intake_matches WHERE job_id = ${jobId}`;
        for (const m of matchResult.candidates) {
          await sql`INSERT INTO public.document_intake_matches
            (job_id, match_kind, source_module, source_id, label, score, scope_ok, reason, is_selected)
            VALUES (${jobId}, ${m.matchKind}, ${m.sourceModule ?? null}, ${m.sourceId ?? null}, ${m.label},
              ${m.score}, ${m.scopeOk}, ${m.reason ?? null}, ${m.isSelected ?? false})`;
        }

        const redCount = extraction.fields.filter((f) => f.validationStatus === "red").length;
        const missingRequired = docTypeDef.expected_fields
          .filter((ef) => ef.required && !extraction.fields.some((f) => f.key === ef.key && (f.normalizedValue || f.rawValue)))
          .map((ef) => ef.label);

        let status = "review";
        let qvcReason: string | null = null;
        const qvcMissing: string[] = [...missingRequired];
        if (unreadable) { status = "qvc"; qvcReason = "Document is unreadable — OCR produced no usable text."; }
        else if (matchResult.status === "out_of_scope") { status = "qvc"; qvcReason = matchResult.reason ?? "No authorized matching record in your scope."; }
        else if (cls.requiresQvc && cls.confidence < 0.4) { status = "qvc"; qvcReason = "Document type could not be confidently classified."; }
        else if (missingRequired.length) { status = "qvc"; qvcReason = `Missing required field(s): ${missingRequired.join(", ")}`; }
        else if (redCount > 0 && docTypeDef.requires_qvc) { status = "qvc"; qvcReason = `${redCount} field(s) are invalid or missing.`; }

        await sql`
          UPDATE public.document_intake_jobs SET
            status = ${status},
            provider = ${provider.name},
            ocr_engine = ${ingest.engine},
            ocr_ms = ${ingest.ocrMs},
            language_detected = ${ingest.languageDetected},
            page_count = ${ingest.pageCount},
            doc_type_code = ${cls.code},
            doc_type_confidence = ${cls.confidence},
            classification = ${sql.json({ code: cls.code, confidence: cls.confidence, domain: cls.domain, category: cls.category, scores: cls.scores } as never)},
            extraction_summary = ${sql.json(extraction.summary as never)},
            target_module = ${docTypeDef.target_module ?? null},
            match_status = ${matchResult.status},
            matched_source_module = ${matchResult.matchedModule ?? null},
            matched_source_id = ${matchResult.matchedId ?? null},
            matched_confidence = ${matchResult.matchedScore ?? null},
            qvc_reason = ${qvcReason},
            qvc_missing = ${sql.json(qvcMissing)},
            error = NULL,
            updated_at = now()
          WHERE id = ${jobId}`;
        await event(sql, jobId, "processed", {
          engine: ingest.engine, isDigital: ingest.isDigital, docType: cls.code, docTypeConfidence: cls.confidence,
          fields: extraction.fields.length, lineItems: extraction.lineItems.length,
          matchStatus: matchResult.status, status, qvcReason,
        }, actorId, actorName);
        await sql`COMMIT`;
      } catch (e) {
        await sql`ROLLBACK`;
        throw e;
      }
    });

    return { jobId, status: "processed" };
  }

  // ── field correction ─────────────────────────────────────────────────
  async updateField(jobId: string, fieldKey: string, patch: { correctedValue?: string | null; verified?: boolean }, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT country_id, city_branch_id, clearing_agent_id, operational_domain, status FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);
      if (["linked", "cancelled"].includes(job.status)) throw new Error(`Job is ${job.status}.`);
      const done = patch.verified === true;
      await sql`UPDATE public.document_intake_fields SET
        corrected_value = ${patch.correctedValue === undefined ? sql`corrected_value` : patch.correctedValue},
        verified = COALESCE(${patch.verified ?? null}, verified),
        verified_by = ${done ? actorId : sql`verified_by`},
        verified_at = ${done ? sql`now()` : sql`verified_at`},
        validation_status = CASE WHEN ${done} THEN 'green' ELSE validation_status END,
        updated_at = now()
        WHERE job_id = ${jobId} AND lower(field_key) = lower(${fieldKey})`;
      await event(sql, jobId, "field_corrected", { fieldKey, correctedValue: patch.correctedValue, verified: patch.verified }, actorId, actorName);
      return { jobId, fieldKey };
    });
  }

  async selectMatch(jobId: string, matchId: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT country_id, city_branch_id, clearing_agent_id, operational_domain, status FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);
      const m = (await sql`SELECT * FROM public.document_intake_matches WHERE id = ${matchId} AND job_id = ${jobId}`)?.[0];
      if (!m) throw new Error("Match candidate not found.");
      if (!m.scope_ok) throw new Error("That candidate is outside your authorized scope.");
      await sql`UPDATE public.document_intake_matches SET is_selected = (id = ${matchId}) WHERE job_id = ${jobId} AND match_kind = ${m.match_kind}`;
      // A source_record OR a General-Office master (company / customer / account)
      // selection records the record the reviewed draft should be linked to.
      if (["source_record", "company", "customer", "account"].includes(m.match_kind)) {
        await sql`UPDATE public.document_intake_jobs SET
          match_status = 'user', matched_source_module = ${m.source_module}, matched_source_id = ${m.source_id},
          matched_confidence = ${m.score}, status = CASE WHEN status = 'qvc' THEN 'review' ELSE status END, updated_at = now()
          WHERE id = ${jobId}`;
      }
      await event(sql, jobId, "match_selected", { matchId, kind: m.match_kind, module: m.source_module, id: m.source_id }, actorId, actorName);
      return { jobId, matchId };
    });
  }

  async sendToQvc(jobId: string, reason: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);
      const qvcItemId = `di:${job.job_no}:${crypto.randomBytes(4).toString("hex")}`;
      await sql`UPDATE public.document_intake_jobs SET status = 'qvc', qvc_reason = ${reason}, qvc_item_id = ${qvcItemId}, updated_at = now() WHERE id = ${jobId}`;
      // feed the existing Smart CRM / QVC action queue
      await sql`INSERT INTO public.crm_action_items
        (source_type, source_id, reference_no, party_name, due_date, item_type, module,
         country_id, country_name, country_branch_id, city_branch_id, status, next_follow_up, notes)
        SELECT 'document_intake', ${job.id}::text, ${job.job_no},
               COALESCE(${job.contract_reference}, ${job.document_reference}, ${job.original_filename}),
               current_date + 3, 'document_verification', 'document_intake',
               ${job.country_id}::text, co.name, ${job.country_branch_id}::text, ${job.city_branch_id}::text,
               'open', current_date + 3, ${`QVC review: ${reason}`}
        FROM (SELECT 1) x LEFT JOIN public.countries co ON co.id = ${job.country_id}
        WHERE NOT EXISTS (SELECT 1 FROM public.crm_action_items c WHERE c.source_id = ${job.id}::text AND c.module = 'document_intake' AND c.is_completed = false)`;
      await event(sql, jobId, "sent_to_qvc", { reason, qvcItemId }, actorId, actorName);
      return { jobId, qvcItemId };
    });
  }

  async cancelJob(jobId: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT operational_domain, country_id, city_branch_id, clearing_agent_id, status FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);
      if (job.status === "linked") throw new Error("A linked job cannot be cancelled — reverse the linked draft in its own module.");
      await sql`UPDATE public.document_intake_jobs SET status = 'cancelled', updated_at = now() WHERE id = ${jobId}`;
      await event(sql, jobId, "cancelled", {}, actorId, actorName);
      return { jobId };
    });
  }

  async updateJobScope(
    jobId: string,
    scopeUpdate: { countryId?: string | null; countryBranchId?: string | null; cityBranchId?: string | null },
    actorId: string,
    actorName: string | null,
    scope: IntakeScope,
  ) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);

      const countryId = scopeUpdate.countryId !== undefined ? scopeUpdate.countryId : job.country_id;
      const countryBranchId = scopeUpdate.countryBranchId !== undefined ? scopeUpdate.countryBranchId : job.country_branch_id;
      const cityBranchId = scopeUpdate.cityBranchId !== undefined ? scopeUpdate.cityBranchId : job.city_branch_id;

      if (scope.countryIds && countryId && !scope.countryIds.includes(countryId)) {
        throw new Error("Selected country is outside your assigned scope.");
      }

      await sql`UPDATE public.document_intake_jobs SET
        country_id = ${countryId ?? null},
        country_branch_id = ${countryBranchId ?? null},
        city_branch_id = ${cityBranchId ?? null},
        updated_at = now()
        WHERE id = ${jobId}`;

      await event(sql, jobId, "scope_updated", { countryId, countryBranchId, cityBranchId }, actorId, actorName);
      return { jobId, countryId, countryBranchId, cityBranchId };
    });
  }

  // ── confirm draft (AI prepares a reviewed draft — never a posting) ────
  async confirmDraft(
    jobId: string,
    opts: {
      linkMode?: "new_record" | "append_existing";
      targetModuleOverride?: string | null;
      countryId?: string | null;
      countryBranchId?: string | null;
      cityBranchId?: string | null;
    },
    actorId: string,
    actorName: string | null,
    scope: IntakeScope,
  ) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Job not found.");
      assertRowInScope(scope, job);
      if (!["review", "qvc", "draft_ready"].includes(job.status)) {
        throw new Error(`A draft can only be prepared from a reviewed job (job is ${job.status}).`);
      }

      const targetModule: string | null = opts.targetModuleOverride ?? job.target_module ?? null;
      if (!targetModule) throw new Error("This document type has no target module — link it manually from its source module.");
      if (!DRAFTABLE_MODULES.includes(targetModule)) {
        throw new Error(`Automatic draft preparation is not available for ${targetModule} yet — use manual entry.`);
      }

      const effectiveCountryId = opts.countryId !== undefined ? opts.countryId : job.country_id;
      const effectiveCountryBranchId = opts.countryBranchId !== undefined ? opts.countryBranchId : job.country_branch_id;
      const effectiveCityBranchId = opts.cityBranchId !== undefined ? opts.cityBranchId : job.city_branch_id;

      const fields = await sql`SELECT field_key, corrected_value, normalized_value, raw_value, confidence, page_number, verified, validation_status
        FROM public.document_intake_fields WHERE job_id = ${jobId}`;
      const lines = await sql`SELECT line_no, description, hs_code, brand, quantity, unit, packages, gross_weight, net_weight, unit_price, amount, currency
        FROM public.document_intake_line_items WHERE job_id = ${jobId} ORDER BY line_no`;

      // Every required field the human still has to resolve blocks confirmation.
      const redUnverified = (fields as any[]).filter((f) => f.validation_status === "red" && !f.verified).map((f) => f.field_key);
      if (redUnverified.length) {
        throw new Error(`Resolve or verify these field(s) before preparing the draft: ${redUnverified.join(", ")}`);
      }

      const linkMode = opts.linkMode ?? (job.match_status === "auto" || job.match_status === "user" ? "append_existing" : "new_record");
      if (linkMode === "append_existing" && !job.matched_source_id) {
        throw new Error("No in-scope source record is selected to append to — pick a match or choose 'new record'.");
      }

      const prepared = buildPreparedDraft(targetModule, fields as any[], lines as any[]);

      // The references the user typed at intake are authoritative — seed them
      // into the draft payload for any target key the extractor did not fill.
      const seedRef = (payloadKey: string, value: string | null) => {
        if (value && (prepared.payload[payloadKey] === undefined || prepared.payload[payloadKey] === null || prepared.payload[payloadKey] === "")) {
          prepared.payload[payloadKey] = value;
        }
      };
      if (targetModule === "purchase_orders") {
        seedRef("purchaseContractNo", job.contract_reference);
        seedRef("billNo", job.document_reference);
      } else if (targetModule === "sales_orders") {
        seedRef("salesContractNo", job.contract_reference);
        seedRef("invoiceNo", job.document_reference);
      } else if (targetModule === "shipping_bl_records") {
        seedRef("blNumber", job.bl_reference);
      } else if (targetModule === "purchase_loading_records") {
        seedRef("purchaseContractNo", job.contract_reference);
      }
      if (job.container_reference && !prepared.payload.containerNumbers) {
        prepared.payload.containerNumbers = job.container_reference;
      }

      if (effectiveCountryId && !prepared.payload.countryId) {
        prepared.payload.countryId = effectiveCountryId;
      }
      if (effectiveCountryBranchId && !prepared.payload.countryBranchId) {
        prepared.payload.countryBranchId = effectiveCountryBranchId;
      }
      if (effectiveCityBranchId && !prepared.payload.cityBranchId) {
        prepared.payload.cityBranchId = effectiveCityBranchId;
      }
      if ((effectiveCountryBranchId || effectiveCityBranchId) && !prepared.payload.branchId) {
        prepared.payload.branchId = effectiveCountryBranchId || effectiveCityBranchId;
      }

      // supersede any earlier live draft for this job
      await sql`UPDATE public.document_intake_drafts SET status = 'superseded', updated_at = now()
        WHERE job_id = ${jobId} AND status = 'prepared' AND deleted_at IS NULL`;

      const seq = (await sql`SELECT count(*)::int n FROM public.document_intake_drafts`)?.[0]?.n ?? 0;
      const draftNo = `DID-${new Date().getUTCFullYear()}-${String(seq + 1).padStart(5, "0")}`;

      const row = (await sql`
        INSERT INTO public.document_intake_drafts
          (job_id, draft_no, operational_domain, target_module, doc_type_code,
           company_id, country_id, country_branch_id, city_branch_id, clearing_agent_id, scope_composite_id,
           link_mode, linked_source_module, linked_source_id,
           draft_payload, line_items, field_provenance, currency,
           status, created_by, created_by_name)
        VALUES
          (${jobId}, ${draftNo}, ${job.operational_domain}, ${targetModule}, ${job.doc_type_code},
           ${job.company_id}, ${effectiveCountryId ?? null}, ${effectiveCountryBranchId ?? null}, ${effectiveCityBranchId ?? null}, ${job.clearing_agent_id}, ${job.scope_composite_id},
           ${linkMode}, ${linkMode === "append_existing" ? job.matched_source_module : null}, ${linkMode === "append_existing" ? job.matched_source_id : null},
           ${sql.json(prepared.payload as never)}, ${sql.json(prepared.goodsEntries as never)}, ${sql.json(prepared.provenance as never)}, ${prepared.currency},
           'prepared', ${actorId}, ${actorName})
        RETURNING id, draft_no`)?.[0];

      await sql`UPDATE public.document_intake_jobs SET
        status = 'draft_ready', draft_id = ${row.id}, draft_reference = ${row.draft_no},
        target_module = ${targetModule},
        country_id = ${effectiveCountryId ?? null},
        country_branch_id = ${effectiveCountryBranchId ?? null},
        city_branch_id = ${effectiveCityBranchId ?? null},
        reviewed_by = ${actorId}, reviewed_at = now(), qvc_reason = NULL, updated_at = now()
        WHERE id = ${jobId}`;
      await event(sql, jobId, "draft_prepared", { draftNo: row.draft_no, targetModule, linkMode, countryId: effectiveCountryId, countryBranchId: effectiveCountryBranchId, cityBranchId: effectiveCityBranchId, unresolved: prepared.unresolved }, actorId, actorName);
      return { jobId, draftId: row.id, draftNo: row.draft_no, targetModule, linkMode, unresolved: prepared.unresolved };
    });
  }

  async listDrafts(scope: IntakeScope, filters: { targetModule?: string; status?: string; jobId?: string } = {}) {
    try {
      const rows = await withLocalPg(async (sql) => {
        const where: any[] = [sql`d.deleted_at IS NULL`];
        if (filters.targetModule) where.push(sql`d.target_module = ${filters.targetModule}`);
        where.push(filters.status ? sql`d.status = ${filters.status}` : sql`d.status = 'prepared'`);
        if (filters.jobId) where.push(sql`d.job_id = ${filters.jobId}`);
        if (scope.domain) where.push(sql`d.operational_domain = ${scope.domain}`);
        if (scope.countryIds) where.push(sql`(d.country_id IS NULL OR d.country_id = ANY(${scope.countryIds}))`);
        if (scope.cityBranchIds) where.push(sql`(d.city_branch_id IS NULL OR d.city_branch_id = ANY(${scope.cityBranchIds}))`);
        if (scope.clearingAgentIds) where.push(sql`(d.clearing_agent_id IS NULL OR d.clearing_agent_id = ANY(${scope.clearingAgentIds}))`);
        const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
        return sql`SELECT d.* FROM public.document_intake_drafts_v d WHERE ${w} ORDER BY d.created_at DESC LIMIT 100`;
      });
      return rows ?? [];
    } catch (err) {
      console.warn("document_intake_drafts_v notice:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  async getDraft(draftId: string, scope: IntakeScope) {
    try {
      return await withLocalPg(async (sql) => {
        const d = (await sql`SELECT * FROM public.document_intake_drafts_v WHERE id = ${draftId} AND deleted_at IS NULL`)?.[0];
        if (!d) return null;
        assertRowInScope(scope, { country_id: d.country_id, city_branch_id: d.city_branch_id, clearing_agent_id: d.clearing_agent_id, operational_domain: d.operational_domain });
        return d;
      });
    } catch (err) {
      console.warn("document_intake_drafts_v get notice:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async discardDraft(draftId: string, reason: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const d = (await sql`SELECT * FROM public.document_intake_drafts WHERE id = ${draftId} AND deleted_at IS NULL`)?.[0];
      if (!d) throw new Error("Draft not found.");
      assertRowInScope(scope, { country_id: d.country_id, city_branch_id: d.city_branch_id, clearing_agent_id: d.clearing_agent_id, operational_domain: d.operational_domain });
      if (d.status === "consumed") throw new Error("A consumed draft cannot be discarded — reverse the created record in its own module.");
      await sql`UPDATE public.document_intake_drafts SET status = 'discarded', discarded_reason = ${reason}, updated_at = now() WHERE id = ${draftId}`;
      await sql`UPDATE public.document_intake_jobs SET status = 'review', draft_id = NULL, draft_reference = NULL, updated_at = now()
        WHERE id = ${d.job_id} AND status = 'draft_ready'`;
      await event(sql, d.job_id, "draft_discarded", { draftNo: d.draft_no, reason }, actorId, actorName);
      return { draftId };
    });
  }

  /**
   * Called BY the target module's authorized new-entry flow once it has created
   * the real record. Idempotent per (module, source_id). Never creates or posts
   * anything itself — it only records that the draft was used.
   */
  async consumeDraft(draftId: string, createdSourceModule: string, createdSourceId: string, actorId: string, actorName: string | null, scope: IntakeScope) {
    return withLocalPg(async (sql) => {
      const d = (await sql`SELECT * FROM public.document_intake_drafts WHERE id = ${draftId} AND deleted_at IS NULL`)?.[0];
      if (!d) throw new Error("Draft not found.");
      assertRowInScope(scope, { country_id: d.country_id, city_branch_id: d.city_branch_id, clearing_agent_id: d.clearing_agent_id, operational_domain: d.operational_domain });
      if (d.status === "consumed") {
        if (d.consumed_source_id === createdSourceId) return { draftId, jobId: d.job_id, alreadyConsumed: true };
        throw new Error("This draft was already used to create a different record.");
      }
      if (d.status !== "prepared") throw new Error(`Draft is ${d.status}.`);
      await sql`UPDATE public.document_intake_drafts SET
        status = 'consumed', consumed_source_module = ${createdSourceModule}, consumed_source_id = ${createdSourceId},
        consumed_by = ${actorId}, consumed_by_name = ${actorName}, consumed_at = now(), updated_at = now()
        WHERE id = ${draftId}`;
      await sql`UPDATE public.document_intake_jobs SET
        status = 'linked', matched_source_module = ${createdSourceModule}, matched_source_id = ${createdSourceId}, updated_at = now()
        WHERE id = ${d.job_id}`;
      await event(sql, d.job_id, "draft_consumed", { draftNo: d.draft_no, createdSourceModule, createdSourceId }, actorId, actorName);
      return { draftId, jobId: d.job_id };
    });
  }

  // ── document type registry ───────────────────────────────────────────
  async listDocTypes(countryId?: string | null) {
    return loadRegistry(countryId);
  }
}

export const documentIntakeService = new DocumentIntakeService();
