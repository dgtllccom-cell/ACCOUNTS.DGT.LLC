import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { listEligibleRuns } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

/** Approved / posted / paid UAE payroll runs in scope, with their live SIF status. */
export async function GET() {
  try {
    const { session } = await guardWps("read");
    return apiOk({ runs: await listEligibleRuns(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
