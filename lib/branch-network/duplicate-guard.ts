/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiClientError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * Server-side duplicate protection for the Branch & Network hierarchy.
 * The database enforces the same rules with partial unique indexes
 * (city_branches_country_city_domain_idx, user_role_assignments_live_scope_idx,
 * user_role_assignments_one_admin_per_scope_idx); these checks run first so the caller
 * gets a clear 409 naming the existing record instead of a raw constraint error.
 */

const ADMIN_ROLES = new Set(["country_admin", "main_branch_admin", "city_branch_admin", "branch_admin"]);

export type AssignmentScope = {
  role: string;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  operationalDomain: string | null;
};

export function isAdminRole(role: string) {
  return ADMIN_ROLES.has(role);
}

/** An existing auth login with this e-mail (case-insensitive). */
export async function findUserByEmail(admin: any, email: string): Promise<{ id: string; email: string } | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql`select id, email from auth.users where lower(email) = ${e} limit 1`;
    return (rows as any[])[0] ?? null;
  }).catch(() => null);
  if (viaPg) return { id: String(viaPg.id), email: String(viaPg.email) };
  try {
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const hit = (data?.users ?? []).find((u: any) => String(u.email ?? "").toLowerCase() === e);
      if (hit) return { id: hit.id, email: hit.email };
      if ((data?.users ?? []).length < 1000) break;
    }
  } catch {
    /* auth admin unavailable — the createUser call below still rejects a duplicate e-mail */
  }
  return null;
}

/** An existing login that already uses this username. */
export async function findUserByUsername(username: string): Promise<{ id: string; email: string } | null> {
  const u = username.trim().toLowerCase();
  if (!u) return null;
  const hit = await withLocalPg(async (sql) => {
    const rows = await sql`select id, email from auth.users where lower(raw_user_meta_data->>'username') = ${u} limit 1`;
    return (rows as any[])[0] ?? null;
  }).catch(() => null);
  return hit ? { id: String(hit.id), email: String(hit.email) } : null;
}

/** The same employee / person master must not get a second login. */
export async function findProfileByIdentity(admin: any, ids: { employeeId?: string | null; personMasterId?: string | null }) {
  for (const [col, val] of [["employee_id", ids.employeeId], ["person_master_id", ids.personMasterId]] as const) {
    if (!val) continue;
    try {
      const { data, error } = await admin.from("profiles").select("id, full_name").eq(col, val).is("deleted_at", null).limit(1);
      if (!error && data?.[0]) return { id: data[0].id as string, fullName: data[0].full_name as string | null, column: col };
    } catch {
      /* column missing on this schema — skip */
    }
  }
  return null;
}

/**
 * Throws a 409 when the scope already has a live holder of this admin role, or the user already holds the
 * same role in the same scope + domain.
 */
export async function assertNoDuplicateAssignment(scope: AssignmentScope, userId: string | null, excludeAssignmentId?: string | null) {
  const domain = scope.operationalDomain ?? "";
  const rows = await withLocalPg(async (sql) => {
    return (await sql`
      select ura.id, ura.user_id, coalesce(p.full_name, 'another user') as full_name
        from public.user_role_assignments ura
        left join public.profiles p on p.id = ura.user_id
       where ura.is_active = true and ura.deleted_at is null
         and ura.role::text = ${scope.role}
         and coalesce(ura.country_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${scope.countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and coalesce(ura.country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${scope.countryBranchId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and coalesce(ura.city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${scope.cityBranchId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
         and coalesce(ura.operational_domain, '') = ${domain}
         and (${excludeAssignmentId ?? null}::uuid is null or ura.id <> ${excludeAssignmentId ?? null}::uuid)
    `) as any[];
  }).catch(() => null);
  if (!rows?.length) return;
  const sameUser = userId ? rows.find((r) => String(r.user_id) === userId) : null;
  if (sameUser) {
    throw new ApiClientError("Duplicate assignment: this user already holds the same role in the same scope and domain. No new record was created.", { status: 409, code: "DUPLICATE_ASSIGNMENT" });
  }
  if (isAdminRole(scope.role)) {
    throw new ApiClientError(
      `Duplicate admin: this scope already has an active ${scope.role.replace(/_/g, " ")} (${rows[0].full_name}). Deactivate or edit that assignment instead of creating another.`,
      { status: 409, code: "DUPLICATE_ADMIN", details: { existingUserId: rows[0].user_id } }
    );
  }
}

/** Throws a 409 naming the existing login when the e-mail / username / employee identity is already in use. */
export async function assertNoDuplicateUser(admin: any, input: { email: string; username?: string | null; employeeId?: string | null; personMasterId?: string | null }) {
  const byEmail = await findUserByEmail(admin, input.email);
  if (byEmail) {
    throw new ApiClientError(`Duplicate user: a login with e-mail ${byEmail.email} already exists. No new user was created.`, { status: 409, code: "DUPLICATE_USER", details: { existingUserId: byEmail.id } });
  }
  if (input.username) {
    const byName = await findUserByUsername(input.username);
    if (byName) {
      throw new ApiClientError(`Duplicate user: username "${input.username}" is already in use. No new user was created.`, { status: 409, code: "DUPLICATE_USER", details: { existingUserId: byName.id } });
    }
  }
  const byIdentity = await findProfileByIdentity(admin, { employeeId: input.employeeId, personMasterId: input.personMasterId });
  if (byIdentity) {
    throw new ApiClientError(`Duplicate user: this ${byIdentity.column === "employee_id" ? "employee" : "person"} already has a login${byIdentity.fullName ? ` (${byIdentity.fullName})` : ""}. No new user was created.`, { status: 409, code: "DUPLICATE_USER", details: { existingUserId: byIdentity.id } });
  }
}
