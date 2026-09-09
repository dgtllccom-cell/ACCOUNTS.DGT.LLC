import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ERP_SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { readMobileProfileFromToken } from "@/lib/auth/edge-session";
import { MOBILE_PROFILE_HOME, mobileProfileAllowsApi, mobileProfileAllowsPath } from "@/lib/permissions/mobile-profiles";

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

  // ── Mobile access-profile perimeter ──────────────────────────────────────
  // A verified mobile_cash_ledger / mobile_field session may only reach its own
  // /m/* pages and a small allow-list of APIs. This is the single choke point
  // that also covers routes which never call authorize() (HR/payroll, CRM,
  // clearing-agents, audit, messages, …). Server-side authorize() + the layout
  // guard remain as defense in depth.
  if (pathname.startsWith("/m/") || pathname.startsWith("/api/erp/") || pathname.startsWith("/dashboard")) {
    const mp = await readMobileProfileFromToken(request.cookies.get(ERP_SESSION_COOKIE)?.value);
    if (mp && mp !== "standard") {
      const isApi = pathname.startsWith("/api/");
      const allowed = isApi ? mobileProfileAllowsApi(mp, pathname) : mobileProfileAllowsPath(mp, pathname);
      if (!allowed) {
        if (isApi) {
          return NextResponse.json(
            { ok: false, error: { code: "FORBIDDEN", message: "This is not available on your mobile access profile." } },
            { status: 403 },
          );
        }
        return NextResponse.redirect(new URL(MOBILE_PROFILE_HOME[mp], request.url));
      }
    }
  }

  if (
    pathname.startsWith("/api/erp/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/erp/document-intelligence")
  ) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/erp/auth|auth|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
