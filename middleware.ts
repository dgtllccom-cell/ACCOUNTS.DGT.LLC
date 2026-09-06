import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ERP_SESSION_COOKIE } from "@/lib/auth/session-cookie";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Enforce authentication for all dashboard routes.
  // This is a fast cookie-presence check (not a full session validation).
  // Individual API routes and pages call requireErpSession() for full validation.
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get(ERP_SESSION_COOKIE);
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
