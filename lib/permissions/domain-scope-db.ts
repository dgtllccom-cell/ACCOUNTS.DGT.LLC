import { withReadPg } from "@/lib/db/local-postgres";

/**
 * DB lookups behind the operational-domain rule (see domain-scope.ts). Kept apart so domain-scope.ts stays pure and testable.
 * Both loaders read through the shared pooled Postgres connection (the app's Supabase "admin" client can be RLS-blind).
 */

/** operational_domain of the given city branches (null/unknown = 'business'). */
export async function loadCityBranchDomains(ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return out;
  await withReadPg(async (sql) => {
    const rows = (await sql`select id, operational_domain from public.city_branches where id = any(${list}::uuid[])`) as unknown as Array<{ id: string; operational_domain: string | null }>;
    for (const r of rows) out.set(r.id, r.operational_domain || "business");
  });
  return out;
}

/** operational_domain of each user's live assignment (a user with several keeps the set of domains). */
export async function loadUserDomains(userIds: readonly string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const list = [...new Set(userIds.filter(Boolean))];
  if (!list.length) return out;
  await withReadPg(async (sql) => {
    const rows = (await sql`
      select user_id, operational_domain from public.user_role_assignments
      where deleted_at is null and is_active = true and user_id = any(${list}::uuid[])
    `) as unknown as Array<{ user_id: string; operational_domain: string | null }>;
    for (const r of rows) {
      const set = out.get(r.user_id) ?? new Set<string>();
      set.add(r.operational_domain || "business");
      out.set(r.user_id, set);
    }
  });
  return out;
}
