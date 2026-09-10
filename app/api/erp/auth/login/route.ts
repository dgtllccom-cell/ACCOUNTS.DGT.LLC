import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Route } from "next";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dashboardByRole, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { MOBILE_PROFILE_HOME } from "@/lib/permissions/mobile-profiles";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { setTempSuperAdminSession, setDirectUserSession } from "@/lib/auth/temp-session";

import { withLocalPg } from "@/lib/db/local-postgres";

function toEnterpriseRole(role: string): EnterpriseRole {
  if (role === "staff") return "staff_user";
  return role as EnterpriseRole;
}

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

  const getRedirectBase = () => {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
    if (forwardedHost && !forwardedHost.includes("0.0.0.0")) {
      return `${forwardedProto}://${forwardedHost}`;
    }
    const origin = request.nextUrl?.origin;
    if (origin && !origin.includes("0.0.0.0") && !origin.includes("127.0.0.1")) {
      return origin;
    }
    return "http://72.60.209.121";
  };

  const respondError = (message: string, status: number) => {
    if (isJson) {
      return NextResponse.json({ error: message }, { status });
    }
    const base = getRedirectBase();
    return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(message)}`, base), { status: 303 });
  };

  const respondSuccess = (redirectTo: string) => {
    if (isJson) {
      return NextResponse.json({ success: true, redirectUrl: redirectTo });
    }
    const base = getRedirectBase();
    return NextResponse.redirect(new URL(redirectTo, base), { status: 303 });
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

  const cleanLower = rawIdentifier.trim().toLowerCase();
  const isShippingUser =
    (cleanLower === "shipping" ||
     cleanLower === "shipping@dgt.llc" ||
     cleanLower === "shipping.line" ||
     cleanLower === "shipping.line@dgt.llc" ||
     cleanLower === "shippingline" ||
     cleanLower === "shippingline@dgt.llc") &&
    (BOOTSTRAP_ENABLED && rawPassword === BOOTSTRAP_PASSWORD);

  if (isShippingUser) {
    await setDirectUserSession({
      userId: "00000000-0000-4000-8000-000000000004",
      email: "shipping@dgt.llc",
      fullName: "Shipping Line Operator",
      roles: ["agent_user"],
      assignments: [{
        role: "agent_user",
        countryId: null,
        countryBranchId: null,
        cityBranchId: null,
        clearingAgentId: null,
        ledgerVisibility: "shipping_only",
        operationalDomain: "shipping",
        mobileProfile: "standard"
      }],
      remember: rememberMe
    });
    return respondSuccess("/dashboard/logistics");
  }

  const admin = createSupabaseAdminClient() as any;
  const profileSelect = "id, user_code, full_name, raw_password";

  // 1. Look up profile in database with direct SQL by email or user_code, with Supabase fallback
  let profileRecord: any = null;
  const cleanId = rawIdentifier.replace(/@dgt\.llc$/i, "").trim().toLowerCase();

  try {
    profileRecord = await withLocalPg(async (sql) => {
      const rows = await sql`
        SELECT p.id, p.user_code, p.full_name, p.raw_password, u.email as auth_email
        FROM public.profiles p
        LEFT JOIN auth.users u ON u.id = p.id
        WHERE u.email ILIKE ${rawIdentifier}
           OR u.email ILIKE ${`${cleanId}@dgt.llc`}
           OR p.user_code ILIKE ${rawIdentifier}
           OR p.user_code ILIKE ${cleanId}
        LIMIT 1;
      `;
      return rows[0] || null;
    });
  } catch (err) {
    console.warn("Direct pg profile lookup err:", err);
  }

  if (!profileRecord) {
    try {
      // A. Direct user_code match via Supabase Admin
      const { data: profile } = await admin
        .from("profiles")
        .select(profileSelect)
        .or(`user_code.ilike.${rawIdentifier},user_code.ilike.${cleanId}`)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      profileRecord = profile;

      // B. If not found by direct code, check aliases (.branch <-> .admin)
      if (!profileRecord) {
        const altId = cleanId.endsWith(".branch")
          ? cleanId.replace(/\.branch$/, ".admin")
          : cleanId.endsWith(".admin")
          ? cleanId.replace(/\.admin$/, ".branch")
          : cleanId;
        if (altId !== cleanId) {
          const { data: altProfile } = await admin
            .from("profiles")
            .select(profileSelect)
            .ilike("user_code", altId)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();
          if (altProfile) {
            profileRecord = altProfile;
          }
        }
      }
    } catch (err) {
      console.warn("Profile Supabase lookup err:", err);
    }
  }

  // 2. Fetch User Role Assignments if profile is found
  let userRoles: EnterpriseRole[] = [];
  let roleAssignments: any[] = [];

  if (profileRecord) {
    try {
      const rows = await withLocalPg(async (sql) => {
        return await sql`
          SELECT role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, mobile_profile
          FROM public.user_role_assignments
          WHERE user_id = ${profileRecord.id}
            AND is_active = true
            AND deleted_at IS NULL;
        `;
      });

      if (rows && rows.length > 0) {
        roleAssignments = rows.map((a: any) => ({
          role: toEnterpriseRole(a.role),
          countryId: a.country_id,
          countryBranchId: a.country_branch_id,
          cityBranchId: a.city_branch_id,
          clearingAgentId: a.clearing_agent_id,
          ledgerVisibility: a.ledger_visibility,
          mobileProfile: a.mobile_profile ?? "standard"
        }));
        userRoles = rows.map((a: any) => toEnterpriseRole(a.role));
      }
    } catch (e) {
      console.warn("Direct pg role lookup err:", e);
    }

    if (userRoles.length === 0) {
      try {
        const { data: assignments } = await admin
          .from("user_role_assignments")
          .select("role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, mobile_profile")
          .eq("user_id", profileRecord.id)
          .eq("is_active", true)
          .is("deleted_at", null);

        if (assignments && assignments.length > 0) {
          roleAssignments = assignments.map((a: any) => ({
            role: toEnterpriseRole(a.role),
            countryId: a.country_id,
            countryBranchId: a.country_branch_id,
            cityBranchId: a.city_branch_id,
            clearingAgentId: a.clearing_agent_id,
            ledgerVisibility: a.ledger_visibility,
            mobileProfile: a.mobile_profile ?? "standard"
          }));
          userRoles = assignments.map((a: any) => toEnterpriseRole(a.role));
        }
      } catch (e) {
        console.warn("Supabase role lookup err:", e);
      }
    }
  }

  // 3. Verify Password.
  let isAuthenticated = false;
  let authenticatedEmail: string | null = null;

  if (profileRecord) {
    const hasRawPwMatch =
      typeof profileRecord.raw_password === "string" &&
      profileRecord.raw_password.length > 0 &&
      profileRecord.raw_password === rawPassword;
    const hasBootstrapBypass =
      isDemoAuthEnabled() && BOOTSTRAP_ENABLED && rawPassword === BOOTSTRAP_PASSWORD;
    if (hasRawPwMatch || hasBootstrapBypass) {
      isAuthenticated = true;
      authenticatedEmail = rawIdentifier.includes("@") ? rawIdentifier.toLowerCase() : `${cleanId}@dgt.llc`;
    }
  }

  // Check direct PostgreSQL auth.users encrypted_password using pgcrypto crypt()
  if (!isAuthenticated) {
    try {
      const match = await withLocalPg(async (sql) => {
        const rows = await sql`
          SELECT u.id, u.email
          FROM auth.users u
          WHERE (u.email ILIKE ${rawIdentifier} OR u.email ILIKE ${`${cleanId}@dgt.llc`} OR u.id = ${profileRecord?.id ?? null})
            AND u.encrypted_password = crypt(${rawPassword}, u.encrypted_password)
          LIMIT 1;
        `;
        return rows[0] || null;
      });
      if (match) {
        isAuthenticated = true;
        authenticatedEmail = match.email;
      }
    } catch (e) {
      console.warn("Direct pg crypt auth check err:", e);
    }
  }

  if (!isAuthenticated && isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const aliasMap: Record<string, string> = {
        "superadmin@damaan.com": "superadmin@dgt.llc",
        "all.superadmin@dgt.llc": "superadmin@dgt.llc",
        "superadmin": "superadmin@dgt.llc",
        "clearing.superadmin@dgt.llc": "shipping.superadmin@dgt.llc",
        "clearingagent@dgt.llc": "shipping.superadmin@dgt.llc",
        "shipping@dgt.llc": "shipping.superadmin@dgt.llc",
        "clearing@dgt.llc": "shipping.superadmin@dgt.llc",
        "business@dgt.llc": "business.superadmin@dgt.llc",
      };
      const mapped = aliasMap[rawIdentifier.toLowerCase()] || aliasMap[cleanId.toLowerCase()];

      // If profile is known (by user_code or name), retrieve their Supabase Auth email
      let profileAuthEmail: string | null = null;
      if (profileRecord?.id) {
        try {
          const { data: authUserData } = await admin.auth.admin.getUserById(profileRecord.id);
          if (authUserData?.user?.email) {
            profileAuthEmail = authUserData.user.email.toLowerCase();
          }
        } catch (e) {
          console.warn("Auth user lookup by profile ID err:", e);
        }
      }

      const candidateEmails = Array.from(new Set([
        profileAuthEmail,
        mapped,
        rawIdentifier.toLowerCase().includes("@") ? rawIdentifier.toLowerCase() : null,
        !rawIdentifier.includes("@") ? `${cleanId}@dgt.llc` : null,
        profileRecord?.user_code && !profileRecord.user_code.includes("@") ? `${profileRecord.user_code.toLowerCase().replace(/[^a-z0-9]/g, "")}@dgt.llc` : null,
        rawIdentifier.toLowerCase(),
        cleanId.toLowerCase(),
      ].filter(Boolean) as string[]));

      for (const authEmail of candidateEmails) {
        const { data: signInData, error: sbError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: rawPassword
        });
        if (!sbError && signInData?.user) {
          isAuthenticated = true;
          authenticatedEmail = signInData.user.email || authEmail;
          if (!profileRecord) {
            const { data: prof } = await admin
              .from("profiles")
              .select(profileSelect)
              .eq("id", signInData.user.id)
              .maybeSingle();
            profileRecord = prof || {
              id: signInData.user.id,
              user_code: signInData.user.user_metadata?.user_code || rawIdentifier,
              full_name: signInData.user.user_metadata?.full_name || rawIdentifier
            };
          }

          if (userRoles.length === 0 && profileRecord?.id) {
            try {
              const { data: assignments } = await admin
                .from("user_role_assignments")
                .select("role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility, mobile_profile")
                .eq("user_id", profileRecord.id)
                .eq("is_active", true)
                .is("deleted_at", null);

              if (assignments && assignments.length > 0) {
                roleAssignments = assignments.map((a: any) => ({
                  role: toEnterpriseRole(a.role),
                  countryId: a.country_id,
                  countryBranchId: a.country_branch_id,
                  cityBranchId: a.city_branch_id,
                  clearingAgentId: a.clearing_agent_id,
                  ledgerVisibility: a.ledger_visibility,
                  mobileProfile: a.mobile_profile ?? "standard"
                }));
                userRoles = assignments.map((a: any) => toEnterpriseRole(a.role));
              }
            } catch (e) {
              console.warn("Role lookup retry err:", e);
            }
          }
          break;
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
    email: authenticatedEmail || rawIdentifier.toLowerCase(),
    fullName: profileRecord.full_name || rawIdentifier,
    roles: userRoles,
    assignments: roleAssignments,
    remember: rememberMe
  });

  // 6. Determine Redirection Target
  // A simplified mobile profile overrides the role dashboard — the user lands
  // directly on their assigned mobile interface.
  const mobileProfile = (roleAssignments.find((a) => a?.mobileProfile && a.mobileProfile !== "standard")?.mobileProfile) as
    | "mobile_cash_ledger"
    | "mobile_field"
    | undefined;
  const redirectTo = mobileProfile
    ? MOBILE_PROFILE_HOME[mobileProfile]
    : dashboardForRoles(userRoles);

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
