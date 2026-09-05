import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { processTranscriptionJob } from "@/lib/services/transcription-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const voiceMsg = await withLocalPg(async (sql) =>
      sql`SELECT audio_storage_key, original_language_code FROM voice_messages WHERE id=${id}`.then(r => r?.[0])
    );
    if (!voiceMsg) return apiOk({ error: "Not found" }, { status: 404 });

    const result = await processTranscriptionJob({
      voiceMessageId: id,
      audioStorageKey: voiceMsg.audio_storage_key,
      originalLanguage: voiceMsg.original_language_code,
      audioMimeType: "audio/webm",
    });

    return apiOk({ transcript: result.transcript, processingTimeMs: result.processingTimeMs });
  } catch (error) {
    return handleApiError(error);
  }
}
