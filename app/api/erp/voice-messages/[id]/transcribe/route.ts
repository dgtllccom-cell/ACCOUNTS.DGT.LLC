import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { retranscribeJob, serverTranscriptionAvailable } from "@/lib/services/transcription-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * POST /api/erp/voice-messages/[id]/transcribe
 * Re-run server transcription on a stored voice job's audio (accuracy pass).
 * Requires OPENAI_API_KEY — otherwise returns the existing browser transcript
 * and reports that no server provider is configured.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guardIntake("write");
    const { id } = await params;
    const result = await retranscribeJob(id);
    return apiOk({
      transcript: result.transcript,
      source: result.source,
      serverProviderConfigured: serverTranscriptionAvailable(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
