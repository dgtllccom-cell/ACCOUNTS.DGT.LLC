"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Check, Settings2, SlidersHorizontal, X } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

const STORAGE_KEY = "damaan-super-admin-dashboard-widgets";

const WIDGETS = [
  { id: "kpis", labelKey: "dash.widget_kpi_cards", label: "Executive KPI Cards" },
  { id: "finance", labelKey: "dash.widget_finance_cards", label: "Financial Overview Cards" },
  { id: "salesPurchase", labelKey: "dash.widget_sales_purchase_chart", label: "Sales vs Purchase Chart" },
  { id: "profitTrend", labelKey: "dash.widget_profit_trend_chart", label: "Profit Trend Chart" },
  { id: "countryPerformance", labelKey: "dash.widget_country_performance", label: "Country Performance" },
  { id: "system", labelKey: "dash.widget_system_status", label: "System Status" },
  { id: "quick", labelKey: "dash.widget_quick_controls", label: "Quick Controls" },
  { id: "activity", labelKey: "dash.widget_recent_activities", label: "Recent Activities" }
] as const satisfies ReadonlyArray<{ id: string; labelKey: UiKey; label: string }>;

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

export function SuperAdminDashboardSettingsPanel({
  className,
  isOpen,
  onOpenChange
}: {
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const { visible, toggle, reset } = useDashboardSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  };
  const lang = useActiveLanguage();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={className || "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-card-foreground shadow-sm transition hover:bg-muted cursor-pointer"}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {t(lang, "dash.dashboard_settings", "Dashboard Settings")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          {/* Subtle click-outside backdrop */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setOpen(false)}
          />
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black">{t(lang, "dash.dashboard_settings", "Dashboard Settings")}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, "dash.choose_widgets_subtitle", "Choose what appears on this dashboard.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label={t(lang, "common.close", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1 p-3 max-h-[60vh] overflow-y-auto">
              {WIDGETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span>{t(lang, item.labelKey, item.label)}</span>
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border ${
                      visible[item.id] ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600 text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white transition hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
              >
                {t(lang, "dash.reset_dashboard", "Reset Dashboard")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

