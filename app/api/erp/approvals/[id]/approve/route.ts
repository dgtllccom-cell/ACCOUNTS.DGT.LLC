import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { aiVoiceTextEntryService } from "@/lib/services/ai-voice-text-entry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  approverNotes: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { scope, session } = await guardIntake("write");
    const body = bodySchema.parse(await request.json());

    const workflow = await aiVoiceTextEntryService.approveWorkflow(
      id,
      session.userId,
      body.approverNotes,
    );

    return apiOk({
      workflowId: workflow.id,
      status: "approved",
      message: "Draft approved and ready for posting",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
