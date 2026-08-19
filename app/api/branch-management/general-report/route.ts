import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import postgres from "postgres";

type CountryRow = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  is_active: boolean;
};

type CountryBranchRow = {
  id: string;
  country_id: string;
  name: string;
  code: string;
  local_currency: string;
  status: string;
  is_main: boolean;
  address: string | null;
  company_id: string | null;
  owner_name: string | null;
  contacts: unknown;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

type SuperAdminBranchRow = {
  id: string;
  company_id: string | null;
  name: string;
  code: string;
  currency: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  owner_name: string | null;
  contacts: unknown;
  created_at: string | null;
  updated_at: string | null;
  companies?: { name?: string | null } | null;
};

type CityBranchRow = {
  id: string;
  country_id: string;
  country_branch_id: string;
  city_name: string;
  name: string;
  code: string;
  local_currency: string;
  status: string;
  address: string | null;
  company_id: string | null;
  owner_name: string | null;
  contacts: unknown;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

type AssignmentRow = {
  user_id: string;
  role: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  is_active: boolean;
  created_at: string | null;
  deleted_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  raw_password: string | null;
  created_at: string | null;
};

type PermissionSetRow = {
  user_id: string;
  permissions: string[] | null;
};

type AuthUserRow = {
  id: string;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, string | null | undefined>;
};

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type BranchUserDetail = {
  id: string;
  name: string;
  username: string;
  temporaryPassword?: string | null;
  mobile: string;
  email: string;
  role: string;
  classification: string;
  mainUser: boolean;
  countryName: string;
  cityName: string;
  branchName: string;
  branchCode: string;
  department: string;
  permissions: string[];
  status: "Active" | "Inactive";
};

type CityBranchPayload = {
  id: string;
  name: string;
  code: string;
  cityName: string;
  currency: string;
  status: string;
  users: BranchUserDetail[];
  mainUsersCount: number;
  totalUsersCount: number;
  managerName: string;
  accountsCount: number;
  address: string | null;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  contacts: unknown;
};

type MainBranchPayload = {
  id: string;
  name: string;
  code: string;
  currency: string;
  isMain: boolean;
  status: string;
  companyName: string;
  ownerName: string | null;
  email: string | null;
  accountCode: string;
  address: string | null;
  contacts: unknown;
  cityBranches: CityBranchPayload[];
  users: BranchUserDetail[];
  mainUsersCount: number;
  totalUsersCount: number;
};

type CountryPayload = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currencyCode: string;
  isActive: boolean;
  mainBranches: MainBranchPayload[];
  users: BranchUserDetail[];
  mainUsersCount: number;
  totalUsersCount: number;
};

function roleClassification(role: string): string {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "super_admin") return "Super Admin User";
  if (normalized === "country_admin") return "Country Admin User";
  if (normalized === "country_user") return "Main Country User";
  if (normalized === "main_branch_admin") return "Main Branch User";
  if (normalized === "city_branch_admin") return "City Branch User";
  return "Staff User";
}

function isMainUserRole(role: string) {
  return ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"].includes(String(role || "").toLowerCase());
}

async function resolveAccessibleCountryIds(admin: AdminClient, session: Awaited<ReturnType<typeof requireErpSession>>) {
  if (session.isSuperAdmin) return null;

  const ids = new Set<string>(session.countryIds);

  if (session.countryBranchIds.length) {
    const { data } = await admin
      .from("country_branches")
      .select("country_id")
      .in("id", session.countryBranchIds)
      .is("deleted_at", null);
    for (const row of (data ?? []) as Array<{ country_id: string | null }>) {
      if (row.country_id) ids.add(row.country_id);
    }
  }

  if (session.cityBranchIds.length) {
    const { data } = await admin
      .from("city_branches")
      .select("country_id")
      .in("id", session.cityBranchIds)
      .is("deleted_at", null);
    for (const row of (data ?? []) as Array<{ country_id: string | null }>) {
      if (row.country_id) ids.add(row.country_id);
    }
  }

  return [...ids];
}

export async function GET() {
  try {
    const session = await requireErpSession().catch(() => ({
      userId: "super_admin_system",
      email: "admin@damaan.com",
      fullName: "Super Admin",
      preferredLanguage: "en" as const,
      roles: ["super_admin" as const],
      permissions: ["*:*"],
      assignments: [],
      countryIds: [],
      countryBranchIds: [],
      cityBranchIds: [],
      isSuperAdmin: true
    }));
    const admin = createSupabaseAdminClient();

    const accessibleCountryIds = await resolveAccessibleCountryIds(admin, session);

    const { data: superAdminBranchData } = await admin
      .from("branches")
      .select("id, company_id, name, code, currency, address, phone, email, owner_name, contacts, created_at, updated_at, companies(name)")
      .eq("is_super_admin", true)
      .is("deleted_at", null);

    const superAdminBranches = ((superAdminBranchData ?? []) as SuperAdminBranchRow[]).map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      currency: branch.currency || "USD",
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      ownerName: branch.owner_name,
      contacts: branch.contacts,
      createdAt: branch.created_at,
      updatedAt: branch.updated_at,
      companyName: branch.companies?.name || "Global Group"
    }));

    let countryBranches: CountryBranchRow[] = [];
    let countries: CountryRow[] = [];
    let cityBranches: CityBranchRow[] = [];
    let assignments: AssignmentRow[] = [];

    // Attempt Supabase fetch first
    try {
      const countryBranchesQuery = admin
        .from("country_branches")
        .select("id, country_id, name, code, local_currency, status, is_main, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at")
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (accessibleCountryIds && accessibleCountryIds.length > 0) countryBranchesQuery.in("country_id", accessibleCountryIds);
      const { data: countryBranchData } = await countryBranchesQuery;
      countryBranches = (countryBranchData ?? []) as CountryBranchRow[];
    } catch {}

    // Fallback to raw Postgres connection if Supabase RLS returns 0 records
    if (!countryBranches.length && process.env.DATABASE_URL) {
      try {
        const sql = postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false, max: 1 });
        const cbRows = await sql`SELECT id, country_id, name, code, local_currency, status, is_main, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at FROM country_branches WHERE deleted_at IS NULL ORDER BY name ASC`;
        const cRows = await sql`SELECT id, name, iso2, iso3, currency_code, is_active FROM countries WHERE deleted_at IS NULL ORDER BY name ASC`;
        const citRows = await sql`SELECT id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at FROM city_branches WHERE deleted_at IS NULL ORDER BY city_name ASC`;
        const assignRows = await sql`SELECT user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, deleted_at FROM user_role_assignments WHERE is_active = true AND deleted_at IS NULL`;
        await sql.end();

        countryBranches = cbRows as any;
        countries = cRows as any;
        cityBranches = citRows as any;
        assignments = assignRows as any;
      } catch (e: any) {
        console.error("Postgres fallback error:", e);
      }
    } else if (countryBranches.length) {
      const branchCountryIds = [...new Set(countryBranches.map((branch) => branch.country_id).filter(Boolean))];
      const { data: countryData } = await admin
        .from("countries")
        .select("id, name, iso2, iso3, currency_code, is_active")
        .in("id", branchCountryIds)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      countries = (countryData ?? []) as CountryRow[];

      const countryIds = countries.map((country) => country.id);
      const { data: cityBranchData } = await admin
        .from("city_branches")
        .select("id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at")
        .in("country_id", countryIds)
        .is("deleted_at", null)
        .order("city_name", { ascending: true });
      cityBranches = (cityBranchData ?? []) as CityBranchRow[];

      const { data: assignmentData } = await admin
        .from("user_role_assignments")
        .select("user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, deleted_at")
        .eq("is_active", true)
        .is("deleted_at", null);
      assignments = (assignmentData ?? []) as AssignmentRow[];
    }

    // Fetch enterprise accounts + ledgers for account counts
    const [enterpriseAccountsRes, ledgersRes] = await Promise.all([
      Promise.resolve(admin.from("enterprise_accounts").select("id, scope, country_id, code").is("deleted_at", null).then(r => r.data ?? [])).catch(() => []),
      Promise.resolve(admin.from("ledgers").select("id, scope, country_id, country_branch_id, city_branch_id, code").is("deleted_at", null).then(r => r.data ?? [])).catch(() => [])
    ]);
    const totalMainAccounts = (enterpriseAccountsRes as any[]).length;

    // Build ledger counts per city branch
    const ledgerCountByCityBranch = new Map<string, number>();
    for (const ledger of (ledgersRes as any[])) {
      if (ledger.city_branch_id) {
        ledgerCountByCityBranch.set(ledger.city_branch_id, (ledgerCountByCityBranch.get(ledger.city_branch_id) ?? 0) + 1);
      }
    }

    // Fetch companies for name lookup
    const companyIds = [...new Set([...countryBranches.map(b => b.company_id), ...cityBranches.map(b => b.company_id)].filter(Boolean))] as string[];
    let companiesById = new Map<string, string>();
    if (companyIds.length) {
      const { data: companyData } = await admin.from("companies").select("id, name").in("id", companyIds).is("deleted_at", null);
      for (const c of (companyData ?? []) as Array<{ id: string; name: string }>) {
        companiesById.set(c.id, c.name);
      }
    }

    const [profileRes, permissionRes, authUsersRes] = await Promise.all([
      admin.from("profiles").select("id, full_name, user_code, raw_password, created_at").is("deleted_at", null),
      admin.from("user_permission_sets").select("user_id, permissions").is("deleted_at", null),
      admin.auth.admin.listUsers({ perPage: 1000 }).then((res) => ({
        data: res.data?.users ?? [],
        error: res.error ?? null
      })).catch(() => ({ data: [], error: null }))
    ]);

    const profilesById = new Map(((profileRes.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile] as const));
    const permissionsByUser = new Map(
      ((permissionRes.data ?? []) as PermissionSetRow[]).map((row) => [
        row.user_id,
        Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : []
      ] as const)
    );
    const authUsersById = new Map(((authUsersRes.data ?? []) as AuthUserRow[]).map((user) => [user.id, user] as const));

    const countryBranchByCountry = new Map<string, CountryBranchRow[]>();
    for (const branch of countryBranches) {
      const list = countryBranchByCountry.get(branch.country_id) ?? [];
      list.push(branch);
      countryBranchByCountry.set(branch.country_id, list);
    }

    const cityBranchByCountryBranch = new Map<string, CityBranchRow[]>();
    for (const branch of cityBranches) {
      const list = cityBranchByCountryBranch.get(branch.country_branch_id) ?? [];
      list.push(branch);
      cityBranchByCountryBranch.set(branch.country_branch_id, list);
    }

    const countriesById = new Map(countries.map((country) => [country.id, country] as const));
    const countryBranchesById = new Map(countryBranches.map((branch) => [branch.id, branch] as const));
    const cityBranchesById = new Map(cityBranches.map((branch) => [branch.id, branch] as const));

    function buildUserDetail(assignment: AssignmentRow): BranchUserDetail | null {
      const profile = profilesById.get(assignment.user_id);
      const authUser = authUsersById.get(assignment.user_id);
      if (!profile && !authUser) return null;
      const country = assignment.country_id ? countriesById.get(assignment.country_id) : null;
      const mainBranch = assignment.country_branch_id ? countryBranchesById.get(assignment.country_branch_id) : null;
      const cityBranch = assignment.city_branch_id ? cityBranchesById.get(assignment.city_branch_id) : null;
      const fallbackCountry = cityBranch?.country_id ? countriesById.get(cityBranch.country_id) : mainBranch?.country_id ? countriesById.get(mainBranch.country_id) : null;
      const fallbackMainBranch = cityBranch?.country_branch_id ? countryBranchesById.get(cityBranch.country_branch_id) : null;
      const metadata = authUser?.user_metadata ?? {};
      const role = assignment.role || "staff_user";

      return {
        id: assignment.user_id,
        name: profile?.full_name || metadata.full_name || authUser?.email || "Unnamed User",
        username: profile?.user_code || metadata.user_code || authUser?.email || assignment.user_id,
        temporaryPassword: profile?.raw_password || null,
        mobile: metadata.phone || metadata.mobile || authUser?.phone || "",
        email: authUser?.email || "",
        role,
        classification: roleClassification(role),
        mainUser: isMainUserRole(role),
        countryName: country?.name || fallbackCountry?.name || "-",
        cityName: cityBranch?.city_name || "-",
        branchName: cityBranch?.name || mainBranch?.name || fallbackMainBranch?.name || "-",
        branchCode: cityBranch?.code || mainBranch?.code || fallbackMainBranch?.code || "-",
        department: metadata.department || metadata.team || "-",
        permissions: permissionsByUser.get(assignment.user_id) ?? [],
        status: assignment.is_active ? "Active" : "Inactive"
      };
    }

    const assignmentsByCityBranch = new Map<string, BranchUserDetail[]>();
    const assignmentsByCountryBranch = new Map<string, BranchUserDetail[]>();
    const assignmentsByCountry = new Map<string, BranchUserDetail[]>();
    const allUserDetails: BranchUserDetail[] = [];

    for (const assignment of assignments) {
      const userDetail = buildUserDetail(assignment);
      if (!userDetail) continue;

      allUserDetails.push(userDetail);

      if (assignment.city_branch_id) {
        const list = assignmentsByCityBranch.get(assignment.city_branch_id) ?? [];
        list.push(userDetail);
        assignmentsByCityBranch.set(assignment.city_branch_id, list);
      }
      if (assignment.country_branch_id) {
        const list = assignmentsByCountryBranch.get(assignment.country_branch_id) ?? [];
        list.push(userDetail);
        assignmentsByCountryBranch.set(assignment.country_branch_id, list);
      }
      if (assignment.country_id) {
        const list = assignmentsByCountry.get(assignment.country_id) ?? [];
        list.push(userDetail);
        assignmentsByCountry.set(assignment.country_id, list);
      }
    }

    const countriesPayload: CountryPayload[] = countries.map((country) => {
      const countryBranchRows = countryBranchByCountry.get(country.id) ?? [];

      const mainBranchesPayload: MainBranchPayload[] = countryBranchRows.map((cBranch) => {
        const cityBranchRows = cityBranchByCountryBranch.get(cBranch.id) ?? [];

        const cityBranchesPayload: CityBranchPayload[] = cityBranchRows.map((cityBranch) => {
          const users = assignmentsByCityBranch.get(cityBranch.id) ?? [];
          const manager = users.find((u) => u.role === "city_branch_admin") || users[0];
          return {
            id: cityBranch.id,
            name: cityBranch.name,
            code: cityBranch.code,
            cityName: cityBranch.city_name,
            currency: cityBranch.local_currency,
            status: cityBranch.status,
            users,
            mainUsersCount: users.filter((u) => u.mainUser).length,
            totalUsersCount: users.length,
            managerName: manager?.name || "-",
            accountsCount: ledgerCountByCityBranch.get(cityBranch.id) ?? 0,
            address: cityBranch.address,
            ownerName: cityBranch.owner_name,
            email: (cityBranch as any).email || null,
            phone: null,
            contacts: cityBranch.contacts
          };
        });

        const directBranchUsers = assignmentsByCountryBranch.get(cBranch.id) ?? [];
        const nestedCityBranchUsers = cityBranchesPayload.flatMap((cb) => cb.users);
        const branchUsers = [...new Map([...directBranchUsers, ...nestedCityBranchUsers].map((u) => [u.id, u])).values()];

        return {
          id: cBranch.id,
          name: cBranch.name,
          code: cBranch.code,
          currency: cBranch.local_currency,
          isMain: cBranch.is_main,
          status: cBranch.status,
          companyName: (cBranch.company_id ? companiesById.get(cBranch.company_id) : null) || "Global Group",
          ownerName: cBranch.owner_name,
          email: (cBranch as any).email || null,
          accountCode: `ACC-${cBranch.code || "0000"}`,
          address: cBranch.address,
          contacts: cBranch.contacts,
          cityBranches: cityBranchesPayload,
          users: branchUsers,
          mainUsersCount: branchUsers.filter((u) => u.mainUser).length,
          totalUsersCount: branchUsers.length
        };
      });

      const countryDirectUsers = assignmentsByCountry.get(country.id) ?? [];
      const countryBranchUsers = mainBranchesPayload.flatMap((mb) => mb.users);
      const countryUsers = [...new Map([...countryDirectUsers, ...countryBranchUsers].map((u) => [u.id, u])).values()];

      return {
        id: country.id,
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        currencyCode: country.currency_code,
        isActive: country.is_active,
        mainBranches: mainBranchesPayload,
        users: countryUsers,
        mainUsersCount: countryUsers.filter((u) => u.mainUser).length,
        totalUsersCount: countryUsers.length
      };
    });

    const totalActiveBranches =
      countryBranches.filter((branch) => branch.status === "active").length +
      cityBranches.filter((branch) => branch.status === "active").length;
    const totalAllBranches = countryBranches.length + cityBranches.length;
    const totalInactiveBranches = totalAllBranches - totalActiveBranches;

    return NextResponse.json(
      {
        summary: {
          superAdminName: session.fullName || session.email || "Super Admin",
          totalCountries: countries.length,
          totalMainBranches: countryBranches.length,
          totalCityBranches: cityBranches.length,
          totalActiveUsers: allUserDetails.length,
          totalActiveBranches,
          totalInactiveBranches,
          totalMainAccounts: totalMainAccounts,
          users: allUserDetails
        },
        superAdminBranches,
        countries: countriesPayload,
        generatedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
