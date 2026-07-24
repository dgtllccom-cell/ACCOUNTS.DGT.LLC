import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  temporaryPassword: string | null;
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
  status: string;
  createdDate: string | null;
};

function roleClassification(role: string) {
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
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient();

    const accessibleCountryIds = await resolveAccessibleCountryIds(admin, session);

    const { data: superAdminBranchData, error: superAdminBranchError } = await admin
      .from("branches")
      .select("id, company_id, name, code, currency, address, phone, email, owner_name, contacts, created_at, updated_at, companies(name)")
      .eq("is_super_admin", true)
      .is("deleted_at", null);

    if (superAdminBranchError) throw new Error(superAdminBranchError.message);
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

    if (accessibleCountryIds && accessibleCountryIds.length === 0) {
      return NextResponse.json(
        {
          summary: {
            superAdminName: session.fullName || session.email || "Super Admin",
            totalCountries: 0,
            totalMainBranches: 0,
            totalCityBranches: 0,
            totalActiveUsers: 0,
            totalActiveBranches: 0,
            users: []
          },
          superAdminBranches,
          countries: [],
          generatedAt: new Date().toISOString()
        },
        { status: 200 }
      );
    }

    const countryBranchesQuery = admin
      .from("country_branches")
      .select("id, country_id, name, code, local_currency, status, is_main, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (accessibleCountryIds) countryBranchesQuery.in("country_id", accessibleCountryIds);
    const { data: countryBranchData, error: countryBranchError } = await countryBranchesQuery;
    if (countryBranchError) throw new Error(countryBranchError.message);

    const countryBranches = (countryBranchData ?? []) as CountryBranchRow[];
    const branchCountryIds = [...new Set(countryBranches.map((branch) => branch.country_id).filter(Boolean))];

    if (!branchCountryIds.length) {
      return NextResponse.json(
        {
          summary: {
            superAdminName: session.fullName || session.email || "Super Admin",
            totalCountries: 0,
            totalMainBranches: 0,
            totalCityBranches: 0,
            totalActiveUsers: 0,
            totalActiveBranches: 0,
            users: []
          },
          superAdminBranches,
          countries: [],
          generatedAt: new Date().toISOString()
        },
        { status: 200 }
      );
    }

    const countriesQuery = admin
      .from("countries")
      .select("id, name, iso2, iso3, currency_code, is_active")
      .in("id", branchCountryIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    const { data: countryData, error: countryError } = await countriesQuery;
    if (countryError) throw new Error(countryError.message);

    const countries = (countryData ?? []) as CountryRow[];
    const countryIds = countries.map((country) => country.id);

    const cityBranchesQuery = admin
      .from("city_branches")
      .select("id, country_id, country_branch_id, city_name, name, code, local_currency, status, address, company_id, owner_name, contacts, created_at, updated_at, deleted_at")
      .is("deleted_at", null)
      .order("city_name", { ascending: true });
    if (countryIds.length) cityBranchesQuery.in("country_id", countryIds);
    const { data: cityBranchData, error: cityBranchError } = await cityBranchesQuery;
    if (cityBranchError) throw new Error(cityBranchError.message);

    const assignmentsQuery = admin
      .from("user_role_assignments")
      .select("user_id, role, country_id, country_branch_id, city_branch_id, is_active, created_at, deleted_at")
      .eq("is_active", true)
      .is("deleted_at", null);
    const { data: assignmentData, error: assignmentError } = await assignmentsQuery;
    if (assignmentError) throw new Error(assignmentError.message);

    const cityBranches = (cityBranchData ?? []) as CityBranchRow[];
    const assignments = (assignmentData ?? []) as AssignmentRow[];
    const [profileRes, permissionRes, authUsersRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, user_code, raw_password, created_at")
        .is("deleted_at", null),
      admin
        .from("user_permission_sets")
        .select("user_id, permissions")
        .is("deleted_at", null),
      admin.auth.admin.listUsers({ perPage: 1000 }).then((res) => ({
        data: res.data?.users ?? [],
        error: res.error ?? null
      }))
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    if (permissionRes.error) throw new Error(permissionRes.error.message);

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

    const mainBranchIds = countryBranches.map((branch) => branch.id);
    const cityBranchIds = cityBranches.map((branch) => branch.id);
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
        status: assignment.is_active ? "Active" : "Inactive",
        createdDate: assignment.created_at || profile?.created_at || authUser?.created_at || null
      };
    }

    const usersByCountry = new Map<string, BranchUserDetail[]>();
    const usersByMainBranch = new Map<string, BranchUserDetail[]>();
    const usersByCityBranch = new Map<string, BranchUserDetail[]>();
    const allUserDetails: BranchUserDetail[] = [];

    for (const assignment of assignments) {
      const detail = buildUserDetail(assignment);
      if (!detail) continue;
      allUserDetails.push(detail);

      const assignmentCityBranch = assignment.city_branch_id ? cityBranchesById.get(assignment.city_branch_id) : null;
      const assignmentMainBranch = assignment.country_branch_id
        ? countryBranchesById.get(assignment.country_branch_id)
        : assignmentCityBranch?.country_branch_id
          ? countryBranchesById.get(assignmentCityBranch.country_branch_id)
          : null;
      const mappedCountryId = assignment.country_id || assignmentCityBranch?.country_id || assignmentMainBranch?.country_id || null;
      const mappedMainBranchId = assignment.country_branch_id || assignmentCityBranch?.country_branch_id || null;

      if (mappedCountryId) {
        const list = usersByCountry.get(mappedCountryId) ?? [];
        list.push(detail);
        usersByCountry.set(mappedCountryId, list);
      }
      if (mappedMainBranchId) {
        const list = usersByMainBranch.get(mappedMainBranchId) ?? [];
        list.push(detail);
        usersByMainBranch.set(mappedMainBranchId, list);
      }
      if (assignment.city_branch_id) {
        const list = usersByCityBranch.get(assignment.city_branch_id) ?? [];
        list.push(detail);
        usersByCityBranch.set(assignment.city_branch_id, list);
      }
    }

    const userIdsWithAssignments = new Set(allUserDetails.map((user) => user.id));
    for (const [userId, authUser] of authUsersById.entries()) {
      if (userIdsWithAssignments.has(userId)) continue;
      const profile = profilesById.get(userId);
      const metadata = authUser.user_metadata ?? {};
      const role = metadata.role || metadata.user_role || "staff_user";
      allUserDetails.push({
        id: userId,
        name: profile?.full_name || metadata.full_name || authUser.email || "Unnamed User",
        username: profile?.user_code || metadata.user_code || authUser.email || userId,
        temporaryPassword: profile?.raw_password || null,
        mobile: metadata.phone || metadata.mobile || authUser.phone || "",
        email: authUser.email || "",
        role,
        classification: roleClassification(role),
        mainUser: isMainUserRole(role),
        countryName: metadata.country_name || "-",
        cityName: metadata.city_name || "-",
        branchName: metadata.branch_name || "-",
        branchCode: metadata.branch_code || "-",
        department: metadata.department || metadata.team || "-",
        permissions: permissionsByUser.get(userId) ?? [],
        status: "Active",
        createdDate: profile?.created_at || authUser.created_at || null
      });
    }

    const allowedCountryIds = accessibleCountryIds ?? countryIds;
    const activeUserIds = new Set<string>();
    for (const assignment of assignments) {
      if (!assignment.user_id || !assignment.is_active || assignment.deleted_at) continue;
      if (assignment.country_id && allowedCountryIds.includes(assignment.country_id)) {
        activeUserIds.add(assignment.user_id);
        continue;
      }
      if (assignment.country_branch_id && mainBranchIds.includes(assignment.country_branch_id)) {
        activeUserIds.add(assignment.user_id);
        continue;
      }
      if (assignment.city_branch_id && cityBranchIds.includes(assignment.city_branch_id)) {
        activeUserIds.add(assignment.user_id);
      }
    }

    const countriesPayload = countries.map((country) => {
      const mainBranches = (countryBranchByCountry.get(country.id) ?? []).map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        localCurrency: branch.local_currency,
        status: branch.status,
        isMain: branch.is_main,
        address: branch.address,
        companyId: branch.company_id,
        ownerName: branch.owner_name,
        contacts: branch.contacts,
        createdAt: branch.created_at,
        updatedAt: branch.updated_at,
        userCount: usersByMainBranch.get(branch.id)?.length ?? 0,
        users: usersByMainBranch.get(branch.id) ?? [],
        cityBranches: (cityBranchByCountryBranch.get(branch.id) ?? []).map((cityBranch) => ({
          id: cityBranch.id,
          cityName: cityBranch.city_name,
          name: cityBranch.name,
          code: cityBranch.code,
          localCurrency: cityBranch.local_currency,
          status: cityBranch.status,
          address: cityBranch.address,
          companyId: cityBranch.company_id,
          ownerName: cityBranch.owner_name,
          contacts: cityBranch.contacts,
          createdAt: cityBranch.created_at,
          updatedAt: cityBranch.updated_at,
          userCount: usersByCityBranch.get(cityBranch.id)?.length ?? 0,
          users: usersByCityBranch.get(cityBranch.id) ?? []
        }))
      }));

      const totalCityBranches = mainBranches.reduce((sum, branch) => sum + branch.cityBranches.length, 0);
      const countryCode = (country.iso2 || country.iso3 || country.currency_code || "").toUpperCase();

      return {
        id: country.id,
        name: country.name,
        code: countryCode || country.currency_code,
        currency: country.currency_code,
        status: country.is_active ? "active" : "inactive",
        totalMainBranches: mainBranches.length,
        totalCityBranches,
        totalActiveMainBranches: mainBranches.filter((branch) => branch.status === "active").length,
        totalActiveCityBranches: mainBranches.reduce(
          (sum, branch) => sum + branch.cityBranches.filter((cityBranch) => cityBranch.status === "active").length,
          0
        ),
        userCount: usersByCountry.get(country.id)?.length ?? 0,
        users: usersByCountry.get(country.id) ?? [],
        mainBranches
      };
    }).filter((country) => country.mainBranches.length > 0);

    return NextResponse.json(
      {
        summary: {
          superAdminName: session.fullName || session.email || "Super Admin",
          totalCountries: countriesPayload.length,
          totalMainBranches: countryBranches.length,
          totalCityBranches: cityBranches.length,
          totalActiveUsers: allUserDetails.length || activeUserIds.size,
          totalActiveBranches:
            countryBranches.filter((branch) => branch.status === "active").length +
            cityBranches.filter((branch) => branch.status === "active").length,
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

