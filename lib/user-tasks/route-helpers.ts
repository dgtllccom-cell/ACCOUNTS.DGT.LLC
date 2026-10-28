import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError, apiOk, invalidIdErrorOf } from "@/lib/api/response";
import { mapTaskError } from "./service";

export async function requireTaskSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  return { session };
}

/** Uniform error handler — hides DB internals, surfaces a clean setupPending flag. */
export async function taskErrorResponse(error: unknown, emptyPayload?: Record<string, unknown>): Promise<Response> {
  // an account number / code in an id parameter is the caller's mistake, not an outage
  const invalidId = await invalidIdErrorOf(error);
  if (invalidId) return apiError(invalidId.code, invalidId.message, invalidId.status, { value: invalidId.value });
  const mapped = mapTaskError(error);
  if (mapped.setupPending) {
    return apiOk({ ...(emptyPayload ?? {}), setupPending: true });
  }
  return apiError(mapped.code, mapped.message, mapped.status);
}
