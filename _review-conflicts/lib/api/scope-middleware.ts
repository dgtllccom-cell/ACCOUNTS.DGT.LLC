import type { NextRequest } from "next/server";
import type { ErpSession } from "@/lib/auth/session";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, type PermissionCheck } from "@/lib/permissions/middleware";

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
