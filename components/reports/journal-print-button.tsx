"use client";

import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { t } from "@/lib/i18n/ui";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
import type { ERPCompanyInfo, ERPFilterPill } from "@/lib/reports/erp-report-template-builder";

export type JournalPrintButtonProps = {
  title: string;
  subtitle?: string;
  columns: GenericReportColumn[];
  rows?: Record<string, unknown>[];
  fetchFullData?: () => Promise<Record<string, unknown>[]>;
  summary?: Record<string, unknown>;
  totalsRow?: Record<string, unknown>;
  filters?: ERPFilterPill[];
  /** optional explicit branding override; when omitted branding resolves from the login scope */
  companyInfo?: ERPCompanyInfo;
  /** optional explicit scope for branding resolution (defaults to the logged-in scope) */
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  orientation?: "portrait" | "landscape";
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function JournalPrintButton({
  title,
  subtitle,
  columns,
  rows,
  fetchFullData,
  summary,
  totalsRow,
  filters,
  companyInfo,
  countryId,
  countryBranchId,
  cityBranchId,
  orientation,
  className = "",
  variant = "outline",
  size = "sm"
}: JournalPrintButtonProps) {
  const lang = useActiveLanguage();
  const scope = useErpScope();
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    try {
      setLoading(true);
      let dataset = rows || [];
      if (fetchFullData) {
        dataset = await fetchFullData();
      }

      // Branding: an explicit override wins; otherwise resolve dynamically from
      // the logged-in country/branch scope. Never a hard-coded company.
      const resolvedCountryId = countryId ?? scope.lockedCountryId ?? undefined;
      const resolvedCountryBranchId = countryBranchId ?? scope.lockedCountryBranchId ?? undefined;
      const resolvedCityBranchId = cityBranchId ?? scope.lockedCityBranchId ?? undefined;

      await openScopedGenericReport({
        title,
        subtitle,
        lang,
        columns,
        rows: dataset,
        summary,
        totalsRow,
        filters: filters?.map((f) => ({ label: f.label, value: String(f.value ?? "") })),
        orientation,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        countryName: companyInfo?.country ?? scope.countryName,
        branchName: companyInfo?.branch ?? scope.branchDisplayName,
        currency: companyInfo?.currency,
        printedBy: companyInfo?.printedBy ?? scope.userName,
      });
    } catch (err) {
      console.error("Journal Print Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={loading}
      className={`gap-1.5 font-bold shadow-xs ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      ) : (
        <Printer className="h-4 w-4 text-blue-600" />
      )}
      <span>{loading ? t(lang, "common.loading", "Loading...") : t(lang, "report.print", "Print Report")}</span>
    </Button>
  );
}
