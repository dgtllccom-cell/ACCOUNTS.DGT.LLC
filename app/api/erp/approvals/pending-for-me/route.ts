import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";

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
export async function GET(_request: NextRequest) {
  try {
    const { scope } = await guardIntake("read");
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
          j.job_no, j.original_language, j.doc_type_code, j.target_module,
          j.country_name, j.city_branch_name, j.original_filename, j.source_type,
          (SELECT count(*)::int FROM public.document_intake_fields f WHERE f.job_id = j.id) AS field_count,
          p.full_name AS submitted_by_name
        FROM public.approval_workflows w
        JOIN public.document_intake_queue_v j ON w.document_intake_job_id = j.id
        LEFT JOIN public.profiles p ON p.id = w.submitted_by
        WHERE w.status IN ('pending', 'returned_for_review')
          AND w.approver_id IS NULL
          AND w.deleted_at IS NULL
          AND ${scopeOk(sql)}
        ORDER BY w.submitted_at DESC
        LIMIT 50
      `,
    );

    return apiOk({ rows: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
