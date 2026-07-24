"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Route } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { setTempSuperAdminSession } from "@/lib/auth/temp-session";

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8)
});

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
  if (
    (input.identifier.toLowerCase() === "superadmin" ||
      input.identifier.toLowerCase() === "superadmin@damaan.com") &&
    input.password === "Admin@123"
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
