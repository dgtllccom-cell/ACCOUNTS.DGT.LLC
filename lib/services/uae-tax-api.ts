import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";
import type { ErpSession } from "@/lib/auth/session";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";

/**
 * Shared guard for every /api/erp/uae-tax/** route. `action` maps to the
 * standard resources: `read` -> uae_tax:read, `write` -> uae_tax:write,
 * `file` -> uae_tax_filing:write (VAT return / recovery / ASP submission).
 */
export async function guardUaeTax(
  action: "read" | "write" | "file" | "settings",
): Promise<{ session: ErpSession; scope: UaeTaxScope }> {
  const session = await requireErpSession();
  const resource =
    action === "settings" ? "uae_tax_settings" : action === "file" ? "uae_tax_filing" : "uae_tax";
  const act = action === "read" ? "read" : "write";
  authorizeApiScope(session, { resource, action: act });
  return { session, scope: uaeTaxScopeFromSession(session) };
}
