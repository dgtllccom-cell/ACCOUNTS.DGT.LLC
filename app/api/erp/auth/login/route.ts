import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Route } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dashboardByRole, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { normalizeUserCode } from "@/lib/services/user-identity-service";

function dashboardForRoles(roles: EnterpriseRole[]) {
  const primary = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("country_admin")
      ? "country_admin"
      : roles.includes("country_user")
        ? "country_user"
        : roles[0];
  return primary ? dashboardByRole[primary] : "/dashboard";
}

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

  if (!isSupabaseConfigured()) {
    return respondError("Authentication service is not configured.", 503);
  }

  // Resolve a real email to authenticate against Supabase Auth. Identifiers may be
  // either an email address or an internal user code that maps to a real auth user.
  const emailResult = z.string().email().safeParse(rawIdentifier);
  let emailToLogin = emailResult.success ? emailResult.data : null;

  if (!emailToLogin) {
    try {
      const admin = createSupabaseAdminClient() as any;
      const userCode = normalizeUserCode(rawIdentifier);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("user_code", userCode)
        .is("deleted_at", null)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);

      const profileId = profile?.id as string | undefined;
      if (!profileId) {
        return respondError("Invalid User ID or Password.", 401);
      }

      const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(profileId);
      if (userErr) throw new Error(userErr.message);
      const resolvedEmail = (userRes?.user?.email as string | undefined) ?? undefined;
      if (!resolvedEmail) {
        return respondError("Invalid User ID or Password.", 401);
      }
      emailToLogin = resolvedEmail;
    } catch {
      return respondError("Invalid User ID or Password.", 401);
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: emailToLogin,
    password: rawPassword
  });

  if (error) {
    return respondError("Invalid User ID or Password.", 401);
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
          after: { identifier: rawIdentifier },
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
