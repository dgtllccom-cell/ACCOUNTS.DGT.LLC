"use client";

import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, Clock, Globe } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type CountryCard = {
  key: string;
  nameKey: string;
  href: string;
  status: "active" | "planned";
};

const COUNTRIES: CountryCard[] = [
  { key: "uae", nameKey: "uae", href: "/dashboard/tax-einvoicing/uae/dashboard", status: "active" },
  { key: "pakistan", nameKey: "country_pakistan", href: "/dashboard/tax-einvoicing/coming-soon?country=pakistan", status: "planned" },
  { key: "afghanistan", nameKey: "country_afghanistan", href: "/dashboard/tax-einvoicing/coming-soon?country=afghanistan", status: "planned" },
  { key: "india", nameKey: "country_india", href: "/dashboard/tax-einvoicing/coming-soon?country=india", status: "planned" },
  { key: "other", nameKey: "country_other", href: "/dashboard/tax-einvoicing/coming-soon?country=other", status: "planned" },
];

export function AllTaxesView({ lang: langProp }: { lang?: SupportedLanguage }) {
  const s = useErpScreen("tax_einv", langProp);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Calculator className="h-5 w-5" />
          </span>
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("all_taxes", "All Taxes")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">{s.t("all_taxes_subtitle", "")}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/tax"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                <Calculator className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("all_rates_link", "Tax Setup & Rates")}</p>
                <p className="text-[11px] text-slate-400">{s.t("all_rates_link_hint", "Rates, TRN and defaults per country")}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
          </Link>

          {COUNTRIES.map((c) => {
            const active = c.status === "active";
            return (
              <Link
                key={c.key}
                href={c.href}
                className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition ${
                  active
                    ? "border-blue-200 bg-white hover:border-blue-400 dark:border-blue-900 dark:bg-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
                    <Globe className="h-4 w-4" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}
                  >
                    {active ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {active ? s.t("all_status_active", "Active") : s.t("all_status_planned", "Planned")}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t(c.nameKey, "")}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {active
                      ? s.t("all_uae_hint", "VAT engine, e-Invoicing, returns, documentation and audit")
                      : s.t("all_planned_hint", "Container ready — tax rules to be configured")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
