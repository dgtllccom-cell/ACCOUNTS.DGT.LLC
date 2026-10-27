import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUserManager } from "@/lib/permissions/user-management-scope";
import { branchDomainAllowed, resolveScopedCityBranch } from "@/lib/permissions/branch-page-scope";
import {
  BranchUserPermissionManagementView,
  type BranchInfo,
  type BranchUserDetails
} from "@/features/permissions/components/branch-user-permission-management-view";

export const metadata = { title: "Branch User Permission Management | DGT LLC ERP SYSTEM", description: "Manage permissions for branch users and staff without cross-branch leakage." };

export const dynamic = "force-dynamic";

export default async function BranchUserPermissionsPage(props: {
  searchParams?: Promise<{ branchId?: string; userId?: string }>;
}) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const isPermitted =
    session.isSuperAdmin ||
    isUserManager(session) ||
    session.roles.some((r) =>
      ["city_branch_admin", "main_branch_admin", "country_admin", "shipping_line_admin"].includes(r)
    );

  if (!isPermitted) {
    redirect("/dashboard");
  }

  const searchParams = (await props.searchParams) || {};
  const supabase = createSupabaseAdminClient() as any;

  // Resolve Branch Scope
  // Only a branch inside the login's own scope (a requested ?branchId= outside it is refused). No "first branch of the database"
  // fallback for anyone but the Global Super Admin.
  const scoped = resolveScopedCityBranch(session, searchParams.branchId);
  if (scoped.denied) redirect("/dashboard");
  let targetBranchId: string | null = scoped.branchId;

  if (!targetBranchId && session.isSuperAdmin) {
    const { data: firstBranch } = await supabase
      .from("city_branches")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    targetBranchId = firstBranch?.id || null;
  }

  if (!targetBranchId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm font-semibold">No accessible branch found.</p>
      </div>
    );
  }

  // 1. Fetch branch information
  const { data: branchData } = await supabase
    .from("city_branches")
    .select("id, name, code, city_name, country_id, local_currency, operational_domain")
    .eq("id", targetBranchId)
    .maybeSingle();
  // a Business-only / Shipping-only login never opens a branch of the other domain
  if (!branchDomainAllowed(session, branchData?.operational_domain)) redirect("/dashboard");

  let countryName = "";
  let countryCurrency = "";
  if (branchData?.country_id) {
    const { data: countryData } = await supabase
      .from("countries")
      .select("name, currency_code")
      .eq("id", branchData.country_id)
      .maybeSingle();
    if (countryData?.name) {
      countryName = countryData.name;
    }
    countryCurrency = countryData?.currency_code ? String(countryData.currency_code).toUpperCase() : "";
  }

  const branchInfo: BranchInfo = {
    id: branchData?.id || targetBranchId,
    name: branchData?.name || branchData?.city_name || "City Branch",
    code: branchData?.code || "",
    cityName: branchData?.city_name || undefined,
    countryName,
    currency: String(branchData?.local_currency || countryCurrency || "").toUpperCase(),
    operationalDomain: branchData?.operational_domain || "business"
  };

  // 2. Fetch users in this branch
  // Query user_role_assignments for this city_branch_id
  const { data: assignments } = await supabase
    .from("user_role_assignments")
    .select("user_id, role, operational_domain, is_active, created_at")
    .eq("city_branch_id", targetBranchId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((assignments || []).map((a: any) => a.user_id))).filter(Boolean);

  let profilesMap: Record<string, any> = {};
  let permissionsMap: Record<string, string[]> = {};

  if (userIds.length > 0) {
    const [profilesRes, permsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, user_code, email, phone")
        .in("id", userIds),
      supabase
        .from("user_permission_sets")
        .select("user_id, permissions")
        .in("user_id", userIds)
        .is("deleted_at", null)
    ]);

    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        profilesMap[p.id] = p;
      });
    }

    if (permsRes.data) {
      permsRes.data.forEach((p: any) => {
        permissionsMap[p.user_id] = p.permissions || [];
      });
    }
  }

  const branchUsers: BranchUserDetails[] = (assignments || []).map((a: any) => {
    const profile = profilesMap[a.user_id];
    const code = profile?.user_code || `U-${a.user_id.substring(0, 6).toUpperCase()}`;
    return {
      id: a.user_id,
      name: profile?.full_name || profile?.user_code || "Branch User",
      userCode: code,
      username: profile?.email || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      role: a.role || "shipping_line_user",
      operationalDomain: a.operational_domain || "shipping",
      isActive: a.is_active ?? true,
      // neutral, language-independent timestamp (server and browser render the same text); last login is not tracked on this screen
      assignedOn: a.created_at ? new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ") : "",
      lastLogin: "",
      permissions: permissionsMap[a.user_id] || []
    };
  });

  return (
    <BranchUserPermissionManagementView
      branch={branchInfo}
      users={branchUsers}
      initialUserId={searchParams.userId}
    />
  );
}
