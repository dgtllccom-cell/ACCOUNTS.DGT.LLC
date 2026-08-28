"use client";

import { Globe } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

const COUNTRY_KEY: Record<string, string> = {
  pakistan: "country_pakistan",
  india: "country_india",
  afghanistan: "country_afghanistan",
  iran: "country_iran",
  other: "country_other",
};

export function UaeTaxComingSoonView({
  lang: langProp,
  country,
}: {
  lang?: SupportedLanguage;
  country?: string;
}) {
  const s = useErpScreen("tax_einv", langProp);
  const key = COUNTRY_KEY[(country ?? "").toLowerCase()] ?? "group_countries";

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 pt-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-800">
          <Globe className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50">
          {s.t(key, "")} — {s.t("coming_soon_title", "Coming Soon")}
        </h1>
        <p className="text-sm leading-6 text-slate-500">
          {s.t("coming_soon_body", "")}
        </p>
      </div>
    </section>
  );
}
