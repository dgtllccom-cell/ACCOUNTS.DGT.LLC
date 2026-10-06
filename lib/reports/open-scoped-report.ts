"use client";

/**
 * Thin wrapper that resolves DYNAMIC branding (company / logo / country / branch
 * from `country_company_profiles` via the existing `/api/erp/branding` resolver)
 * and then hands off to the central generic report engine
 * (`openGenericErpReport`). One helper for every list/report screen migrated off
 * `window.print()` / `document.write()`.
 *
 * Print / Save-as-PDF / Excel / CSV / Email / WhatsApp / orientation all come
 * from the shared `PdfPreviewModal` the engine renders into — no per-screen
 * handlers.
 */

import { fetchBranding } from "@/lib/branding/client";
import {
  openGenericErpReport,
  type GenericReportColumn,
} from "@/lib/reports/open-generic-erp-report";
import type { ERPCompanyInfo } from "@/lib/reports/erp-report-template-builder";

export type ScopedReportInput = {
  title: string;
  subtitle?: string;
  lang?: string;
  columns: GenericReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
  totalsRow?: Record<string, unknown>;
  filters?: Array<{ label: string; value: string }>;
  orientation?: "portrait" | "landscape";
  footerNotesHtml?: string;
  /** resolve branding for this country (a single-country / scoped report) */
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  /** display-only fallbacks when no branding profile exists */
  countryName?: string | null;
  branchName?: string | null;
  currency?: string | null;
  printedBy?: string | null;
  reportPeriod?: string | null;
};

function real(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  if (!s || /^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$)/i.test(s)) return undefined;
  return s;
}

export async function openScopedGenericReport(input: ScopedReportInput): Promise<void> {
  let companyInfo: ERPCompanyInfo = {
    country: real(input.countryName),
    branch: real(input.branchName),
    currency: real(input.currency),
    printedBy: real(input.printedBy),
    reportPeriod: real(input.reportPeriod),
  };

  if (input.countryId) {
    try {
      const qs = new URLSearchParams({ countryId: input.countryId });
      if (input.countryBranchId) qs.set("countryBranchId", input.countryBranchId);
      if (input.cityBranchId) qs.set("cityBranchId", input.cityBranchId);
      const res = await fetch(`/api/erp/branding?${qs.toString()}`);
      const j = await res.json().catch(() => ({}));
      const b = j?.branding;
      if (b) {
        const byLang = (b.companyNameByLang && (b.companyNameByLang[input.lang || "en"] || b.companyNameByLang.en)) || null;
        companyInfo = {
          ...companyInfo,
          name: real(byLang) || real(b.companyName) || companyInfo.country,
          logoUrl: real(b.logoUrl),
          address: real(b.address),
          phone: real(b.phone),
          email: real(b.email),
          website: real(b.website),
          country: real(b.countryName) || companyInfo.country,
          currency: real(b.baseCurrency) || companyInfo.currency,
        };
      }
    } catch {
      /* keep the neutral fallbacks — never a hard-coded brand */
    }
  }

  openGenericErpReport({
    title: input.title,
    subtitle: input.subtitle,
    lang: input.lang,
    columns: input.columns,
    rows: input.rows,
    summary: input.summary,
    totalsRow: input.totalsRow,
    filters: input.filters,
    companyInfo,
    orientation: input.orientation,
    footerNotesHtml: input.footerNotesHtml,
  });
}

export type { GenericReportColumn };
