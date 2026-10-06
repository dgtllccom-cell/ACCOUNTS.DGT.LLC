"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Filter, RotateCcw } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type DateRange = { mode: DateMode; from: string | null; to: string | null; anchor: string };
export type DateMode = "day" | "week" | "month" | "last30" | "all" | "custom";

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(dateStr: string, n: number) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); }

/** Compute the [from,to] date-only bounds for a mode anchored on `anchor` (yyyy-mm-dd). */
export function computeRange(mode: DateMode, anchor: string, customFrom?: string, customTo?: string): DateRange {
  const a = new Date(anchor + "T00:00:00");
  if (mode === "day") return { mode, anchor, from: anchor, to: anchor };
  if (mode === "week") {
    const dow = (a.getDay() + 6) % 7; // Monday=0
    const from = addDays(anchor, -dow);
    return { mode, anchor, from, to: addDays(from, 6) };
  }
  if (mode === "month") {
    const from = iso(new Date(a.getFullYear(), a.getMonth(), 1));
    const to = iso(new Date(a.getFullYear(), a.getMonth() + 1, 0));
    return { mode, anchor, from, to };
  }
  if (mode === "last30") return { mode, anchor, from: addDays(anchor, -29), to: anchor };
  if (mode === "custom") return { mode, anchor, from: customFrom || null, to: customTo || null };
  return { mode: "all", anchor, from: null, to: null };
}

/** True when a record's yyyy-mm-dd falls within the (inclusive) range; "all" always matches. */
export function inRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (range.mode === "all") return true;
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function EmployeeDateToolbar({
  lang,
  value,
  onChange
}: {
  lang: SupportedLanguage;
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (k: string, f: string) => t(lang, k as never, f);
  const today = useMemo(() => iso(new Date()), []);
  const [customFrom, setCustomFrom] = useState(value.from || today);
  const [customTo, setCustomTo] = useState(value.to || today);

  const handleModeChange = (newMode: DateMode) => {
    if (newMode === "custom") {
      onChange({ mode: "custom", anchor: customFrom, from: customFrom, to: customTo });
    } else {
      onChange(computeRange(newMode, value.anchor));
    }
  };

  const label =
    value.mode === "all"
      ? tt("god.all_dates", "All Dates")
      : value.from === value.to
      ? value.from
      : `${value.from || "…"} → ${value.to || "…"}`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/60"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Left: Quick Date Preset Dropdown & Date Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset Select Dropdown */}
        <div className="relative">
          <select
            value={value.mode}
            onChange={(e) => handleModeChange(e.target.value as DateMode)}
            className="h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="day">{tt("god.today", "Today / Selected Day")}</option>
            <option value="week">{tt("god.this_week", "This Week")}</option>
            <option value="month">{tt("god.this_month", "This Month")}</option>
            <option value="last30">{tt("god.last_30", "Last 30 Days")}</option>
            <option value="all">{tt("god.all_dates", "All Dates")}</option>
            <option value="custom">{tt("god.custom_range", "Custom Range (تاریخ کا انتخاب)")}</option>
          </select>
        </div>

        {/* Day Stepper Controls (when mode is day) */}
        {value.mode === "day" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange(computeRange("day", addDays(value.anchor, -1)))}
              className="h-8.5 w-8.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              title={tt("god.prev_day", "Previous Day")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <ErpDatePicker
              mode="single"
              lang={lang}
              size="sm"
              presets={false}
              clearable={false}
              value={{ from: value.anchor || null }}
              onApply={(v) => v.from && onChange(computeRange("day", v.from))}
            />
            <button
              type="button"
              onClick={() => onChange(computeRange("day", addDays(value.anchor, 1)))}
              className="h-8.5 w-8.5 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              title={tt("god.next_day", "Next Day")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(computeRange("day", today))}
              className="h-8.5 rounded-lg bg-sky-600 px-2.5 text-xs font-bold text-white hover:bg-sky-700"
            >
              {tt("god.today", "Today")}
            </button>
          </div>
        )}

        {/* Custom Range Inputs (when mode is custom) */}
        {value.mode === "custom" && (
          <div className="flex items-center gap-1.5 text-xs">
            <ErpDatePicker
              mode="range"
              lang={lang}
              size="sm"
              applyLabel="apply"
              value={{ from: customFrom || null, to: customTo || null }}
              onApply={(v) => {
                const from = v.from ?? "";
                const to = v.to ?? "";
                setCustomFrom(from);
                setCustomTo(to);
                onChange({ mode: "custom", anchor: from, from, to });
              }}
            />
          </div>
        )}
      </div>

      {/* Right: Active Date Range Badge Indicator */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <Calendar className="h-3.5 w-3.5 text-sky-600" />
        <span>{label}</span>
      </div>
    </div>
  );
}
