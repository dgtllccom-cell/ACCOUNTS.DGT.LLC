/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { userCreateSchema, uuidSchema } from "@/lib/api/erp-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { expandPermissionGroups } from "@/lib/permissions/catalog";
import { issueNextUserCode, normalizeUserCode } from "@/lib/services/user-identity-service";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toAppRole(role: EnterpriseRole) {
  // Database enum uses legacy 'staff' while app uses 'staff_user'.
  if (role === "staff_user") return "staff";
  return role;
}

function assertScopeForRole(role: EnterpriseRole, scope: { countryId: string | null; countryBranchId: string | null; cityBranchId: string | null }) {
  if (role === "super_admin") {
    if (scope.countryId || scope.countryBranchId || scope.cityBranchId) {
      throw new Error("Super Admin user must not be assigned to a country/branch scope.");
    }
    return;
  }

  if (!scope.countryId) {
    throw new Error("countryId is required for this role.");
  }

  if (role === "country_admin" || role === "country_user") {
    if (scope.countryBranchId || scope.cityBranchId) {
      throw new Error(`${role === "country_admin" ? "Country Admin" : "Country User"} must not be assigned to a branch scope.`);
    }
    return;
  }

  if (role === "main_branch_admin") {
    if (!scope.countryBranchId || scope.cityBranchId) {
      throw new Error("Main Branch Admin requires countryBranchId and must not include cityBranchId.");
    }
    return;
  }

  if (role === "auditor_viewer") {
    // Auditor can be country-level or branch-level.
    return;
  }

  // City/branch-scoped roles.
  if (!scope.countryBranchId || !scope.cityBranchId) {
    throw new Error("countryBranchId and cityBranchId are required for this role.");
  }
}

function normalizePermissions(input: unknown) {
  return Array.isArray(input)
    ? [...new Set(input.map((permission) => String(permission).trim()).filter(Boolean))]
    : [];
}

function isPermissionAllowed(permission: string, allowed: Set<string>) {
  const [resource] = permission.split(":");
  return allowed.has("*:*") || allowed.has(permission) || allowed.has(`${resource}:*`);
}

function constrainPermissions(requested: string[], allowedPermissions: string[]) {
  const allowed = new Set(allowedPermissions);
  return requested.filter((permission) => isPermissionAllowed(permission, allowed));
}

async function loadScopePermissionLimit(
  admin: any,
  scope: { countryBranchId?: string | null; cityBranchId?: string | null }
) {
  if (scope.cityBranchId && isUuid(scope.cityBranchId)) {
    const { data } = await admin
      .from("city_branches")
      .select("permission_grants")
      .eq("id", scope.cityBranchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (Array.isArray(data?.permission_grants) && data.permission_grants.length) {
      return expandPermissionGroups(data.permission_grants);
    }
  }

  if (scope.countryBranchId && isUuid(scope.countryBranchId)) {
    const { data } = await admin
      .from("country_branches")
      .select("permission_grants")
      .eq("id", scope.countryBranchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (Array.isArray(data?.permission_grants) && data.permission_grants.length) {
      return expandPermissionGroups(data.permission_grants);
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = userCreateSchema.parse(await request.json());

    // Authorization:
    // - Super Admin can create all users.
    // - Country/Main branch admins can create non-admin users within their own country.
    const isCountryManager = session.roles.some((r) => r === "country_admin" || r === "main_branch_admin");
    if (!session.isSuperAdmin) {
      if (!isCountryManager) throw new Error("Not authorized to create users.");
      if (body.role === "super_admin" || body.role === "country_admin") {
        throw new Error("Only Super Admin can create Super Admin or Country Admin users.");
      }
      if (!body.countryId || !session.countryIds.includes(body.countryId)) {
        throw new Error("Country scope is not allowed.");
      }
    }

    assertScopeForRole(body.role, {
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    const admin = createSupabaseAdminClient() as any;

    const issuedUserCode = normalizeUserCode(
      body.userCode ?? (await issueNextUserCode(admin, { role: body.role, countryId: body.countryId ?? null }))
    );

    const requestedPermissions = normalizePermissions(body.permissions);
    const defaultRolePermissions = [...new Set(enterpriseRolePermissions[body.role] ?? [])];
    const requestedOrDefault = requestedPermissions.length ? requestedPermissions : defaultRolePermissions;
    const scopePermissionLimit = session.isSuperAdmin
      ? null
      : await loadScopePermissionLimit(admin, {
          countryBranchId: body.countryBranchId ?? null,
          cityBranchId: body.cityBranchId ?? null
        });
    const creatorLimit = session.isSuperAdmin ? ["*:*"] : session.permissions;
    const parentLimit = scopePermissionLimit ?? creatorLimit;
    const issuedPermissions = session.isSuperAdmin
      ? requestedOrDefault
      : constrainPermissions(constrainPermissions(requestedOrDefault, creatorLimit), parentLimit);

    if (!issuedPermissions.length) {
      throw new Error("No assignable permissions remain after applying parent scope limits.");
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        user_code: issuedUserCode,
        phone: body.phone ?? null,
        company_id: body.companyId ?? null,
        id_type: body.idType ?? null,
        id_value: body.idValue ?? null
      }
    });

    if (createError) throw new Error(createError.message);

    const newUserId = created?.user?.id as string | undefined;
    if (!newUserId) throw new Error("Failed to create user.");

    // Ensure profile exists.
    const profilePayload = {
      id: newUserId,
      full_name: body.fullName,
      user_code: issuedUserCode,
      preferred_language_code: body.preferredLanguage,
      default_company_id: body.companyId ?? null,
      raw_password: body.password,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    // Store effective permissions for this user (role defaults + optional overrides from UI).
    // This enables stable permission snapshots and future customization.
    const { error: permError } = await admin
      .from("user_permission_sets")
      .upsert(
        {
          user_id: newUserId,
          permissions: issuedPermissions,
          source: requestedPermissions.length ? "manual" : "role_default",
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );
    if (permError) throw new Error(permError.message);

    const assignmentPayload = {
      user_id: newUserId,
      role: toAppRole(body.role),
      country_id: body.countryId ?? null,
      country_branch_id: body.countryBranchId ?? null,
      city_branch_id: body.cityBranchId ?? null,
      is_active: true,
      created_by: isUuid(session.userId) ? session.userId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: assignmentError } = await admin.from("user_role_assignments").insert(assignmentPayload);
    if (assignmentError) throw new Error(assignmentError.message);

    await auditApiAction(request, {
      action: "users.create.api",
      entityTable: "profiles",
      entityId: newUserId,
      after: {
        email: body.email,
        fullName: body.fullName,
        role: body.role,
        userCode: issuedUserCode,
        countryId: body.countryId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null,
        companyId: body.companyId ?? null
      }
    });

    return apiCreated({ userId: newUserId, userCode: issuedUserCode });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      throw new Error("userId is required.");
    }

    const isCountryManager = session.roles.some((r) => r === "country_admin" || r === "main_branch_admin");
    if (!session.isSuperAdmin && !isCountryManager) {
      throw new Error("Not authorized to view user details.");
    }

    const admin = createSupabaseAdminClient() as any;

    const [profileRes, assignmentRes, permissionsRes, authUserRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("user_role_assignments").select("*").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("user_permission_sets").select("permissions").eq("user_id", userId).maybeSingle(),
      admin.auth.admin.getUserById(userId)
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);
    const profile = profileRes.data;
    if (!profile) {
      throw new Error("User profile not found.");
    }

    const assignment = assignmentRes.data;
    if (!session.isSuperAdmin && assignment?.country_id && !session.countryIds.includes(assignment.country_id)) {
      throw new Error("Not authorized to view users outside of your country.");
    }

    const permissions = permissionsRes.data?.permissions ?? [];
    const authUser = authUserRes.data?.user;

    return apiOk({
      userId,
      userCode: profile.user_code,
      fullName: profile.full_name,
      defaultCompanyId: profile.default_company_id ?? null,
      isActive: assignment?.is_active ?? false,
      role: assignment?.role ?? "city_branch_admin",
      countryId: assignment?.country_id ?? null,
      countryBranchId: assignment?.country_branch_id ?? null,
      cityBranchId: assignment?.city_branch_id ?? null,
      permissions,
      email: authUser?.email ?? "",
      phone: authUser?.user_metadata?.phone ?? "",
      purpose: authUser?.user_metadata?.purpose ?? ""
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = z.object({
      userId: uuidSchema,
      isActive: z.boolean().optional(),
      password: z.string().min(8).max(128).optional(),
      fullName: z.string().trim().min(2).max(200).optional(),
      companyId: uuidSchema.nullable().optional(),
      role: z.string().trim().max(64).optional(),
      countryId: uuidSchema.nullable().optional(),
      countryBranchId: uuidSchema.nullable().optional(),
      cityBranchId: uuidSchema.nullable().optional(),
      permissions: z.array(z.string()).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
      purpose: z.string().trim().optional()
    }).parse(await request.json());

    // Authorization check:
    // Super Admin can edit any user.
    // Country Admin and Main Branch Admin can edit users in their country.
    const isCountryManager = session.roles.some((r) => r === "country_admin" || r === "main_branch_admin");
    if (!session.isSuperAdmin) {
      if (!isCountryManager) throw new Error("Not authorized to update users.");
      // If updating scope, ensure it matches current session country.
      if (body.countryId && !session.countryIds.includes(body.countryId)) {
        throw new Error("Country scope is not allowed.");
      }
    }

    const admin = createSupabaseAdminClient() as any;

    // Fetch the target user's current assignment to check their current country scope
    const { data: targetAssignment } = await admin
      .from("user_role_assignments")
      .select("country_id, role, country_branch_id, city_branch_id")
      .eq("user_id", body.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!session.isSuperAdmin && targetAssignment) {
      if (targetAssignment.role === "super_admin" || targetAssignment.role === "country_admin") {
        throw new Error("Only Super Admin can update Super Admin or Country Admin users.");
      }
      if (targetAssignment.country_id && !session.countryIds.includes(targetAssignment.country_id)) {
        throw new Error("Not authorized to update users outside of your country.");
      }
    }

    // 1. Update profiles table if fullName or password is provided
    if (body.fullName !== undefined || body.password !== undefined || body.companyId !== undefined) {
      const profileUpdates: any = {
        updated_at: new Date().toISOString()
      };
      if (body.fullName !== undefined) profileUpdates.full_name = body.fullName;
      if (body.password !== undefined) profileUpdates.raw_password = body.password;
      if (body.companyId !== undefined) profileUpdates.default_company_id = body.companyId;

      const { error: profileError } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", body.userId);

      if (profileError) throw new Error(profileError.message);
    }

    // 2. Update Supabase Auth if password, email, phone, or purpose is provided
    if (body.password !== undefined || body.email !== undefined || body.phone !== undefined || body.purpose !== undefined) {
      const updates: any = {};
      if (body.password !== undefined) updates.password = body.password;
      if (body.email !== undefined) updates.email = body.email;
      
      const userMetadata: any = {};
      if (body.phone !== undefined) userMetadata.phone = body.phone;
      if (body.purpose !== undefined) userMetadata.purpose = body.purpose;
      
      if (Object.keys(userMetadata).length > 0) {
        // Merge with existing metadata
        const { data: currentAuth } = await admin.auth.admin.getUserById(body.userId);
        updates.user_metadata = {
          ...(currentAuth?.user?.user_metadata ?? {}),
          ...userMetadata
        };
      }
      
      const { error: authError } = await admin.auth.admin.updateUserById(body.userId, updates);
      if (authError) throw new Error(authError.message);
    }

    // 3. Update active status, roles, or branch scopes in user_role_assignments
    if (
      body.isActive !== undefined ||
      body.role !== undefined ||
      body.countryId !== undefined ||
      body.countryBranchId !== undefined ||
      body.cityBranchId !== undefined
    ) {
      // Fetch latest assignment row
      const { data: currentAssign } = await admin
        .from("user_role_assignments")
        .select("id, role, country_id, country_branch_id, city_branch_id, is_active")
        .eq("user_id", body.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentAssign) {
        const assignmentUpdates: any = {
          updated_at: new Date().toISOString()
        };
        if (body.isActive !== undefined) assignmentUpdates.is_active = body.isActive;
        if (body.role !== undefined) assignmentUpdates.role = toAppRole(body.role as EnterpriseRole);
        if (body.countryId !== undefined) assignmentUpdates.country_id = body.countryId;
        if (body.countryBranchId !== undefined) assignmentUpdates.country_branch_id = body.countryBranchId;
        if (body.cityBranchId !== undefined) assignmentUpdates.city_branch_id = body.cityBranchId;

        const { error: assignmentError } = await admin
          .from("user_role_assignments")
          .update(assignmentUpdates)
          .eq("id", currentAssign.id);

        if (assignmentError) throw new Error(assignmentError.message);
      }
    }

    // 4. Update user_permission_sets if permissions are provided
    if (body.permissions !== undefined) {
      const requestedPermissions = normalizePermissions(body.permissions);
      const targetRole = (body.role || targetAssignment?.role || "city_branch_admin") as EnterpriseRole;
      const defaultRolePermissions = [...new Set(enterpriseRolePermissions[targetRole] ?? [])];
      const requestedOrDefault = requestedPermissions.length ? requestedPermissions : defaultRolePermissions;

      const scopePermissionLimit = session.isSuperAdmin
        ? null
        : await loadScopePermissionLimit(admin, {
            countryBranchId: body.countryBranchId !== undefined ? body.countryBranchId : (targetAssignment?.country_branch_id ?? null),
            cityBranchId: body.cityBranchId !== undefined ? body.cityBranchId : (targetAssignment?.city_branch_id ?? null)
          });
      const creatorLimit = session.isSuperAdmin ? ["*:*"] : session.permissions;
      const parentLimit = scopePermissionLimit ?? creatorLimit;
      const issuedPermissions = session.isSuperAdmin
        ? requestedOrDefault
        : constrainPermissions(constrainPermissions(requestedOrDefault, creatorLimit), parentLimit);

      const { error: permError } = await admin
        .from("user_permission_sets")
        .upsert(
          {
            user_id: body.userId,
            permissions: issuedPermissions,
            source: requestedPermissions.length ? "manual" : "role_default",
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id" }
        );
      if (permError) throw new Error(permError.message);
    }

    await auditApiAction(request, {
      action: "users.update.api",
      entityTable: "profiles",
      entityId: body.userId,
      after: {
        userId: body.userId,
        isActive: body.isActive,
        fullName: body.fullName,
        role: body.role,
        countryId: body.countryId,
        countryBranchId: body.countryBranchId,
        cityBranchId: body.cityBranchId
      }
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      throw new Error("userId is required.");
    }

    const isCountryManager = session.roles.some((r) => r === "country_admin" || r === "main_branch_admin");
    if (!session.isSuperAdmin && !isCountryManager) {
      throw new Error("Not authorized to delete users.");
    }

    const admin = createSupabaseAdminClient() as any;

    const { data: targetAssignment } = await admin
      .from("user_role_assignments")
      .select("country_id, role")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!session.isSuperAdmin && targetAssignment) {
      if (targetAssignment.role === "super_admin" || targetAssignment.role === "country_admin") {
        throw new Error("Only Super Admin can delete Super Admin or Country Admin users.");
      }
      if (targetAssignment.country_id && !session.countryIds.includes(targetAssignment.country_id)) {
        throw new Error("Not authorized to delete users outside of your country.");
      }
    }

    const { data: authUserRes, error: getAuthError } = await admin.auth.admin.getUserById(userId);
    if (getAuthError || !authUserRes?.user) {
      throw new Error(getAuthError?.message ?? "Auth user not found.");
    }

    const originalEmail = authUserRes.user.email;
    const dummyEmail = `deleted_${Date.now()}_${originalEmail}`;

    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: dummyEmail,
      user_metadata: {
        ...(authUserRes.user.user_metadata ?? {}),
        original_email: originalEmail,
        deleted_at: new Date().toISOString()
      }
    });
    if (authError) throw new Error(authError.message);

    const now = new Date().toISOString();

    const { error: profileError } = await admin
      .from("profiles")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    const { error: assignmentError } = await admin
      .from("user_role_assignments")
      .update({ deleted_at: now, updated_at: now, is_active: false })
      .eq("user_id", userId);
    if (assignmentError) throw new Error(assignmentError.message);

    try {
      await admin
        .from("user_permission_sets")
        .update({ deleted_at: now, updated_at: now })
        .eq("user_id", userId);
    } catch (e) {
      // ignore
    }

    await auditApiAction(request, {
      action: "users.delete.api",
      entityTable: "profiles",
      entityId: userId,
      before: {
        email: originalEmail
      }
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}




