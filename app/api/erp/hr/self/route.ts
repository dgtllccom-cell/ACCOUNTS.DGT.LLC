import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveSelfEmployeeId, selfServiceBundle } from "@/lib/services/hr-self-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Employee Self-Service — returns ONLY the logged-in user's own employee record
 * bundle. No scope parameters are accepted; the employee id is resolved from the
 * session email and every query is pinned to it.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    const employeeId = await resolveSelfEmployeeId(session);
    if (!employeeId) {
      return apiError("NOT_LINKED", "Your login is not linked to an employee record. Ask HR to set the matching email on your employee profile.", 404);
    }
    const bundle = await selfServiceBundle(employeeId);
    return apiOk(bundle);
  } catch (error) {
    return handleApiError(error);
  }
}
