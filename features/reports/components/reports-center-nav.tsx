"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/** The category bar shared by every report page: only the categories the login may open (computed on the server from the route policy). */
export function ReportsCenterNav({ lang, items, activeKey }: { lang: string; items: Array<{ key: string; href: string; labelKey: string; fallback: string }>; activeKey: string }) {
  const s = useErpScreen("rc", lang as never);
  if (items.length <= 1) return null;
  return (
    <nav dir={s.dir} aria-label={s.t("nav.aria", "Report categories")} data-testid="reports-center-nav" className="mb-3 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <Link key={c.key} href={c.href as Route} data-testid={`rc-nav-${c.key}`} aria-current={c.key === activeKey ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1 text-[11px] font-bold transition", c.key === activeKey ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200")}>
          {s.tGlobal(c.labelKey, c.fallback)}
        </Link>
      ))}
    </nav>
  );
}
