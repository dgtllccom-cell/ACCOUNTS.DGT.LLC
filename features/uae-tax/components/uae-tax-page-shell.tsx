"use client";

import type { ReactNode } from "react";
import { Building2, Calculator } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Standard chrome for every UAE Tax & e-Invoicing screen: RTL-aware heading
 * block + a slot for the screen body. Placeholder screens (phases not yet
 * built) pass no children and get a "coming in a later phase" panel.
 */
export function UaeTaxPageShell({
  lang: langProp,
  titleKey,
  subtitleKey,
  phaseNote,
  children,
}: {
  lang?: SupportedLanguage;
  titleKey: string;
  subtitleKey?: string;
  /** e.g. "tax_einv.phase_ingestion" — shown when there is no `children`. */
  phaseNote?: string;
  children?: ReactNode;
}) {
  const s = useErpScreen("tax_einv", langProp);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Calculator className="h-5 w-5" />
          </span>
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              {s.t(titleKey.replace(/^tax_einv\./, ""), "")}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Building2 className="h-3.5 w-3.5" />
              {s.t("uae", "United Arab Emirates")}
              {subtitleKey ? <span className="normal-case tracking-normal text-slate-500"> — {s.t(subtitleKey.replace(/^tax_einv\./, ""), "")}</span> : null}
            </p>
          </div>
        </header>

        {children ?? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {s.t("phase_pending_title", "This screen is scheduled for a later build phase")}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">
              {phaseNote
                ? s.t(phaseNote.replace(/^tax_einv\./, ""), "")
                : s.t("phase_pending_body", "The UAE Tax engine, dashboard and settings are live now. This area is delivered in a later phase of the rollout.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
