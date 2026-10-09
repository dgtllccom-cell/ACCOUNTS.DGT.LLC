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
 * Searchable ledger list for the Goods Transfer Journal's human-confirmed postings
 * (cost of sales, inter-country accounts). Existing ledgers only; nothing is ever auto-created.
 * Scoped to the country of the lot/purchase being worked on.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const p = request.nextUrl.searchParams;
    const countryId = z.string().uuid().parse(p.get("countryId"));
    authorizeApiScope(session, { resource: "purchases", action: "read", countryId });
    const lang = await getRequestLanguage(p.get("lang"));
    const q = String(p.get("q") ?? "").trim().toLowerCase();
    if (p.get("kind") === "account") {
      // warehouse-provider / counterparty accounts (existing accounts only)
      const accounts = await withLocalPg((sql) => sql`
        select a.id, a.code, a.name from public.enterprise_accounts a
        where a.deleted_at is null and (a.country_id = ${countryId}::uuid or a.country_id is null)
          ${q ? sql`and (lower(a.name) like ${"%" + q + "%"} or lower(a.code) like ${"%" + q + "%"})` : sql``}
        order by a.name limit 30`);
      const localizedAccounts = await localizeRecordFields((accounts ?? []) as any[], "enterprise_accounts", ["name"], lang).catch(() => accounts ?? []);
      return apiOk({ accounts: localizedAccounts ?? [] });
    }
    const rows = await withLocalPg((sql) => sql`
      select l.id, l.code, l.name, l.currency as currency_code
      from public.ledgers l
      where l.deleted_at is null
        and coalesce(l.country_id, (select cb.country_id from public.city_branches cb where cb.id = l.city_branch_id),
                     (select mb.country_id from public.country_branches mb where mb.id = l.country_branch_id)) = ${countryId}::uuid
        ${q ? sql`and (lower(l.name) like ${"%" + q + "%"} or lower(l.code) like ${"%" + q + "%"})` : sql``}
      order by l.code nulls last, l.name
      limit 40`);
    const localizedRows = await localizeRecordFields((rows ?? []) as any[], "ledgers", ["name"], lang).catch(() => rows ?? []);
    return apiOk({ ledgers: localizedRows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
