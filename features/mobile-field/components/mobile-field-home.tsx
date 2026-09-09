"use client";

import Link from "next/link";
import { Truck, CheckSquare, Camera } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileFieldShell } from "./mobile-field-shell";

export function MobileFieldHome({
  langProp,
  userName,
  scopeLabel,
}: {
  langProp?: SupportedLanguage;
  userName: string;
  scopeLabel?: string;
}) {
  const s = useErpScreen("mfield", langProp);

  const items = [
    {
      href: "/m/field/loading",
      icon: Truck,
      key: "menu_loading",
      fb: "Loading & Vehicle Check",
      subKey: "menu_loading_sub",
      subFb: "Inspect trucks, verify cargo and record loading",
      tone: "bg-emerald-600",
    },
    {
      href: "/m/field/tasks",
      icon: CheckSquare,
      key: "menu_tasks",
      fb: "Assigned Tasks",
      subKey: "menu_tasks_sub",
      subFb: "View task checklist and update status",
      tone: "bg-blue-600",
    },
    {
      href: "/m/field/documents",
      icon: Camera,
      key: "menu_docs",
      fb: "Photo & Slip Intake",
      subKey: "menu_docs_sub",
      subFb: "Capture delivery receipts, weighbridge slips and gate passes",
      tone: "bg-amber-600",
    },
  ] as const;

  return (
    <MobileFieldShell title={s.t("app_title", "Field Operations")} langProp={langProp}>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {s.t("hi", "Assalam o Alaikum")},{" "}
        <span className="text-slate-900 dark:text-slate-100">{userName}</span>
      </p>

      {scopeLabel ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span>📍</span>
          <span>{scopeLabel}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {items.map(({ href, icon: Icon, key, fb, subKey, subFb, tone }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone} text-white shadow-sm`}
            >
              <Icon className="h-7 w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black tracking-tight">{s.t(key, fb)}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {s.t(subKey, subFb)}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {s.t("scope_note", "You can work only within your authorized country and branch.")}
      </p>
    </MobileFieldShell>
  );
}
