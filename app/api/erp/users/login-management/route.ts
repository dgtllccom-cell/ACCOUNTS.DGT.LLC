import { NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

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
  updated_at: string | null;
  deleted_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  employee_id: string | null;
  person_master_id: string | null;
  default_company_id: string | null;
  photo_url: string | null;
};

type PermissionSetRow = {
  user_id: string;
  permissions: string[] | null;
};

type AuthUserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  raw_user_meta_data: Record<string, string | null | undefined> | null;
};

type BranchUserDetail = {
  id: string;
  name: string;
  loginId: string;
  username: string;
  email: string;
  mobile: string;
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
  lastLogin: string | null;
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

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadViaPg() {
  return await withLocalPg(async (sql) => {
    const [countryRows, branchRows, cityRows, assignmentRows, profileRows, permissionRows, authRows, superAdminBranchRows, ledgerRows, companyRows] = await Promise.all([
      sql<CountryRow[]>`select id, name, iso2, iso3, currency_code, is_active from countries where deleted_at is null order by name asc`,
      sql<CountryBranchRow[]>`select id, country_id, name, code, local_currency, status, is_main, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at from country_branches where deleted_at is null order by name asc`,
      sql<CityBranchRow[]>`select id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at from city_branches where deleted_at is null order by city_name asc`,
      sql<AssignmentRow[]>`select user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, updated_at, deleted_at from user_role_assignments where deleted_at is null order by created_at desc`,
      sql<ProfileRow[]>`select id, full_name, user_code, created_at, updated_at, deleted_at, first_name, middle_name, last_name, employee_id, person_master_id, default_company_id, photo_url from profiles where deleted_at is null`,
      sql<PermissionSetRow[]>`select user_id, permissions from user_permission_sets where deleted_at is null`,
      sql<AuthUserRow[]>`select id, email, phone, created_at, last_sign_in_at, raw_user_meta_data from auth.users order by created_at desc`,
      sql<SuperAdminBranchRow[]>`select id, company_id, name, code, currency, address, phone, email, owner_name, contacts, created_at, updated_at, companies(name) from branches where is_super_admin = true and deleted_at is null order by name asc`,
      sql<{ city_branch_id: string | null; accounts_count: number }[]>`select city_branch_id, count(*)::int as accounts_count from ledgers where deleted_at is null group by city_branch_id`,
      sql<{ id: string; name: string }[]>`select id, name from companies where deleted_at is null`
    ]);

    const countriesById = new Map(countryRows.map((row) => [row.id, row] as const));
    const countryBranchesById = new Map(branchRows.map((row) => [row.id, row] as const));
    const cityBranchesById = new Map(cityRows.map((row) => [row.id, row] as const));
    const profilesById = new Map(profileRows.map((row) => [row.id, row] as const));
    const permissionsByUser = new Map(permissionRows.map((row) => [row.user_id, Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : []] as const));
    const authUsersById = new Map(authRows.map((row) => [row.id, row] as const));
    const ledgerCountByCityBranch = new Map<string, number>();
    for (const row of ledgerRows) {
      if (row.city_branch_id) {
        ledgerCountByCityBranch.set(row.city_branch_id, (ledgerCountByCityBranch.get(row.city_branch_id) ?? 0) + Number(row.accounts_count || 0));
      }
    }
    const companiesById = new Map(companyRows.map((row) => [row.id, row.name] as const));

    const buildUserDetail = (assignment: AssignmentRow): BranchUserDetail | null => {
      const profile = profilesById.get(assignment.user_id);
      const authUser = authUsersById.get(assignment.user_id);
      if (!profile && !authUser) return null;

      const country = assignment.country_id ? countriesById.get(assignment.country_id) : null;
      const mainBranch = assignment.country_branch_id ? countryBranchesById.get(assignment.country_branch_id) : null;
      const cityBranch = assignment.city_branch_id ? cityBranchesById.get(assignment.city_branch_id) : null;
      const fallbackCountry = cityBranch?.country_id ? countriesById.get(cityBranch.country_id) : mainBranch?.country_id ? countriesById.get(mainBranch.country_id) : null;
      const fallbackMainBranch = cityBranch?.country_branch_id ? countryBranchesById.get(cityBranch.country_branch_id) : null;
      const metadata = authUser?.raw_user_meta_data ?? {};
      const role = assignment.role || "staff_user";
      const lastLogin = normalizeDate(authUser?.last_sign_in_at || assignment.updated_at || assignment.created_at || profile?.updated_at || profile?.created_at || authUser?.created_at || null);

      return {
        id: assignment.user_id,
        name: profile?.full_name || metadata.full_name || authUser?.email || "Unnamed User",
        loginId: profile?.user_code || metadata.user_code || authUser?.email || assignment.user_id,
        username: profile?.user_code || metadata.user_code || authUser?.email || assignment.user_id,
        email: authUser?.email || "",
        mobile: metadata.phone || metadata.mobile || authUser?.phone || "",
        role,
        classification: roleClassification(role),
        mainUser: isMainUserRole(role),
        countryName: country?.name || fallbackCountry?.name || "-",
        cityName: cityBranch?.city_name || "-",
        branchName: cityBranch?.name || mainBranch?.name || fallbackMainBranch?.name || "-",
        branchCode: cityBranch?.code || mainBranch?.code || fallbackMainBranch?.code || "-",
        department: metadata.department || metadata.team || "-",
        permissions: permissionsByUser.get(assignment.user_id) ?? [],
        status: assignment.is_active ? "Active" : "Inactive",
        lastLogin
      };
    };

    const assignmentsByCityBranch = new Map<string, BranchUserDetail[]>();
    const assignmentsByCountryBranch = new Map<string, BranchUserDetail[]>();
    const assignmentsByCountry = new Map<string, BranchUserDetail[]>();
    const allUserDetails: BranchUserDetail[] = [];

    for (const assignment of assignmentRows) {
      const detail = buildUserDetail(assignment);
      if (!detail) continue;
      allUserDetails.push(detail);
      if (assignment.city_branch_id) {
        const list = assignmentsByCityBranch.get(assignment.city_branch_id) ?? [];
        list.push(detail);
        assignmentsByCityBranch.set(assignment.city_branch_id, list);
      }
      if (assignment.country_branch_id) {
        const list = assignmentsByCountryBranch.get(assignment.country_branch_id) ?? [];
        list.push(detail);
        assignmentsByCountryBranch.set(assignment.country_branch_id, list);
      }
      if (assignment.country_id) {
        const list = assignmentsByCountry.get(assignment.country_id) ?? [];
        list.push(detail);
        assignmentsByCountry.set(assignment.country_id, list);
      }
    }

    const countries: CountryPayload[] = countryRows.map((country) => {
      const mainBranchRows = branchRows.filter((branch) => branch.country_id === country.id);
      const mainBranches: MainBranchPayload[] = mainBranchRows.map((mainBranch) => {
        const cityBranchRows = cityRows.filter((cityBranch) => cityBranch.country_branch_id === mainBranch.id);
        const cityBranches: CityBranchPayload[] = cityBranchRows.map((cityBranch) => {
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
            contacts: cityBranch.contacts
          };
        });

        const directUsers = assignmentsByCountryBranch.get(mainBranch.id) ?? [];
        const nestedCityUsers = cityBranches.flatMap((cb) => cb.users);
        const branchUsers = [...new Map([...directUsers, ...nestedCityUsers].map((u) => [u.id, u] as const)).values()];

        return {
          id: mainBranch.id,
          name: mainBranch.name,
          code: mainBranch.code,
          currency: mainBranch.local_currency,
          isMain: mainBranch.is_main,
          status: mainBranch.status,
          companyName: (mainBranch.company_id ? companiesById.get(mainBranch.company_id) : null) || "Global Group",
          ownerName: mainBranch.owner_name,
          address: mainBranch.address,
          contacts: mainBranch.contacts,
          cityBranches,
          users: branchUsers,
          mainUsersCount: branchUsers.filter((u) => u.mainUser).length,
          totalUsersCount: branchUsers.length
        };
      });

      const countryUsers = [
        ...(assignmentsByCountry.get(country.id) ?? []),
        ...mainBranches.flatMap((mainBranch) => mainBranch.users)
      ];
      const uniqueCountryUsers = [...new Map(countryUsers.map((user) => [user.id, user] as const)).values()];

      return {
        id: country.id,
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        currencyCode: country.currency_code,
        isActive: country.is_active,
        mainBranches,
        users: uniqueCountryUsers,
        mainUsersCount: uniqueCountryUsers.filter((u) => u.mainUser).length,
        totalUsersCount: uniqueCountryUsers.length
      };
    });

    const superAdminBranches = superAdminBranchRows.map((branch) => ({
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

    const totalActiveBranches = branchRows.filter((branch) => branch.status === "active").length + cityRows.filter((branch) => branch.status === "active").length;
    const summary = {
      totalCountries: countries.length,
      totalMainBranches: branchRows.length,
      totalCityBranches: cityRows.length,
      totalActiveUsers: allUserDetails.filter((user) => user.status === "Active").length,
      totalActiveBranches,
      totalInactiveBranches: branchRows.length + cityRows.length - totalActiveBranches,
      totalMainAccounts: branchRows.length,
      users: allUserDetails
    };

    return {
      summary,
      superAdminBranches,
      countries,
      generatedAt: new Date().toISOString()
    };
  });
}

export async function GET() {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return apiError("FORBIDDEN", "Super Admin access is required.", 403);
    }

    const viaPg = await loadViaPg();
    if (viaPg) {
      return apiOk({ data: viaPg });
    }

    return apiError("DATABASE_UNAVAILABLE", "Development database connection is not configured.", 503);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
