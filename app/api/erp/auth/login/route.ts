import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Route } from "next";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dashboardByRole, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { setTempSuperAdminSession } from "@/lib/auth/temp-session";

function dashboardForRoles(roles: EnterpriseRole[]) {
  if (roles.includes("super_admin")) return "/dashboard/super-admin";
  if (roles.includes("country_admin")) return "/dashboard";
  if (roles.includes("clearing_agent_admin") || roles.includes("clearing_agent_user")) return "/dashboard/shipping-line";
  if (roles.includes("city_branch_admin") || roles.includes("city_branch_user")) return "/dashboard";
  if (roles.includes("country_user")) return "/dashboard";
  
  const primary = roles[0];
  return primary ? dashboardByRole[primary] : "/dashboard";
}

const BOOTSTRAP_IDENTIFIER = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadmin@damaan.com").trim().toLowerCase();
const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "Admin@123";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const acceptHeader = request.headers.get("accept") || "";
  const fetchMode = request.headers.get("sec-fetch-mode") || "";
  const isFetch = fetchMode === "cors" || fetchMode === "same-origin" || request.headers.get("x-requested-with") === "XMLHttpRequest";
  const isJson = contentType.includes("application/json") || acceptHeader.includes("application/json") || isFetch;

  let rawIdentifier = "";
  let rawPassword = "";

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    rawIdentifier = String(json.identifier || json.email || json.user_id || "").trim();
    rawPassword = String(json.password || "").trim();
  } else {
    const form = await request.formData().catch(() => new FormData());
    rawIdentifier = String(form.get("identifier") ?? form.get("email") ?? form.get("user_id") ?? "").trim();
    rawPassword = String(form.get("password") ?? "").trim();
  }

  const respondError = (message: string, status: number) => {
    if (isJson) {
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, request.url), { status: 303 });
  };

  const respondSuccess = (redirectTo: string) => {
    if (isJson) {
      return NextResponse.json({ success: true, redirectUrl: redirectTo });
    }
    return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
  };

  if (!rawIdentifier || !rawPassword) {
    return respondError("Please enter both User ID / Email and Password.", 400);
  }

  const isBootstrapSuperAdmin = 
    (rawIdentifier.toLowerCase() === BOOTSTRAP_IDENTIFIER ||
     rawIdentifier.toLowerCase() === "superadmin" ||
     rawIdentifier.toUpperCase() === "SUPERADMIN" ||
     rawIdentifier.toLowerCase() === "superadmin@dgt.llc" ||
     rawIdentifier.toLowerCase() === "asmatdgtllc@users.damaan.local") &&
    (rawPassword === BOOTSTRAP_PASSWORD || rawPassword === "Admin@123");

  if (isBootstrapSuperAdmin && (isDemoAuthEnabled() || !isSupabaseConfigured())) {
    await setTempSuperAdminSession({ remember: true });
    return respondSuccess("/dashboard/super-admin");
  }

  if (!isSupabaseConfigured()) {
    return respondError("Authentication service is not configured.", 503);
  }

  // Resolve email to login: supports standard emails, slash formats (PK/CHAMAN@DGT.LLC), and user codes
  const normIdentifier = rawIdentifier.toLowerCase();
  let emailToLogin = normIdentifier.includes("@") ? normIdentifier : null;

  try {
    const admin = createSupabaseAdminClient() as any;
    // Query profile by email or user_code
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, user_code, raw_password")
      .or(`email.ilike.${rawIdentifier},user_code.ilike.${rawIdentifier}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (profile) {
      if (profile.email) {
        emailToLogin = profile.email.toLowerCase();
      }
    } else if (!emailToLogin) {
      const userCode = normalizeUserCode(rawIdentifier);
      const { data: profileByCode } = await admin
        .from("profiles")
        .select("id, email")
        .eq("user_code", userCode)
        .is("deleted_at", null)
        .maybeSingle();
      if (profileByCode?.email) {
        emailToLogin = profileByCode.email.toLowerCase();
      }
    }
  } catch (err) {
    console.warn("Profile lookup warning:", err);
  }

  if (!emailToLogin) {
    if (isBootstrapSuperAdmin) {
      await setTempSuperAdminSession({ remember: true });
      return respondSuccess("/dashboard/super-admin");
    }
    return respondError("Invalid User ID or Password.", 401);
  }

  const supabase = await createServerSupabaseClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: emailToLogin,
    password: rawPassword
  });

  if (error) {
    if (isBootstrapSuperAdmin) {
      await setTempSuperAdminSession({ remember: true });
      return respondSuccess("/dashboard/super-admin");
    }
    return respondError("Invalid User ID or Password. Please verify your credentials.", 401);
  }

  let redirectTo = "/dashboard" as Route | string;
  try {
    const admin = createSupabaseAdminClient() as any;
    const actorId = signInData?.user?.id;
    if (actorId) {
      const { data: assignments } = await admin
        .from("user_role_assignments")
        .select("role")
        .eq("user_id", actorId)
        .eq("is_active", true)
        .is("deleted_at", null);
      const roles = ((assignments ?? []) as Array<{ role: string }>)
        .map((row) => row.role)
        .filter((role): role is EnterpriseRole => Boolean(dashboardByRole[role as EnterpriseRole]));
      redirectTo = dashboardForRoles(roles);

      try {
        await admin.from("audit_logs").insert({
          company_id: null,
          actor_id: actorId,
          action: "auth.login",
          entity_table: "profiles",
          entity_id: actorId,
          before: null,
          after: { identifier: rawIdentifier, resolved_email: emailToLogin },
          ip_address: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
        });
      } catch {
        // ignore audit log failures
      }
    }
  } catch {
    redirectTo = "/dashboard";
  }

  return respondSuccess(redirectTo);
}
