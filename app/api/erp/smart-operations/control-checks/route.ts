import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { runControlChecks } from "@/lib/services/smart-operations-detectors";

export const dynamic = "force-dynamic";

/** GET — read-only Smart Operations control checks for the caller's country / branch scope. */
export async function GET() {
  try {
    const session = await requireErpSession();
    return apiOk(await runControlChecks(session));
  } catch (error) {
    return handleApiError(error);
  }
}
