import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { getRequestLanguage } from "@/lib/i18n/server";
import { wantsRawRecord } from "@/lib/i18n/localize-records";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { uuidSchema } from "@/lib/api/erp-validation";
import {
  CENTER_TYPES,
  centerTypesOf,
  countsByType,
  grandTotalsByCurrency,
  totalsByCurrency,
  type CenterDomain
} from "@/lib/reports/center-totals";
import { assertDomainAllowed, defaultDomain, loadCenterFilterOptions, loadCenterRows, localizeCenterRows } from "@/lib/reports/center-register";
import { assertCenterRead, reportScopeLevel, sessionReportDomains } from "@/lib/reports/report-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/reports/country - the Reports Center register (Business or Shipping Line domain).
 *
 * Needs reports:read, applies the login's own country / branch scope in SQL, never serves Business rows to a Shipping-only login (or the
 * reverse), and returns currency-separated totals computed from the SAME filtered rows the table shows. Every value comes from the original
 * saved record; a value the record does not carry is empty - there are no placeholder names, rates or amounts in this report.
 * (The path is kept for old clients; the previous implementation shipped sample figures and fabricated supplier names.)
 */
const querySchema = z.object({
  domain: z.enum(["business", "shipping"]).optional(),
  search: z.string().trim().max(120).optional(),
  type: z.string().trim().max(40).optional(),
  countryId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().trim().max(40).optional(),
  currency: z.string().trim().max(8).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
  options: z.enum(["1", "0"]).default("1")
});

const blankToUndefined = (v: string | null) => (v == null || v === "" || v === "all" ? undefined : v);

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const sp = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(sp.get("lang"));
    const raw = wantsRawRecord(request);
    const q = querySchema.parse({
      domain: blankToUndefined(sp.get("domain")),
      search: blankToUndefined(sp.get("search")),
      type: blankToUndefined(sp.get("type")),
      countryId: blankToUndefined(sp.get("countryId")),
      branchId: blankToUndefined(sp.get("branchId")),
      userId: blankToUndefined(sp.get("userId")),
      from: blankToUndefined(sp.get("from")),
      to: blankToUndefined(sp.get("to")),
      status: blankToUndefined(sp.get("status")),
      currency: blankToUndefined(sp.get("currency")),
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
      options: sp.get("options") ?? undefined
    });

    const domain: CenterDomain = q.domain ?? defaultDomain(session);
    assertCenterRead(session, domain);
    assertDomainAllowed(session, domain);
    if (q.type && !CENTER_TYPES.some((t) => t.key === q.type && t.domain === domain)) {
      return apiOk({ rows: [], total: 0, totals: [], grand: [], countsByType: {}, truncated: false });
    }

    const { rows, truncated, statuses, currencies } = await loadCenterRows(session, { domain, search: q.search, type: q.type, countryId: q.countryId, branchId: q.branchId, userId: q.userId, from: q.from, to: q.to, status: q.status, currency: q.currency });
    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;

    const [options, assigned] = await Promise.all([
      q.options === "1" ? loadCenterFilterOptions(session, domain) : Promise.resolve(null),
      withLocalPg(async (sql) => ({
        countries: (await sql`select name from countries where id = any(${session.countryIds}::uuid[]) order by name`) as unknown as Array<{ name: string }>,
        main: (await sql`select name from country_branches where id = any(${session.countryBranchIds}::uuid[]) order by name`) as unknown as Array<{ name: string }>,
        city: (await sql`select name from city_branches where id = any(${session.cityBranchIds}::uuid[]) order by name`) as unknown as Array<{ name: string }>
      }))
    ]);
    const scope = resolveReportScope(session);
    const domains = sessionReportDomains(session);

    return apiOk({
      domain,
      // country / branch names are shown in the viewer's language (the saved originals with ?raw=1); numbers, references and party names stay as saved
      rows: raw ? rows.slice(start, start + q.pageSize) : await localizeCenterRows(rows.slice(start, start + q.pageSize), lang),
      total,
      page: q.page,
      pageSize: q.pageSize,
      // the SAME filtered rows as the table: currency-separated, never converted
      totals: totalsByCurrency(rows),
      grand: grandTotalsByCurrency(rows),
      countsByType: countsByType(rows),
      truncated,
      statuses,
      currencies,
      types: centerTypesOf(domain),
      options,
      viewer: {
        id: session.userId,
        name: session.fullName || session.email || "",
        roles: session.roles,
        level: reportScopeLevel(session),
        scopeLabel: scope.scopeLabel,
        domains: { business: domains.business, shipping: domains.shipping },
        assigned: {
          countries: (assigned?.countries ?? []).map((r) => r.name),
          mainBranches: (assigned?.main ?? []).map((r) => r.name),
          cityBranches: (assigned?.city ?? []).map((r) => r.name)
        }
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
