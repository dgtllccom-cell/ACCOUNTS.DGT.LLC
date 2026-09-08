import type { ErpSession } from "@/lib/auth/session";
import type { HealthReport, HealthFinding, HealthCategory, HealthCategorySummary } from "./types";
import {
  scanNavigationIntegrity,
  scanLanguages,
  scanPrintPdf,
  scanBuildDeploy,
  runI18nGuard,
  probePages,
  probeApis,
  probeRbac,
} from "./scanner";

const CATS: HealthCategory[] = ["page", "navigation", "api", "permission", "language", "print_pdf", "build_deploy"];

function summarize(findings: HealthFinding[]): HealthCategorySummary[] {
  return CATS.map((category) => {
    const f = findings.filter((x) => x.category === category);
    return {
      category,
      total: f.length,
      healthy: f.filter((x) => x.status === "healthy" || x.status === "redirected" || x.status === "unauthorized_expected").length,
      warning: f.filter((x) => x.status === "warning").length,
      failed: f.filter((x) => x.status === "failed" || x.status === "not_found" || x.status === "server_error").length,
      notTested: f.filter((x) => x.status === "not_tested").length,
    };
  });
}

/**
 * Run a full scan. `baseUrl` + `cookie` enable the live probes; pass them as
 * null to run static checks only (navigation / language / print / build).
 */
export async function buildHealthReport(opts: {
  session: ErpSession;
  baseUrl: string | null;
  cookie: string | null;
  live: boolean;
}): Promise<HealthReport> {
  const { session, baseUrl, cookie, live } = opts;
  const findings: HealthFinding[] = [];
  const notTested: { area: string; reason: string }[] = [];

  // static
  findings.push(...scanNavigationIntegrity());
  const langScan = scanLanguages();
  findings.push(...langScan.findings);
  findings.push(...scanPrintPdf());
  const { findings: buildFindings, ...build } = scanBuildDeploy();
  findings.push(...buildFindings);

  // gates
  const i18nGuard = runI18nGuard();
  if (i18nGuard.status === "not_tested") notTested.push({ area: "i18n guard", reason: i18nGuard.detail });

  // live
  if (live && baseUrl && cookie) {
    const [pages, apis, rbac] = await Promise.all([
      probePages(baseUrl, cookie, session),
      probeApis(baseUrl, cookie),
      probeRbac(baseUrl, cookie, session),
    ]);
    findings.push(...pages, ...apis, ...rbac);
  } else {
    notTested.push({ area: "Page & route health (live)", reason: "static-only scan — no server base URL available" });
    notTested.push({ area: "API health (live)", reason: "static-only scan" });
    notTested.push({ area: "RBAC integrity (live)", reason: "static-only scan" });
  }

  // typecheck is never run per-request (too slow)
  notTested.push({ area: "TypeScript (tsc --noEmit)", reason: "not run per request — run `npx tsc --noEmit` in CI / locally" });

  const categories = summarize(findings);
  const pageCat = categories.find((c) => c.category === "page")!;
  const apiCat = categories.find((c) => c.category === "api")!;
  const permCat = categories.find((c) => c.category === "permission")!;
  const langCat = categories.find((c) => c.category === "language")!;
  const printCat = categories.find((c) => c.category === "print_pdf")!;

  const totalScored = findings.filter((f) => f.status !== "not_tested" && f.status !== "unknown").length || 1;
  const good = findings.filter((f) => ["healthy", "redirected", "unauthorized_expected"].includes(f.status)).length;
  const bad = findings.filter((f) => ["failed", "not_found", "server_error"].includes(f.status)).length;
  const warn = findings.filter((f) => f.status === "warning").length;
  const score = Math.round(((good + warn * 0.5) / totalScored) * 100);
  const label: HealthReport["overall"]["label"] = bad > 0 ? "critical" : warn > 3 ? "attention" : "healthy";

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      role: session.roles?.[0] ?? "unknown",
      isSuperAdmin: Boolean(session.isSuperAdmin),
      countryIds: session.countryIds?.length ?? 0,
      branchIds: (session.cityBranchIds?.length ?? 0) + (session.countryBranchIds?.length ?? 0),
    },
    environment: {
      appEnv: process.env.APP_ENV || process.env.NODE_ENV || "unknown",
      nodeVersion: process.version,
      nextRuntime: process.env.NEXT_RUNTIME || "nodejs",
    },
    build,
    gates: {
      i18nGuard: i18nGuard.status,
      i18nGuardDetail: i18nGuard.detail,
      typecheck: "not_tested",
      typecheckDetail: "Run separately — not executed during a scan.",
    },
    overall: {
      score,
      label,
      healthyPages: pageCat.healthy,
      warnings: warn,
      brokenPages: pageCat.failed,
      failedApis: apiCat.failed,
      permissionIssues: permCat.failed + permCat.warning,
      languageIssues: langCat.failed + langCat.warning,
      printPdfIssues: printCat.failed + printCat.warning,
    },
    categories,
    findings: findings.sort((a, b) => {
      const rank = (s: string) => (["failed", "server_error", "not_found"].includes(s) ? 0 : s === "warning" ? 1 : s === "not_tested" ? 3 : 2);
      return rank(a.status) - rank(b.status);
    }),
    notTested,
  };
}

export { scanLanguages };
