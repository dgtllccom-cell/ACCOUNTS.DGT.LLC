export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

/**
 * Destination choices for an Inter-Country Trade: the OTHER DGT countries' branches (with code and local
 * currency) and their warehouses. Existing records only — nothing is created from here.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const p = request.nextUrl.searchParams;
    const countryId = z.string().uuid().parse(p.get("countryId"));
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId });
    const lang = await getRequestLanguage(p.get("lang"));
    const out = await withLocalPg(async (sql) => {
      const branches = await sql`
        select b.id, b.code, b.name, b.local_currency, b.country_id, c.name as country_name
        from public.country_branches b join public.countries c on c.id = b.country_id
        where b.deleted_at is null and b.country_id <> ${countryId}::uuid
        order by c.name, b.name`;
      const warehouses = await sql`
        select w.id, w.warehouse_code, w.warehouse_name, w.country_id from public.warehouses w
        where w.deleted_at is null and coalesce(w.is_active, true) = true and w.country_id <> ${countryId}::uuid order by w.warehouse_name`;
      const cities = await sql`
        select ci.id, ci.name, ci.city_name, ci.country_branch_id from public.city_branches ci
        where ci.deleted_at is null and coalesce(ci.is_business_branch, true) = true and ci.country_id <> ${countryId}::uuid order by ci.city_name`;
      return { branches, warehouses, cities };
    });
    const branches = await localizeRecordFields((out?.branches ?? []) as any[], "country_branches", ["name"], lang).catch(() => out?.branches ?? []);
    const warehouses = await localizeRecordFields((out?.warehouses ?? []) as any[], "warehouses", ["warehouse_name"], lang).catch(() => out?.warehouses ?? []);
    return apiOk({ branches, warehouses, cities: out?.cities ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
