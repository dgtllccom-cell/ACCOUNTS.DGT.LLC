import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";

/**
 * Mirrors lib/services/uae-tax-api.ts exactly, for Pakistan. The scope
 * derivation (uaeTaxScopeFromSession) is genuinely country-agnostic despite
 * its name — it just returns the session's own assigned countries — so it's
 * reused as-is rather than duplicated.
 */
let cachedPkCountryId: string | null | undefined;
async function resolvePkCountryId(): Promise<string | null> {
  if (cachedPkCountryId !== undefined) return cachedPkCountryId;
  const rows = await withLocalPg(
    async (sql) => sql`SELECT id FROM public.countries WHERE upper(iso2) = 'PK' AND deleted_at IS NULL LIMIT 1`,
  );
  cachedPkCountryId = (rows?.[0]?.id as string | undefined) ?? null;
  return cachedPkCountryId;
}

export async function assertPkCountryAccess(session: ErpSession): Promise<void> {
  const isGlobal = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  if (isGlobal) return;
  const pkCountryId = await resolvePkCountryId();
  if (pkCountryId && !session.countryIds.includes(pkCountryId)) {
    throw new ErpPermissionError("Pakistan Tax is only accessible to users assigned to Pakistan.");
  }
}

/**
 * Shared guard for every /api/erp/pk-tax/** route. `action` maps to
 * pk_tax:read, pk_tax:write, or pk_tax_filing:write (review/confirm/file/pay).
 */
export async function guardPkTax(
  action: "read" | "write" | "file",
): Promise<{ session: ErpSession; scope: UaeTaxScope }> {
  const session = await requireErpSession();
  const resource = action === "file" ? "pk_tax_filing" : "pk_tax";
  const act = action === "read" ? "read" : "write";
  authorizeApiScope(session, { resource, action: act });
  await assertPkCountryAccess(session);

  return { session, scope: uaeTaxScopeFromSession(session) };
}
