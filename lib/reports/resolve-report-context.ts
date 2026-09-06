import "server-only";
import type { ErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { withLocalPg } from "@/lib/db/local-postgres";

/**
 * The "Branch & User Details" block that Card 1 of every ERP report shows, plus a
 * banner image key. Resolved server-side from the signed-in session's primary
 * role assignment — real country / state / city / branch names, not IDs.
 */
export type ReportContext = {
  country: string;
  state: string;
  city: string;
  branchName: string;
  branchCode: string;
  userId: string;
  userName: string;
  role: string;
  accessScope: string;   // "Global" | "Country" | "Main Branch" | "Branch"
  scopeLabel: string;
  online: boolean;
  /** location-aware banner image url (public/images/report-banners/*) */
  bannerImage: string;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
};

const SCOPE_ACCESS: Record<string, string> = {
  global: "Global",
  country: "Country",
  branch: "Branch",
};

const BANNERS: Record<string, string> = {
  Pakistan: "/images/report-banners/pakistan.jpg",
  Afghanistan: "/images/report-banners/afghanistan.jpg",
  "United Arab Emirates": "/images/report-banners/uae.jpg",
  Iran: "/images/report-banners/iran.jpg",
  India: "/images/report-banners/india.jpg",
};

type Geo = {
  country: string; state: string; city: string; branchName: string; branchCode: string;
  countryId: string | null; countryBranchId: string | null; cityBranchId: string | null;
};

export async function resolveReportContext(session: ErpSession): Promise<ReportContext> {
  const scope = resolveReportScope(session);
  const primary = session.assignments?.[0] ?? null;

  const fallback: Geo = {
    country: session.isSuperAdmin ? "All Countries (Global)" : "—",
    state: "—", city: "—",
    branchName: session.isSuperAdmin ? "All Global Branches" : "—",
    branchCode: "—",
    countryId: primary?.countryId ?? null,
    countryBranchId: primary?.countryBranchId ?? null,
    cityBranchId: primary?.cityBranchId ?? null,
  };

  let geo: Geo = fallback;
  try {
    geo = (await withLocalPg<Geo>(async (sql) => {
    const countryId = primary?.countryId ?? null;
    const countryBranchId = primary?.countryBranchId ?? null;
    const cityBranchId = primary?.cityBranchId ?? null;

    let country = fallback.country;
    let state = "—";
    let city = "—";
    let branchName = fallback.branchName;
    let branchCode = "—";

    if (countryId) {
      const [c] = await sql`select name from public.countries where id = ${countryId}::uuid limit 1`;
      if (c?.name) country = c.name;
    }
    if (cityBranchId) {
      const [cb] = await sql`
        select cb.name, cb.code, s.name as state_name, ci.name as city_name
        from public.city_branches cb
        left join public.cities ci on ci.id = cb.city_id
        left join public.states s on s.id = ci.state_id
        where cb.id = ${cityBranchId}::uuid limit 1`;
      if (cb) {
        branchName = cb.name || branchName;
        branchCode = cb.code || branchCode;
        state = cb.state_name || state;
        city = cb.city_name || city;
      }
    } else if (countryBranchId) {
      const [mb] = await sql`select name, code from public.country_branches where id = ${countryBranchId}::uuid limit 1`;
      if (mb) { branchName = mb.name || branchName; branchCode = mb.code || branchCode; }
    }

      return { country, state, city, branchName, branchCode, countryId, countryBranchId, cityBranchId };
    })) ?? fallback;
  } catch {
    geo = fallback;
  }

  return {
    ...geo,
    userId: session.userId,
    userName: session.fullName || session.email || session.userId,
    role: (session.roles?.[0] || "user").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    accessScope: SCOPE_ACCESS[scope.level] ?? scope.level,
    scopeLabel: scope.scopeLabel ?? SCOPE_ACCESS[scope.level] ?? "",
    online: true,
    bannerImage: BANNERS[geo.country] ?? "/images/report-banners/default.jpg",
  };
}
