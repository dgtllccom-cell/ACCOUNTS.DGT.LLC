import type { NextRequest } from "next/server";
import type { ErpSession } from "@/lib/auth/session";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, canAccessCityBranch, canAccessCountry, canAccessCountryBranch, hasRolePermission, ErpPermissionError, type PermissionCheck } from "@/lib/permissions/middleware";

export type ApiScope = {
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
};

export function getScopeFromSearchParams(request: NextRequest): ApiScope {
  return {
    countryId: request.nextUrl.searchParams.get("countryId"),
    countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
    cityBranchId: request.nextUrl.searchParams.get("cityBranchId")
  };
}

export async function requireAuthorizedSession(check: PermissionCheck): Promise<ErpSession> {
  const session = await requireErpSession();
  authorize(session, check);
  return session;
}

export function authorizeApiScope(
  session: ErpSession,
  input: {
    resource: string;
    action: string;
  } & ApiScope
) {
  authorize(session, {
    resource: input.resource,
    action: input.action,
    countryId: input.countryId,
    countryBranchId: input.countryBranchId,
    cityBranchId: input.cityBranchId
  });
}

/**
 * Dual-scope authorization for Country-to-Country records that legitimately belong to TWO
 * scopes at once (a source/purchasing branch and a destination/receiving branch) — e.g. a
 * Country Purchase's dest_country_id/dest_country_branch_id/dest_city_branch_id. Mirrors the
 * RLS OR pattern already designed (but never wired into app code) on
 * inter_branch_ledger_transfers (0020_branch_ledger_inter_branch_accounting.sql). The
 * permission string still gates the resource/action; only the SCOPE check is OR'd across the
 * two triples, so a user with legitimate access to either the source or the destination side
 * can read the record. Super admin always passes.
 */
export function authorizeApiScopeEither(
  session: ErpSession,
  input: {
    resource: string;
    action: string;
    source: ApiScope;
    destination: ApiScope | null | undefined;
  }
) {
  if (!hasRolePermission(session, input.resource, input.action)) {
    throw new ErpPermissionError(`Missing permission: ${input.resource}:${input.action}`);
  }
  if (session.isSuperAdmin) return;

  const matchesScope = (scope: ApiScope) => {
    if (scope.cityBranchId) return canAccessCityBranch(session, scope.cityBranchId);
    if (scope.countryBranchId) return canAccessCountryBranch(session, scope.countryBranchId);
    if (scope.countryId) return canAccessCountry(session, scope.countryId);
    return false;
  };

  const sourceOk = matchesScope(input.source);
  const destOk = input.destination ? matchesScope(input.destination) : false;

  if (!sourceOk && !destOk) {
    throw new ErpPermissionError("Neither the source nor destination scope of this record is allowed for this user.");
  }
}

/** True if the session's scope matches the destination side of a Country Purchase record
 *  (used to gate destination-only actions like Receiving to destination-branch users, not
 *  just anyone with source access). Super admin always passes. */
export function isDestinationScopeUser(session: ErpSession, destination: ApiScope | null | undefined) {
  if (session.isSuperAdmin) return true;
  if (!destination || (!destination.cityBranchId && !destination.countryBranchId && !destination.countryId)) return false;
  if (destination.cityBranchId) return canAccessCityBranch(session, destination.cityBranchId);
  if (destination.countryBranchId) return canAccessCountryBranch(session, destination.countryBranchId);
  if (destination.countryId) return canAccessCountry(session, destination.countryId);
  return false;
}

/**
 * Build scope filter arrays from a session.
 * Returns the sets of IDs the user is allowed to access.
 * Super admins get null (meaning "all"), non-super users get their assigned IDs.
 */
export function buildScopeFilter(session: ErpSession) {
  if (session.isSuperAdmin) {
    return { countryIds: null, countryBranchIds: null, cityBranchIds: null, isSuperAdmin: true };
  }
  return {
    countryIds: session.countryIds.length > 0 ? session.countryIds : [],
    countryBranchIds: session.countryBranchIds.length > 0 ? session.countryBranchIds : [],
    cityBranchIds: session.cityBranchIds.length > 0 ? session.cityBranchIds : [],
    isSuperAdmin: false,
  };
}

/**
 * Apply scope filters to a Supabase query.
 * This is the single place where session-based scoping is applied to queries,
 * replacing all ad-hoc `.in("country_id", ...)` blocks across API routes.
 * 
 * @param query - A Supabase query builder
 * @param session - The authenticated session
 * @param explicitScope - Optional explicit scope from query params (these take priority)
 * @returns The query with scope filters applied
 */
export function enforceScopeFilter(
  query: any,
  session: ErpSession,
  explicitScope?: ApiScope
): any {
  let q = query;

  // Explicit filters from query params always apply (even for super admins)
  if (explicitScope?.cityBranchId) {
    q = q.eq("city_branch_id", explicitScope.cityBranchId);
  } else if (explicitScope?.countryBranchId) {
    q = q.eq("country_branch_id", explicitScope.countryBranchId);
  } else if (explicitScope?.countryId) {
    q = q.eq("country_id", explicitScope.countryId);
  }

  // For non-super admins, enforce session scope
  if (!session.isSuperAdmin) {
    if (session.cityBranchIds.length > 0) {
      // City branch users see their branches + records without a city branch (country-level)
      q = q.or(`city_branch_id.in.(${session.cityBranchIds.join(",")}),city_branch_id.is.null`);
      if (session.countryIds.length > 0) {
        q = q.in("country_id", session.countryIds);
      }
    } else if (session.countryBranchIds.length > 0) {
      q = q.in("country_branch_id", session.countryBranchIds);
    } else if (session.countryIds.length > 0) {
      q = q.in("country_id", session.countryIds);
    } else {
      // Fail-safe: user has no scope assignments → return nothing
      q = q.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  return q;
}

/**
 * Like enforceScopeFilter, but for tables that also carry a destination scope (e.g.
 * purchase_orders.dest_country_id/dest_country_branch_id/dest_city_branch_id) — a non-super
 * user sees a row if EITHER their session scope matches the source columns OR the destination
 * columns, so a destination-branch user can see incoming Country Purchase orders they didn't
 * create. Explicit query-param filters still apply first and always narrow to source columns
 * (matching enforceScopeFilter's existing behavior) since filtering is normally initiated from
 * the source side's own screens.
 */
export function enforceScopeFilterWithDestination(
  query: any,
  session: ErpSession,
  explicitScope?: ApiScope,
  destColumns: { countryId: string; countryBranchId: string; cityBranchId: string } = {
    countryId: "dest_country_id",
    countryBranchId: "dest_country_branch_id",
    cityBranchId: "dest_city_branch_id"
  }
): any {
  let q = query;

  if (explicitScope?.cityBranchId) {
    q = q.eq("city_branch_id", explicitScope.cityBranchId);
    return q;
  } else if (explicitScope?.countryBranchId) {
    q = q.eq("country_branch_id", explicitScope.countryBranchId);
    return q;
  } else if (explicitScope?.countryId) {
    q = q.eq("country_id", explicitScope.countryId);
    return q;
  }

  if (session.isSuperAdmin) return q;

  const sourceClauses: string[] = [];
  const destClauses: string[] = [];
  if (session.cityBranchIds.length > 0) {
    sourceClauses.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
    destClauses.push(`${destColumns.cityBranchId}.in.(${session.cityBranchIds.join(",")})`);
  }
  if (session.countryBranchIds.length > 0) {
    sourceClauses.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
    destClauses.push(`${destColumns.countryBranchId}.in.(${session.countryBranchIds.join(",")})`);
  }
  if (session.countryIds.length > 0) {
    sourceClauses.push(`country_id.in.(${session.countryIds.join(",")})`);
    destClauses.push(`${destColumns.countryId}.in.(${session.countryIds.join(",")})`);
  }

  const allClauses = [...sourceClauses, ...destClauses];
  if (allClauses.length === 0) {
    return q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  return q.or(allClauses.join(","));
}
