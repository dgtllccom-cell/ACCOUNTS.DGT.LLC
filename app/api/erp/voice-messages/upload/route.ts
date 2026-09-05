import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { aiVoiceTextEntryService } from "@/lib/services/ai-voice-text-entry";
import { queueTranscription } from "@/lib/services/transcription-service";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const uploadSchema = z.object({
  sourceType: z.enum(["voice", "text"]),
  originalLanguage: z.enum(["en", "ur", "ps", "fa", "ar"]),
  operationalDomain: z.enum(["business", "shipping"]),
  transcript: z.string().min(1).max(50000),
  countryId: z.string().uuid().optional(),
  countryBranchId: z.string().uuid().optional(),
  cityBranchId: z.string().uuid().optional(),
  clearingAgentId: z.string().uuid().optional(),
  sourceModuleHint: z.string().max(120).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

/**
 * POST /api/erp/voice-messages/upload
 *
 * Submit a voice message or text instruction for AI processing.
 * - Voice: multipart file + transcript
 * - Text: freeform text instruction
 *
 * Returns: { jobId, jobNo, status }
 */
export async function POST(request: NextRequest) {
  try {
    const { scope, session } = await guardIntake("write");

    // Parse form data (for file) or JSON (for text-only)
    const contentType = request.headers.get("content-type") || "";
    let input: z.infer<typeof uploadSchema>;
    let audioBuffer: Buffer | undefined;
    let audioDurationSeconds: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Voice message with audio file
      const formData = await request.formData();

      const sourceType = formData.get("sourceType") as string;
      const transcript = formData.get("transcript") as string;
      const originalLanguage = formData.get("originalLanguage") as string;
      const operationalDomain = formData.get("operationalDomain") as string;
      const audioFile = formData.get("audio") as File | null;
      const duration = formData.get("durationSeconds") as string;

      input = uploadSchema.parse({
        sourceType,
        transcript,
        originalLanguage,
        operationalDomain,
        countryId: formData.get("countryId") || undefined,
        countryBranchId: formData.get("countryBranchId") || undefined,
        cityBranchId: formData.get("cityBranchId") || undefined,
        clearingAgentId: formData.get("clearingAgentId") || undefined,
        sourceModuleHint: formData.get("sourceModuleHint") || undefined,
        idempotencyKey: formData.get("idempotencyKey") || undefined,
      });

      if (!audioFile) {
        return apiOk({ error: "Audio file is required for voice messages" }, { status: 400 });
      }

      audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      audioDurationSeconds = duration ? parseInt(duration) : undefined;
    } else {
      // Text instruction (JSON body)
      input = uploadSchema.parse(await request.json());
    }

    // Submit to AI service
    const result = await aiVoiceTextEntryService.submitVoiceTextInput(
      {
        sourceType: input.sourceType,
        originalLanguage: input.originalLanguage,
        operationalDomain: input.operationalDomain,
        transcript: input.transcript,
        audioBuffer,
        audioDurationSeconds,
        countryId: input.countryId,
        countryBranchId: input.countryBranchId,
        cityBranchId: input.cityBranchId,
        clearingAgentId: input.clearingAgentId,
        companyId: (session as any)?.companyId,
        sourceModuleHint: input.sourceModuleHint,
        idempotencyKey: input.idempotencyKey,
      },
      session.userId,
      (session as any)?.userName || null,
      scope,
    );

    // Queue transcription (if voice)
    if (input.sourceType === "voice" && result) {
      await queueTranscription(
        result.jobId,
        `voice/${result.jobNo}/${crypto.randomBytes(8).toString("hex")}.webm`,
        input.originalLanguage,
        "audio/webm",
      );
    }

    if (!result) {
      return apiOk({ error: "Failed to create document intake job" }, { status: 500 });
    }

    return apiOk({
      jobId: result.jobId,
      jobNo: result.jobNo,
      status: "submitted",
      nextStep: input.sourceType === "voice" ? "transcribing" : "intent_analysis",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
