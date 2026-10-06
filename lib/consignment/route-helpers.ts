import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/api/response";
import { mapConsignmentError } from "./service";

/**
 * Auth gate for every Consignment Register API route. Country/Branch scope is enforced
 * inside the service (visibleSql / assertCanEdit) — the same model as Customer Inquiry —
 * so a valid ERP session is all the route layer checks.
 */
export async function requireConsignmentSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  return { session };
}

export function consignmentErrorResponse(error: unknown, emptyPayload?: Record<string, unknown>): Response {
  const mapped = mapConsignmentError(error);
  if (mapped.setupPending) return apiOk({ ...(emptyPayload ?? {}), setupPending: true });
  return apiError(mapped.code, mapped.message, mapped.status);
}
