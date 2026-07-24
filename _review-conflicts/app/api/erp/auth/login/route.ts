import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Route } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ERP_SESSION_COOKIE } from "@/lib/auth/temp-session";
import { dashboardByRole, type EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { createHmac } from "node:crypto";
import { normalizeUserCode } from "@/lib/services/user-identity-service";

const TEMP_USER_UUIDS: Record<string, string> = {
  "temp-super-admin": "00000000-0000-4000-8000-000000000001",
  "temp-pakistan-country-admin": "00000000-0000-4000-8000-000000000002",
  "temp-quetta-city-admin": "00000000-0000-4000-8000-000000000003"
};

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
  remember: z.boolean().default(false)
});

type TempSessionPayloadV1 = {
  v: 1;
  kind: "temp";
  userId: string;
  email: string;
  fullName: string;
  roles: EnterpriseRole[];
  assignments?: Array<{
    role: EnterpriseRole;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
  }>;
  createdAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function getSessionSecret() {
  return (
    process.env.ERP_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-insecure-erp-session-secret"
  );
}

function sign(payloadB64: string) {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

const demoAccounts: Record<
  string,
  {
    password: string;
    userId: string;
    email: string;
    fullName: string;
    roles: EnterpriseRole[];
    assignments?: TempSessionPayloadV1["assignments"];
  }
> = {
  superadmin: {
    password: "Admin@123",
    userId: TEMP_USER_UUIDS["temp-super-admin"],
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"]
  },
  "superadmin@damaan.com": {
    password: "Admin@123",
    userId: TEMP_USER_UUIDS["temp-super-admin"],
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"]
  },
  "pk-country-0531": {
    password: "Test@12345",
    userId: TEMP_USER_UUIDS["temp-pakistan-country-admin"],
    email: "pakistan.country.test.20260531@example.com",
    fullName: "Pakistan Country Test Admin",
    roles: ["country_admin"],
    assignments: [
      {
        role: "country_admin",
        countryId: "dec26827-2ba2-4517-97cb-2d85729511a2",
        countryBranchId: null,
        cityBranchId: null
      }
    ]
  },
  "pk-quetta-0531": {
    password: "Test@12345",
    userId: TEMP_USER_UUIDS["temp-quetta-city-admin"],
    email: "quetta.city.test.20260531@example.com",
    fullName: "Quetta City Test Admin",
    roles: ["city_branch_admin"],
    assignments: [
      {
        role: "city_branch_admin",
        countryId: "dec26827-2ba2-4517-97cb-2d85729511a2",
        countryBranchId: "04723132-7910-413b-a3ea-48b78f73e071",
        cityBranchId: "b3d606be-1d37-44a3-a740-d8685f6fc158"
      }
    ]
  }
};

function makeTempToken(account: (typeof demoAccounts)[string]) {
  const payload: TempSessionPayloadV1 = {
    v: 1,
    kind: "temp",
    userId: account.userId,
    email: account.email,
    fullName: account.fullName,
    roles: account.roles,
    assignments: account.assignments,
    createdAt: Date.now()
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

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
  const form = await request.formData();
  const parsed = loginSchema.safeParse({
    identifier: String(form.get("identifier") ?? ""),
    password: String(form.get("password") ?? ""),
    remember: String(form.get("remember") ?? "") === "on"
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(". ");
    const url = new URL(`/auth/login?error=${encodeURIComponent(message)}`, request.url);
    return NextResponse.redirect(url, { status: 303 });
  }

  const input = parsed.data;
  const idLower = input.identifier.trim().toLowerCase();
  const demoAccount = demoAccounts[idLower];

  if (!isSupabaseConfigured()) {
    // Temp bootstrap login (stable fallback, avoids Server Actions origin issues in some environments).
    if (demoAccount && input.password === demoAccount.password) {
      const token = makeTempToken(demoAccount);
      try {
        const admin = createSupabaseAdminClient() as any;
        await admin.from("audit_logs").insert({
          company_id: null,
          actor_id: null,
          action: "auth.login.temp",
          entity_table: "profiles",
          entity_id: null,
          before: null,
          after: { identifier: input.identifier, temp: true },
          ip_address: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
        });
      } catch {
        // ignore audit bootstrap failures
      }
      const res = NextResponse.redirect(new URL(dashboardForRoles(demoAccount.roles), request.url), { status: 303 });
      res.cookies.set(ERP_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: input.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8
      });
      return res;
    }

    const url = new URL(
      `/auth/login?error=${encodeURIComponent("Supabase is not configured. Use the temporary Super Admin login for now.")}`,
      request.url
    );
    return NextResponse.redirect(url, { status: 303 });
  }

  // ERP bootstrap/demo users should always be able to enter through the ERP
  // session layer. This keeps local operations working even when Supabase Auth
  // DNS/network is unavailable.
  const wantsTemp = request.nextUrl.searchParams.get("temp") === "1";
  if ((wantsTemp || demoAccount) && demoAccount && input.password === demoAccount.password) {
    const token = makeTempToken(demoAccount);
    const res = NextResponse.redirect(new URL(dashboardForRoles(demoAccount.roles), request.url), { status: 303 });
    res.cookies.set(ERP_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: input.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8
    });
    return res;
  }

  const identifierRaw = input.identifier.trim();
  const emailResult = z.string().email().safeParse(identifierRaw);
  let emailToLogin = emailResult.success ? emailResult.data : null;

  // User ID login: resolve user_code -> email via service role (profiles.user_code).
  if (!emailToLogin) {
    try {
      const admin = createSupabaseAdminClient() as any;
      const userCode = normalizeUserCode(identifierRaw);
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("user_code", userCode)
        .is("deleted_at", null)
        .maybeSingle();
      if (profileError) throw new Error(profileError.message);

      const profileId = profile?.id as string | undefined;
      if (!profileId) {
        const url = new URL(`/auth/login?error=${encodeURIComponent("Invalid User ID / Email.")}`, request.url);
        return NextResponse.redirect(url, { status: 303 });
      }

      const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(profileId);
      if (userErr) throw new Error(userErr.message);
      const resolvedEmail = (userRes?.user?.email as string | undefined) ?? undefined;
      if (!resolvedEmail) {
        const url = new URL(`/auth/login?error=${encodeURIComponent("User ID exists but email is missing.")}`, request.url);
        return NextResponse.redirect(url, { status: 303 });
      }
      emailToLogin = resolvedEmail;
    } catch (e: any) {
      const url = new URL(
        `/auth/login?error=${encodeURIComponent(e?.message || "User ID login is not available yet.")}`,
        request.url
      );
      return NextResponse.redirect(url, { status: 303 });
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: emailToLogin,
    password: input.password
  });

  if (error) {
    const url = new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url);
    return NextResponse.redirect(url, { status: 303 });
  }

  try {
    const admin = createSupabaseAdminClient() as any;
    const actorId = signInData?.user?.id ?? null;
    const { data: profile } = actorId
      ? await admin.from("profiles").select("id, default_company_id").eq("id", actorId).maybeSingle()
      : { data: null };
    await admin.from("audit_logs").insert({
      company_id: profile?.default_company_id ?? null,
      actor_id: actorId,
      action: "auth.login.success",
      entity_table: "profiles",
      entity_id: actorId,
      before: null,
      after: { identifier: input.identifier, remembered: input.remember },
      ip_address: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null
    });
  } catch {
    // ignore audit logging failures; auth should still succeed
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
    }
  } catch {
    redirectTo = "/dashboard";
  }

  return NextResponse.redirect(new URL(redirectTo as Route, request.url), { status: 303 });
}
