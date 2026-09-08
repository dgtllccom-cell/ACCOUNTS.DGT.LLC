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

  // duplicate hrefs (two menu items → same page).
  // A section parent that shares its route with its own first child (the "click the
  // section header to open its landing view" pattern) is intentional — only flag
  // duplicates that sit in unrelated parts of the menu.
  const navByKey = new Map(nav.map((e) => [e.key, e]));
  const isAncestor = (ancestorKey: string, node: NavEntry): boolean => {
    let p = node.parentKey;
    while (p) {
      if (p === ancestorKey) return true;
      p = navByKey.get(p)?.parentKey ?? null;
    }
    return false;
  };
  const hrefSeen = new Map<string, string[]>();
  for (const e of nav) {
    if (!e.href) continue;
    hrefSeen.set(e.href, [...(hrefSeen.get(e.href) ?? []), e.key]);
  }
  for (const [href, keys] of hrefSeen) {
    if (keys.length < 2) continue;
    const entries = keys.map((k) => navByKey.get(k)!).filter(Boolean);
    // every entry is on a single ancestor chain → intentional landing pattern
    const onOneChain = entries.every(
      (a) => a === entries[0] || isAncestor(a.key, entries[0]) || isAncestor(entries[0].key, a) || entries.some((b) => b !== a && (isAncestor(a.key, b) || isAncestor(b.key, a))),
    );
    if (onOneChain) {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: href,
          status: "healthy",
          title: `Section header shares its route with a child (intentional landing pattern)`,
          expected: "a parent menu node may open the same view as its default child",
          actual: `${keys.join(", ")} → ${href}`,
          link: href,
        }),
      );
    } else {
      out.push(
        finding({
          category: "navigation",
          module: "Sidebar",
          target: href,
          status: "warning",
          title: `Two unrelated menu items point to the same route`,
          expected: "One menu item per route (or a parent/child landing pair)",
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

  // child route in a different top-level section than its parent (loose structural
  // check). Compare on the "/dashboard/<section>" prefix, not the parent's full href —
  // a section parent often deep-links to one of its own pages while its children sit
  // elsewhere under the same section, which is fine.
  const byKey = new Map(nav.map((e) => [e.key, e]));
  const section = (href: string) => href.split("?")[0].split("/").slice(0, 3).join("/"); // /dashboard/<x>
  for (const e of nav) {
    if (!e.href || !e.parentKey) continue;
    const parent = byKey.get(e.parentKey);
    if (parent?.href && parent.href !== "/dashboard" && section(e.href) !== section(parent.href)) {
      // informational: a curated menu legitimately groups cross-section shortcuts
      // under a heading. Only a real concern if the target is also unreachable —
      // the live page probe reports that separately.
      out.push(
        finding({
          category: "navigation",
          module: parent.label,
          target: e.href,
          status: "healthy",
          title: `Menu item grouped under a parent from another URL section (cross-link)`,
          expected: `informational — target still resolves; grouped under "${parent.label}"`,
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

  // Keys whose value is a brand name or a standard code/acronym — correctly identical
  // in every language (CLAUDE.md: translate chrome, not names/codes).
  const INVARIANT_KEYS = new Set<string>([
    "cbr.pdf_brand", // "Digital Dock ERP" — product name
    "pdfui.eip2_ifsc_colon", // "IFSC:" — standard bank-code label
  ]);

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
    if (sameCount === 4 && enVal.length > 3 && /[a-z]{2,}/i.test(enVal) && !/^[A-Z0-9_ /-]+$/.test(enVal) && !INVARIANT_KEYS.has(k)) {
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

/* ── 3. print / PDF builder health ────────────────────────────────────────── */
// Runs client-side only (see lib/health/print-check.ts) — the report engine
// pulls in a client-only print store, so it cannot be imported into a route.
// The API leaves the "print_pdf" category empty; the Health Center UI fills it.

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

async function probe(baseUrl: string, path: string, cookie: string, method: "GET" | "HEAD" = "GET", timeoutMs = 12000): Promise<{ status: number; location: string | null; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { cookie, "x-erp-health-scan": "1" },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
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
const SAFE_API_TARGETS: { module: string; path: string; expectAuthWhenScoped?: boolean; needsParams?: boolean }[] = [
  { module: "Accounts", path: "/api/erp/accounts?limit=1" },
  { module: "Customers", path: "/api/erp/customers?limit=1" },
  { module: "Companies", path: "/api/erp/companies?limit=1" },
  { module: "Goods", path: "/api/erp/goods?limit=1" },
  { module: "Banks", path: "/api/erp/banks?limit=1" },
  { module: "Employees", path: "/api/erp/hr-payroll/employees?limit=1" },
  { module: "Warehouses", path: "/api/erp/master-data/warehouses?limit=1" },
  { module: "Locations · Countries", path: "/api/erp/locations/countries" },
  { module: "Locations · Summary", path: "/api/erp/locations/summary" },
  { module: "Purchase Orders", path: "/api/erp/purchases/orders?limit=1" },
  { module: "Sales Orders", path: "/api/erp/sales/orders?limit=1" },
  { module: "Roznamcha", path: "/api/erp/roznamcha?limit=1" },
  { module: "Ledger · Accounts", path: "/api/erp/accounting/accounts?limit=1" },
  { module: "Approvals", path: "/api/erp/approvals?limit=1" },
  { module: "User Tasks", path: "/api/erp/user-tasks?limit=1" },
  { module: "Customer Inquiries", path: "/api/erp/customer-inquiries?limit=1" },
  { module: "Consignment Register", path: "/api/erp/consignment?limit=1" },
  { module: "Bill Expenses", path: "/api/erp/bill-expenses?limit=1" },
  { module: "Documents", path: "/api/erp/documents?limit=1", needsParams: true },
  { module: "Reports · Business Summary", path: "/api/erp/reports/business-summary" },
  { module: "Reports · Activity Summary", path: "/api/erp/reports/activity-summary" },
  { module: "HR · Contracts", path: "/api/erp/hr/contracts?limit=1" },
  { module: "Shipping Lines", path: "/api/erp/shipping-lines?limit=1" },
  { module: "Trucks", path: "/api/erp/master-data/trucks?limit=1" },
];

export async function probeApis(baseUrl: string, cookie: string): Promise<HealthFinding[]> {
  const out: HealthFinding[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < SAFE_API_TARGETS.length; i += CONCURRENCY) {
    const batch = SAFE_API_TARGETS.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (tg) => {
        let r = await probe(baseUrl, tg.path, cookie, "GET", 20000);
        // one retry, serially, for a timeout / connection drop before calling it broken
        if (r.status === 0) r = await probe(baseUrl, tg.path, cookie, "GET", 25000);
        return { tg, r };
      }),
    );
    for (const { tg, r } of results) {
      let status: HealthStatus;
      let expected = "HTTP 200 (or 401/403 if out of the caller's scope)";
      if (r.status === 0) status = "failed";
      else if (r.status >= 200 && r.status < 300) status = r.ms > 8000 ? "warning" : "healthy";
      else if (r.status === 401 || r.status === 403) status = "unauthorized_expected";
      else if ((r.status === 400 || r.status === 422) && tg.needsParams) {
        // route exists, auth passed, input validation is enforced — that is healthy
        status = "healthy";
        expected = "HTTP 200, or 400/422 when required query params are omitted (validation active)";
      } else if (r.status === 404) status = "not_found";
      else if (r.status >= 500) status = "server_error";
      else status = "warning";
      const slowNote = status === "warning" && r.status >= 200 && r.status < 300 ? " — SLOW response, over 8s" : "";
      out.push(
        finding({
          category: "api",
          module: tg.module,
          target: tg.path,
          status,
          title: `${tg.module} read API${slowNote}`,
          expected,
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
