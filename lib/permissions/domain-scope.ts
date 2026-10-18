import type { ErpSession } from "@/lib/auth/session";

/**
 * ONE operational-domain rule for data lists (Business vs Shipping Line), shared by every route that returns
 * branches, users, accounts, companies, customers or reports:
 *
 *   Global Super Admin                          every domain
 *   a login with a 'both' assignment            every domain
 *   Business Super Admin / Business user        'business' rows (+ rows tagged 'both')
 *   Shipping Super Admin / Shipping user        'shipping' rows (+ rows tagged 'both')
 *
 * It is a DOMAIN filter only — it never widens a country / branch scope, and one granted permission never switches it off.
 */
type DomainSession = Pick<ErpSession, "isSuperAdmin" | "operationalDomains">;

export type RowDomain = "business" | "shipping";

/** The single domain a login is limited to, or null when it may see both (Global Super Admin / 'both' assignment). */
export function sessionDomainFilter(session: DomainSession): RowDomain | null {
  if (session.isSuperAdmin) return null;
  const d = session.operationalDomains ?? ["business"];
  if (d.includes("both") || (d.includes("business") && d.includes("shipping"))) return null;
  return d.includes("shipping") ? "shipping" : "business";
}

/** Row-domain values the login may see (null = no domain restriction). 'both' rows are shared and always visible. */
export function allowedRowDomains(session: DomainSession): string[] | null {
  const f = sessionDomainFilter(session);
  return f ? [f, "both"] : null;
}

/** True when a row tagged `rowDomain` (null/unknown = 'business') is visible to this login. */
export function rowInSessionDomain(session: DomainSession, rowDomain: string | null | undefined): boolean {
  const allowed = allowedRowDomains(session);
  if (!allowed) return true;
  return allowed.includes(rowDomain || "business");
}

/** SQL fragment (postgres.js tagged template) restricting `alias.operational_domain` to the login's domain. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sqlRowDomainCondition(sql: any, session: DomainSession, alias: string) {
  const allowed = allowedRowDomains(session);
  if (!allowed) return sql`TRUE`;
  const col = sql.unsafe(alias ? `${alias}.operational_domain` : "operational_domain");
  return sql`coalesce(${col}, 'business') = ANY(${allowed}::text[])`;
}
