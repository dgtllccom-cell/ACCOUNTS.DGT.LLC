import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope, session } = await guardIntake("read");

    const rows = await withLocalPg(async (sql) =>
      sql`
        SELECT
          w.id, w.document_intake_job_id, w.status, w.submitted_by,
          w.submitted_at, w.reviewer_id, w.approver_id,
          j.job_no, j.original_language_code
        FROM public.approval_workflows w
        JOIN public.document_intake_jobs j ON w.document_intake_job_id = j.id
        WHERE w.status IN ('pending', 'returned_for_review')
          AND w.approver_id IS NULL
          AND (j.country_id IS NULL OR j.country_id = ANY(${scope.countryIds}))
        ORDER BY w.submitted_at DESC
        LIMIT 50
      `
    );

    return apiOk({ rows: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
