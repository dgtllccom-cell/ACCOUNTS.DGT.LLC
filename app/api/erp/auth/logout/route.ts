import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clearErpSession } from "@/lib/auth/temp-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST() {
  // getCurrentErpSession() (lib/auth/session.ts) checks the custom signed
  // temp-session cookie FIRST — named "erp_session" (lib/auth/session-cookie.ts),
  // the cookie every POST /api/erp/auth/login actually sets — and only falls
  // back to Supabase Auth's own cookie if that one is absent. This route was
  // clearing "erp_session_id"/"erp_refresh_token", neither of which is a real
  // cookie name, so "erp_session" survived and a "logged out" browser kept its
  // previous identity on the very next request.
  await clearErpSession();

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
