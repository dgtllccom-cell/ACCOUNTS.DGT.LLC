import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/api/response";
import { mapBeiError } from "./service";

export async function requireBeiSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  return { session };
}

export function beiErrorResponse(error: unknown, emptyPayload?: Record<string, unknown>): Response {
  const mapped = mapBeiError(error);
  if (mapped.setupPending) return apiOk({ ...(emptyPayload ?? {}), setupPending: true });
  return apiError(mapped.code, mapped.message, mapped.status);
}
