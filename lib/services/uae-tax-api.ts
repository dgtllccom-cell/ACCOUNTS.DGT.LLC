import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";

/**
 * Resolves (and caches for the lifetime of the server process) the country_id
 * of the United Arab Emirates. The UAE Tax module is UAE-only, so every
 * non-super user touching it must carry an AE country assignment.
 */
let cachedUaeCountryId: string | null | undefined;
async function resolveUaeCountryId(): Promise<string | null> {
  if (cachedUaeCountryId !== undefined) return cachedUaeCountryId;
  const rows = await withLocalPg(
    async (sql) =>
      sql`SELECT id FROM public.countries WHERE upper(iso2) = 'AE' AND deleted_at IS NULL LIMIT 1`,
  );
  cachedUaeCountryId = (rows?.[0]?.id as string | undefined) ?? null;
  return cachedUaeCountryId;
}

/**
 * Assert a session is allowed into the UAE Tax module at all: super / global
 * reporting roles always pass; every other user must carry the UAE in their
 * assigned countries. Call this in routes that authorize with
 * `authorizeApiScope` directly instead of `guardUaeTax`.
 */
export async function assertUaeCountryAccess(session: ErpSession): Promise<void> {
  const isGlobal = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  if (isGlobal) return;
  const uaeCountryId = await resolveUaeCountryId();
  if (uaeCountryId && !session.countryIds.includes(uaeCountryId)) {
    throw new ErpPermissionError(
      "UAE Tax & e-Invoicing is only accessible to users assigned to the United Arab Emirates.",
    );
  }
}

/**
 * Shared guard for every /api/erp/uae-tax/** route. `action` maps to the
 * standard resources: `read` -> uae_tax:read, `write` -> uae_tax:write,
 * `file` -> uae_tax_filing:write (VAT return / recovery / ASP submission),
 * `settings` -> uae_tax_settings:write (entities / rules / zones / ledgers).
 *
 * In addition to the RBAC permission string, a non-super user must have the
 * UAE in their assigned countries — a country_admin for another country can
 * hold uae_tax_settings:write from the role template but still has no business
 * mutating UAE tax configuration.
 */
export async function guardUaeTax(
  action: "read" | "write" | "file" | "settings",
): Promise<{ session: ErpSession; scope: UaeTaxScope }> {
  const session = await requireErpSession();
  const resource =
    action === "settings" ? "uae_tax_settings" : action === "file" ? "uae_tax_filing" : "uae_tax";
  const act = action === "read" ? "read" : "write";
  authorizeApiScope(session, { resource, action: act });
  await assertUaeCountryAccess(session);

  return { session, scope: uaeTaxScopeFromSession(session) };
}
