"use client";

import type { ReactNode } from "react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { roleLabel, type BranchUserContext } from "@/lib/hooks/use-branch-user-context";
import { cn } from "@/lib/utils";

/**
 * Universal ERP "Branch & User Summary" header.
 *
 * ONE reusable, role-scoped summary shown at the top of important ERP pages (replaces the
 * per-page copy-pasted `DashboardSummaryHeader` blocks). It renders three fixed sections plus an
 * org breakdown:
 *   1. Branch & User Details   — from the session (`useBranchUserContext`), server-RBAC-scoped.
 *   2. Page Summary            — page-specific metrics the caller passes (Purchase/Sales/…).
 *   3. Entries Summary         — optional total/cleared/remaining style counts.
 *   4. Organizational Report   — country/branch/agent breakdown of what THIS user may see.
 *
 * The component is presentational: metrics + breakdown come from each page (computed from its own
 * session-scoped data). Branch Name + User Name are always shown. Fully 5-language (EN/UR/PS/FA/AR)
 * and RTL-aware.
 */

const RTL_LANGS = new Set(["ur", "ar", "fa", "ps"]);

export type MetricTone = "default" | "positive" | "negative" | "muted";
export type SummaryMetric = { label: string; value: string | number; tone?: MetricTone };
export type OrgBreakdownNode = {
  level: "country" | "mainBranch" | "cityBranch" | "agent";
  name: string;
  code?: string | null;
  currency?: string | null;
  branchCount?: number;
  metrics: SummaryMetric[];
};

function toneClass(tone?: MetricTone) {
  switch (tone) {
    case "positive": return "text-emerald-600 dark:text-emerald-400";
    case "negative": return "text-rose-600 dark:text-rose-400";
    case "muted": return "text-slate-400 dark:text-slate-500";
    default: return "text-slate-900 dark:text-slate-100";
  }
}

export function BranchUserSummary({
  moduleTitle,
  context,
  loading = false,
  metrics = [],
  entries = [],
  breakdown = [],
  generatedAt,
  className
}: {
  /** e.g. "Purchase Order", "Sales", "Roznamcha" — the page/module this summary is for. */
  moduleTitle: string;
  context: BranchUserContext | null;
  loading?: boolean;
  /** Page-specific financial/summary metrics (Purchase Total, Transferred, Remaining, …). */
  metrics?: SummaryMetric[];
  /** Optional entries/counts summary (Total Entries, Cleared, Remaining, …). */
  entries?: SummaryMetric[];
  /** Country/branch/agent breakdown of what this user is authorized to see. */
  breakdown?: OrgBreakdownNode[];
  generatedAt?: string | null;
  className?: string;
}) {
  const lang = useActiveLanguage();
  const isRtl = RTL_LANGS.has(lang);
  const tr = (s: string) => translateHeader(lang, s);

  const details: Array<{ label: string; value: string }> = context
    ? [
        ...(context.companyName ? [{ label: "Company", value: context.companyName }] : []),
        { label: "Country", value: context.country || (context.isSuperAdmin ? tr("All Countries") : "-") },
        { label: "Branch Name", value: context.branchName || (context.isSuperAdmin ? tr("All Branches") : "-") },
        { label: "User ID", value: context.userId || "-" },
        { label: "User Name", value: context.userName || "-" },
        { label: "Role", value: tr(roleLabel(context.role)) },
        { label: "Scope", value: context.scopeLabel || tr(context.isSuperAdmin ? "Global" : "-") },
        { label: "Date & Time", value: generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString() },
        { label: "Status", value: tr(context.status || "Active") }
      ]
    : [];

  const levelLabel: Record<OrgBreakdownNode["level"], string> = {
    country: "Country",
    mainBranch: "Main Branch",
    cityBranch: "City / Local Branch",
    agent: "Agent"
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950",
        className
      )}
      aria-label={tr("Branch & User Summary")}
    >
      {/* Context strip: MANDATORY Branch + User, always visible. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500 dark:border-slate-800">
        <span>{tr("Branch Name")}: <b className="text-slate-900 dark:text-slate-100">{loading ? "…" : (context?.branchName || (context?.isSuperAdmin ? tr("All Branches") : "-"))}</b></span>
        <span>{tr("User Name")}: <b className="text-slate-900 dark:text-slate-100">{loading ? "…" : (context?.userName || "-")}</b></span>
        <span>{tr("Role")}: <b className="text-slate-900 dark:text-slate-100">{loading ? "…" : tr(roleLabel(context?.role))}</b></span>
        <span className="ms-auto text-[11px] font-bold uppercase tracking-wider text-primary">{tr(moduleTitle)}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* 1 — Branch & User Details */}
        <SummaryCard n={1} title={tr("Branch & User Details")} accent="blue">
          <dl className="space-y-1.5">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-[110px_1fr] gap-2 text-[11px]">
                <dt className="font-semibold uppercase text-slate-400">{tr(d.label)}</dt>
                <dd className="truncate font-semibold text-slate-800 dark:text-slate-200" title={d.value}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </SummaryCard>

        {/* 2 — Page Summary (page-specific metrics) */}
        <SummaryCard n={2} title={tr("Financial Summary")} accent="emerald">
          {metrics.length ? (
            <dl className="space-y-2">
              {metrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                  <dt className="font-semibold uppercase text-slate-400">{tr(m.label)}</dt>
                  <dd className={cn("font-bold tabular-nums", toneClass(m.tone))}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">{tr("No data")}</p>
          )}
        </SummaryCard>

        {/* 3 — Entries Summary */}
        <SummaryCard n={3} title={tr("Entries Summary")} accent="violet">
          {entries.length ? (
            <dl className="space-y-2">
              {entries.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                  <dt className="font-semibold uppercase text-slate-400">{tr(m.label)}</dt>
                  <dd className={cn("font-bold tabular-nums", toneClass(m.tone))}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">{tr("No data")}</p>
          )}
        </SummaryCard>

        {/* 4 — Organizational Report (scoped breakdown) */}
        <SummaryCard n={4} title={tr("Organizational Report")} accent="amber">
          {breakdown.length ? (
            <ul className="space-y-1.5">
              {breakdown.map((node, i) => (
                <li key={`${node.level}-${node.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1 text-[11px] dark:border-slate-800">
                  <span className="truncate font-semibold text-slate-800 dark:text-slate-200" title={node.name}>{node.name}</span>
                  <span className="shrink-0 text-slate-400">{node.branchCount != null ? `${node.branchCount} ${tr("Branches")}` : tr(levelLabel[node.level])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{tr("No data")}</p>
          )}
        </SummaryCard>
      </div>

      {/* Breakdown detail — per authorized country/branch/agent. */}
      {breakdown.some((n) => n.metrics.length) ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {breakdown.map((node, i) => (
            <div key={`detail-${node.level}-${node.name}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{node.name}</span>
                <span className="text-[10px] font-semibold text-slate-400">{node.currency || tr(levelLabel[node.level])}</span>
              </div>
              <dl className="space-y-1.5">
                {node.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-2 text-[11px]">
                    <dt className="font-semibold uppercase text-slate-400">{tr(m.label)}</dt>
                    <dd className={cn("font-bold tabular-nums", toneClass(m.tone))}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ n, title, accent, children }: { n: number; title: string; accent: "blue" | "emerald" | "violet" | "amber"; children: ReactNode }) {
  const accentMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", accentMap[accent])}>{n}</span>
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{title}</h4>
      </div>
      {children}
    </div>
  );
}
