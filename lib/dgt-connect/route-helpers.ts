import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { apiError } from "@/lib/api/response";
import { DgtAccessError } from "./service";

export async function requireDgtSession(): Promise<{ session: ErpSession } | { response: Response }> {
  const session = await getCurrentErpSession();
  if (!session) {
    return { response: apiError("UNAUTHORIZED", "Authentication is required", 401) };
  }
  return { session };
}

export function dgtErrorResponse(error: unknown): Response {
  if (error instanceof DgtAccessError) {
    return apiError("FORBIDDEN", error.message, 403);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[DGT Connect]", message);
  return apiError("DGT_CONNECT_ERROR", message, 500);
}
