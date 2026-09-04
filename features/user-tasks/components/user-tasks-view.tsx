"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquare, RefreshCw, Printer, Plus, Eye, Search, AlertTriangle, Clock,
  ListChecks, ShieldCheck, Bell, FileText, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { openScopedGenericReport, type GenericReportColumn } from "@/lib/reports/open-scoped-report";
import {
  STATUS_ORDER, fmtDate, fmtDateTime, priorityTone, statusTone,
  type TaskListItem, type TaskStatus,
} from "../lib/shared";
import { TaskDetailModal } from "./task-detail-modal";
import { AssignTaskForm } from "./assign-task-form";

type Scope = "my" | "team" | "overdue" | "completed";

export function UserTasksView({ scope, lang: langProp, autoAssign = false }: { scope: Scope; lang?: string; autoAssign?: boolean }) {
  const s = useErpScreen("utask", langProp);
  const erpScope = useErpScope();

  const [rows, setRows] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(autoAssign);
  const [summary, setSummary] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalNode(document.getElementById("erp-page-actions-slot")); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope });
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (priorityFilter !== "all") qs.set("priority", priorityFilter);
      if (search.trim()) qs.set("q", search.trim());
      const [lr, sr] = await Promise.all([
        fetch(`/api/erp/user-tasks?${qs.toString()}`, { credentials: "include" }),
        fetch(`/api/erp/user-tasks/summary`, { credentials: "include" }),
      ]);
      const lj = await lr.json();
      const sj = await sr.json();
      if (lj.ok) { setRows(lj.data.rows || []); setCanManage(Boolean(lj.data.canManage)); }
      if (sj.ok) setSummary(sj.data);
    } catch {
      /* keep last */
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter, priorityFilter, search]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, statusFilter, priorityFilter]);

  const titleKey =
    scope === "team" ? "team_tasks" : scope === "overdue" ? "overdue" : scope === "completed" ? "completed" : "my_tasks";
  const titleFallback =
    scope === "team" ? "Team Tasks" : scope === "overdue" ? "Overdue Tasks" : scope === "completed" ? "Completed / Verified" : "My Tasks";

  const tiles = useMemo(() => {
    const total = rows.length;
    const overdue = rows.filter((r) => r.is_overdue).length;
    const inprog = rows.filter((r) => r.status === "in_progress").length;
    const done = rows.filter((r) => r.status === "completed" || r.status === "verified").length;
    return [
      { key: "k_assigned", fallback: "Assigned", value: total, icon: ListChecks, accent: "border-t-indigo-500", tone: "text-indigo-600" },
      { key: "k_in_progress", fallback: "In Progress", value: inprog, icon: Clock, accent: "border-t-sky-500", tone: "text-sky-600" },
      { key: "k_overdue", fallback: "Overdue", value: overdue, icon: AlertTriangle, accent: "border-t-rose-500", tone: "text-rose-600" },
      { key: "k_completed", fallback: "Completed", value: done, icon: CheckSquare, accent: "border-t-emerald-500", tone: "text-emerald-600" },
      {
        key: "k_awaiting_verify", fallback: "Awaiting Your Verification",
        value: summary?.awaitingMyVerification ?? 0, icon: ShieldCheck, accent: "border-t-amber-500", tone: "text-amber-600",
      },
    ];
  }, [rows, summary]);

  function printRegister() {
    const columns: GenericReportColumn[] = [
      { key: (r: any) => r.task_no || r.id?.slice(0, 8), label: s.t("col_task_no", "Task No") },
      { key: (r: any) => r.title, label: s.t("col_task", "Task") },
      { key: (r: any) => r.assignee_name || "", label: s.t("col_assignee", "Assignee") },
      { key: (r: any) => s.t(`pr_${r.priority}`, r.priority), label: s.t("col_priority", "Priority"), align: "center" },
      { key: (r: any) => fmtDate(r.due_at), label: s.t("col_due", "Due"), align: "center" },
      { key: (r: any) => s.t(`st_${r.status}`, r.status), label: s.t("col_status", "Status"), align: "center" },
      { key: (r: any) => r.country_name || "", label: s.t("col_country", "Country") },
      { key: (r: any) => r.city_branch_name || r.country_branch_name || "", label: s.t("col_branch", "Branch") },
    ];
    void openScopedGenericReport({
      title: s.t(titleKey, titleFallback),
      subtitle: s.t("subtitle", "User Tasks"),
      lang: s.lang,
      columns,
      rows: rows as unknown as Record<string, unknown>[],
      orientation: "landscape",
      countryId: erpScope.lockedCountryId,
      countryBranchId: erpScope.lockedCountryBranchId,
      cityBranchId: erpScope.lockedCityBranchId,
      countryName: erpScope.countryName,
      branchName: erpScope.branchDisplayName,
      printedBy: erpScope.userName,
      filters: [
        { label: s.t("col_status", "Status"), value: statusFilter === "all" ? s.t("filter_all", "All") : s.t(`st_${statusFilter}`, statusFilter) },
        ...(search ? [{ label: "Search", value: search }] : []),
        { label: "Records", value: String(rows.length) },
      ],
      summary: {
        [s.t("k_assigned", "Assigned")]: String(rows.length),
        [s.t("k_overdue", "Overdue")]: String(rows.filter((r) => r.is_overdue).length),
        [s.t("k_completed", "Completed")]: String(rows.filter((r) => r.status === "completed" || r.status === "verified").length),
      },
    });
  }

  async function markAllRead() {
    await fetch(`/api/erp/user-tasks/notifications`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: "{}" });
    await load();
  }

  const showAssignBtn = canManage && (scope === "team" || scope === "my");

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-50 p-4 text-sm font-sans md:p-6 dark:bg-slate-950">
      <div className="print:hidden space-y-4">
        {portalNode && createPortal(
          <div className="flex items-center gap-2">
            <span className="me-1 hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
              <CheckSquare className="h-3.5 w-3.5" /> {s.t(titleKey, titleFallback)}
            </span>
            <button
              onClick={() => setShowNotif(true)}
              className="relative inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Bell className="h-3.5 w-3.5" />
              {(summary?.unread ?? 0) > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {summary.unread > 99 ? "99+" : summary.unread}
                </span>
              )}
            </button>
            <Button size="sm" variant="outline" onClick={load} className="h-7">
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.t("refresh", "Refresh")}</span>
            </Button>
            <Button size="sm" onClick={printRegister} className="h-7 bg-blue-600 text-white hover:bg-blue-700">
              <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.t("print_report", "Print Report")}</span>
            </Button>
            {showAssignBtn && (
              <Button size="sm" onClick={() => setShowAssign(true)} className="h-7 bg-indigo-600 text-white hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{s.t("assign_task", "Assign Task")}</span>
              </Button>
            )}
          </div>,
          portalNode
        )}

        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.t(titleKey, titleFallback)}</h1>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Assign work, track progress, and verify completion across your team.")}</p>
        </div>

        {/* summary tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Card key={tile.key} className={`border-t-4 ${tile.accent} shadow-sm`}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.t(tile.key, tile.fallback)}</div>
                    <div className={`text-xl font-bold ${tile.tone}`}>{tile.value}</div>
                  </div>
                  <Icon className={`h-5 w-5 opacity-30 ${tile.tone}`} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* filter bar */}
        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <div className="flex items-center gap-1.5">
              {(["all", "open", ...STATUS_ORDER] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st as any)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    statusFilter === st ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st === "all" ? s.t("filter_all", "All") : st === "open" ? s.t("filter_open", "Open / Active") : s.t(`st_${st}`, st)}
                </button>
              ))}
            </div>
            <div className="relative ms-auto">
              <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder={s.t("search_ph", "Search title, task no, reference…")}
                className="w-56 rounded-md border border-slate-300 py-1 ps-7 pe-2 text-xs"
              />
            </div>
            {(statusFilter !== "all" || priorityFilter !== "all" || search) && (
              <button onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setSearch(""); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700">
                <X className="h-3 w-3" /> {s.t("clear_filters", "Clear Filters")}
              </button>
            )}
          </CardContent>
        </Card>

        {/* register */}
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold text-start">{s.t("col_task", "Task")}</th>
                  <th className="px-3 py-2 font-semibold text-start">{s.t("col_assignee", "Assignee")}</th>
                  <th className="px-3 py-2 font-semibold text-center">{s.t("col_priority", "Priority")}</th>
                  <th className="px-3 py-2 font-semibold text-center">{s.t("col_due", "Due")}</th>
                  <th className="px-3 py-2 font-semibold text-center">{s.t("col_status", "Status")}</th>
                  <th className="px-3 py-2 font-semibold text-start">{s.t("col_module", "Module")}</th>
                  <th className="px-3 py-2 font-semibold text-start">{s.t("col_branch", "Branch")}</th>
                  <th className="px-3 py-2 font-semibold text-center">{s.t("col_actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-400">…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                      <p className="text-xs">
                        {statusFilter !== "all" || search
                          ? s.t("empty_filtered", "No tasks match the selected filters.")
                          : scope === "my" ? s.t("empty_my", "You have no assigned tasks right now.") : s.t("empty", "No tasks yet.")}
                      </p>
                    </td>
                  </tr>
                )}
                {!loading && rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${r.unread_count > 0 ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {r.unread_count > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                        <span className="font-medium text-slate-800">{r.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{r.task_no}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.assignee_name || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityTone(r.priority)}`}>
                        {s.t(`pr_${r.priority}`, r.priority)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-center text-xs ${r.is_overdue ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                      {fmtDate(r.due_at)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(r.status)}`}>
                        {s.t(`st_${r.status}`, r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {r.related_module ? s.t(`mod_${r.related_module}`, r.related_module.replace(/_/g, " ")) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.city_branch_name || r.country_branch_name || r.country_name || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {openId && (
        <TaskDetailModal
          taskId={openId}
          s={s}
          onClose={() => { setOpenId(null); load(); }}
          onChanged={load}
        />
      )}
      {showAssign && (
        <AssignTaskForm
          s={s}
          onClose={() => setShowAssign(false)}
          onCreated={() => { setShowAssign(false); load(); }}
        />
      )}
      {showNotif && (
        <NotificationsPanel s={s} summary={summary} onClose={() => setShowNotif(false)} onMarkAll={markAllRead} onOpenTask={(id) => { setShowNotif(false); setOpenId(id); }} />
      )}
    </div>
  );
}

function NotificationsPanel({
  s, summary, onClose, onMarkAll, onOpenTask,
}: {
  s: ReturnType<typeof useErpScreen>;
  summary: any;
  onClose: () => void;
  onMarkAll: () => void;
  onOpenTask: (id: string) => void;
}) {
  const items: any[] = summary?.notifications ?? [];
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/20" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-sm overflow-y-auto bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Bell className="h-4 w-4" /> {s.t("notif_title", "Task Notifications")}</h2>
          <button onClick={onClose} aria-label={s.tGlobal("common.close", "Close")} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <button onClick={onMarkAll} className="mb-2 text-[11px] font-semibold text-indigo-600 hover:underline">{s.t("mark_all_read", "Mark all read")}</button>
        <ul className="divide-y divide-slate-100">
          {items.length === 0 && <li className="py-6 text-center text-xs text-slate-400">{s.t("empty", "No tasks yet.")}</li>}
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => onOpenTask(n.task_id)} className={`block w-full px-1 py-2 text-start ${n.is_read ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-1.5">
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                  <span className="text-xs font-semibold text-slate-700">{s.t(`ev_${n.kind}`, n.kind)}</span>
                  <span className="ms-auto text-[10px] text-slate-400">{fmtDateTime(n.created_at)}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{n.title} · {n.task_no}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
