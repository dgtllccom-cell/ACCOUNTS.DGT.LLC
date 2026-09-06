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

const bodySchema = z.object({
  approverNotes: z.string().max(2000).optional(),
});

/**
 * POST /api/erp/approvals/{workflowId}/approve
 *
 * Final-approve a submitted AI-intake draft. The draft is NOT posted here —
 * approval only clears it for consumption into the real ERP record through the
 * module's own workflow (which keeps its own DR/CR + serial rules).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { session, scope } = await guardIntake("write");

    // scope-check the workflow's job before touching it
    const guard = await withLocalPg(async (sql) => {
      const row = (await sql`
        SELECT j.id, j.job_no, j.country_id, j.city_branch_id, j.clearing_agent_id, j.operational_domain, w.status
        FROM public.approval_workflows w
        JOIN public.document_intake_jobs j ON j.id = w.document_intake_job_id
        WHERE w.id = ${id} AND w.deleted_at IS NULL
      `)?.[0];
      return row ?? null;
    });
    if (!guard) return apiError("NOT_FOUND", "Approval workflow not found.", 404);
    assertRowInScope(scope, guard);

    const body = bodySchema.parse(await request.json());
    const workflow = await aiVoiceTextEntryService.approveWorkflow(id, session.userId, body.approverNotes);

    await auditApiAction(request, {
      action: "approval.workflow.approve",
      entityTable: "approval_workflows",
      entityId: workflow.id,
      after: { jobNo: guard.job_no, status: "approved" },
    });

    return apiOk({
      workflowId: workflow.id,
      status: "approved",
      message: "Draft approved — ready to be consumed into its ERP record.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
