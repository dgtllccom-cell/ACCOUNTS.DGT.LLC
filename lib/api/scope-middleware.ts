import type { NextRequest } from "next/server";
import type { ErpSession } from "@/lib/auth/session";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, isCountryRoleFor, canAccessCityBranch, canAccessCountry, canAccessCountryBranch, hasRolePermission, ErpPermissionError, type PermissionCheck } from "@/lib/permissions/middleware";

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
    if (isCountryRoleFor(session, scope.countryId)) return true;
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
  if (isCountryRoleFor(session, destination.countryId)) return true;
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
    // 1. Shipping-scoped / Clearing Agent isolation
    if (session.isShippingScoped && session.clearingAgentIds?.length > 0) {
      q = q.in("clearing_agent_id", session.clearingAgentIds);
    }
    // 2. City Branch isolation: Branch users strictly see records belonging to their city branch
    else if (session.cityBranchIds.length > 0) {
      const isCountryRole = session.roles.some((r) => r === "country_admin" || r === "country_user");
      if (isCountryRole && session.countryIds.length > 0) {
        q = q.in("country_id", session.countryIds);
      } else {
        q = q.in("city_branch_id", session.cityBranchIds);
      }
    }
    // 3. Country Branch isolation
    else if (session.countryBranchIds.length > 0) {
      q = q.in("country_branch_id", session.countryBranchIds);
    }
    // 4. Country Admin / Country User isolation
    else if (session.countryIds.length > 0) {
      q = q.in("country_id", session.countryIds);
    }
    // 5. Fail-safe: user has no scope assignments → return empty set
    else {
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

/**
 * Raw-SQL twin of {@link enforceScopeFilter} for routes/services that query through
 * `withLocalPg` / `getSharedPg` instead of the Supabase client. Same rule, one place:
 *   Super Admin → no restriction · country roles → their countries · branch users → their
 *   city branches · country-branch users → their country branches · no assignment → no rows.
 * `alias` is the table alias carrying country_id / country_branch_id / city_branch_id.
 */
export type SqlScope =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "country"; ids: string[] }
  | { kind: "countryBranch"; ids: string[] }
  // ownCountryBranchIds: main branches the caller is assigned to AT main-branch level. Their
  // resolved scope is their city branches, so rows saved at main-branch level (no city branch)
  // would otherwise be invisible to the main branch's own admin.
  | { kind: "cityBranch"; ids: string[]; ownCountryBranchIds?: string[] };

export function sessionSqlScope(session: ErpSession): SqlScope {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) return { kind: "all" };
  const isCountryRole = session.roles.some((r) => r === "country_admin" || r === "country_user");
  if (session.cityBranchIds.length > 0) {
    if (isCountryRole && session.countryIds.length > 0) return { kind: "country", ids: session.countryIds };
    const ownCountryBranchIds = [
      ...new Set((session.assignments ?? []).filter((a) => !a.cityBranchId && a.countryBranchId).map((a) => a.countryBranchId as string))
    ];
    return { kind: "cityBranch", ids: session.cityBranchIds, ownCountryBranchIds };
  }
  if (session.countryBranchIds.length > 0) return { kind: "countryBranch", ids: session.countryBranchIds };
  if (session.countryIds.length > 0) return { kind: "country", ids: session.countryIds };
  return { kind: "none" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sqlScopeCondition(sql: any, scope: SqlScope, alias: string, opts: { hasCountryBranchCol?: boolean; prefix?: string } = {}) {
  // prefix "dest_" matches the destination triple (dest_country_id / dest_country_branch_id / dest_city_branch_id)
  const col = (c: string) => sql.unsafe(alias ? `${alias}.${opts.prefix ?? ""}${c}` : `${opts.prefix ?? ""}${c}`);
  // Tables without country_branch_id cannot be matched at main-branch level → deny rather than widen.
  if (scope.kind === "countryBranch" && opts.hasCountryBranchCol === false) return sql`FALSE`;
  switch (scope.kind) {
    case "all":
      return sql`TRUE`;
    case "none":
      return sql`FALSE`;
    case "country":
      return sql`${col("country_id")} = ANY(${scope.ids}::uuid[])`;
    case "countryBranch":
      return sql`${col("country_branch_id")} = ANY(${scope.ids}::uuid[])`;
    case "cityBranch":
      if (scope.ownCountryBranchIds?.length && opts.hasCountryBranchCol !== false) {
        return sql`(${col("city_branch_id")} = ANY(${scope.ids}::uuid[]) OR (${col("city_branch_id")} IS NULL AND ${col("country_branch_id")} = ANY(${scope.ownCountryBranchIds}::uuid[])))`;
      }
      return sql`${col("city_branch_id")} = ANY(${scope.ids}::uuid[])`;
  }
}

/** Reject explicit country/branch query params that point outside the caller's scope (403). */
export function assertExplicitScopeAllowed(session: ErpSession, scope: ApiScope) {
  if (session.isSuperAdmin) return;
  if (scope.cityBranchId && !canAccessCityBranch(session, scope.cityBranchId)) throw new ErpPermissionError("This branch is outside your authorized scope.");
  if (scope.countryBranchId && !canAccessCountryBranch(session, scope.countryBranchId)) throw new ErpPermissionError("This branch is outside your authorized scope.");
  if (scope.countryId && !canAccessCountry(session, scope.countryId)) throw new ErpPermissionError("This country is outside your authorized scope.");
}

/** In-app twin of {@link sqlScopeCondition} for rows already loaded (e.g. from an RPC). */
export function recordInSessionScope(
  session: ErpSession,
  rec: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null } | null | undefined
): boolean {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return true;
  if (!rec || scope.kind === "none") return false;
  if (scope.kind === "country") return !!rec.country_id && scope.ids.includes(rec.country_id);
  if (scope.kind === "countryBranch") return !!rec.country_branch_id && scope.ids.includes(rec.country_branch_id);
  if (!rec.city_branch_id && rec.country_branch_id && scope.ownCountryBranchIds?.includes(rec.country_branch_id)) return true;
  return !!rec.city_branch_id && scope.ids.includes(rec.city_branch_id);
}

/**
 * Hierarchy-inclusive variant for MASTER data that is defined at several levels (accounts,
 * ledgers): a branch user sees its own city branch's rows plus the parent-level rows that have
 * no city branch (its main branch's, then its country's) — never a sibling branch's rows.
 * Country roles see their countries; Super Admin everything; no assignment nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sqlHierarchyScopeCondition(sql: any, session: ErpSession, alias: string) {
  const scope = sessionSqlScope(session);
  const col = (c: string) => sql.unsafe(alias ? `${alias}.${c}` : c);
  if (scope.kind === "all") return sql`TRUE`;
  if (scope.kind === "none") return sql`FALSE`;
  if (scope.kind === "country") return sql`${col("country_id")} = ANY(${scope.ids}::uuid[])`;
  const cityIds = scope.kind === "cityBranch" ? scope.ids : [];
  return sql`(
    ${col("city_branch_id")} = ANY(${cityIds}::uuid[])
    OR (${col("city_branch_id")} IS NULL AND ${col("country_branch_id")} = ANY(${session.countryBranchIds}::uuid[]))
    OR (${col("city_branch_id")} IS NULL AND ${col("country_branch_id")} IS NULL AND ${col("country_id")} = ANY(${session.countryIds}::uuid[]))
  )`;
}

/** PostgREST `.or()` expression for {@link sqlHierarchyScopeCondition} (Supabase query paths). */
export function postgrestHierarchyScope(session: ErpSession): string | null {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return null;
  if (scope.kind === "none") return "id.eq.00000000-0000-0000-0000-000000000000";
  if (scope.kind === "country") return `country_id.in.(${scope.ids.join(",")})`;
  const parts: string[] = [];
  if (scope.kind === "cityBranch" && scope.ids.length) parts.push(`city_branch_id.in.(${scope.ids.join(",")})`);
  if (session.countryBranchIds.length) parts.push(`and(city_branch_id.is.null,country_branch_id.in.(${session.countryBranchIds.join(",")}))`);
  if (session.countryIds.length) parts.push(`and(city_branch_id.is.null,country_branch_id.is.null,country_id.in.(${session.countryIds.join(",")}))`);
  return parts.length ? parts.join(",") : "id.eq.00000000-0000-0000-0000-000000000000";
}

/**
 * True when the record sits exactly at one of the caller's own assignment levels (a main-branch
 * admin's main-branch-level row, a country admin's country-level row). Complements
 * {@link recordInSessionScope}, whose resolved scope for a main-branch admin is its city branches.
 */
export function recordAtOwnAssignmentLevel(
  session: ErpSession,
  rec: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null } | null | undefined
): boolean {
  if (!rec) return false;
  return (session.assignments ?? []).some((a) =>
    a.cityBranchId
      ? a.cityBranchId === rec.city_branch_id
      : a.countryBranchId
        ? !rec.city_branch_id && a.countryBranchId === rec.country_branch_id
        : a.countryId
          ? !rec.city_branch_id && !rec.country_branch_id && a.countryId === rec.country_id
          : false
  );
}

/** SQL twin of {@link recordAtOwnAssignmentLevel} for one side (prefix) of a row. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sqlOwnAssignmentLevelCondition(sql: any, session: ErpSession, alias: string, prefix = "") {
  const col = (c: string) => sql.unsafe(`${alias ? alias + "." : ""}${prefix}${c}`);
  const as = session.assignments ?? [];
  const cb = as.filter((a) => !a.cityBranchId && a.countryBranchId).map((a) => a.countryBranchId as string);
  const c = as.filter((a) => !a.cityBranchId && !a.countryBranchId && a.countryId).map((a) => a.countryId as string);
  return sql`(
    (${col("city_branch_id")} is null and ${col("country_branch_id")} = any(${cb}::uuid[]))
    or (${col("city_branch_id")} is null and ${col("country_branch_id")} is null and ${col("country_id")} = any(${c}::uuid[]))
  )`;
}

/**
 * Org-structure lookup lists (rows of countries / country_branches / city_branches) trimmed to
 * the caller's hierarchy: own branch plus its parent levels, never a sibling or another country.
 */
export function orgRowInSessionScope(
  session: ErpSession,
  level: "country" | "countryBranch" | "cityBranch",
  row: { id: string; country_id?: string | null; country_branch_id?: string | null }
): boolean {
  if (level === "country") return recordInHierarchyScope(session, { country_id: row.id });
  if (level === "countryBranch") return recordInHierarchyScope(session, { country_id: row.country_id, country_branch_id: row.id });
  return recordInHierarchyScope(session, { country_id: row.country_id, country_branch_id: row.country_branch_id, city_branch_id: row.id });
}

/** In-app twin of {@link sqlHierarchyScopeCondition} for already-loaded master rows. */
export function recordInHierarchyScope(
  session: ErpSession,
  rec: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null } | null | undefined
): boolean {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return true;
  if (!rec || scope.kind === "none") return false;
  if (scope.kind === "country") return !!rec.country_id && scope.ids.includes(rec.country_id);
  if (rec.city_branch_id) return scope.kind === "cityBranch" && scope.ids.includes(rec.city_branch_id);
  if (rec.country_branch_id) return session.countryBranchIds.includes(rec.country_branch_id);
  return !!rec.country_id && session.countryIds.includes(rec.country_id);
}
