/**
 * DEV-only: deactivate every "[E2E TEST]" identity this harness created (login blocked on the next request; rows are kept for audit).
 *   BASE=http://127.0.0.1:3540 node scripts/dev/e2e-cleanup.mjs
 */
import { devQuery, globalClient, E2E_DOMAIN } from "./_rbac-users.mjs";
const g = await globalClient();
const users = await devQuery((sql) => sql`
  select u.id, u.email, a.role, a.is_active from auth.users u
  join public.user_role_assignments a on a.user_id = u.id and a.deleted_at is null
  where u.email like ${"%@" + E2E_DOMAIN}`);
let n = 0;
for (const u of users) {
  if (!u.is_active) continue;
  const r = await g.req("PATCH", "/api/erp/users", { userId: u.id, isActive: false });
  console.log(r.status === 200 ? "deactivated" : `FAILED ${r.status}`, u.email, u.role);
  if (r.status === 200) n++;
}
console.log(`${n} E2E identities deactivated (${users.length} assignments found)`);
