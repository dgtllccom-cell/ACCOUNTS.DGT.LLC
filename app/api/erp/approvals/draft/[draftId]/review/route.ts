import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { aiVoiceTextEntryService } from "@/lib/services/ai-voice-text-entry";
import { withLocalPg } from "@/lib/db/local-postgres";
import { auditApiAction } from "@/lib/api/audit";
import { assertRowInScope } from "@/lib/document-intelligence/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
  corrections: z.record(z.any()).optional(),
  reviewerNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
  returnReason: z.string().max(2000).optional(),
});

/**
 * POST /api/erp/approvals/draft/{workflowId}/review
 *   action: approve | reject | return
 *
 * The {workflowId} path segment is an `approval_workflows.id`. Scope-checked
 * against the workflow's document job, audited, and — for reject / return — the
 * source job is moved back so the reviewer can act on it again.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId: workflowId } = await params;
    const { session, scope } = await guardIntake("write");
    const body = reviewSchema.parse(await request.json());

    const guard = await withLocalPg(async (sql) => {
      const row = (await sql`
        SELECT j.id AS job_id, j.job_no, j.country_id, j.city_branch_id, j.clearing_agent_id, j.operational_domain, w.status
        FROM public.approval_workflows w
        JOIN public.document_intake_jobs j ON j.id = w.document_intake_job_id
        WHERE w.id = ${workflowId} AND w.deleted_at IS NULL
      `)?.[0];
      return row ?? null;
    });
    if (!guard) return apiError("NOT_FOUND", "Approval workflow not found.", 404);
    assertRowInScope(scope, guard);
    if (!["pending", "returned_for_review"].includes(guard.status)) {
      return apiError("CONFLICT", `This draft is already ${guard.status}.`, 409);
    }

    if (body.action === "approve") {
      const approved = await aiVoiceTextEntryService.approveWorkflow(workflowId, session.userId, body.reviewerNotes);
      await auditApiAction(request, { action: "approval.workflow.approve", entityTable: "approval_workflows", entityId: approved.id, after: { jobNo: guard.job_no } });
      return apiOk({ workflowId: approved.id, status: "approved", nextStep: "consume_into_erp_record" });
    }

    if (body.action === "reject") {
      const rejected = await aiVoiceTextEntryService.rejectWorkflow(workflowId, body.rejectionReason || "No reason provided");
      await withLocalPg(async (sql) => {
        await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
          VALUES (${guard.job_id}, 'approval_rejected', ${sql.json({ workflowId, reason: body.rejectionReason ?? null })}, ${session.userId}, ${session.fullName ?? null})`;
      });
      await auditApiAction(request, { action: "approval.workflow.reject", entityTable: "approval_workflows", entityId: rejected.id, after: { jobNo: guard.job_no, reason: body.rejectionReason ?? null } });
      return apiOk({ workflowId: rejected.id, status: "rejected", message: "Draft rejected — it cannot be posted." });
    }

    // return for correction — send the job back to review
    const returned = await aiVoiceTextEntryService.returnForReview(workflowId, body.returnReason || "Corrections needed");
    await withLocalPg(async (sql) => {
      await sql`UPDATE public.document_intake_jobs SET status = 'review', updated_at = now()
        WHERE id = ${guard.job_id} AND status IN ('draft_ready', 'qvc')`;
      await sql`INSERT INTO public.document_intake_events (job_id, action, detail, actor_id, actor_name)
        VALUES (${guard.job_id}, 'approval_returned', ${sql.json({ workflowId, reason: body.returnReason ?? null })}, ${session.userId}, ${session.fullName ?? null})`;
    });
    await auditApiAction(request, { action: "approval.workflow.return", entityTable: "approval_workflows", entityId: returned.id, after: { jobNo: guard.job_no, reason: body.returnReason ?? null } });
    return apiOk({ workflowId: returned.id, status: "returned_for_review", corrections: body.corrections, nextStep: "awaiting_submitter_corrections" });
  } catch (error) {
    return handleApiError(error);
  }
}
