import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ERP_SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { readMobileProfileFromToken } from "@/lib/auth/edge-session";
import { MOBILE_PROFILE_HOME, mobileProfileAllowsApi, mobileProfileAllowsPath } from "@/lib/permissions/mobile-profiles";
import { isPrototypeMode } from "@/lib/prototype/mode";

function resolveRedirectUrl(targetPath: string, request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "https");
  if (forwardedHost && !forwardedHost.startsWith("0.0.0.0") && !forwardedHost.startsWith("127.0.0.1") && !forwardedHost.startsWith("localhost")) {
    return new URL(targetPath, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(targetPath, request.url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The dashboard layout (server) needs the requested path to apply the route access policy (see lib/navigation/route-policy).
  // Always overwrite: a client-supplied value must never be trusted.
  request.headers.set("x-erp-pathname", pathname);

  if (isPrototypeMode()) {
    if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
      return NextResponse.json(
        { ok: true, data: { success: true, prototype: true, noWrite: true } },
        { status: 200, headers: { "x-dgt-prototype": "1" } },
      );
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // Enforce authentication for all dashboard routes.
  // This is a fast cookie-presence check (not a full session validation).
  // Individual API routes and pages call requireErpSession() for full validation.
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = request.cookies.get(ERP_SESSION_COOKIE);
    if (!sessionCookie?.value) {
      const loginUrl = resolveRedirectUrl("/auth/login", request);
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
      const allowed = isApi ? mobileProfileAllowsApi(mp, pathname, request.method) : mobileProfileAllowsPath(mp, pathname);
      if (!allowed) {
        if (isApi) {
          return NextResponse.json(
            { ok: false, error: { code: "FORBIDDEN", message: "This is not available on your mobile access profile." } },
            { status: 403 },
          );
        }
        return NextResponse.redirect(resolveRedirectUrl(MOBILE_PROFILE_HOME[mp], request));
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
