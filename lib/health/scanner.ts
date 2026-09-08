/**
 * ERP Health & Integrity Center — scanner.
 *
 * READ-ONLY. Static checks (navigation, languages, print builders, build/deploy)
 * run in-process. Live checks (page routes, APIs, RBAC) issue GET/HEAD requests
 * only, against the running server, forwarding the caller's own session cookie —
 * so they can never see or do more than the caller already can, and never write.
 */
import { execFileSync } from "node:child_process";
import type { ErpSession } from "@/lib/auth/session";
import { sidebarTree, type SidebarNode } from "@/lib/navigation/sidebar";
import { getUiDictionaries, t } from "@/lib/i18n/ui";
import { buildGenericErpReportHtml } from "@/lib/reports/open-generic-erp-report";
import type { HealthFinding, HealthReport, HealthStatus, HealthCategory } from "./types";

const LANGS = ["en", "ur", "ps", "fa", "ar"] as const;
type Lang = (typeof LANGS)[number];
const now = () => new Date().toISOString();

let _fid = 0;
function finding(f: Omit<HealthFinding, "id" | "checkedAt">): HealthFinding {
  return { id: `f${++_fid}`, checkedAt: now(), ...f };
}

/* ── navigation inventory ─────────────────────────────────────────────────── */

export interface NavEntry {
  key: string;
  labelKey: string;
  label: string;
  href: string | null;
  roles: string[] | null;
  permission: { resource: string; action: string } | null;
  depth: number;
  parentKey: string | null;
  hasChildren: boolean;
}

export function flattenNav(nodes: SidebarNode[] = sidebarTree, depth = 0, parentKey: string | null = null): NavEntry[] {
  const out: NavEntry[] = [];
  for (const n of nodes) {
    out.push({
      key: n.key,
      labelKey: n.labelKey as string,
      label: t("en", n.labelKey as string, n.labelKey as string),
      href: (n.href as string) ?? null,
      roles: n.roles ? [...n.roles] : null,
      permission: n.permission ?? null,
      depth,
      parentKey,
      hasChildren: Boolean(n.children?.length),
    });
    if (n.children?.length) out.push(...flattenNav(n.children, depth + 1, n.key));
  }
  return out;
}

/* ── 1. navigation integrity (static) ─────────────────────────────────────── */

export function scanNavigationIntegrity(): HealthFinding[] {
  const nav = flattenNav();
  const out: HealthFinding[] = [];
  const dict = getUiDictionaries();

  // duplicate keys
  const keySeen = new Map<string, number>();
  for (const e of nav) keySeen.set(e.key, (keySeen.get(e.key) ?? 0) + 1);
  for (const [key, count] of keySeen) {
    if (count > 1) {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: key,
          status: "warning",
          title: `Duplicate menu key "${key}"`,
          expected: "Each sidebar node key is unique",
          actual: `Appears ${count} times`,
        }),
      );
    }
  }

  // duplicate hrefs (two menu items → same page)
  const hrefSeen = new Map<string, string[]>();
  for (const e of nav) {
    if (!e.href) continue;
    hrefSeen.set(e.href, [...(hrefSeen.get(e.href) ?? []), e.key]);
  }
  for (const [href, keys] of hrefSeen) {
    if (keys.length > 1) {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: href,
          status: "warning",
          title: `Two menu items point to the same route`,
          expected: "One menu item per route",
          actual: `${keys.join(", ")} → ${href}`,
          link: href,
        }),
      );
    }
  }

  // label key missing from the dictionary (would render the raw key)
  for (const e of nav) {
    const enVal = (dict.en as Record<string, string>)[e.labelKey];
    if (!enVal) {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: e.key,
          status: "failed",
          title: `Menu label key not in dictionary`,
          expected: `"${e.labelKey}" resolves in all 5 languages`,
          actual: `Missing — the menu would show the raw key`,
          language: Object.fromEntries(LANGS.map((l) => [l, "fail"])) as any,
        }),
      );
    }
  }

  // leaf node without href AND without children (dead entry)
  for (const e of nav) {
    if (!e.href && !e.hasChildren) {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: e.key,
          status: "warning",
          title: `Menu node has neither a route nor children`,
          expected: "A menu node links somewhere or groups children",
          actual: `"${e.label}" is a dead entry`,
        }),
      );
    }
  }

  // child route not under its parent's path (loose structural check)
  const byKey = new Map(nav.map((e) => [e.key, e]));
  for (const e of nav) {
    if (!e.href || !e.parentKey) continue;
    const parent = byKey.get(e.parentKey);
    if (parent?.href && !e.href.startsWith(parent.href) && parent.href !== "/dashboard") {
      out.push(
        finding({
          category: "navigation",
          module: parent.label,
          target: e.href,
          status: "warning",
          title: `Child route is outside its parent's path`,
          expected: `starts with "${parent.href}"`,
          actual: e.href,
          link: e.href,
        }),
      );
    }
  }

  return out;
}

/* ── 2. five-language health (static) ─────────────────────────────────────── */

export function scanLanguages(): { findings: HealthFinding[]; namespaceRollup: Record<string, Record<Lang, number>> } {
  const dict = getUiDictionaries() as Record<Lang, Record<string, string>>;
  const findings: HealthFinding[] = [];
  const enKeys = Object.keys(dict.en);

  // parity — every en key must exist (non-empty) in every language
  const missing: Record<Lang, string[]> = { en: [], ur: [], ps: [], fa: [], ar: [] };
  const silentEnglish: string[] = [];
  const rawLooking: string[] = [];

  for (const k of enKeys) {
    const enVal = dict.en[k];
    if (/^[a-z0-9]+(\.[a-z0-9_]+)+$/i.test(enVal) && enVal === k) rawLooking.push(k);
    let sameCount = 0;
    for (const l of LANGS) {
      const v = dict[l]?.[k];
      if (v == null || v === "") missing[l].push(k);
      else if (l !== "en" && v === enVal) sameCount++;
    }
    // a non-en value identical to en across ALL 4 → silent English (ignore short tokens / codes)
    if (sameCount === 4 && enVal.length > 3 && /[a-z]{2,}/i.test(enVal) && !/^[A-Z0-9_ /-]+$/.test(enVal)) {
      silentEnglish.push(k);
    }
  }

  for (const l of LANGS) {
    if (missing[l].length) {
      findings.push(
        finding({
          category: "language",
          module: "i18n dictionary (lib/i18n/ui.ts)",
          target: l,
          status: "failed",
          title: `${missing[l].length} key(s) missing a ${l.toUpperCase()} value`,
          expected: `all ${enKeys.length} keys present in ${l.toUpperCase()}`,
          actual: `${missing[l].length} missing`,
          evidence: missing[l].slice(0, 25),
          language: { [l]: "fail" } as any,
        }),
      );
    }
  }
  if (silentEnglish.length) {
    findings.push(
      finding({
        category: "language",
        module: "i18n dictionary (lib/i18n/ui.ts)",
        target: "silent-english",
        status: "warning",
        title: `${silentEnglish.length} key(s) render English in every non-English language`,
        expected: "translated text per language",
        actual: "UR/PS/FA/AR value equals the English value",
        evidence: silentEnglish.slice(0, 30),
        language: { ur: "fail", ps: "fail", fa: "fail", ar: "fail" } as any,
      }),
    );
  }
  if (rawLooking.length) {
    findings.push(
      finding({
        category: "language",
        module: "i18n dictionary (lib/i18n/ui.ts)",
        target: "raw-keys",
        status: "warning",
        title: `${rawLooking.length} key(s) whose English value looks like the key itself`,
        expected: "human-readable English label",
        actual: "value === key",
        evidence: rawLooking.slice(0, 20),
      }),
    );
  }
  if (!findings.length) {
    findings.push(
      finding({
        category: "language",
        module: "i18n dictionary (lib/i18n/ui.ts)",
        target: "parity",
        status: "healthy",
        title: `${enKeys.length} keys × 5 languages — full parity, no silent English`,
        expected: "full parity",
        actual: "full parity",
        language: Object.fromEntries(LANGS.map((l) => [l, "pass"])) as any,
      }),
    );
  }

  // per-namespace rollup (nav., cns., health., …) — counts of keys per language present
  const namespaceRollup: Record<string, Record<Lang, number>> = {};
  for (const k of enKeys) {
    const ns = k.includes(".") ? k.split(".")[0] : "(root)";
    namespaceRollup[ns] ??= { en: 0, ur: 0, ps: 0, fa: 0, ar: 0 };
    for (const l of LANGS) if (dict[l]?.[k]) namespaceRollup[ns][l]++;
  }

  return { findings, namespaceRollup };
}

/* ── 3. print / PDF builder health (static) ───────────────────────────────── */

export function scanPrintPdf(): HealthFinding[] {
  const out: HealthFinding[] = [];
  const columns = [
    { key: "name", label: "Name", align: "left" as const },
    { key: "amount", label: "Amount", align: "right" as const, format: "number" as const },
  ];
  const cases: { name: string; rows: Record<string, unknown>[] }[] = [
    { name: "empty dataset", rows: [] },
    { name: "sample dataset", rows: [{ name: "Test Row", amount: 1234.5 }] },
  ];
  for (const lang of LANGS) {
    for (const c of cases) {
      try {
        const { html } = buildGenericErpReportHtml({
          title: "Health Check Report",
          lang,
          columns,
          rows: c.rows,
          summary: { Total: c.rows.length },
          filters: [{ label: "Scope", value: "health" }],
        });
        const ok = typeof html === "string" && html.length > 200 && html.includes("<table");
        if (!ok) {
          out.push(
            finding({
              category: "print_pdf",
              module: "Universal report engine",
              target: `buildGenericErpReportHtml [${lang}/${c.name}]`,
              status: "failed",
              title: `Report builder produced no usable HTML`,
              expected: "an HTML document containing a <table>",
              actual: `${html?.length ?? 0} chars, table=${html?.includes("<table")}`,
              language: { [lang]: "fail" } as any,
            }),
          );
        }
      } catch (e) {
        out.push(
          finding({
            category: "print_pdf",
            module: "Universal report engine",
            target: `buildGenericErpReportHtml [${lang}/${c.name}]`,
            status: "failed",
            title: `Report builder threw`,
            expected: "no exception",
            actual: e instanceof Error ? e.message : String(e),
            language: { [lang]: "fail" } as any,
          }),
        );
      }
    }
  }
  if (!out.length) {
    out.push(
      finding({
        category: "print_pdf",
        module: "Universal report engine",
        target: "buildGenericErpReportHtml",
        status: "healthy",
        title: "Report builder renders for all 5 languages (empty + populated)",
        expected: "valid HTML + <table>, no exception",
        actual: "10/10 cases passed",
        language: Object.fromEntries(LANGS.map((l) => [l, "pass"])) as any,
      }),
    );
  }
  return out;
}

/* ── 4. build & deploy (static) ───────────────────────────────────────────── */

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function scanBuildDeploy(): HealthReport["build"] & { findings: HealthFinding[] } {
  const localSha = git(["rev-parse", "HEAD"]);
  const originMainSha = git(["rev-parse", "origin/main"]);
  const dirty = git(["status", "--porcelain"]);
  const dirtyCount = dirty == null ? null : dirty.split("\n").filter((l) => l.trim() && !l.includes("tsconfig.tsbuildinfo")).length;
  let buildId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const p = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(p)) buildId = fs.readFileSync(p, "utf8").trim();
  } catch {
    /* ignore */
  }

  const findings: HealthFinding[] = [];
  if (localSha && originMainSha && localSha !== originMainSha) {
    findings.push(
      finding({
        category: "build_deploy",
        module: "Deployment",
        target: "HEAD vs origin/main",
        status: "warning",
        title: "Running code differs from origin/main (may be behind — origin ref not fetched here)",
        expected: "deployed HEAD === origin/main",
        actual: `HEAD ${localSha.slice(0, 8)} · origin/main(cached) ${originMainSha.slice(0, 8)}`,
      }),
    );
  }
  if (dirtyCount && dirtyCount > 0) {
    findings.push(
      finding({
        category: "build_deploy",
        module: "Deployment",
        target: "working tree",
        status: "warning",
        title: `${dirtyCount} uncommitted file(s) in the running checkout`,
        expected: "clean working tree on a deployed server",
        actual: `${dirtyCount} modified/untracked`,
      }),
    );
  }

  return {
    localSha,
    localShaShort: localSha ? localSha.slice(0, 8) : null,
    originMainSha,
    workingTreeDirtyFiles: dirtyCount,
    buildId,
    note:
      "SHA read from the running server's git checkout. origin/main is the local cached ref (not fetched during a scan). tsc / build results are not run per-request — use the deep gate check.",
    findings,
  };
}

export function runI18nGuard(): { status: "pass" | "fail" | "not_tested"; detail: string } {
  try {
    const outp = execFileSync("node", ["scripts/i18n-ui-guard.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 60000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const pass = /i18n-ui-guard passed/.test(outp);
    const line = (outp.split("\n").find((l) => /passed|FAILED/.test(l)) || "").trim();
    return { status: pass ? "pass" : "fail", detail: line || outp.slice(-300) };
  } catch (e: any) {
    const out = String(e?.stdout || "") + String(e?.stderr || "");
    if (/i18n-ui-guard/.test(out)) {
      const line = (out.split("\n").find((l) => /FAILED|✗/.test(l)) || "").trim();
      return { status: "fail", detail: line || out.slice(-300) };
    }
    return { status: "not_tested", detail: "guard script not runnable in this environment" };
  }
}

/* ── 5. live probes (page routes / APIs / RBAC) ───────────────────────────── */

function classifyHttp(status: number, location: string | null): HealthStatus {
  if (status >= 200 && status < 300) return "healthy";
  if (status === 401 || status === 403) return "unauthorized_expected";
  if (status >= 300 && status < 400) {
    if (location && /\/auth\/login|\/login/.test(location)) return "redirected";
    return "redirected";
  }
  if (status === 404) return "not_found";
  if (status === 405) return "healthy"; // route exists, wrong verb for a HEAD/GET probe
  if (status >= 500) return "server_error";
  return "unknown";
}

async function probe(baseUrl: string, path: string, cookie: string, method: "GET" | "HEAD" = "GET"): Promise<{ status: number; location: string | null; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { cookie, "x-erp-health-scan": "1" },
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    return { status: res.status, location: res.headers.get("location"), ms: Date.now() - start };
  } catch (e) {
    return { status: 0, location: null, ms: Date.now() - start };
  }
}

export async function probePages(baseUrl: string, cookie: string, session: ErpSession): Promise<HealthFinding[]> {
  const nav = flattenNav().filter((e) => e.href && e.href.startsWith("/dashboard"));
  // de-dupe hrefs
  const seen = new Set<string>();
  const targets = nav.filter((e) => e.href && !seen.has(e.href) && seen.add(e.href!));
  const out: HealthFinding[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (e) => {
        const r = await probe(baseUrl, e.href!, cookie, "GET");
        return { e, r };
      }),
    );
    for (const { e, r } of results) {
      const status = r.status === 0 ? "failed" : classifyHttp(r.status, r.location);
      // is this route in the current user's declared scope?
      const roleOk = !e.roles || e.roles.length === 0 || session.isSuperAdmin || e.roles.some((role) => session.roles.includes(role as any));
      let title = e.label;
      let final: HealthStatus = status;
      let expected = "200 for an in-scope page, or redirect to login when unauthenticated";
      let actual = r.status === 0 ? "no response (timeout / connection error)" : `HTTP ${r.status}${r.location ? ` → ${r.location}` : ""} (${r.ms}ms)`;
      if (status === "healthy" && !roleOk) {
        final = "warning";
        title = `${e.label} — reachable but declared for other roles only`;
        expected = `403/redirect for roles not in [${e.roles?.join(", ")}]`;
      }
      if (status === "unauthorized_expected" && roleOk) {
        // current user SHOULD have access but got 401/403
        final = "warning";
        title = `${e.label} — denied for a role that should have access`;
      }
      out.push(
        finding({
          category: "page",
          module: e.parentKey ? flattenNav().find((n) => n.key === e.parentKey)?.label || "—" : "Top level",
          target: e.href!,
          status: final,
          title,
          expected,
          actual,
          permission: e.permission ? `${e.permission.resource}:${e.permission.action}` : e.roles?.length ? `roles: ${e.roles.join(", ")}` : "public (no role gate)",
          link: e.href!,
        }),
      );
    }
  }
  return out;
}

/** Curated set of safe, read-only GET endpoints. Never anything that writes. */
const SAFE_API_TARGETS: { module: string; path: string; expectAuthWhenScoped?: boolean }[] = [
  { module: "Accounts", path: "/api/erp/accounts?limit=1" },
  { module: "Customers", path: "/api/erp/customers?limit=1" },
  { module: "Companies", path: "/api/erp/companies?limit=1" },
  { module: "Goods", path: "/api/erp/goods?limit=1" },
  { module: "Banks", path: "/api/erp/banks?limit=1" },
  { module: "Employees", path: "/api/erp/hr-payroll/employees?limit=1" },
  { module: "Warehouses", path: "/api/erp/master-data/warehouses?limit=1" },
  { module: "Locations · Countries", path: "/api/erp/locations/countries" },
  { module: "Locations · Summary", path: "/api/erp/locations/summary" },
  { module: "Purchase Orders", path: "/api/erp/purchase-orders?limit=1" },
  { module: "Sales Orders", path: "/api/erp/sales-orders?limit=1" },
  { module: "Roznamcha", path: "/api/erp/roznamcha?limit=1" },
  { module: "Ledger · Accounts", path: "/api/erp/accounting/accounts?limit=1" },
  { module: "Approvals", path: "/api/erp/approvals?limit=1" },
  { module: "User Tasks", path: "/api/erp/user-tasks?limit=1" },
  { module: "Customer Inquiries", path: "/api/erp/customer-inquiries?limit=1" },
  { module: "Consignment Register", path: "/api/erp/consignment?limit=1" },
  { module: "Bill Expenses", path: "/api/erp/bill-expenses?limit=1" },
  { module: "Documents", path: "/api/erp/documents?limit=1" },
  { module: "Reports · Business Summary", path: "/api/erp/reports/business-summary" },
  { module: "Reports · Activity Summary", path: "/api/erp/reports/activity-summary" },
  { module: "HR · Contract Reminders", path: "/api/erp/hr/contracts/reminders" },
  { module: "Shipping Lines", path: "/api/erp/shipping-lines?limit=1" },
  { module: "Trucks", path: "/api/erp/master-data/trucks?limit=1" },
];

export async function probeApis(baseUrl: string, cookie: string): Promise<HealthFinding[]> {
  const out: HealthFinding[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < SAFE_API_TARGETS.length; i += CONCURRENCY) {
    const batch = SAFE_API_TARGETS.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (tg) => ({ tg, r: await probe(baseUrl, tg.path, cookie, "GET") })));
    for (const { tg, r } of results) {
      let status: HealthStatus;
      if (r.status === 0) status = "failed";
      else if (r.status >= 200 && r.status < 300) status = "healthy";
      else if (r.status === 401 || r.status === 403) status = "unauthorized_expected";
      else if (r.status === 404) status = "not_found";
      else if (r.status >= 500) status = "server_error";
      else status = "warning";
      out.push(
        finding({
          category: "api",
          module: tg.module,
          target: tg.path,
          status,
          title: `${tg.module} read API`,
          expected: "HTTP 200 (or 401/403 if out of the caller's scope)",
          actual: r.status === 0 ? "no response (timeout / connection error)" : `HTTP ${r.status} (${r.ms}ms)`,
        }),
      );
    }
  }
  return out;
}

export async function probeRbac(baseUrl: string, cookie: string, session: ErpSession): Promise<HealthFinding[]> {
  const out: HealthFinding[] = [];
  // Scope-clamp check: a scoped user asking for a foreign countryId must be refused.
  // For a super admin there is no "foreign" country, so this specific probe is n/a.
  const foreignCountry = "00000000-0000-0000-0000-0000000000ff";
  const scopeTargets = [
    { module: "Accounts", path: `/api/erp/accounts?countryId=${foreignCountry}` },
    { module: "Customers", path: `/api/erp/customers?countryId=${foreignCountry}&limit=1` },
    { module: "Ledger General Report", path: `/api/erp/accounting/reports/ledger?countryId=${foreignCountry}` },
  ];
  if (session.isSuperAdmin) {
    out.push(
      finding({
        category: "permission",
        module: "RBAC",
        target: "scope-clamp (foreign countryId)",
        status: "not_tested",
        title: "Cross-scope denial not probed for a Super Admin",
        expected: "a scoped (country/branch) user is refused a foreign countryId",
        actual: "current session is Super Admin — every country is in scope; run this scan as a country/branch user (or on DEV with a scoped dev-session)",
      }),
    );
  } else {
    for (const tg of scopeTargets) {
      const r = await probe(baseUrl, tg.path, cookie, "GET");
      const denied = r.status === 401 || r.status === 403;
      out.push(
        finding({
          category: "permission",
          module: tg.module,
          target: tg.path,
          status: denied ? "unauthorized_expected" : r.status >= 200 && r.status < 300 ? "failed" : "warning",
          title: denied ? `${tg.module}: foreign country correctly refused` : `${tg.module}: foreign country NOT refused`,
          expected: "HTTP 401/403 for a countryId outside the caller's scope",
          actual: `HTTP ${r.status}`,
          permission: `session roles: ${session.roles.join(", ")} · countries: ${session.countryIds?.length ?? 0}`,
        }),
      );
    }
  }
  return out;
}
