import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/approvals/pending-for-me
 *
 * AI-intake drafts submitted for approval and not yet decided, scoped to the
 * caller's country (super admin / global-reports see all). Each row carries
 * enough job context (doc type, target module, field count, language) for the
 * approval queue to render without a second round-trip.
 */
export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardIntake("read");
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const scopeOk = scope.countryIds
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sql: any) => sql`(j.country_id IS NULL OR j.country_id = ANY(${scope.countryIds}))`
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sql: any) => sql`true`;

    const rows = await withLocalPg(async (sql) =>
      sql`
        SELECT
          w.id, w.document_intake_job_id, w.status, w.submitted_by, w.submitted_at,
          w.reviewer_id, w.reviewer_notes, w.approver_id, w.returned_reason,
          j.job_no, j.doc_type_code, j.target_module, j.original_filename,
          COALESCE(b.original_language, j.language_detected) AS original_language,
          COALESCE(b.source_type, j.upload_method)          AS source_type,
          j.country_name, j.city_branch_name,
          COALESCE(j.field_count,
            (SELECT count(*)::int FROM public.document_intake_fields f WHERE f.job_id = j.id)) AS field_count,
          p.full_name AS submitted_by_name
        FROM public.approval_workflows w
        JOIN public.document_intake_queue_v j ON w.document_intake_job_id = j.id
        JOIN public.document_intake_jobs b    ON b.id = w.document_intake_job_id
        LEFT JOIN public.profiles p ON p.id = w.submitted_by
        WHERE w.status IN ('pending', 'returned_for_review')
          AND w.approver_id IS NULL
          AND w.deleted_at IS NULL
          AND ${scopeOk(sql)}
        ORDER BY w.submitted_at DESC
        LIMIT 50
      `,
    );

    let localizedRows: any[] = rows ?? [];
    try {
      localizedRows = await localizeJoinedNames(localizedRows, lang, [
        { idField: "submitted_by", nameField: "submitted_by_name", table: "profiles", field: "full_name" }
      ]);
    } catch {
      // keep original names
    }
    return apiOk({ rows: localizedRows });
  } catch (error) {
    return handleApiError(error);
  }
}
