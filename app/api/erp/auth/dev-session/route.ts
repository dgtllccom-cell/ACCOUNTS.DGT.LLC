import { NextResponse } from "next/server";
import { isDemoAuthEnabled } from "@/lib/supabase/config";
import { setTempSuperAdminSession, setDirectUserSession } from "@/lib/auth/temp-session";

/**
 * DEV-ONLY passwordless session bootstrap for end-to-end testing.
 *
 * Gated to APP_ENV === "development" AND demo auth enabled — returns 404
 * otherwise, so it is completely inert in staging/production. Same spirit as
 * /api/erp/auth/preview, but establishes a real `erp_session` cookie (so API
 * routes that call requireErpSession() work), and can mint a scoped role for
 * permission testing.
 *
 *   POST /api/erp/auth/dev-session
 *   POST /api/erp/auth/dev-session { "role": "country_admin", "countryId": "<uuid>" }
 */
function devEnabled() {
  return (process.env.APP_ENV || "").toLowerCase() === "development" && isDemoAuthEnabled();
}

export async function POST(request: Request) {
  if (!devEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const role = typeof body.role === "string" ? body.role : "super_admin";

  if (role === "super_admin") {
    await setTempSuperAdminSession({ remember: false });
    return NextResponse.json({ ok: true, role: "super_admin", email: "superadmin@damaan.com" });
  }

  await setDirectUserSession({
    userId: (typeof body.userId === "string" && body.userId) || "00000000-0000-4000-8000-000000000009",
    email: `${role}@dev.local`,
    fullName: `Dev ${role}`,
    roles: [role as never],
    assignments: [
      {
        role: role as never,
        countryId: (typeof body.countryId === "string" && body.countryId) || null,
        countryBranchId: (typeof body.countryBranchId === "string" && body.countryBranchId) || null,
        cityBranchId: (typeof body.cityBranchId === "string" && body.cityBranchId) || null,
      },
    ],
    remember: false,
  });
  return NextResponse.json({ ok: true, role });
}

export async function GET() {
  return NextResponse.json({ enabled: devEnabled() });
}
