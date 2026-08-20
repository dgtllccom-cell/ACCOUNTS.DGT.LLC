"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { t } from "@/lib/i18n/ui";
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

export function EmployeeDateToolbar({ lang, value, onChange }: { lang: SupportedLanguage; value: DateRange; onChange: (r: DateRange) => void }) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (k: string, f: string) => t(lang, k as never, f);
  const today = useMemo(() => iso(new Date()), []);
  const [customFrom, setCustomFrom] = useState(value.from || today);
  const [customTo, setCustomTo] = useState(value.to || today);

  const set = (mode: DateMode, anchor = value.anchor) => onChange(computeRange(mode, anchor));
  const presetBtn = (mode: DateMode, key: string, fallback: string) => (
    <button type="button" onClick={() => set(mode)}
      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${value.mode === mode ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>
      {tt(key, fallback)}
    </button>
  );

  const label = value.mode === "all"
    ? tt("god.all_dates", "All Dates")
    : value.from === value.to ? value.from : `${value.from || "…"} → ${value.to || "…"}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900" dir={isRtl ? "rtl" : "ltr"}>
      {/* Day stepper */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(computeRange("day", addDays(value.anchor, -1)))}
          className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" title={tt("god.prev_day", "Previous Day")}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" value={value.anchor} onChange={(e) => onChange(computeRange(value.mode === "all" || value.mode === "custom" ? "day" : value.mode, e.target.value))}
          className="h-8 rounded-lg border border-slate-200 bg-background px-2 text-xs dark:border-slate-700" />
        <button type="button" onClick={() => onChange(computeRange("day", addDays(value.anchor, 1)))}
          className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" title={tt("god.next_day", "Next Day")}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={() => onChange(computeRange("day", today))}
        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700">{tt("god.today", "Today")}</button>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      {presetBtn("week", "god.this_week", "This Week")}
      {presetBtn("month", "god.this_month", "This Month")}
      {presetBtn("last30", "god.last_30", "Last 30 Days")}
      {presetBtn("all", "god.all_dates", "All Dates")}

      {/* Custom range */}
      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-center gap-1 text-xs">
        <span className="text-slate-400">{tt("god.from_date", "From")}</span>
        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-background px-1.5 dark:border-slate-700" />
        <span className="text-slate-400">{tt("god.to_date", "To")}</span>
        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-background px-1.5 dark:border-slate-700" />
        <button type="button" onClick={() => onChange({ mode: "custom", anchor: customFrom, from: customFrom, to: customTo })}
          className="rounded-lg bg-slate-700 px-2 py-1 font-bold text-white hover:bg-slate-800">{tt("god.apply", "Apply")}</button>
      </div>

      <div className="ms-auto flex items-center gap-1 text-xs font-bold text-slate-500">
        <Calendar className="h-3.5 w-3.5" /> {label}
      </div>
    </div>
  );
}
