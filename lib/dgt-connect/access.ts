import type { ErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { DgtDirectory, DgtDirectoryUser } from "./types";

/**
 * DGT Connect access model — enforced SERVER-SIDE on every directory read,
 * conversation create and message send.
 *
 *  - super_admin ............... may reach every user
 *  - country-level login ....... may reach every user assigned to any of the
 *                                login's countries (all branches, all users)
 *  - branch-level login ........ may reach users who share one of the login's
 *                                city/country branches, PLUS the country- and
 *                                super-admins of the login's countries (so a
 *                                branch user can always contact their admins)
 *
 * A conversation is only ever created between the caller and users the caller
 * may reach; membership of an existing conversation is checked on every read.
 */

const COUNTRY_LEVEL_ROLES = new Set(["country_admin", "country_user", "main_branch_admin"]);
const COUNTRY_ADMIN_ROLES = new Set(["country_admin", "main_branch_admin", "super_admin"]);

function lang(v: string | null | undefined): SupportedLanguage {
  return (["en", "ur", "ps", "fa", "ar"].includes(String(v)) ? v : "en") as SupportedLanguage;
}

type AssignmentRow = {
  user_id: string;
  full_name: string | null;
  preferred_language_code: string | null;
  role: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
};

async function loadActiveAssignments(): Promise<AssignmentRow[]> {
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select ura.user_id,
             p.full_name,
             p.preferred_language_code,
             ura.role,
             ura.country_id,
             ura.country_branch_id,
             ura.city_branch_id
      from public.user_role_assignments ura
      join public.profiles p on p.id = ura.user_id
      where ura.is_active = true
        and ura.deleted_at is null
        and (p.deleted_at is null)
    `) as unknown as AssignmentRow[];
  });
  return rows ?? [];
}

export type DgtScopeKind = "super_admin" | "country" | "branch";

export function dgtScopeKind(session: ErpSession): DgtScopeKind {
  if (session.isSuperAdmin || session.roles.includes("super_admin")) return "super_admin";
  const hasBranch = session.cityBranchIds.length > 0 || session.countryBranchIds.length > 0;
  const isCountryLevel = session.roles.some((r) => COUNTRY_LEVEL_ROLES.has(r));
  if (isCountryLevel && !session.roles.some((r) => ["city_branch_admin", "accountant", "cashier", "staff_user"].includes(r))) {
    return "country";
  }
  return hasBranch ? "branch" : session.countryIds.length ? "country" : "branch";
}

/** True when `session` is permitted to open / continue a chat with `targetUserId`. */
export async function dgtCanReach(session: ErpSession, targetUserId: string): Promise<boolean> {
  if (targetUserId === session.userId) return false;
  const reachable = await dgtReachableUserIds(session);
  return reachable.has(targetUserId);
}

/** The complete set of user ids `session` may start a conversation with. */
export async function dgtReachableUserIds(session: ErpSession): Promise<Set<string>> {
  const assignments = await loadActiveAssignments();
  const kind = dgtScopeKind(session);
  const out = new Set<string>();

  if (kind === "super_admin") {
    for (const a of assignments) if (a.user_id !== session.userId) out.add(a.user_id);
    return out;
  }

  const myCountries = new Set(session.countryIds);
  const myCountryBranches = new Set(session.countryBranchIds);
  const myCityBranches = new Set(session.cityBranchIds);

  for (const a of assignments) {
    if (a.user_id === session.userId) continue;

    // Always allow reaching a super-admin or a country-admin of one of my countries.
    if (
      (a.role && COUNTRY_ADMIN_ROLES.has(a.role) && (!a.country_id || myCountries.has(a.country_id))) ||
      a.role === "super_admin"
    ) {
      out.add(a.user_id);
      continue;
    }

    if (kind === "country") {
      if (a.country_id && myCountries.has(a.country_id)) out.add(a.user_id);
      continue;
    }

    // branch-level
    if (a.city_branch_id && myCityBranches.has(a.city_branch_id)) out.add(a.user_id);
    else if (a.country_branch_id && myCountryBranches.has(a.country_branch_id)) out.add(a.user_id);
  }

  return out;
}

/** Country → Branch → User tree, filtered to what `session` may message. */
export async function dgtDirectory(session: ErpSession): Promise<DgtDirectory> {
  const assignments = await loadActiveAssignments();
  const reachable = await dgtReachableUserIds(session);

  // NOTE: the Supabase transaction pooler does not pipeline concurrent queries on
  // a single connection (withLocalPg uses max:1) — run these sequentially.
  const [countries, countryBranches, cityBranches, presenceRows] = (await withLocalPg(async (sql) => {
    const c = await sql`select id, name from public.countries where deleted_at is null order by name`;
    const cb = await sql`select id, country_id, name from public.country_branches where deleted_at is null order by name`;
    const cib = await sql`select id, country_id, country_branch_id, coalesce(name, city_name) as name from public.city_branches where deleted_at is null order by coalesce(name, city_name)`;
    const pr = await sql`select user_id, status, last_seen_at from public.dgt_presence`;
    return [c, cb, cib, pr] as const;
  })) ?? [[], [], [], []];

  const countryName = new Map<string, string>((countries as any[]).map((r) => [r.id, r.name]));
  const branchName = new Map<string, string>([
    ...(countryBranches as any[]).map((r) => [r.id, r.name] as [string, string]),
    ...(cityBranches as any[]).map((r) => [r.id, r.name] as [string, string]),
  ]);
  const branchCountry = new Map<string, string>([
    ...(countryBranches as any[]).map((r) => [r.id, r.country_id] as [string, string]),
    ...(cityBranches as any[]).map((r) => [r.id, r.country_id] as [string, string]),
  ]);
  const presence = new Map<string, { status: string; last: string | null }>(
    (presenceRows as any[]).map((r) => [r.user_id, { status: r.status, last: r.last_seen_at }])
  );

  const STALE_MS = 65_000;
  function presenceOf(userId: string): { presence: DgtDirectoryUser["presence"]; lastSeenAt: string | null } {
    const p = presence.get(userId);
    if (!p) return { presence: "offline", lastSeenAt: null };
    const fresh = p.last && Date.now() - new Date(p.last).getTime() < STALE_MS;
    return { presence: fresh ? (p.status as any) : "offline", lastSeenAt: p.last };
  }

  // one directory user per (user, scope) — dedupe by user id keeping the most specific assignment
  const byUser = new Map<string, DgtDirectoryUser>();
  for (const a of assignments) {
    if (!reachable.has(a.user_id)) continue;
    const pres = presenceOf(a.user_id);
    const entry: DgtDirectoryUser = {
      id: a.user_id,
      name: a.full_name || "User",
      role: a.role,
      lang: lang(a.preferred_language_code),
      countryId: a.country_id,
      countryBranchId: a.country_branch_id,
      cityBranchId: a.city_branch_id,
      presence: pres.presence,
      lastSeenAt: pres.lastSeenAt,
    };
    const prev = byUser.get(a.user_id);
    const specificity = (x: DgtDirectoryUser) => (x.cityBranchId ? 3 : x.countryBranchId ? 2 : x.countryId ? 1 : 0);
    if (!prev || specificity(entry) > specificity(prev)) byUser.set(a.user_id, entry);
  }

  const countryMap = new Map<string, { id: string; name: string; branches: Map<string, DgtDirectoryUser[]>; branchKind: Map<string, "country_branch" | "city_branch">; countryUsers: DgtDirectoryUser[] }>();
  const ensureCountry = (cid: string) => {
    if (!countryMap.has(cid)) countryMap.set(cid, { id: cid, name: countryName.get(cid) || "—", branches: new Map(), branchKind: new Map(), countryUsers: [] });
    return countryMap.get(cid)!;
  };
  const cityBranchIds = new Set((cityBranches as any[]).map((r) => r.id));

  for (const u of byUser.values()) {
    const branchId = u.cityBranchId || u.countryBranchId;
    const cid = u.countryId || (branchId ? branchCountry.get(branchId) : null);
    if (!cid) continue;
    const country = ensureCountry(cid);
    if (branchId) {
      if (!country.branches.has(branchId)) country.branches.set(branchId, []);
      country.branches.get(branchId)!.push(u);
      country.branchKind.set(branchId, cityBranchIds.has(branchId) ? "city_branch" : "country_branch");
    } else {
      country.countryUsers.push(u);
    }
  }

  return {
    scopeLabel: dgtScopeKind(session),
    self: { id: session.userId, name: session.fullName || "You", lang: (session.preferredLanguage || "en") as SupportedLanguage },
    countries: [...countryMap.values()]
      .map((c) => ({
        id: c.id,
        name: c.name,
        countryUsers: c.countryUsers.sort((a, b) => a.name.localeCompare(b.name)),
        branches: [...c.branches.entries()]
          .map(([bid, users]) => ({
            id: bid,
            kind: c.branchKind.get(bid) || "country_branch",
            name: branchName.get(bid) || "—",
            countryId: c.id,
            users: users.sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function directKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}
