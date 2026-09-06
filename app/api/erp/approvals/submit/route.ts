import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";
import { auditApiAction } from "@/lib/api/audit";
import { assertRowInScope } from "@/lib/document-intelligence/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  submitterNotes: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/erp/approvals/submit  { jobId }
 *
 * A reviewer sends a reviewed AI-intake draft (job in `review` / `qvc` /
 * `draft_ready`) into the approval queue. Creates one `approval_workflows` row
 * (status = pending). The draft is NOT posted here — a separate approver
 * approves it, then it is consumed into the real ERP record through the
 * module's own workflow. Idempotent: an open workflow for the job is reused.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardIntake("write");
    const { jobId, submitterNotes } = bodySchema.parse(await request.json());

    const result = await withLocalPg(async (sql) => {
      const job = (await sql`
        SELECT id, job_no, status, country_id, city_branch_id, clearing_agent_id, operational_domain
        FROM public.document_intake_jobs WHERE id = ${jobId} AND deleted_at IS NULL
      `)?.[0];
      if (!job) return { error: "not_found" as const };
      assertRowInScope(scope, job);
      if (!["review", "qvc", "draft_ready"].includes(job.status)) {
        return { error: `bad_status:${job.status}` as const };
      }

      const existing = (await sql`
        SELECT id, status FROM public.approval_workflows
        WHERE document_intake_job_id = ${jobId} AND deleted_at IS NULL
          AND status IN ('pending', 'returned_for_review')
        ORDER BY submitted_at DESC LIMIT 1
      `)?.[0];
      if (existing) return { workflow: existing, reused: true, job };

      const [wf] = await sql`
        INSERT INTO public.approval_workflows
          (document_intake_job_id, status, submitted_by, submitted_at, reviewer_notes)
        VALUES (${jobId}, 'pending', ${session.userId}, now(), ${submitterNotes ?? null})
        RETURNING id, status, submitted_at
      `;
      await sql`
        INSERT INTO public.document_intake_events (job_id, action, payload, actor_id, actor_name)
        VALUES (${jobId}, 'approval_submitted',
          ${sql.json({ workflowId: wf.id })}, ${session.userId}, ${session.fullName ?? null})
      `;
      return { workflow: wf, reused: false, job };
    });

    if (!result || "error" in result) {
      const e = result?.error ?? "unknown";
      if (e === "not_found") return apiError("NOT_FOUND", "Document job not found in your scope.", 404);
      if (String(e).startsWith("bad_status")) {
        return apiError("BAD_REQUEST", `A draft can only be submitted for approval from a reviewed job (job is ${String(e).split(":")[1]}).`, 400);
      }
      return apiError("SERVER_ERROR", "Could not submit for approval.", 500);
    }

    await auditApiAction(request, {
      action: "approval.workflow.submit",
      entityTable: "approval_workflows",
      entityId: result.workflow.id,
      after: { jobId, jobNo: result.job.job_no, reused: result.reused },
    });

    return apiCreated({ workflowId: result.workflow.id, status: result.workflow.status, reused: result.reused });
  } catch (error) {
    return handleApiError(error);
  }
}
