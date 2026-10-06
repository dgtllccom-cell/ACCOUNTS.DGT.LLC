"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export default function LedgerPage() {
  const lang = useActiveLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t(lang, "ledger.hub_title", "Ledger")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(lang, "ledger.hub_subtitle", "Ledger views will read only posted entries from the normalized ledger table.")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href={"/dashboard/ledger/general-report" as Route} className="rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-sm">
          <h2 className="font-semibold">{t(lang, "ledger.hub_general_report_title", "Ledger General Report")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(lang, "ledger.hub_general_report_desc", "Inspect all ledger and roznamcha postings with filters, totals, and export actions.")}</p>
        </Link>
        <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          {t(lang, "ledger.hub_filters_planned", "Filters planned: company, branch, account, date range, currency, source document, and export status.")}
        </section>
      </div>
    </div>
  );
}
