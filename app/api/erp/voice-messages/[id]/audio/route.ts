import { NextRequest, NextResponse } from "next/server";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";
import { readVoiceAudio } from "@/lib/services/voice-audio-storage";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/erp/voice-messages/[id]/audio
 * Streams the stored voice recording back for playback. Scope-checked; the file
 * lives in private storage and is never served statically.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardIntake("read");
    const { id } = await params;

    const job = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT audio_storage_key, audio_mime_type, country_id, uploaded_by
        FROM public.document_intake_jobs
        WHERE id = ${id} AND deleted_at IS NULL
      `;
      return rows?.[0] ?? null;
    });
    if (!job || !job.audio_storage_key || job.audio_storage_key === "__pending__") {
      return NextResponse.json({ error: "No audio for this job." }, { status: 404 });
    }

    if (!scope.isSuperAdmin) {
      const ownScope =
        job.uploaded_by === session.userId ||
        (scope.countryIds && job.country_id && scope.countryIds.includes(job.country_id));
      if (!ownScope) return NextResponse.json({ error: "Outside your scope." }, { status: 403 });
    }

    const { buffer, mime } = await readVoiceAudio(job.audio_storage_key);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": job.audio_mime_type || mime,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: unknown) {
    rethrowIfNextControlFlow(error);
    const message = error instanceof Error ? error.message : "Failed to load audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
