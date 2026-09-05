/**
 * Transcription Service
 *
 * Async worker that converts audio to text using OpenAI Whisper API.
 * Supports all 5 languages with language hint to improve accuracy.
 * Stores result back to voice_messages table.
 */

import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type TranscriptionJob = {
  voiceMessageId: string;
  audioStorageKey: string;
  originalLanguage: SupportedLanguage;
  audioMimeType: string;
};

export type TranscriptionResult = {
  voiceMessageId: string;
  transcript: string;
  detectedLanguage: SupportedLanguage;
  detectedLanguageConfidence: number;
  processingTimeMs: number;
  provider: string;
};

const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: "en",
  ur: "ur", // Urdu
  ps: "ps", // Pashto
  fa: "fa", // Persian/Farsi
  ar: "ar", // Arabic
};

/**
 * Transcribe audio using OpenAI Whisper API.
 * The API automatically detects language but we provide a hint for better accuracy.
 */
async function transcribeWithWhisper(
  audioBuffer: Buffer,
  languageHint: SupportedLanguage,
  filename: string,
): Promise<{ text: string; language: string; detectedLanguageConfidence: number }> {
  // Use OpenAI Whisper API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  try {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }), filename);
    formData.append("model", "whisper-1");
    formData.append("language", LANGUAGE_CODES[languageHint]);
    formData.append("temperature", "0");
    formData.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${response.status} ${error}`);
    }

    const result = (await response.json()) as {
      text: string;
      language?: string;
    };

    // Whisper returns language code (en, ur, ar, etc.)
    // Map it back to our supported languages
    const detectedLang = result.language || LANGUAGE_CODES[languageHint];
    const confidence = result.language === LANGUAGE_CODES[languageHint] ? 0.95 : 0.75;

    return {
      text: result.text || "",
      language: detectedLang,
      detectedLanguageConfidence: confidence,
    };
  } catch (error) {
    console.error("Whisper transcription error:", error);
    throw error;
  }
}

/**
 * Fallback: Local transcription using pre-recorded mock data (for testing/offline).
 */
function transcribeWithMock(languageHint: SupportedLanguage): {
  text: string;
  language: string;
  detectedLanguageConfidence: number;
} {
  const mockTranscriptions: Record<SupportedLanguage, string> = {
    en: "Make a payment of fifty thousand to ABC Bank today",
    ur: "روپے کی رقم ہے پندرہ ہزار، حساب ہے ایبی سی کمپنی بینک، آج کی تاریخ",
    ps: "پنجاه زره پول بنک ABC ته امروز ورکړه",
    fa: "پنجاه هزار تومان به بانک ABC امروز بپرداخت",
    ar: "ادفع خمسين ألف إلى بنك إيه بي سي اليوم",
  };

  return {
    text: mockTranscriptions[languageHint],
    language: LANGUAGE_CODES[languageHint],
    detectedLanguageConfidence: 0.98,
  };
}

/**
 * Process a transcription job: read audio from storage, transcribe, store result.
 */
export async function processTranscriptionJob(job: TranscriptionJob): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const provider = process.env.SPEECH_TO_TEXT_PROVIDER || "openai_whisper";

  try {
    // Validate voice message exists and is in 'transcribing' status
    const voiceMessage = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT id, audio_storage_key, original_language_code, status
        FROM public.voice_messages
        WHERE id = ${job.voiceMessageId} AND status = 'transcribing'
      `;
      return rows?.[0];
    });

    if (!voiceMessage) {
      throw new Error(
        `Voice message ${job.voiceMessageId} not found or not in transcribing status`,
      );
    }

    // In production: read audio from S3 or storage
    // For now: placeholder - assume audioBuffer is passed in job
    const audioBuffer = Buffer.alloc(0); // TODO: implement storage read

    // Transcribe based on provider
    let transcriptionResult;
    if (provider === "mock_transcriber" || process.env.NODE_ENV === "test") {
      transcriptionResult = transcribeWithMock(job.originalLanguage);
    } else {
      transcriptionResult = await transcribeWithWhisper(
        audioBuffer,
        job.originalLanguage,
        `voice_${job.voiceMessageId}.wav`,
      );
    }

    // Store transcription back to voice_messages
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.voice_messages
        SET
          transcription_raw = ${transcriptionResult.text},
          detected_language_confidence = ${transcriptionResult.detectedLanguageConfidence},
          transcription_ai_provider = ${provider},
          transcription_ms = ${Date.now() - startTime},
          status = 'transcribed',
          updated_at = now()
        WHERE id = ${job.voiceMessageId}
      `;
    });

    return {
      voiceMessageId: job.voiceMessageId,
      transcript: transcriptionResult.text,
      detectedLanguage: (transcriptionResult.language as SupportedLanguage) || job.originalLanguage,
      detectedLanguageConfidence: transcriptionResult.detectedLanguageConfidence,
      processingTimeMs: Date.now() - startTime,
      provider,
    };
  } catch (error) {
    // Log error and update status
    const errorMessage = error instanceof Error ? error.message : String(error);
    await withLocalPg(async (sql) => {
      await sql`
        UPDATE public.voice_messages
        SET
          status = 'error',
          error_message = ${errorMessage},
          updated_at = now()
        WHERE id = ${job.voiceMessageId}
      `;
    });

    throw error;
  }
}

/**
 * Queue a transcription job (async, typically called after voice message upload).
 * In production, this would write to a job queue (Redis, SQS, etc.).
 * For now, process immediately.
 */
export async function queueTranscription(
  voiceMessageId: string,
  audioStorageKey: string,
  originalLanguage: SupportedLanguage,
  audioMimeType: string,
): Promise<void> {
  const job: TranscriptionJob = {
    voiceMessageId,
    audioStorageKey,
    originalLanguage,
    audioMimeType,
  };

  // TODO: In production, write to job queue (Redis, SQS, etc.)
  // For now, process immediately for testing
  if (process.env.ASYNC_TRANSCRIPTION === "true") {
    // In a real implementation, this would be a background job
    // For now, we'll just queue it
    console.log(`[Transcription] Queued job for voice message ${voiceMessageId}`);
  } else {
    // Synchronous processing for testing
    console.log(`[Transcription] Processing synchronously: ${voiceMessageId}`);
    await processTranscriptionJob(job);
  }
}

/**
 * Bulk process multiple transcription jobs (for admin/batching).
 */
export async function bulkProcessTranscriptions(
  voiceMessageIds: string[],
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];

  for (const id of voiceMessageIds) {
    try {
      const voiceMessage = await withLocalPg(async (sql) => {
        const rows = await sql`
          SELECT id, audio_storage_key, original_language_code, audio_mime_type
          FROM public.voice_messages
          WHERE id = ${id} AND status = 'transcribing'
        `;
        return rows?.[0];
      });

      if (!voiceMessage) {
        console.warn(`Voice message ${id} not found or not in transcribing status, skipping`);
        continue;
      }

      const result = await processTranscriptionJob({
        voiceMessageId: id,
        audioStorageKey: voiceMessage.audio_storage_key,
        originalLanguage: voiceMessage.original_language_code,
        audioMimeType: voiceMessage.audio_mime_type,
      });

      results.push(result);
    } catch (error) {
      console.error(`Failed to transcribe voice message ${id}:`, error);
      // Continue with next message
    }
  }

  return results;
}
