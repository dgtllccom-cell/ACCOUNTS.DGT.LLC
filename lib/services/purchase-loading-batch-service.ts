import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Partial Container Purchase Workflow (spec §11).
 *
 * One Purchase Booking for N containers. Documents arrive for a subset → the AI
 * proposes a Loading Batch (LOAD-01, LOAD-02, …) covering only those containers,
 * within the SAME country / branch / purchase scope. The user confirms; the
 * existing Purchase Loading form creates the loading records (pre-filled from
 * the batch). This service only proposes / groups / tracks — it never creates a
 * loading record, a payment, a container master, or a second purchase booking,
 * and never posts to any ledger.
 */

export type LoadingScope = {
  countryIds: string[] | null;      // null = global read
  countryBranchIds: string[] | null;
  cityBranchIds: string[] | null;
  isSuperAdmin: boolean;
};

const CONTAINER_RE = /\b([A-Z]{4}\d{7})\b/g;

function parseContainers(...values: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    // structured "ABCD1234567" codes first
    const codes = String(v).toUpperCase().match(CONTAINER_RE);
    if (codes) codes.forEach((c) => out.add(c));
    // otherwise split a free list
    if (!codes) {
      String(v).split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length >= 4 && s.length <= 20).forEach((s) => out.add(s.toUpperCase()));
    }
  }
  return [...out];
}

function scopeOk(scope: LoadingScope, row: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }): boolean {
  if (scope.isSuperAdmin) return true;
  if (scope.countryIds && row.country_id && !scope.countryIds.includes(row.country_id)) return false;
  if (scope.countryBranchIds && row.country_branch_id && !scope.countryBranchIds.includes(row.country_branch_id)) return false;
  if (scope.cityBranchIds && row.city_branch_id && !scope.cityBranchIds.includes(row.city_branch_id)) return false;
  return true;
}

export class PurchaseLoadingBatchService {
  async progressForOrder(purchaseOrderId: string, scope: LoadingScope) {
    return withLocalPg(async (sql) => {
      const po = (await sql`SELECT id, country_id, country_branch_id, purchase_order_no,
        form_data->'form'->>'purchaseContractNo' AS purchase_contract_no
        FROM public.purchase_orders WHERE id = ${purchaseOrderId} AND deleted_at IS NULL`)?.[0];
      if (!po) return null;
      if (!scopeOk(scope, po)) throw new Error("Purchase order is outside your authorized scope.");
      const progress = (await sql`SELECT * FROM public.purchase_loading_progress_v WHERE purchase_order_id = ${purchaseOrderId}`)?.[0] ?? null;
      const batches = await sql`SELECT * FROM public.purchase_loading_batches WHERE purchase_order_id = ${purchaseOrderId} AND deleted_at IS NULL ORDER BY created_at`;
      const loadedContainers = (await sql`SELECT DISTINCT container_number FROM public.purchase_loading_records
        WHERE purchase_order_id = ${purchaseOrderId} AND deleted_at IS NULL AND container_number IS NOT NULL AND container_number <> ''`).map((r: any) => r.container_number);
      return { purchaseOrder: po, progress, batches: batches ?? [], loadedContainers };
    });
  }

  async listBatches(scope: LoadingScope, filters: { purchaseOrderId?: string; status?: string } = {}) {
    return withLocalPg(async (sql) => {
      const where: any[] = [sql`b.deleted_at IS NULL`];
      if (filters.purchaseOrderId) where.push(sql`b.purchase_order_id = ${filters.purchaseOrderId}`);
      if (filters.status) where.push(sql`b.status = ${filters.status}`);
      if (!scope.isSuperAdmin && scope.countryIds) where.push(sql`(b.country_id IS NULL OR b.country_id = ANY(${scope.countryIds}))`);
      if (!scope.isSuperAdmin && scope.cityBranchIds) where.push(sql`(b.city_branch_id IS NULL OR b.city_branch_id = ANY(${scope.cityBranchIds}))`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return (await sql`SELECT b.* FROM public.purchase_loading_batches b WHERE ${w} ORDER BY b.created_at DESC LIMIT 200`) ?? [];
    });
  }

  /**
   * Propose a Loading Batch from an in-scope intake job that is matched to a
   * purchase order. Containers already loaded (or already in another live batch)
   * are excluded — no duplicates.
   */
  async proposeBatchFromJob(jobId: string, scope: LoadingScope, actorId: string, actorName: string | null) {
    return withLocalPg(async (sql) => {
      const job = (await sql`SELECT * FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL`)?.[0];
      if (!job) throw new Error("Intake job not found.");
      if (job.operational_domain !== "business") throw new Error("Loading batches are a business-domain workflow.");
      if (!["auto", "user"].includes(job.match_status) || job.matched_source_module !== "purchase_orders" || !job.matched_source_id) {
        throw new Error("This document is not linked to an in-scope purchase order — select the matching purchase order first.");
      }
      const po = (await sql`SELECT id, country_id, country_branch_id, city_branch_id, purchase_order_no,
        form_data->'form'->>'purchaseContractNo' AS purchase_contract_no,
        NULLIF(regexp_replace(COALESCE(form_data->'form'->>'containerCount', form_data->>'containerCount', '0'), '[^0-9]', '', 'g'), '')::int AS planned_containers
        FROM public.purchase_orders WHERE id = ${job.matched_source_id} AND deleted_at IS NULL`)?.[0];
      if (!po) throw new Error("Linked purchase order not found.");
      if (!scopeOk(scope, po)) throw new Error("Purchase order is outside your authorized scope.");
      // same-scope guarantee: the job's scope must match the PO's scope
      if (job.country_id && po.country_id && job.country_id !== po.country_id) {
        throw new Error("The document and the purchase order belong to different countries — cannot batch.");
      }

      // extracted containers
      const fields = await sql`SELECT field_key, corrected_value, normalized_value, raw_value
        FROM public.document_intake_fields WHERE job_id = ${jobId}
          AND lower(field_key) IN ('container_numbers','container_number','containers')`;
      const fromFields = parseContainers(
        ...(fields as any[]).flatMap((f) => [f.corrected_value, f.normalized_value, f.raw_value]),
        job.container_reference,
      );
      if (!fromFields.length) throw new Error("No container numbers were extracted from this document.");

      // exclude containers already loaded or already in a live batch for this PO
      const already = new Set<string>([
        ...(await sql`SELECT DISTINCT upper(container_number) c FROM public.purchase_loading_records
          WHERE purchase_order_id = ${po.id} AND deleted_at IS NULL AND container_number IS NOT NULL AND container_number <> ''`).map((r: any) => r.c),
        ...(await sql`SELECT unnest(container_numbers) c FROM public.purchase_loading_batches
          WHERE purchase_order_id = ${po.id} AND deleted_at IS NULL AND status IN ('proposed','confirmed','loaded')`).map((r: any) => String(r.c).toUpperCase()),
      ]);
      const containers = fromFields.filter((c) => !already.has(c.toUpperCase()));
      if (!containers.length) throw new Error("Every container in this document is already loaded or already in a batch for this purchase order.");

      const n = (await sql`SELECT count(*)::int c FROM public.purchase_loading_batches WHERE purchase_order_id = ${po.id} AND deleted_at IS NULL`)?.[0]?.c ?? 0;
      const batchNo = `LOAD-${String(n + 1).padStart(2, "0")}`;

      const draftId = job.draft_id ?? null;
      const row = (await sql`
        INSERT INTO public.purchase_loading_batches
          (batch_no, purchase_order_id, purchase_order_no, purchase_contract_no,
           country_id, country_branch_id, city_branch_id,
           source_intake_job_id, source_intake_draft_id,
           container_numbers, container_count, planned_container_count, status, created_by, created_by_name)
        VALUES
          (${batchNo}, ${po.id}, ${po.purchase_order_no}, ${po.purchase_contract_no},
           ${po.country_id}, ${po.country_branch_id}, ${po.city_branch_id},
           ${jobId}, ${draftId},
           ${containers}, ${containers.length}, ${po.planned_containers ?? null}, 'proposed', ${actorId}, ${actorName})
        RETURNING *`)?.[0];

      await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
        VALUES (${jobId}, 'loading_batch_proposed', ${sql.json({ batchNo, containers, purchaseOrder: po.purchase_order_no } as never)}, ${actorId}, ${actorName})`;

      return { batch: row, containers, batchNo, purchaseOrderNo: po.purchase_order_no, planned: po.planned_containers ?? null };
    });
  }

  async confirmBatch(batchId: string, scope: LoadingScope, actorId: string, actorName: string | null) {
    return withLocalPg(async (sql) => {
      const b = (await sql`SELECT * FROM public.purchase_loading_batches WHERE id = ${batchId} AND deleted_at IS NULL`)?.[0];
      if (!b) throw new Error("Loading batch not found.");
      if (!scopeOk(scope, b)) throw new Error("Loading batch is outside your authorized scope.");
      if (b.status === "cancelled") throw new Error("This batch was cancelled.");
      await sql`UPDATE public.purchase_loading_batches SET status = 'confirmed', confirmed_by = ${actorId}, confirmed_at = now(), updated_at = now()
        WHERE id = ${batchId} AND status = 'proposed'`;
      if (b.source_intake_job_id) {
        await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
          VALUES (${b.source_intake_job_id}, 'loading_batch_confirmed', ${sql.json({ batchNo: b.batch_no } as never)}, ${actorId}, ${actorName})`;
      }
      return { batchId, status: "confirmed", batchNo: b.batch_no, containerNumbers: b.container_numbers };
    });
  }

  async cancelBatch(batchId: string, reason: string, scope: LoadingScope, actorId: string, actorName: string | null) {
    return withLocalPg(async (sql) => {
      const b = (await sql`SELECT * FROM public.purchase_loading_batches WHERE id = ${batchId} AND deleted_at IS NULL`)?.[0];
      if (!b) throw new Error("Loading batch not found.");
      if (!scopeOk(scope, b)) throw new Error("Loading batch is outside your authorized scope.");
      const linked = (await sql`SELECT count(*)::int c FROM public.purchase_loading_records WHERE loading_batch_id = ${batchId} AND deleted_at IS NULL`)?.[0]?.c ?? 0;
      if (linked > 0) throw new Error("Loading records are already linked to this batch — reverse those in the Purchase Loading module first.");
      await sql`UPDATE public.purchase_loading_batches SET status = 'cancelled', cancelled_reason = ${reason}, updated_at = now() WHERE id = ${batchId}`;
      return { batchId, status: "cancelled" };
    });
  }
}

export const purchaseLoadingBatchService = new PurchaseLoadingBatchService();
