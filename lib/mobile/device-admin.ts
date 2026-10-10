import { requireErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";

/** Only the Super Admin approves, rejects or revokes devices. */
export async function requireSuperAdminSession() {
  const session = await requireErpSession();
  if (!session.isSuperAdmin) throw new ApiClientError("Only the Super Admin can manage mobile devices.", { status: 403, code: "FORBIDDEN" });
  return session;
}
