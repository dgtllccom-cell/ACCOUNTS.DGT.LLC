import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveSelfEmployeeId, selfServiceBundle } from "@/lib/services/hr-self-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Employee Self-Service — returns ONLY the logged-in user's own employee record
 * bundle. No scope parameters are accepted; the employee id is resolved from the
 * session email and every query is pinned to it.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const employeeId = await resolveSelfEmployeeId(session);
    if (!employeeId) {
      return apiError("NOT_LINKED", "Your login is not linked to an employee record. Ask HR to set the matching email on your employee profile.", 404);
    }
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const bundle: any = await selfServiceBundle(employeeId);
    try {
      if (bundle.profile) {
        const [localizedProfile] = await localizeRecordFields<any>(
          [{ id: employeeId, designation: bundle.profile.designation, department: bundle.profile.department }],
          "employees",
          ["designation", "department"],
          lang
        );
        bundle.profile.designation = localizedProfile.designation;
        bundle.profile.department = localizedProfile.department;
      }
    } catch {
      // keep original designation/department
    }
    return apiOk(bundle);
  } catch (error) {
    return handleApiError(error);
  }
}
