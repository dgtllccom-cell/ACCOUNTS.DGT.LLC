import { withLocalPg } from "@/lib/db/local-postgres";

export interface AccessRegisterEntry {
  id: string;
  country: string;
  countryCode: string;
  mainBranch: string;
  mainBranchCode: string;
  cityBranch: string;
  cityBranchCode: string;
  responsiblePerson: string;
  role: "Super Admin" | "Country Admin" | "Main Branch Admin" | "City Branch User" | "Clearing Agent" | "Accountant" | "Auditor";
  loginUrl: string;
  username: string;
  email: string;
  status: "Active" | "Inactive" | "Suspended";
  assignedPermissions: string;
  passwordVaultRef: string;
  lastUpdated: string;
  notes: string;
}

const ROLE_LABELS: Record<string, AccessRegisterEntry["role"]> = {
  super_admin: "Super Admin",
  country_admin: "Country Admin",
  country_user: "Country Admin",
  main_branch_admin: "Main Branch Admin",
  city_branch_admin: "City Branch User",
  city_branch_user: "City Branch User",
  clearing_agent: "Clearing Agent",
  accountant: "Accountant",
  auditor: "Auditor",
};

function roleLabel(role: string | null): AccessRegisterEntry["role"] {
  if (!role) return "City Branch User";
  return ROLE_LABELS[role] ?? "City Branch User";
}

function statusLabel(active: boolean | null): AccessRegisterEntry["status"] {
  return active === false ? "Inactive" : "Active";
}

interface AccessRow {
  id: string;
  role: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  full_name: string | null;
  user_code: string | null;
  country_name: string | null;
  country_iso: string | null;
  main_branch_name: string | null;
  main_branch_code: string | null;
  city_branch_name: string | null;
  city_branch_code: string | null;
  permissions: unknown;
}

/**
 * Real branch-login / access register — built from `user_role_assignments` joined to
 * profiles, countries and branch masters. No hard-coded users, credentials or branches.
 * Returns an empty array when the datasource is unavailable (callers render a "no data" state).
 */
export async function getAccessRegisterData(): Promise<AccessRegisterEntry[]> {
  const rows = await withLocalPg<AccessRow[]>(async (sql) => {
    return (await sql`
      SELECT
        ura.id::text                         AS id,
        ura.role                             AS role,
        ura.is_active                        AS is_active,
        to_char(ura.updated_at, 'YYYY-MM-DD') AS updated_at,
        p.full_name                          AS full_name,
        p.user_code                          AS user_code,
        c.name                               AS country_name,
        c.iso2                               AS country_iso,
        cb.name                              AS main_branch_name,
        cb.code                              AS main_branch_code,
        ctb.name                             AS city_branch_name,
        ctb.code                             AS city_branch_code,
        ups.permissions                      AS permissions
      FROM user_role_assignments ura
      LEFT JOIN profiles p           ON p.id = ura.user_id AND p.deleted_at IS NULL
      LEFT JOIN countries c          ON c.id = ura.country_id AND c.deleted_at IS NULL
      LEFT JOIN country_branches cb  ON cb.id = ura.country_branch_id AND cb.deleted_at IS NULL
      LEFT JOIN city_branches ctb    ON ctb.id = ura.city_branch_id AND ctb.deleted_at IS NULL
      LEFT JOIN user_permission_sets ups ON ups.user_id = ura.user_id
      WHERE ura.deleted_at IS NULL
      ORDER BY c.name NULLS FIRST, cb.name NULLS FIRST, ctb.name NULLS FIRST, p.full_name
    `) as unknown as AccessRow[];
  });

  if (!rows || rows.length === 0) return [];

  return rows.map((r) => {
    const perms = Array.isArray(r.permissions)
      ? (r.permissions as string[]).join(", ")
      : typeof r.permissions === "string"
        ? r.permissions
        : "";
    return {
      id: r.id,
      country: r.country_name || "—",
      countryCode: (r.country_iso || "").toUpperCase(),
      mainBranch: r.main_branch_name || "—",
      mainBranchCode: r.main_branch_code || "—",
      cityBranch: r.city_branch_name || "—",
      cityBranchCode: r.city_branch_code || "—",
      responsiblePerson: r.full_name || "—",
      role: roleLabel(r.role),
      loginUrl: "/login",
      username: r.user_code || "—",
      email: "",
      status: statusLabel(r.is_active),
      assignedPermissions: perms,
      passwordVaultRef: r.user_code ? `VAULT-${r.user_code}` : "—",
      lastUpdated: r.updated_at || "—",
      notes: "",
    };
  });
}
