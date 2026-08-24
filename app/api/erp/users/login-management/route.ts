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
  clearing_agent_id?: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  user_code: string | null;
  raw_password?: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  default_company_id: string | null;
};

type PermissionSetRow = {
  user_id: string;
  permissions: string[] | null;
};

type BranchUserDetail = {
  id: string;
  name: string;
  loginId: string;
  username: string;
  email: string;
  mobile: string;
  temporaryPassword?: string | null;
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
    const countryRowsRaw = await sql<CountryRow[]>`select id, name, iso2, iso3, currency_code, is_active from countries where deleted_at is null order by name asc`;
    const branchRowsRaw = await sql<CountryBranchRow[]>`select id, country_id, name, code, local_currency, status, is_main, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at from country_branches where deleted_at is null order by name asc`;
    const cityRowsRaw = await sql<CityBranchRow[]>`select id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at from city_branches where deleted_at is null order by city_name asc`;
    const clearingAgentRowsRaw = await sql<any[]>`select id, name, code, head_office_country_id from clearing_agents where deleted_at is null`;
    const clearingBranchRowsRaw = await sql<any[]>`select id, name, code, clearing_agent_id, branch_level from clearing_agent_branches where deleted_at is null`;
    const authUserRowsRaw = await sql<any[]>`select id, email from auth.users`;
    const assignmentRowsRaw = await sql<AssignmentRow[]>`select user_id, role, country_id, country_branch_id, city_branch_id, clearing_agent_id, is_active, created_at, updated_at, deleted_at from user_role_assignments where deleted_at is null order by created_at desc`;
    const profileRowsRaw = await sql<ProfileRow[]>`select id, full_name, user_code, raw_password, created_at, updated_at, deleted_at, default_company_id from profiles where deleted_at is null`;
    const permissionRowsRaw = await sql<PermissionSetRow[]>`select user_id, permissions from user_permission_sets where deleted_at is null`;

    const countryRows = countryRowsRaw as CountryRow[];
    const branchRows = branchRowsRaw as CountryBranchRow[];
    const cityRows = cityRowsRaw as CityBranchRow[];
    const clearingAgents = clearingAgentRowsRaw as Array<{ id: string; name: string; code: string; head_office_country_id: string | null }>;
    const clearingBranches = clearingBranchRowsRaw as Array<{ id: string; name: string; code: string; clearing_agent_id: string; branch_level: string }>;
    const authUsers = authUserRowsRaw as Array<{ id: string; email: string }>;
    const assignmentRows = assignmentRowsRaw as AssignmentRow[];
    const profileRows = profileRowsRaw as ProfileRow[];
    const permissionRows = permissionRowsRaw as PermissionSetRow[];

    const countriesById = new Map(countryRows.map((row) => [row.id, row] as const));
    const countryBranchesById = new Map(branchRows.map((row) => [row.id, row] as const));
    const cityBranchesById = new Map(cityRows.map((row) => [row.id, row] as const));
    const clearingAgentsById = new Map(clearingAgents.map((row) => [row.id, row] as const));
    const clearingBranchesByAgentId = new Map(clearingBranches.map((row) => [row.clearing_agent_id, row] as const));
    const authUsersById = new Map(authUsers.map((row) => [row.id, row] as const));
    const profilesById = new Map(profileRows.map((row) => [row.id, row] as const));
    const permissionsByUser = new Map(permissionRows.map((row) => [row.user_id, Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : []] as const));

    const buildUserDetail = (assignment: AssignmentRow): BranchUserDetail | null => {
      const profile = profilesById.get(assignment.user_id);
      if (!profile) return null;

      const authUser = authUsersById.get(assignment.user_id);
      const country = assignment.country_id ? countriesById.get(assignment.country_id) : null;
      const mainBranch = assignment.country_branch_id ? countryBranchesById.get(assignment.country_branch_id) : null;
      const cityBranch = assignment.city_branch_id ? cityBranchesById.get(assignment.city_branch_id) : null;
      const clearingAgent = assignment.clearing_agent_id ? clearingAgentsById.get(assignment.clearing_agent_id) : null;
      const clearingBranch = assignment.clearing_agent_id ? clearingBranchesByAgentId.get(assignment.clearing_agent_id) : null;

      const fallbackCountry = cityBranch?.country_id
        ? countriesById.get(cityBranch.country_id)
        : mainBranch?.country_id
          ? countriesById.get(mainBranch.country_id)
          : clearingAgent?.head_office_country_id
            ? countriesById.get(clearingAgent.head_office_country_id)
            : null;
      const fallbackMainBranch = cityBranch?.country_branch_id ? countryBranchesById.get(cityBranch.country_branch_id) : null;
      const role = assignment.role || "staff_user";
      const lastLogin = normalizeDate(assignment.updated_at || assignment.created_at || profile?.updated_at || profile?.created_at || null);

      let branchName = "-";
      let branchCode = "-";
      let cityName = "-";

      if (clearingBranch || clearingAgent) {
        branchName = clearingBranch?.name || clearingAgent?.name || "Clearing Agent Head Office";
        branchCode = clearingBranch?.code || clearingAgent?.code || "CLEARING-HO-01";
        cityName = "Head Office";
      } else if (cityBranch) {
        branchName = cityBranch.name;
        branchCode = cityBranch.code;
        cityName = cityBranch.city_name;
      } else if (mainBranch || fallbackMainBranch) {
        branchName = mainBranch?.name || fallbackMainBranch?.name || "-";
        branchCode = mainBranch?.code || fallbackMainBranch?.code || "-";
      } else if (role === "super_admin") {
        branchName = "Global HQ";
        branchCode = "SUPERADMIN";
      }

      return {
        id: assignment.user_id,
        name: profile?.full_name || profile?.user_code || "Unnamed User",
        loginId: profile?.user_code || assignment.user_id,
        username: profile?.user_code || assignment.user_id,
        email: authUser?.email || (profile?.user_code ? `${profile.user_code.toLowerCase()}@dgt.llc` : ""),
        mobile: "",
        temporaryPassword: profile?.raw_password || null,
        role,
        classification: roleClassification(role),
        mainUser: isMainUserRole(role),
        countryName: country?.name || fallbackCountry?.name || "Global",
        cityName,
        branchName,
        branchCode,
        department: assignment.role || "-",
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
            accountsCount: 0,
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
          companyName: "Global Group",
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

    const superAdminUsers = allUserDetails.filter((u) => u.role === "super_admin" || u.countryName === "Global");
    const superAdminBranches = [
      {
        id: "super-admin-branch",
        name: "Global Executive Headquarters & Clearing Agent Super Admin",
        code: "HQ-SUPERADMIN",
        users: superAdminUsers
      }
    ];

    const totalActiveBranches = branchRows.filter((branch) => branch.status === "active").length + cityRows.filter((branch) => branch.status === "active").length;
    const summary = {
      totalCountries: countries.length,
      totalMainBranches: branchRows.length,
      totalCityBranches: cityRows.length,
      totalActiveUsers: allUserDetails.filter((user) => user.status === "Active").length,
      totalActiveBranches,
      totalInactiveBranches: branchRows.length + cityRows.length - totalActiveBranches,
      totalMainAccounts: 0,
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
      return apiOk(viaPg);
    }

    return apiError("DATABASE_UNAVAILABLE", "Development database connection is not configured.", 503);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
