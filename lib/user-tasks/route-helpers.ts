import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/api/response";
import { mapTaskError } from "./service";

export async function requireTaskSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  return { session };
}

/** Uniform error handler — hides DB internals, surfaces a clean setupPending flag. */
export function taskErrorResponse(error: unknown, emptyPayload?: Record<string, unknown>): Response {
  const mapped = mapTaskError(error);
  if (mapped.setupPending) {
    return apiOk({ ...(emptyPayload ?? {}), setupPending: true });
  }
  return apiError(mapped.code, mapped.message, mapped.status);
}
