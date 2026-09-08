"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import type { HealthReport, HealthFinding, HealthStatus, HealthCategory } from "@/lib/health/types";

const TABS: { key: HealthCategory | "overview"; label: string; fallback: string }[] = [
  { key: "overview", label: "tab_overview", fallback: "Overview" },
  { key: "page", label: "tab_pages", fallback: "Pages" },
  { key: "api", label: "tab_apis", fallback: "APIs" },
  { key: "navigation", label: "tab_navigation", fallback: "Navigation" },
  { key: "permission", label: "tab_permissions", fallback: "Permissions" },
  { key: "language", label: "tab_languages", fallback: "Languages" },
  { key: "print_pdf", label: "tab_print", fallback: "Print/PDF" },
  { key: "build_deploy", label: "tab_build", fallback: "Build/Deploy" },
];

const TONE: Record<HealthStatus, string> = {
  healthy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  redirected: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  unauthorized_expected: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  not_found: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  server_error: "bg-rose-600/20 text-rose-700 dark:text-rose-300",
  not_tested: "bg-slate-500/15 text-slate-500",
  unknown: "bg-slate-500/15 text-slate-500",
};

export function HealthCenterView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("health", langProp);
  const { lang, dir } = s;
  const st = (k: string, f: string) => s.t(k, f);

  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detail, setDetail] = useState<HealthFinding | null>(null);

  const run = useCallback(
    async (withLive: boolean) => {
      setLoading(true);
      setErr(null);
      try {
        const res = await apiGet<{ report: HealthReport }>(`/api/erp/health${withLive ? "?live=1" : ""}`);
        setReport(res.report);
        setLive(withLive);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const statusLabel = (x: HealthStatus) => st(`status_${x}`, x.replace(/_/g, " "));

  const shownFindings = useMemo(() => {
    if (!report) return [];
    let f = report.findings;
    if (tab !== "overview") f = f.filter((x) => x.category === tab);
    if (statusFilter) f = f.filter((x) => x.status === statusFilter);
    return f;
  }, [report, tab, statusFilter]);

  const catRow = (cat: HealthCategory) => report?.categories.find((c) => c.category === cat);

  return (
    <section dir={dir} className="mx-auto max-w-7xl px-4 py-4 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground">{st("title", "ERP Health & Integrity Center")}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{st("subtitle", "Pages • APIs • Permissions • Languages • Print/PDF • Production")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run(false)}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {st("rescan_static", "Re-scan (static)")}
          </button>
          <button
            type="button"
            onClick={() => run(true)}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading && live ? st("scanning", "Scanning…") : st("run_full_scan", "Run full live scan")}
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-sky-300/50 bg-sky-50 px-3 py-2 text-[11px] leading-snug text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
        {st("readonly_note", "All scans are read-only. They probe routes and read APIs with your own session — they never create or alter Ledger, Journal, Roznamcha, Purchase, Sales, Payment, Stock or any business record.")}
      </div>

      {err && (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>
      )}

      {loading && !report && <p className="py-10 text-center text-sm text-muted-foreground">{st("loading", "Loading…")}</p>}

      {report && (
        <>
          {/* overall band */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Big label={st("overall_health", "Overall Health")} value={`${report.overall.score}%`} tone={report.overall.label === "healthy" ? "good" : report.overall.label === "attention" ? "warn" : "bad"} />
            <Big label={st("healthy_pages", "Healthy Pages")} value={String(report.overall.healthyPages)} tone="good" />
            <Big label={st("warnings", "Warnings")} value={String(report.overall.warnings)} tone="warn" />
            <Big label={st("broken_pages", "Broken Pages")} value={String(report.overall.brokenPages)} tone="bad" />
            <Big label={st("failed_apis", "Failed APIs")} value={String(report.overall.failedApis)} tone="bad" />
            <Big label={st("permission_issues", "Permission Issues")} value={String(report.overall.permissionIssues)} tone="warn" />
            <Big label={st("translation_issues", "Translation Issues")} value={String(report.overall.languageIssues)} tone="warn" />
            <Big label={st("print_issues", "Print/PDF Issues")} value={String(report.overall.printPdfIssues)} tone="warn" />
          </div>

          {/* tabs */}
          <div className="flex flex-wrap gap-1 border-b border-border">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => { setTab(tb.key); setStatusFilter(""); }}
                className={`rounded-t-lg px-3 py-1.5 text-xs font-bold ${tab === tb.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {st(tb.label, tb.fallback)}
                {tb.key !== "overview" && catRow(tb.key as HealthCategory) ? (
                  <span className="ms-1 rounded bg-muted px-1 text-[10px]">{catRow(tb.key as HealthCategory)!.total}</span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <div className="space-y-4">
              {/* environment + build */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniCard title={st("environment", "Environment")}>
                  <KV k={st("app_env", "APP_ENV")} v={report.environment.appEnv} />
                  <KV k="Node" v={report.environment.nodeVersion} />
                  <KV k="Runtime" v={report.environment.nextRuntime} />
                </MiniCard>
                <MiniCard title={st("build_deploy", "Build / Deploy")}>
                  <KV k={st("main_sha", "Running SHA")} v={report.build.localShaShort || "—"} />
                  <KV k={st("origin_sha", "origin/main (cached)")} v={report.build.originMainSha ? report.build.originMainSha.slice(0, 8) : "—"} />
                  <KV k={st("dirty_files", "Uncommitted files")} v={report.build.workingTreeDirtyFiles == null ? "unknown" : String(report.build.workingTreeDirtyFiles)} />
                  <KV k="BUILD_ID" v={report.build.buildId || "—"} />
                </MiniCard>
                <MiniCard title={st("gates", "Gates")}>
                  <KV k={st("i18n_guard", "i18n guard")} v={statusLabel(report.gates.i18nGuard === "pass" ? "healthy" : report.gates.i18nGuard === "fail" ? "failed" : "not_tested")} />
                  <div className="text-[10px] text-muted-foreground">{report.gates.i18nGuardDetail}</div>
                  <KV k={st("typecheck", "TypeScript")} v={st("not_tested_short", "not run per-scan")} />
                </MiniCard>
                <MiniCard title={st("scan_scope", "Scan scope")}>
                  <KV k={st("role", "Role")} v={report.scope.isSuperAdmin ? "super_admin" : report.scope.role} />
                  <KV k={st("live_probes", "Live probes")} v={live ? st("on", "on") : st("off", "off — static only")} />
                  <KV k={st("generated", "Generated")} v={new Date(report.generatedAt).toLocaleString()} />
                </MiniCard>
              </div>

              {/* category rollup */}
              <MiniCard title={st("by_category", "By category")}>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className={s.textStart}>{st("category", "Category")}</th>
                      <th>{st("checked", "Checked")}</th>
                      <th className="text-emerald-600">{st("healthy", "Healthy")}</th>
                      <th className="text-amber-600">{st("warning", "Warning")}</th>
                      <th className="text-rose-600">{st("failed", "Failed")}</th>
                      <th className="text-slate-500">{st("not_tested", "Not Tested")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.categories.map((c) => (
                      <tr key={c.category} className="border-t border-border">
                        <td className={`py-1.5 font-semibold ${s.textStart}`}>{st(`cat_${c.category}`, c.category.replace(/_/g, " "))}</td>
                        <td className="text-center">{c.total}</td>
                        <td className="text-center">{c.healthy}</td>
                        <td className="text-center">{c.warning}</td>
                        <td className="text-center">{c.failed}</td>
                        <td className="text-center">{c.notTested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MiniCard>

              {report.notTested.length > 0 && (
                <MiniCard title={st("not_tested_title", "Not tested (and why)")}>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {report.notTested.map((n, i) => (
                      <li key={i}>• <b>{n.area}</b> — {n.reason}</li>
                    ))}
                  </ul>
                </MiniCard>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{st("filter_status", "Filter")}:</span>
                {["", "failed", "warning", "healthy", "unauthorized_expected", "not_tested"].map((sf) => (
                  <button
                    key={sf || "all"}
                    type="button"
                    onClick={() => setStatusFilter(sf)}
                    className={`rounded px-2 py-0.5 font-bold ${statusFilter === sf ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    {sf ? statusLabel(sf as HealthStatus) : st("all", "All")}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-muted/60 uppercase text-muted-foreground">
                    <tr>
                      <th className={`px-2.5 py-1.5 ${s.textStart}`}>{st("col_module", "Module")}</th>
                      <th className={`px-2.5 py-1.5 ${s.textStart}`}>{st("col_target", "Route / Target")}</th>
                      <th className={`px-2.5 py-1.5 ${s.textStart}`}>{st("col_issue", "Issue / Result")}</th>
                      <th className="px-2.5 py-1.5 text-center">{st("col_status", "Status")}</th>
                      <th className="px-2.5 py-1.5 text-center">{st("col_lang", "Lang")}</th>
                      <th className="px-2.5 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {shownFindings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2.5 py-6 text-center text-muted-foreground">{st("empty_findings", "No findings in this view.")}</td>
                      </tr>
                    )}
                    {shownFindings.map((f) => (
                      <tr key={f.id} className="border-t border-border hover:bg-muted/30">
                        <td className={`px-2.5 py-1.5 font-semibold ${s.textStart}`}>{f.module}</td>
                        <td className={`px-2.5 py-1.5 font-mono ${s.textStart}`}>{f.target}</td>
                        <td className={`px-2.5 py-1.5 ${s.textStart}`}>{f.title}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[f.status]}`}>{statusLabel(f.status)}</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          {f.language ? Object.entries(f.language).map(([l, v]) => (
                            <span key={l} className={`mx-0.5 text-[9px] font-bold ${v === "pass" ? "text-emerald-600" : v === "fail" ? "text-rose-600" : "text-slate-400"}`}>{l.toUpperCase()}</span>
                          )) : "—"}
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          <button type="button" onClick={() => setDetail(f)} className="text-primary hover:underline">{st("view", "View")}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <DetailDrawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.title || ""} subtitle={detail ? `${detail.module} · ${detail.target}` : ""}>
        {detail && (
          <div dir={dir} className="space-y-3 p-4 text-sm">
            <KV k={st("col_status", "Status")} v={statusLabel(detail.status)} />
            {detail.expected && <KV k={st("expected", "Expected")} v={detail.expected} />}
            {detail.actual && <KV k={st("actual", "Actual")} v={detail.actual} />}
            {detail.permission && <KV k={st("permission_result", "Permission")} v={detail.permission} />}
            {detail.printPdf && <KV k={st("print_result", "Print/PDF")} v={detail.printPdf} />}
            {detail.language && (
              <div>
                <div className="text-xs font-bold text-muted-foreground">{st("language_result", "Language result")}</div>
                <div className="mt-1 flex gap-2">
                  {Object.entries(detail.language).map(([l, v]) => (
                    <span key={l} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${v === "pass" ? "bg-emerald-500/15 text-emerald-600" : v === "fail" ? "bg-rose-500/15 text-rose-600" : "bg-slate-500/15 text-slate-500"}`}>{l.toUpperCase()} {v}</span>
                  ))}
                </div>
              </div>
            )}
            {detail.evidence && detail.evidence.length > 0 && (
              <div>
                <div className="text-xs font-bold text-muted-foreground">{st("evidence", "Evidence")}</div>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-[11px]">{detail.evidence.join("\n")}</pre>
              </div>
            )}
            <KV k={st("last_checked", "Last checked")} v={new Date(detail.checkedAt).toLocaleString()} />
            {detail.link && (
              <a href={detail.link} className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                {st("open_page", "Open the affected page")}
              </a>
            )}
          </div>
        )}
      </DetailDrawer>
    </section>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "border-s-emerald-500" : tone === "warn" ? "border-s-amber-500" : "border-s-rose-500";
  return (
    <div className={`rounded-lg border border-border bg-card px-3 py-2 border-s-4 ${c}`}>
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-black text-foreground">{value}</div>
    </div>
  );
}

function MiniCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-semibold text-foreground">{v}</span>
    </div>
  );
}
