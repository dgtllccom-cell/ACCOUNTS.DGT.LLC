/**
 * Server-side transcription (optional accuracy pass).
 *
 * The BROWSER is the primary speech-to-text engine (Web Speech API, all 5 ERP
 * languages) — it produces the transcript that the user reviews before
 * submitting. This module only adds an OPTIONAL server re-transcription with
 * OpenAI Whisper when OPENAI_API_KEY is configured, to improve accuracy for
 * longer recordings. It NEVER fabricates a transcript and has no mock path.
 */

import { withLocalPg } from "@/lib/db/local-postgres";
import { readVoiceAudio } from "@/lib/services/voice-audio-storage";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const LANGUAGE_CODES: Record<SupportedLanguage, string> = { en: "en", ur: "ur", ps: "ps", fa: "fa", ar: "ar" };

export function serverTranscriptionAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.SPEECH_TO_TEXT_PROVIDER !== "off";
}

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  languageHint: SupportedLanguage,
  filename: string,
): Promise<{ text: string; language: string; confidence: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audioBuffer)]), filename);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  form.append("language", LANGUAGE_CODES[languageHint]);
  form.append("temperature", "0");
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { text: string; language?: string };
  return {
    text: json.text || "",
    language: json.language || LANGUAGE_CODES[languageHint],
    confidence: json.language === LANGUAGE_CODES[languageHint] ? 0.95 : 0.75,
  };
}

/**
 * Re-transcribe a submitted voice job's audio if a server provider is
 * configured. Updates document_intake_jobs.transcript on success and returns
 * the improved text. Returns null when no provider is configured or on any
 * failure (the browser transcript then stands).
 */
export async function maybeServerTranscribe(job: {
  jobId: string;
  audioBuffer: Buffer;
  originalLanguage: SupportedLanguage;
}): Promise<string | null> {
  if (!serverTranscriptionAvailable()) return null;
  const started = Date.now();
  try {
    const { text } = await transcribeWithWhisper(job.audioBuffer, job.originalLanguage, `voice_${job.jobId}.webm`);
    if (!text.trim()) return null;
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.document_intake_jobs
        SET transcript = ${text},
            extraction_summary = coalesce(extraction_summary, '{}'::jsonb) || ${sql.json({
              serverTranscription: { provider: "openai_whisper", ms: Date.now() - started },
            })},
            updated_at = now()
        WHERE id = ${job.jobId}
      `;
    });
    return text;
  } catch (err) {
    console.warn("[transcription] server pass failed, keeping browser transcript:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Re-transcribe an already-stored voice job from its saved audio blob.
 * Used by POST /api/erp/voice-messages/[id]/transcribe.
 */
export async function retranscribeJob(jobId: string): Promise<{ transcript: string; source: "server" | "existing" }> {
  const jobRow = await withLocalPg(async (sql) => {
    const rows = await sql`
      SELECT id, audio_storage_key, original_language, transcript, source_type
      FROM public.document_intake_jobs
      WHERE id = ${jobId} AND deleted_at IS NULL
    `;
    return rows?.[0] ?? null;
  });
  if (!jobRow) throw new Error("Voice job not found.");
  if (jobRow.source_type !== "voice" || !jobRow.audio_storage_key || jobRow.audio_storage_key === "__pending__") {
    throw new Error("This job has no stored audio to re-transcribe.");
  }
  if (!serverTranscriptionAvailable()) {
    return { transcript: jobRow.transcript || "", source: "existing" };
  }
  const { buffer } = await readVoiceAudio(jobRow.audio_storage_key);
  const lang = (jobRow.original_language || "en") as SupportedLanguage;
  const { text } = await transcribeWithWhisper(buffer, lang, `voice_${jobId}.webm`);
  await withLocalPg(async (sql) => {
    await sql`UPDATE public.document_intake_jobs SET transcript = ${text}, updated_at = now() WHERE id = ${jobId}`;
  });
  return { transcript: text, source: "server" };
}
