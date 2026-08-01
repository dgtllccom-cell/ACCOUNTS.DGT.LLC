import { NextResponse } from "next/server";
import { isDemoAuthEnabled } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) {
    return NextResponse.redirect(new URL("/auth/login", request.url), { status: 303 });
  }

  const res = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  res.cookies.set("damaan_dashboard_preview", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return res;
}

