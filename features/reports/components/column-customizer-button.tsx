"use client";

import { useState } from "react";
import { Columns3, X, ArrowUp, ArrowDown } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { useReportColumnPrefs } from "@/features/reports/hooks/use-report-column-prefs";

/**
 * Drop-in "Columns / Customize Report" control for any ERP table.
 * Pass the object returned by {@link useReportColumnPrefs}. All labels are 5-language
 * and the panel flips with the active language (RTL handled by the app shell `dir`).
 */
export function ColumnCustomizerButton({
  prefs,
  compact,
}: {
  prefs: ReturnType<typeof useReportColumnPrefs>;
  compact?: boolean;
}) {
  const lang = useActiveLanguage();
  const _ = (k: string, f: string) => t(lang as never, k as never, f);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <Columns3 className="h-3 w-3" />
        {!compact && <span>{_("report.manage_columns", "Columns")}</span>}
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 ltr:left-0 rtl:right-0"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white">{_("report.visible_columns", "Visible Columns")}</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-2 space-y-1.5">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={prefs.reset}
                className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {_("report.reset_default", "Reset to Default")}
              </button>
              {prefs.savedViewNames.map((v) => (
                <span key={v} className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  <button type="button" onClick={() => prefs.applyView(v)} className="px-1.5 py-0.5 hover:underline">{v}</button>
                  <button type="button" onClick={() => prefs.deleteView(v)} className="px-1 text-blue-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={_("report.save_view_name", "Save current as…")}
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => { prefs.saveView(name); setName(""); }}
                disabled={!name.trim()}
                className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
              >
                {_("report.save_view", "Save")}
              </button>
            </div>
          </div>

          <div className="max-h-60 space-y-1 overflow-y-auto border-t border-slate-100 pt-2 pr-1 dark:border-slate-800">
            {prefs.orderedColumns.map((col, idx) => {
              const isVisible = prefs.visibleKeys.includes(col.key);
              return (
                <div key={col.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={isVisible} onChange={() => prefs.toggle(col.key)} className="rounded border-slate-300 text-blue-600" />
                    <span className="truncate text-slate-700 dark:text-slate-300">{col.label}</span>
                  </label>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => prefs.move(col.key, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => prefs.move(col.key, 1)} disabled={idx === prefs.orderedColumns.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
