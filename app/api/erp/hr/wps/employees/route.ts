import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { listWpsEmployees } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

/** UAE employees in scope with their WPS details and what is missing. */
export async function GET() {
  try {
    const { session } = await guardWps("read");
    return apiOk({ employees: await listWpsEmployees(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
