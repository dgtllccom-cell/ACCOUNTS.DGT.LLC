import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ERP_MODULE_DEFINITIONS, getRoleDefaultPermissions } from "@/lib/permissions/rbac-matrix-builder";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";

// Schema for updating module-level permissions
const updateModuleAccessSchema = z.object({
  moduleKey: z.string().min(1),
  assignments: z.array(
    z.object({
      userId: z.string().uuid(),
      canEdit: z.boolean(),
      canDelete: z.boolean()
    })
  )
});

// Helper: map module key to primary edit and delete permissions
function getModulePermSpecs(moduleKey: string) {
  const mod = ERP_MODULE_DEFINITIONS.find((m) => m.key === moduleKey) || ERP_MODULE_DEFINITIONS[0];
  
  // Primary edit permissions
  const editPerms = mod.editPerms.length > 0 ? mod.editPerms : [`${mod.key}:update`];
  // Primary delete permissions
  const deletePerms = mod.deletePerms.length > 0 ? mod.deletePerms : [`${mod.key}:delete`];
  // View permissions
  const viewPerms = mod.viewPerms.length > 0 ? mod.viewPerms : [`${mod.key}:read`];

  return {
    module: mod,
    editPerms,
    deletePerms,
    viewPerms
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles.includes("country_admin")) {
      throw new ApiClientError("Only Super Admin or Country Admin can manage module permissions.", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get("moduleKey") || "purchase_booking";
    const { module, editPerms, deletePerms, viewPerms } = getModulePermSpecs(moduleKey);

    const admin = createSupabaseAdminClient() as any;

    // Fetch active users with profile and role assignment
    const [profilesRes, assignmentsRes, permSetsRes, countriesRes, mainBranchesRes, cityBranchesRes] = await Promise.all([
      admin.from("profiles").select("id, user_code, full_name, email").order("user_code"),
      admin.from("user_role_assignments").select("user_id, role, country_id, country_branch_id, city_branch_id, is_active").is("deleted_at", null),
      admin.from("user_permission_sets").select("user_id, permissions"),
      admin.from("countries").select("id, name"),
      admin.from("country_branches").select("id, name"),
      admin.from("city_branches").select("id, name, city_name")
    ]);

    const profiles = profilesRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    const permSets = permSetsRes.data ?? [];
    const countries = new Map<string, string>((countriesRes.data ?? []).map((c: any) => [c.id, c.name]));
    const mainBranches = new Map<string, string>((mainBranchesRes.data ?? []).map((b: any) => [b.id, b.name]));
    const cityBranches = new Map<string, string>((cityBranchesRes.data ?? []).map((b: any) => [b.id, `${b.city_name || ""} - ${b.name}`]));

    const permMap = new Map<string, string[]>();
    permSets.forEach((p: any) => {
      if (p.user_id && Array.isArray(p.permissions)) {
        permMap.set(p.user_id, p.permissions);
      }
    });

    const assignMap = new Map<string, any>();
    assignments.forEach((a: any) => {
      if (a.user_id && a.is_active) {
        assignMap.set(a.user_id, a);
      }
    });

    const users = profiles.map((u: any) => {
      const assign = assignMap.get(u.id);
      const role = (assign?.role || "staff_user") as EnterpriseRole;
      const isSuper = role === "super_admin" || u.email?.toLowerCase().includes("super");

      // Effective permissions
      const customPerms = permMap.get(u.id);
      const userPerms = customPerms !== undefined ? customPerms : getRoleDefaultPermissions(role);
      const hasWildcard = isSuper || userPerms.includes("*:*");

      const canView = hasWildcard || viewPerms.some((p) => userPerms.includes(p) || userPerms.includes(`${p.split(":")[0]}:*`));
      const canEdit = hasWildcard || editPerms.some((p) => userPerms.includes(p) || userPerms.includes(`${p.split(":")[0]}:*`));
      const canDelete = hasWildcard || deletePerms.some((p) => userPerms.includes(p) || userPerms.includes(`${p.split(":")[0]}:*`));

      const countryName = assign?.country_id ? countries.get(assign.country_id) || "Country" : "Global Scope";
      const branchName = assign?.city_branch_id
        ? cityBranches.get(assign.city_branch_id) || "Branch"
        : assign?.country_branch_id
        ? mainBranches.get(assign.country_branch_id) || "Main Branch"
        : "All Branches";

      return {
        userId: u.id,
        userCode: u.user_code || "USR",
        fullName: u.full_name || u.user_code || "System User",
        email: u.email || "",
        role,
        isSuperAdmin: isSuper,
        countryId: assign?.country_id || null,
        countryName,
        branchName,
        canView,
        canEdit,
        canDelete
      };
    });

    return apiOk({
      module: {
        key: module.key,
        name: module.name,
        category: module.category,
        editPerms,
        deletePerms,
        viewPerms
      },
      modulesList: ERP_MODULE_DEFINITIONS.map((m) => ({ key: m.key, name: m.name, category: m.category })),
      users
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      throw new ApiClientError("Only Super Admin can reallocate module Edit and Delete permissions.", { status: 403 });
    }

    const body = updateModuleAccessSchema.parse(await request.json());
    const { editPerms, deletePerms } = getModulePermSpecs(body.moduleKey);
    const admin = createSupabaseAdminClient() as any;

    // Fetch existing permissions for all target users
    const userIds = body.assignments.map((a) => a.userId);
    const [permSetsRes, assignmentsRes] = await Promise.all([
      admin.from("user_permission_sets").select("user_id, permissions").in("user_id", userIds),
      admin.from("user_role_assignments").select("user_id, role").in("user_id", userIds).is("deleted_at", null)
    ]);

    const existingPermMap = new Map<string, string[]>();
    (permSetsRes.data ?? []).forEach((p: any) => {
      existingPermMap.set(p.user_id, p.permissions || []);
    });

    const roleMap = new Map<string, string>();
    (assignmentsRes.data ?? []).forEach((a: any) => {
      roleMap.set(a.user_id, a.role);
    });

    const upsertRows: Array<{ user_id: string; permissions: string[]; source: string; updated_at: string }> = [];

    for (const a of body.assignments) {
      const userRole = (roleMap.get(a.userId) || "staff_user") as EnterpriseRole;
      if (userRole === "super_admin") {
        // Super Admin always maintains global access
        continue;
      }

      let currentPerms = existingPermMap.get(a.userId);
      if (!currentPerms) {
        currentPerms = [...getRoleDefaultPermissions(userRole)];
      }

      // Convert to Set for manipulation
      const permSet = new Set<string>(currentPerms);

      // Apply Edit permission
      if (a.canEdit) {
        editPerms.forEach((p) => permSet.add(p));
      } else {
        editPerms.forEach((p) => {
          permSet.delete(p);
          // Also remove wildcards for that resource
          const prefix = p.split(":")[0];
          permSet.delete(`${prefix}:*`);
        });
      }

      // Apply Delete permission
      if (a.canDelete) {
        deletePerms.forEach((p) => permSet.add(p));
      } else {
        deletePerms.forEach((p) => {
          permSet.delete(p);
          const prefix = p.split(":")[0];
          permSet.delete(`${prefix}:*`);
        });
      }

      upsertRows.push({
        user_id: a.userId,
        permissions: Array.from(permSet),
        source: "module_permission_manager",
        updated_at: new Date().toISOString()
      });
    }

    if (upsertRows.length > 0) {
      const { error } = await admin
        .from("user_permission_sets")
        .upsert(upsertRows, { onConflict: "user_id" });

      if (error) throw new Error(error.message);
    }

    return apiOk({
      updatedCount: upsertRows.length,
      message: `Successfully updated permissions for ${upsertRows.length} users.`
    });
  } catch (err) {
    return handleApiError(err);
  }
}
