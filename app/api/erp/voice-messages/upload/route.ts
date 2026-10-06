import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { aiVoiceTextEntryService } from "@/lib/services/ai-voice-text-entry";
import { maybeServerTranscribe } from "@/lib/services/transcription-service";

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
 * Submit a voice message or typed instruction for AI processing.
 * - Voice: multipart { audio, transcript (from browser Web Speech API), durationSeconds, ... }
 * - Text:  JSON { transcript, ... }
 *
 * The browser performs speech-to-text (Web Speech API) and sends the transcript.
 * If a server transcription provider is configured (OPENAI_API_KEY /
 * SPEECH_TO_TEXT_PROVIDER) it re-transcribes for higher accuracy; otherwise the
 * browser transcript stands. No mock transcription is ever used here.
 */
export async function POST(request: NextRequest) {
  try {
    const { scope, session } = await guardIntake("write");

    const contentType = request.headers.get("content-type") || "";
    let input: z.infer<typeof uploadSchema>;
    let audioBuffer: Buffer | undefined;
    let audioMimeType: string | undefined;
    let audioDurationSeconds: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const audioFile = formData.get("audio");
      const duration = formData.get("durationSeconds");

      input = uploadSchema.parse({
        sourceType: formData.get("sourceType"),
        transcript: formData.get("transcript"),
        originalLanguage: formData.get("originalLanguage"),
        operationalDomain: formData.get("operationalDomain"),
        countryId: formData.get("countryId") || undefined,
        countryBranchId: formData.get("countryBranchId") || undefined,
        cityBranchId: formData.get("cityBranchId") || undefined,
        clearingAgentId: formData.get("clearingAgentId") || undefined,
        sourceModuleHint: formData.get("sourceModuleHint") || undefined,
        idempotencyKey: formData.get("idempotencyKey") || undefined,
      });

      if (input.sourceType === "voice") {
        if (!(audioFile instanceof File)) {
          return apiOk({ error: "Audio file is required for voice messages" }, { status: 400 });
        }
        audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        audioMimeType = audioFile.type || "audio/webm";
        audioDurationSeconds = duration ? parseInt(String(duration), 10) : undefined;
      }
    } else {
      input = uploadSchema.parse(await request.json());
    }

    const result = await aiVoiceTextEntryService.submitVoiceTextInput(
      {
        sourceType: input.sourceType,
        originalLanguage: input.originalLanguage,
        operationalDomain: input.operationalDomain,
        transcript: input.transcript,
        audioBuffer,
        audioMimeType,
        audioDurationSeconds,
        countryId: input.countryId,
        countryBranchId: input.countryBranchId,
        cityBranchId: input.cityBranchId,
        clearingAgentId: input.clearingAgentId,
        companyId: (session as { companyId?: string }).companyId,
        sourceModuleHint: input.sourceModuleHint,
        idempotencyKey: input.idempotencyKey,
      },
      session.userId,
      (session as { userName?: string }).userName || null,
      scope,
    );

    if (!result) {
      return apiOk({ error: "Failed to create AI intake job" }, { status: 500 });
    }

    // Optional server-side re-transcription for accuracy — only runs when a real
    // provider is configured. Never blocks; never fabricates.
    let serverTranscript: string | null = null;
    if (input.sourceType === "voice" && audioBuffer && result.audioStorageKey) {
      serverTranscript = await maybeServerTranscribe({
        jobId: result.jobId,
        audioBuffer,
        originalLanguage: input.originalLanguage,
      }).catch(() => null);
    }

    return apiOk({
      jobId: result.jobId,
      jobNo: result.jobNo,
      status: "submitted",
      transcript: serverTranscript || input.transcript,
      transcriptSource: serverTranscript ? "server" : "browser",
      nextStep: "intent_analysis",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
