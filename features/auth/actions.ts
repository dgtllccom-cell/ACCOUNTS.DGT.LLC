"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Route } from "next";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setTempSuperAdminSession } from "@/lib/auth/temp-session";
import { withLocalPg } from "@/lib/db/local-postgres";

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8)
});

// SECURITY: this used to match ANY identifier merely *containing* "superadmin"
// or "asmat" (e.g. "asmat123", "notasmatbutclose") together with a small list
// of accepted passwords, unconditionally in every environment (isDemoAuthEnabled()
// was imported but never actually called). That let anyone on the internet log
// in as super_admin with no real credentials. Now: exact match only, on a
// single configurable identifier/password, and only when demo auth is enabled.
const BOOTSTRAP_IDENTIFIER = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL || "superadmin@damaan.com").trim().toLowerCase();
// No hardcoded fallback: the bootstrap login is disabled unless an operator sets
// BOOTSTRAP_SUPERADMIN_PASSWORD in the environment AND demo auth is enabled.
const BOOTSTRAP_PASSWORD = (process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || "").trim();

export async function signInWithPassword(formData: FormData) {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(". ");
    redirect((`/auth/login?error=${encodeURIComponent(message)}`) as any);
  }

  const input = parsed.data;

  const remember = String(formData.get("remember") || "") === "on";

  // Temporary bootstrap login (works even if Supabase isn't configured yet).
  // Gated behind ALLOW_DEMO_AUTH and requires an EXACT identifier + password
  // match — set ALLOW_DEMO_AUTH=false once real Supabase accounts are confirmed.
  if (
    isDemoAuthEnabled() &&
    BOOTSTRAP_PASSWORD.length > 0 &&
    input.identifier.toLowerCase() === BOOTSTRAP_IDENTIFIER &&
    input.password === BOOTSTRAP_PASSWORD
  ) {
    await setTempSuperAdminSession({ remember });
    redirect("/dashboard" as Route);
  }

  if (!isSupabaseConfigured()) {
    redirect((`/auth/login?error=${encodeURIComponent("Supabase is not configured. Use the temporary Super Admin login for now.")}`) as any);
  }

  // Temporary: Supabase Auth uses email+password. "User ID" login can be added once user_code mapping exists.
  const emailResult = z.string().email().safeParse(input.identifier);
  if (!emailResult.success) {
    redirect(
      (`/auth/login?error=${encodeURIComponent(
        "Please use email to sign in. User ID login will be enabled soon."
      )}`) as any
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailResult.data,
    password: input.password
  });

  if (error) {
    redirect((`/auth/login?error=${encodeURIComponent(error.message)}`) as any);
  }

  redirect("/dashboard" as Route);
}

export async function enterDashboardPreview() {
  if (!isDemoAuthEnabled()) {
    redirect("/auth/login" as Route);
  }

  const cookieStore = await cookies();

  cookieStore.set("damaan_dashboard_preview", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect("/dashboard" as Route);
}

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect((`/auth/login?error=${encodeURIComponent("Supabase is not configured.")}`) as any);
  }

  const input = z
    .object({
      email: z.string().email()
    })
    .parse({
      email: formData.get("email")
    });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email);

  if (error) {
    redirect((`/auth/forgot-password?error=${encodeURIComponent(error.message)}`) as any);
  }

  redirect((`/auth/login?error=${encodeURIComponent("Password reset link sent. Please check your email.")}`) as any);
}

// Self-service: an already-authenticated user (typically right after an
// admin-issued temporary password reset) sets their own new password.
// Uses the same Supabase Auth hashing as every other login - no second
// credential store, no plaintext password ever written anywhere.
export async function updateOwnPassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect((`/auth/set-new-password?error=${encodeURIComponent("Supabase is not configured.")}`) as any);
  }

  const input = z
    .object({
      newPassword: z.string().min(8, "Password must be at least 8 characters."),
      confirmPassword: z.string().min(8)
    })
    .safeParse({
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword")
    });

  if (!input.success) {
    const message = input.error.issues.map((issue) => issue.message).join(". ");
    redirect((`/auth/set-new-password?error=${encodeURIComponent(message)}`) as any);
  }

  if (input.data.newPassword !== input.data.confirmPassword) {
    redirect((`/auth/set-new-password?error=${encodeURIComponent("Passwords do not match.")}`) as any);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();
  if (getUserError || !user) {
    redirect("/auth/login" as Route);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: input.data.newPassword });
  if (updateError) {
    redirect((`/auth/set-new-password?error=${encodeURIComponent(updateError.message)}`) as any);
  }

  // Clear the flag so the dashboard layout stops redirecting here.
  const viaPg = await withLocalPg(async (sql) => {
    await sql`update public.profiles set must_change_password = false where id = ${user!.id}::uuid`;
    return true;
  });
  if (!viaPg) {
    const admin = createSupabaseAdminClient() as any;
    await admin.from("profiles").update({ must_change_password: false }).eq("id", user!.id);
  }

  redirect("/dashboard" as Route);
}
