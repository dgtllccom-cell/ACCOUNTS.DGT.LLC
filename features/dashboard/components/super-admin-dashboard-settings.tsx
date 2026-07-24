"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Check, Settings2, SlidersHorizontal } from "lucide-react";

const STORAGE_KEY = "damaan-super-admin-dashboard-widgets";

const WIDGETS = [
  { id: "kpis", label: "Executive KPI Cards" },
  { id: "finance", label: "Financial Overview Cards" },
  { id: "salesPurchase", label: "Sales vs Purchase Chart" },
  { id: "profitTrend", label: "Profit Trend Chart" },
  { id: "countryPerformance", label: "Country Performance" },
  { id: "system", label: "System Status" },
  { id: "quick", label: "Quick Controls" },
  { id: "activity", label: "Recent Activities" }
] as const;

type WidgetId = (typeof WIDGETS)[number]["id"];
type WidgetState = Record<WidgetId, boolean>;

const defaultState = WIDGETS.reduce((acc, item) => {
  acc[item.id] = true;
  return acc;
}, {} as WidgetState);

const DashboardSettingsContext = createContext<{
  visible: WidgetState;
  toggle: (id: WidgetId) => void;
  reset: () => void;
} | null>(null);

export function useDashboardSettings() {
  const ctx = useContext(DashboardSettingsContext);
  if (!ctx) throw new Error("Dashboard settings provider is missing.");
  return ctx;
}

export function SuperAdminDashboardSettingsProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState<WidgetState>(defaultState);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<WidgetState>;
      setVisible({ ...defaultState, ...parsed });
    } catch {
      setVisible(defaultState);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
  }, [visible]);

  const value = useMemo(
    () => ({
      visible,
      toggle: (id: WidgetId) => setVisible((current) => ({ ...current, [id]: !current[id] })),
      reset: () => setVisible(defaultState)
    }),
    [visible]
  );

  return <DashboardSettingsContext.Provider value={value}>{children}</DashboardSettingsContext.Provider>;
}

export function DashboardWidget({ id, children }: { id: WidgetId; children: ReactNode }) {
  const { visible } = useDashboardSettings();
  if (!visible[id]) return null;
  return <>{children}</>;
}

export function SuperAdminDashboardSettingsPanel() {
  const { visible, toggle, reset } = useDashboardSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-card-foreground shadow-sm transition hover:bg-muted"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Dashboard Settings
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <Settings2 className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-black">Dashboard Settings</p>
              <p className="text-[11px] font-medium text-slate-500">Choose what appears on this dashboard.</p>
            </div>
          </div>
          <div className="space-y-1 p-2">
            {WIDGETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition hover:bg-blue-50"
              >
                <span>{item.label}</span>
                <span
                  className={`grid h-5 w-5 place-items-center rounded-md border ${
                    visible[item.id] ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
            >
              Reset Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

