"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardKind =
  | "super_admin"
  | "country"
  | "branch"
  | "agent"
  | "shipping_line"
  | "clearing_agent";

type WidgetKey =
  | "total_branches"
  | "total_users"
  | "total_accounts"
  | "total_ledgers"
  | "daily_payments"
  | "roznamcha_summary"
  | "pending_approvals"
  | "exchange_rates"
  | "sales_summary"
  | "purchase_summary"
  | "profit_loss"
  | "recent_transactions"
  | "audit_logs"
  | "notifications";

const widgetOptions: Array<{ key: WidgetKey; label: string }> = [
  { key: "total_branches", label: "Total Branches" },
  { key: "total_users", label: "Total Users" },
  { key: "total_accounts", label: "Total Accounts" },
  { key: "total_ledgers", label: "Total Ledgers" },
  { key: "daily_payments", label: "Daily Payments" },
  { key: "roznamcha_summary", label: "Roznamcha Summary" },
  { key: "pending_approvals", label: "Pending Approvals" },
  { key: "exchange_rates", label: "Exchange Rates" },
  { key: "sales_summary", label: "Sales Summary" },
  { key: "purchase_summary", label: "Purchase Summary" },
  { key: "profit_loss", label: "Profit/Loss" },
  { key: "recent_transactions", label: "Recent Transactions" },
  { key: "audit_logs", label: "Audit Logs" },
  { key: "notifications", label: "Notifications" }
];

function storageKey(kind: DashboardKind) {
  return `erp_dashboard_widgets_${kind}`;
}

export default function DashboardSettingsPage() {
  const [kind, setKind] = useState<DashboardKind>("super_admin");
  const [enabled, setEnabled] = useState<Set<WidgetKey>>(new Set());

  const kindOptions = useMemo(
    () =>
      [
        { key: "super_admin", label: "Super Admin Dashboard" },
        { key: "country", label: "Country Dashboard" },
        { key: "branch", label: "Branch/City Dashboard" },
        { key: "agent", label: "Agent Dashboard" },
        { key: "shipping_line", label: "Shipping Line Dashboard" },
        { key: "clearing_agent", label: "Clearing Agent Dashboard" }
      ] as Array<{ key: DashboardKind; label: string }>,
    []
  );

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(kind));
    if (!raw) {
      setEnabled(new Set<WidgetKey>(["total_branches", "total_users", "pending_approvals", "exchange_rates"]));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as WidgetKey[];
      setEnabled(new Set(parsed));
    } catch {
      setEnabled(new Set());
    }
  }, [kind]);

  function toggle(key: WidgetKey) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(storageKey(kind), JSON.stringify(Array.from(next)));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Select which widgets appear on each dashboard.</p>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold">Dashboard</label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as DashboardKind)}
          >
            {kindOptions.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <div className="ms-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            Saved automatically
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {widgetOptions.map((w) => {
            const isOn = enabled.has(w.key);
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => toggle(w.key)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-start transition",
                  isOn ? "border-primary bg-primary/5" : "bg-background hover:bg-muted"
                )}
              >
                <span className="text-sm font-semibold">{w.label}</span>
                <span
                  className={cn(
                    "inline-flex h-5 w-9 items-center rounded-full border p-0.5 transition",
                    isOn ? "border-primary bg-primary/20" : "border-slate-200 bg-slate-100"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full bg-white shadow-sm transition",
                      isOn ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

