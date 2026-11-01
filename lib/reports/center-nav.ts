/**
 * The Reports Center's category navigation: ONE list of the existing report routes (old links and bookmarks keep working), filtered by the
 * login's real access (the shared route policy - the same decision the server layout makes), so a user only ever sees the categories it may open.
 */
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { reportScopeLevel } from "@/lib/reports/report-access";

export type ReportCategory = { key: string; href: string; labelKey: string; fallback: string };

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  { key: "center", href: "/dashboard/reports", labelKey: "rc.nav.center", fallback: "Reports Center" },
  { key: "country", href: "/dashboard/reports/country", labelKey: "rc.nav.country", fallback: "Country Reports" },
  { key: "branch", href: "/dashboard/reports/branch", labelKey: "rc.nav.branch", fallback: "Branch Reports" },
  { key: "handover", href: "/dashboard/reports/handover", labelKey: "rc.nav.handover", fallback: "Handover & Journal PDF Report" },
  { key: "payments", href: "/dashboard/reports/payments", labelKey: "rc.nav.payments", fallback: "Payment Reports" },
  { key: "shipping", href: "/dashboard/reports/shipping", labelKey: "rc.nav.shipping", fallback: "Shipping & Clearing Reports" },
  { key: "super_admin", href: "/dashboard/reports/super-admin", labelKey: "rc.nav.super_admin", fallback: "Super Admin Reports" },
  { key: "audit", href: "/dashboard/audit-monitoring", labelKey: "rc.nav.audit", fallback: "Enterprise Audit & Monitoring" },
  { key: "edit_history", href: "/dashboard/super-admin/edit-history?view=all", labelKey: "rc.nav.edit_history", fallback: "Edit & Version History" },
  { key: "deleted", href: "/dashboard/super-admin/deleted-records?view=all", labelKey: "rc.nav.deleted", fallback: "Deleted Records" },
  { key: "forms", href: "/dashboard/reports/system-forms-directory", labelKey: "rc.nav.forms", fallback: "System Forms Directory" }
] as const;

type SessionLike = Parameters<typeof reportScopeLevel>[0] & { permissions?: string[] | null; canViewFinancials?: boolean | null };

export function accessibleCategories(session: SessionLike): ReportCategory[] {
  const level = reportScopeLevel(session);
  return REPORT_CATEGORIES.filter((c) => {
    // one register, two historic URLs: a country-level (or global) login sees "Country Reports", a branch login sees "Branch Reports"
    if (c.key === "country" && (level === "branch" || level === "main_branch" || level === "own")) return false;
    if (c.key === "branch" && (level === "global" || level === "country")) return false;
    return evaluateRouteAccess({
      pathname: c.href.split("?")[0],
      permissions: session.permissions ?? [],
      roles: session.roles ?? [],
      operationalDomains: session.operationalDomains ?? null,
      canViewFinancials: session.canViewFinancials ?? null
    }).allowed;
  });
}
