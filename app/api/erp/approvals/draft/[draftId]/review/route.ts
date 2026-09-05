import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { aiVoiceTextEntryService } from "@/lib/services/ai-voice-text-entry";

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
 * POST /api/erp/approvals/draft/{draftId}/review
 *
 * Submit review of an AI-generated draft.
 * Actions: approve (move to final approver), reject (stop), return (corrections needed)
 *
 * Returns: { workflowId, status, nextApprover }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { draftId: string } },
) {
  try {
    const { scope, session } = await guardIntake("update");
    const body = reviewSchema.parse(await request.json());

    const workflowId = params.draftId;

    switch (body.action) {
      case "approve":
        const approved = await aiVoiceTextEntryService.approveWorkflow(
          workflowId,
          session.userId,
          body.reviewerNotes,
        );
        return apiOk({
          workflowId: approved.id,
          status: "approved",
          nextStep: "awaiting_final_approval",
        });

      case "reject":
        const rejected = await aiVoiceTextEntryService.rejectWorkflow(
          workflowId,
          body.rejectionReason || "No reason provided",
        );
        return apiOk({
          workflowId: rejected.id,
          status: "rejected",
          message: "Draft has been rejected and cannot be posted",
        });

      case "return":
        const returned = await aiVoiceTextEntryService.returnForReview(
          workflowId,
          body.returnReason || "Corrections needed",
        );
        return apiOk({
          workflowId: returned.id,
          status: "returned_for_review",
          corrections: body.corrections,
          nextStep: "awaiting_submitter_corrections",
        });

      default:
        return apiOk({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
