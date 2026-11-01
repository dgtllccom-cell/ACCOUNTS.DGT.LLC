"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { CenterDomain } from "@/lib/reports/center-totals";
import { ReportsCenter } from "@/features/reports/components/reports-center";

/** The Reports Center register, optionally with one extra tab holding an existing detailed report (kept as it was, never duplicated). */
export function ReportsCenterPage({
  lang, initialDomain, titleKey, titleFallback, extra, extraLabelKey, extraLabelFallback, defaultTab = "register"
}: {
  lang: string; initialDomain?: CenterDomain; titleKey?: string; titleFallback?: string;
  extra?: ReactNode; extraLabelKey?: string; extraLabelFallback?: string; defaultTab?: "register" | "extra";
}) {
  const s = useErpScreen("rc", lang as never);
  const [tab, setTab] = useState<"register" | "extra">(extra ? defaultTab : "register");
  return (
    <div dir={s.dir}>
      {extra ? (
        <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
          {([["register", s.t("tab.register", "Register & documents")], ["extra", s.t(extraLabelKey ?? "tab.extra", extraLabelFallback ?? "Detailed reports")]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} data-testid={`rc-tab-${k}`} onClick={() => setTab(k)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-xs font-bold transition", tab === k ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800")}>{label}</button>
          ))}
        </div>
      ) : null}
      {tab === "register" ? <ReportsCenter lang={lang} initialDomain={initialDomain} titleKey={titleKey} titleFallback={titleFallback} /> : extra}
    </div>
  );
}
