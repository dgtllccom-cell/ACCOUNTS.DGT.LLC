"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  HeartPulse,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type HealthStatus = "healthy" | "warning" | "error" | "unknown";

type Metric = { key: string; label: string; value: string; status: HealthStatus; hint?: string; group: string };
type MonitorStatus = {
  generatedAt: string;
  overall: HealthStatus;
  metrics: Metric[];
  pm2Processes: Array<{ name: string; status: string; cpu: number; memory: string; restarts: number; uptime: string }>;
  raw: Record<string, any>;
};
type MonitorEvent = {
  id: string;
  eventType: string;
  severity: HealthStatus | "info";
  title: string;
  details: unknown;
  branch: string | null;
  commitId: string | null;
  userName: string | null;
  createdAt: string;
};

const REFRESH_MS = 30000;

function statusClasses(s: HealthStatus | "info") {
  switch (s) {
    case "healthy":
      return { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-500/30", chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900" };
    case "warning":
      return { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-500/30", chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900" };
    case "error":
      return { dot: "bg-red-500", text: "text-red-700 dark:text-red-400", ring: "ring-red-500/30", chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900" };
    default:
      return { dot: "bg-slate-400", text: "text-slate-600 dark:text-slate-400", ring: "ring-slate-400/30", chip: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800" };
  }
}

function StatusDot({ status, pulse = false }: { status: HealthStatus | "info"; pulse?: boolean }) {
  const c = statusClasses(status);
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {pulse && status !== "unknown" ? <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", c.dot)} /> : null}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", c.dot)} />
    </span>
  );
}

function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ServerMonitoringDashboard({
  isSuperAdmin,
  githubUrl,
  githubActionsUrl,
  supabaseUrl
}: {
  isSuperAdmin: boolean;
  githubUrl: string;
  githubActionsUrl: string;
  supabaseUrl: string;
}) {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [history, setHistory] = useState<MonitorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [s, h] = await Promise.all([
        apiGet<MonitorStatus>("/api/erp/monitoring/status"),
        apiGet<MonitorEvent[]>("/api/erp/monitoring/history?limit=50")
      ]);
      setStatus(s);
      setHistory(Array.isArray(h) ? h : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const runAction = useCallback(
    async (action: string, opts?: { confirm?: string }) => {
      if (opts?.confirm && typeof window !== "undefined" && !window.confirm(opts.confirm)) return;
      setBusy(action);
      setNotice(null);
      try {
        await apiPost(`/api/erp/monitoring/actions`, { action });
        setNotice({ kind: "ok", text: `Action "${action}" completed.` });
        await load(false);
      } catch (e: any) {
        setNotice({ kind: "err", text: e?.message || `Action "${action}" failed.` });
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Metric[]>();
    for (const m of status?.metrics || []) {
      const arr = map.get(m.group) || [];
      arr.push(m);
      map.set(m.group, arr);
    }
    return Array.from(map.entries());
  }, [status]);

  const overall = status?.overall || "unknown";
  const overallC = statusClasses(overall);
  const counts = useMemo(() => {
    const c = { healthy: 0, warning: 0, error: 0 };
    for (const m of status?.metrics || []) {
      if (m.status === "healthy") c.healthy++;
      else if (m.status === "warning") c.warning++;
      else if (m.status === "error") c.error++;
    }
    return c;
  }, [status]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl ring-4", overallC.ring, overallC.chip)}>
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              Server &amp; Project Monitoring
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot status={overall} pulse /> <span className={cn("font-bold uppercase tracking-wide", overallC.text)}>{overall}</span>
              </span>
              <span className="text-slate-300">·</span>
              <span>Updated {status ? fmtTime(status.generatedAt) : "—"}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">🟢 {counts.healthy}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">🟡 {counts.warning}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">🔴 {counts.error}</span>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {notice ? (
        <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", notice.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300")}>
          {notice.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {notice.text}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      ) : null}

      {/* Quick actions */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Play className="h-4 w-4" /> Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="destructive" size="sm" disabled={!isSuperAdmin || busy !== null} onClick={() => runAction("restart-app", { confirm: "Restart the application (PM2 process)? Active users may briefly disconnect." })}>
            {busy === "restart-app" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restart Application
          </Button>
          <Button variant="destructive" size="sm" disabled={!isSuperAdmin || busy !== null} onClick={() => runAction("restart-pm2", { confirm: "Restart ALL PM2 processes on the server? This affects every app managed by PM2." })}>
            {busy === "restart-pm2" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />} Restart PM2
          </Button>
          <Button variant="secondary" size="sm" disabled={!isSuperAdmin || busy !== null} onClick={() => runAction("health-check")}>
            {busy === "health-check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />} Run Health Check
          </Button>
          <Button variant="outline" size="sm" onClick={() => logsRef.current?.scrollIntoView({ behavior: "smooth" })}>
            <FileText className="h-4 w-4" /> View Logs
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={githubUrl} target="_blank" rel="noreferrer"><Github className="h-4 w-4" /> Open GitHub</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={supabaseUrl} target="_blank" rel="noreferrer"><Database className="h-4 w-4" /> Open Supabase</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={githubActionsUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Check Deployment</a>
          </Button>
        </CardContent>
      </Card>

      {!isSuperAdmin ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" /> Restart and health-check actions are restricted to super admins.
        </div>
      ) : null}

      {/* Metric groups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map(([group, metrics]) => (
          <Card key={group} className="overflow-hidden border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                {group.includes("Source") ? <GitBranch className="h-3.5 w-3.5" /> : group.includes("Server") ? <Server className="h-3.5 w-3.5" /> : group.includes("Database") ? <Database className="h-3.5 w-3.5" /> : group.includes("Network") ? <ShieldAlert className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                {group}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {metrics.map((m) => {
                    const c = statusClasses(m.status);
                    return (
                      <tr key={m.key} className="border-b border-slate-50 last:border-0 dark:border-slate-900">
                        <td className="w-1/2 px-4 py-2.5 align-middle">
                          <div className="flex items-center gap-2">
                            <StatusDot status={m.status} />
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{m.label}</span>
                          </div>
                          {m.hint ? <div className="ms-4.5 mt-0.5 truncate ps-0.5 text-[11px] text-slate-400" title={m.hint}>{m.hint}</div> : null}
                        </td>
                        <td className="px-4 py-2.5 text-right align-middle">
                          <span className={cn("inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-md border px-2 py-0.5 text-xs font-bold", c.chip)} title={m.value}>
                            {m.value}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PM2 processes */}
      {status?.pm2Processes && status.pm2Processes.length > 0 ? (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 py-2.5 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Server className="h-3.5 w-3.5" /> PM2 Processes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
                  <th className="px-4 py-2 text-left font-bold">Name</th>
                  <th className="px-4 py-2 text-left font-bold">Status</th>
                  <th className="px-4 py-2 text-right font-bold">CPU</th>
                  <th className="px-4 py-2 text-right font-bold">Memory</th>
                  <th className="px-4 py-2 text-right font-bold">Restarts</th>
                  <th className="px-4 py-2 text-right font-bold">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {status.pm2Processes.map((p, i) => (
                  <tr key={`${p.name}-${i}`} className="border-b border-slate-50 last:border-0 dark:border-slate-900">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5"><StatusDot status={p.status === "online" ? "healthy" : "error"} /> {p.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.cpu}%</td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.memory}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.restarts}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {/* Event history */}
      <div ref={logsRef}>
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 py-2.5 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><FileText className="h-3.5 w-3.5" /> Event History &amp; Logs</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-900/40">
                  <th className="px-4 py-2 text-left font-bold">Status</th>
                  <th className="px-4 py-2 text-left font-bold">Date &amp; Time</th>
                  <th className="px-4 py-2 text-left font-bold">Event</th>
                  <th className="px-4 py-2 text-left font-bold">User</th>
                  <th className="px-4 py-2 text-left font-bold">Branch</th>
                  <th className="px-4 py-2 text-left font-bold">Details</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No events recorded yet. Deployments, restarts and health checks will appear here.</td>
                  </tr>
                ) : (
                  history.map((ev) => (
                    <tr key={ev.id} className="border-b border-slate-50 last:border-0 dark:border-slate-900">
                      <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5"><StatusDot status={ev.severity} /> <span className="text-[11px] font-bold uppercase text-slate-500">{ev.eventType}</span></span></td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">{fmtTime(ev.createdAt)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{ev.title}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 dark:text-slate-300">{ev.userName || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-500">{ev.branch || "—"}{ev.commitId ? ` @${ev.commitId}` : ""}</td>
                      <td className="max-w-[280px] truncate px-4 py-2.5 text-xs text-slate-400" title={typeof ev.details === "string" ? ev.details : JSON.stringify(ev.details)}>
                        {ev.details ? (typeof ev.details === "string" ? ev.details : JSON.stringify(ev.details)) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <p className="pb-6 text-center text-[11px] text-slate-400">Auto-refreshes every {REFRESH_MS / 1000}s · All data collected live from the server, database, GitHub and your domain.</p>
    </div>
  );
}
