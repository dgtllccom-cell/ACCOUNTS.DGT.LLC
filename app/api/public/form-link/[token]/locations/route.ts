/**
 * Public API: /api/public/form-link/[token]/locations
 *
 * Read-only access to the central Location Management Master (countries → states_provinces → cities) for the
 * external share form. The form used to ship its own hard-coded country / state / city list; it now reads the same
 * master as every ERP address form, so a place added in Location Management appears here too and nothing is duplicated.
 *
 *   GET ?level=countries
 *   GET ?level=states&countryId=<uuid>
 *   GET ?level=cities&countryId=<uuid>&stateId=<uuid>
 *
 * Only a known, active (or preview) form-link token may read. Only active, non-deleted master rows are returned.
 */

import { NextRequest, NextResponse } from "next/server";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length > 200) return fail("Missing token");
    const params = request.nextUrl.searchParams;
    const level = params.get("level") || "countries";
    const countryId = params.get("countryId") || "";
    const stateId = params.get("stateId") || "";
    if (!["countries", "states", "cities"].includes(level)) return fail("Invalid level");
    if (level !== "countries" && !UUID.test(countryId)) return fail("Invalid country");
    if (level === "cities" && stateId && !UUID.test(stateId)) return fail("Invalid state");

    const isPreview = token.startsWith("test_token") || token.includes("preview");

    const data = await withLocalPg(async (sql) => {
      if (!isPreview) {
        const links = await sql<Array<{ status: string; expires_at: string | null }>>`
          select status, expires_at from external_form_links where token = ${token} limit 1
        `;
        const link = links[0];
        if (!link) return { denied: "Invalid or non-existent form link." } as const;
        const expired = link.expires_at && new Date(link.expires_at) < new Date();
        if (link.status !== "active" || expired) return { denied: "This form link is no longer active." } as const;
      }

      if (level === "countries") {
        const rows = await sql`
          select id, name, iso2, phone_code
          from countries
          where is_active = true and deleted_at is null
          order by name
        `;
        return { rows };
      }
      if (level === "states") {
        const rows = await sql`
          select id, name, code, postal_code
          from states_provinces
          where country_id = ${countryId}::uuid and is_active = true and deleted_at is null
          order by name
        `;
        return { rows };
      }
      const rows = stateId
        ? await sql`
            select id, name, code, zip_code
            from cities
            where country_id = ${countryId}::uuid and state_province_id = ${stateId}::uuid
              and is_active = true and deleted_at is null
            order by name
          `
        : await sql`
            select id, name, code, zip_code
            from cities
            where country_id = ${countryId}::uuid and is_active = true and deleted_at is null
            order by name
          `;
      return { rows };
    });

    if (!data) return fail("Location list is temporarily unavailable.", 503);
    if ("denied" in data) return fail(data.denied as string, 403);
    return NextResponse.json({ ok: true, data: data.rows });
  } catch {
    return fail("Location list is temporarily unavailable.", 500);
  }
}
