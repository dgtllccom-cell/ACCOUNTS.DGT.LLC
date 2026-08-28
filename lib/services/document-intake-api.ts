import { requireErpSession } from "@/lib/auth/session";
import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { intakeScopeFromSession, type IntakeScope, type OperationalDomain } from "@/lib/document-intelligence/scope";

/**
 * Guard for every /api/erp/document-intelligence/** route.
 *
 * read  — view the queue / a job (any authenticated ERP user, scoped)
 * write — upload / process / correct fields / send to QVC
 * link  — confirm a reviewed draft into a source module (stricter — needs the
 *         create/update permission of the target module; checked per-target
 *         by the service, not here)
 *
 * Geographic + domain + agent isolation is enforced by every service query
 * repeating the scope in its WHERE (withLocalPg bypasses RLS).
 */
const WRITE_ROLES = new Set([
  "super_admin", "country_admin", "country_user", "main_branch_admin", "city_branch_admin",
  "accountant", "cashier", "agent_user", "staff_user",
]);

export async function guardIntake(
  action: "read" | "write",
  domain?: OperationalDomain | null,
): Promise<{ session: ErpSession; scope: IntakeScope }> {
  const session = await requireErpSession();
  if (action === "write") {
    const roles: string[] = session.roles ?? [];
    if (!session.isSuperAdmin && !roles.some((r) => WRITE_ROLES.has(r))) {
      throw new ErpPermissionError("You do not have permission to submit documents to the intake center.");
    }
  }
  return { session, scope: intakeScopeFromSession(session, domain ?? null) };
}
