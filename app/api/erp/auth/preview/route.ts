import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  res.cookies.set("damaan_dashboard_preview", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return res;
}

