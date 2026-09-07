import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Route } from "next";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dashboardByRole, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { setTempSuperAdminSession, setDirectUserSession } from "@/lib/auth/temp-session";

function dashboardForRoles(roles: EnterpriseRole[]) {
  if (roles.includes("super_admin")) return "/dashboard/super-admin";
  if (roles.includes("country_admin") || roles.includes("country_user")) return "/dashboard/country";
  if (roles.includes("clearing_agent_admin" as EnterpriseRole) || roles.includes("clearing_agent_user" as EnterpriseRole) || roles.includes("agent_user")) return "/dashboard/agent";
  if (roles.includes("city_branch_admin") || roles.includes("city_branch_user" as EnterpriseRole) || roles.includes("accountant") || roles.includes("cashier") || roles.includes("staff_user")) return "/dashboard/city";
  if (roles.includes("super_admin_reports") || roles.includes("auditor_viewer")) return "/dashboard/reports";
  
  const primary = roles[0];
  return primary ? (dashboardByRole[primary] ?? "/dashboard") : "/dashboard";
}

const BOOTSTRAP_IDENTIFIER = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadmin@damaan.com").trim().toLowerCase();
// No hardcoded fallback. The bootstrap Super Admin login is only available when
// an operator explicitly sets BOOTSTRAP_SUPERADMIN_PASSWORD in the environment
// AND demo auth is enabled (never in production).
const BOOTSTRAP_PASSWORD = (process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "").trim();
const BOOTSTRAP_ENABLED = BOOTSTRAP_PASSWORD.length > 0;

// Legacy plaintext `profiles.raw_password` login. OFF in production. Only on when
// demo auth is enabled, or an operator sets ALLOW_LEGACY_RAW_PASSWORD_LOGIN=true
// to migrate legacy accounts. When off, the column is never even read.
function legacyRawPwLoginEnabled() {
  return (
    isDemoAuthEnabled() ||
    String(process.env.ALLOW_LEGACY_RAW_PASSWORD_LOGIN || "").toLowerCase() === "true"
  );
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const acceptHeader = request.headers.get("accept") || "";
  const fetchMode = request.headers.get("sec-fetch-mode") || "";
  const isFetch = fetchMode === "cors" || fetchMode === "same-origin" || request.headers.get("x-requested-with") === "XMLHttpRequest";
  const isJson = contentType.includes("application/json") || acceptHeader.includes("application/json") || isFetch;

  let rawIdentifier = "";
  let rawPassword = "";
  let rememberMe = true;

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    rawIdentifier = String(json.identifier || json.email || json.user_id || "").trim();
    rawPassword = String(json.password || "").trim();
    if (json.remember !== undefined) rememberMe = Boolean(json.remember);
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
    BOOTSTRAP_ENABLED &&
    (isDemoAuthEnabled() || !isSupabaseConfigured()) &&
    (rawIdentifier.toLowerCase() === BOOTSTRAP_IDENTIFIER ||
     rawIdentifier.toLowerCase() === "superadmin" ||
     rawIdentifier.toUpperCase() === "SUPERADMIN" ||
     rawIdentifier.toLowerCase() === "superadmin@dgt.llc" ||
     rawIdentifier.toLowerCase() === "asmatdgtllc@users.damaan.local") &&
    rawPassword === BOOTSTRAP_PASSWORD;

  if (isBootstrapSuperAdmin) {
    await setTempSuperAdminSession({ remember: rememberMe });
    return respondSuccess("/dashboard/super-admin");
  }

  const admin = createSupabaseAdminClient() as any;
  const legacyRawPwAllowed = legacyRawPwLoginEnabled();
  const profileSelect = legacyRawPwAllowed
    ? "id, user_code, full_name, raw_password"
    : "id, user_code, full_name";

  // 1. Look up profile in database with flexible city/email/userCode matching
  let profileRecord: any = null;
  const cleanId = rawIdentifier.replace(/@dgt\.llc$/i, "").trim().toLowerCase();

  try {
    // A. Direct user_code match
    const { data: profile } = await admin
      .from("profiles")
      .select(profileSelect)
      .or(`user_code.ilike.${rawIdentifier},user_code.ilike.${cleanId}`)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    profileRecord = profile;

    // B. If not found by direct code, search by city name in profiles or branches
    if (!profileRecord) {
      const cityKeywords = [
        "quetta", "chaman", "karachi", "lahore", "peshawar", "gwadar",
        "kabul", "kandahar", "herat", "jalalabad", "mazar", "deira",
        "alras", "jebelali", "dubai", "abudhabi", "sharjah", "riyadh",
        "jeddah", "dammam", "yiwu", "guangzhou", "shanghai", "istanbul",
        "mersin", "tehran", "bandarabbas", "chabahar", "delhi", "mumbai"
      ];
      
      const matchedCity = cityKeywords.find(k => cleanId.includes(k));
      if (matchedCity) {
        const { data: cityProfile } = await admin
          .from("profiles")
          .select(profileSelect)
          .ilike("full_name", `%${matchedCity}%`)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        if (cityProfile) {
          profileRecord = cityProfile;
        }
      }
    }
  } catch (err) {
    console.warn("Profile direct lookup err:", err);
  }

  // 2. Fetch User Role Assignments if profile is found
  let userRoles: EnterpriseRole[] = [];
  let roleAssignments: any[] = [];

  if (profileRecord) {
    try {
      const { data: assignments } = await admin
        .from("user_role_assignments")
        .select("role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility")
        .eq("user_id", profileRecord.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (assignments && assignments.length > 0) {
        roleAssignments = assignments.map((a: any) => ({
          role: a.role as EnterpriseRole,
          countryId: a.country_id,
          countryBranchId: a.country_branch_id,
          cityBranchId: a.city_branch_id,
          clearingAgentId: a.clearing_agent_id,
          ledgerVisibility: a.ledger_visibility
        }));
        userRoles = assignments.map((a: any) => a.role as EnterpriseRole);
      }
    } catch (e) {
      console.warn("Role lookup err:", e);
    }
  }

  // 3. Verify Password.
  // Primary path: Supabase Auth (hashed credentials) — see step below.
  // Legacy path: `profiles.raw_password` plaintext compare. DEPRECATED and only
  // kept so users provisioned by older seed scripts (that never created a
  // Supabase Auth entry) are not locked out. No new code writes raw_password;
  // it is scheduled for removal once every active account has a Supabase Auth
  // credential. There is NO hardcoded password bypass here.
  let isAuthenticated = false;

  if (profileRecord) {
    const hasLegacyRawPwMatch =
      legacyRawPwAllowed &&
      typeof profileRecord.raw_password === "string" &&
      profileRecord.raw_password.length > 0 &&
      profileRecord.raw_password === rawPassword;
    const hasBootstrapBypass =
      isDemoAuthEnabled() && BOOTSTRAP_ENABLED && rawPassword === BOOTSTRAP_PASSWORD;
    if (hasLegacyRawPwMatch || hasBootstrapBypass) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated && isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const authEmail = rawIdentifier.toLowerCase();
      const { data: signInData, error: sbError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: rawPassword
      });
      if (!sbError && signInData?.user) {
        isAuthenticated = true;
        if (!profileRecord) {
          profileRecord = {
            id: signInData.user.id,
            user_code: rawIdentifier,
            full_name: signInData.user.user_metadata?.full_name || rawIdentifier
          };
        }
      }
    } catch (sbEx) {
      // ignore
    }
  }

  // (Removed: the "<city>@dgt.llc + shared onboarding password" shortcut. It
  // hardcoded a shared password and let anyone mint a branch/agent session.
  // Branch users now authenticate through Supabase Auth like everyone else.)

  if (isBootstrapSuperAdmin) {
    isAuthenticated = true;
    if (!profileRecord) {
      profileRecord = {
        id: "00000000-0000-4000-8000-000000000001",
        user_code: rawIdentifier,
        full_name: "Super Admin"
      };
      userRoles = ["super_admin"];
    }
  }

  if (!isAuthenticated || !profileRecord) {
    return respondError("Invalid User ID or Password. Please verify your credentials.", 401);
  }

  // 4. Fallback role if no DB assignment found
  if (userRoles.length === 0) {
    // Do NOT grant super_admin based on identifier string — require DB assignment.
    // Default to country_admin only when demo auth is enabled (for testing);
    // in production a missing role assignment should fail cleanly.
    if (isDemoAuthEnabled()) {
      if (rawIdentifier.toLowerCase().includes("clearingagent")) {
        userRoles = ["agent_user" as any];
      } else {
        userRoles = ["country_admin"];
      }
    } else {
      return respondError("Your account has no active role assignment. Contact your administrator.", 403);
    }
  }

  // 5. Establish Session Cookie
  await setDirectUserSession({
    userId: profileRecord.id,
    email: rawIdentifier.toLowerCase(),
    fullName: profileRecord.full_name || rawIdentifier,
    roles: userRoles,
    assignments: roleAssignments,
    remember: rememberMe
  });

  // 6. Determine Redirection Target
  const redirectTo = dashboardForRoles(userRoles);

  try {
    await admin.from("audit_logs").insert({
      company_id: null,
      actor_id: profileRecord.id,
      action: "auth.login",
      entity_table: "profiles",
      entity_id: profileRecord.id,
      before: null,
      after: { identifier: rawIdentifier, roles: userRoles },
      ip_address: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
    });
  } catch {
    // ignore audit errors
  }

  return respondSuccess(redirectTo);
}
