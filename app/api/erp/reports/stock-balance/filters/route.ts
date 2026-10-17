import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { loadFilterOptions, permissionsOf } from "@/lib/services/stock-balance-report-service";

export const dynamic = "force-dynamic";

/** The master filter options: only what the logged-in user scope (country / company / branch) allows. */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "purchases", action: "read" });
    return apiOk({ ...(await loadFilterOptions(session)), perms: permissionsOf(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
