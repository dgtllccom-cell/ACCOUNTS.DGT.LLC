import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { appraisalReport } from "@/lib/services/hr-appraisal-service";

export const dynamic = "force-dynamic";

/** Quarterly / annual appraisal report for one period label (HR, in scope). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    return apiOk(await appraisalReport(session, request.nextUrl.searchParams.get("period")));
  } catch (error) {
    return handleApiError(error);
  }
}
