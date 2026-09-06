import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * GET /api/erp/voice-messages
 * History of the current user's voice / typed AI-entry submissions, scoped to
 * their country/branch/domain. Newest first.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, scope } = await guardIntake("read");
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1), 200);
    const mine = request.nextUrl.searchParams.get("scope") !== "all" || !scope.isSuperAdmin;

    const rows = await withLocalPg(async (sql) => {
      const countryFilter = scope.countryIds && scope.countryIds.length
        ? sql`AND (country_id = ANY(${scope.countryIds}) OR country_id IS NULL)`
        : sql``;
      const mineFilter = mine ? sql`AND uploaded_by = ${session.userId}` : sql``;
      const domainFilter = scope.domain ? sql`AND operational_domain = ${scope.domain}` : sql``;
      return sql`
        SELECT id, job_no, source_type, original_language, operational_domain,
               transcript, audio_duration_seconds, audio_mime_type,
               audio_storage_key IS NOT NULL AND audio_storage_key <> '__pending__' AS has_audio,
               status, doc_type_code, target_module, match_status,
               uploaded_by_name, created_at, updated_at
        FROM public.document_intake_jobs
        WHERE deleted_at IS NULL
          AND source_type IN ('voice', 'text')
          ${mineFilter} ${countryFilter} ${domainFilter}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    });

    return apiOk({ messages: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
