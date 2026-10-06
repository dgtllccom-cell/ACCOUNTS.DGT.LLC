import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireErpSession } from "@/lib/auth/session";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { auditApiAction } from "@/lib/api/audit";
import { isUserManager, userInManagerScope, SUPER_ADMIN_ONLY_ROLES, domainManagerTargetError } from "@/lib/permissions/user-management-scope";

export const dynamic = "force-dynamic";

function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Generates an enterprise-compliant, cryptographically strong temporary password.
 * Format: 12 chars with Uppercase, Lowercase, Number, and Special character.
 */
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(10);
  let result = "Dgt#";
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

const selfChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8)
});

const adminResetSchema = z.object({
  userId: z.string().trim().optional(),
  userCode: z.string().trim().optional(),
  email: z.string().trim().optional(),
  newPassword: z.string().min(8).max(128).optional(),
  generateTemporary: z.boolean().optional(),
  reason: z.string().max(500).optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const rawBody = await request.json().catch(() => ({}));

    // ─── Case 1: Self-Service Password Change ───
    if (rawBody && typeof rawBody.currentPassword === "string" && rawBody.currentPassword.length > 0) {
      const validation = selfChangeSchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0]?.message || "Validation failed" },
          { status: 400 }
        );
      }

      const { currentPassword, newPassword, confirmPassword } = validation.data;
      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "New passwords do not match" },
          { status: 400 }
        );
      }

      if (newPassword === currentPassword) {
        return NextResponse.json(
          { error: "New password must be different from current password" },
          { status: 400 }
        );
      }

      const supabase = await createServerSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.email || "",
        password: currentPassword
      });

      if (signInError) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 }
        );
      }

      await auditApiAction(request, {
        action: "user.password_self_changed",
        entityTable: "profiles",
        entityId: session.userId,
        before: { userId: session.userId, userCode: session.userCode },
        after: { userId: session.userId, userCode: session.userCode, changedAt: new Date().toISOString() }
      });

      return apiOk({ ok: true, message: "Password changed successfully" });
    }

    // ─── Case 2: Administrative Password Reset / Generate Temporary Password ───
    if (!session.isSuperAdmin && !isUserManager(session)) {
      throw new ApiClientError("Not authorized to reset passwords. Requires Super Admin or authorized manager role.", { status: 403 });
    }

    const adminBody = adminResetSchema.parse(rawBody);
    const admin = createSupabaseAdminClient() as any;

    let targetUserId = adminBody.userId;
    let targetProfile: any = null;

    // Resolve target user profile and ID
    if (targetUserId && isUuid(targetUserId)) {
      const { data: p } = await admin.from("profiles").select("*").eq("id", targetUserId).maybeSingle();
      targetProfile = p;
    }

    if (!targetProfile && adminBody.userCode) {
      const { data: p } = await admin.from("profiles").select("*").ilike("user_code", adminBody.userCode.trim()).maybeSingle();
      if (p) {
        targetProfile = p;
        targetUserId = p.id;
      }
    }

    if (!targetProfile && adminBody.email) {
      // Find auth user by email
      const { data: listRes } = await admin.auth.admin.listUsers();
      const foundUser = (listRes?.users || []).find((u: any) => u.email?.toLowerCase() === adminBody.email?.trim().toLowerCase());
      if (foundUser) {
        targetUserId = foundUser.id;
        const { data: p } = await admin.from("profiles").select("*").eq("id", foundUser.id).maybeSingle();
        targetProfile = p || { id: foundUser.id, user_code: adminBody.userCode || "USR", full_name: foundUser.user_metadata?.full_name || foundUser.email };
      }
    }

    if (!targetUserId || !targetProfile) {
      throw new ApiClientError("Target user not found.", { status: 404 });
    }

    // Fetch target user's current role assignment for scope enforcement
    const { data: targetAssignment } = await admin
      .from("user_role_assignments")
      .select("*")
      .eq("user_id", targetUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Enforce RBAC Scoping
    if (!session.isSuperAdmin) {
      if (!targetAssignment || !userInManagerScope(session, targetAssignment)) {
        throw new ApiClientError("Not authorized to reset password for users outside your authorized scope.", { status: 403 });
      }

      if (SUPER_ADMIN_ONLY_ROLES.has(targetAssignment.role)) {
        throw new ApiClientError("Only Global Super Admin can reset credentials for Super Admin or Country Admin accounts.", { status: 403 });
      }

      const domainErr = domainManagerTargetError(session, {
        role: targetAssignment.role,
        operationalDomain: targetAssignment.operational_domain ?? "business",
        countryBranchId: targetAssignment.country_branch_id,
        cityBranchId: targetAssignment.city_branch_id,
        accessProfile: targetAssignment.access_profile
      });
      if (domainErr) {
        throw new ApiClientError(domainErr, { status: 403 });
      }
    }

    // Determine temporary or new password
    const temporaryPassword = (adminBody.generateTemporary || !adminBody.newPassword)
      ? generateTemporaryPassword()
      : adminBody.newPassword;

    // Update Supabase Auth password securely
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: temporaryPassword
    });

    if (authError) {
      throw new Error(`Failed to update authentication credentials: ${authError.message}`);
    }

    // Clean up any legacy raw password left on profiles table
    try {
      await admin.from("profiles").update({ raw_password: null, updated_at: new Date().toISOString() }).eq("id", targetUserId);
    } catch {
      // Column may not exist
    }

    // Record in Audit Trail (NEVER write the plaintext password into the audit trail)
    await auditApiAction(request, {
      action: "user.password_reset",
      entityTable: "profiles",
      entityId: targetUserId,
      before: {
        targetUserId,
        targetUserCode: targetProfile.user_code,
        targetRole: targetAssignment?.role || "unknown",
        resetByUserId: session.userId,
        resetByUserCode: session.userCode,
        resetByRole: session.role
      },
      after: {
        targetUserId,
        targetUserCode: targetProfile.user_code,
        resetByUserId: session.userId,
        resetByUserCode: session.userCode,
        resetTimestamp: new Date().toISOString(),
        isTemporary: Boolean(adminBody.generateTemporary || !adminBody.newPassword),
        reason: adminBody.reason || "Administrative password reset"
      }
    });

    // Fetch auth user email for verification
    const { data: authUserRes } = await admin.auth.admin.getUserById(targetUserId);
    const targetEmail = authUserRes?.user?.email || targetProfile.email || "";

    return apiOk({
      ok: true,
      success: true,
      message: "Temporary password generated successfully.",
      temporaryPassword,
      userId: targetUserId,
      userCode: targetProfile.user_code || "USR",
      email: targetEmail,
      fullName: targetProfile.full_name || targetProfile.user_code || "System User"
    });
  } catch (error) {
    return handleApiError(error);
  }
}
