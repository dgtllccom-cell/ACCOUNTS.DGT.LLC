"use client";

import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openGenericErpReport, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
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
  companyInfo?: ERPCompanyInfo;
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
  orientation,
  className = "",
  variant = "outline",
  size = "sm"
}: JournalPrintButtonProps) {
  const lang = useActiveLanguage();
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    try {
      setLoading(true);
      let dataset = rows || [];
      if (fetchFullData) {
        dataset = await fetchFullData();
      }

      openGenericErpReport({
        title,
        subtitle,
        lang,
        columns,
        rows: dataset,
        summary,
        totalsRow,
        filters,
        companyInfo: {
          name: "DAMAAN GENERAL TRADING LLC",
          tagline: "Wholesale & Commission Trading",
          address: "Dubai, United Arab Emirates",
          printedBy: "ERP User",
          ...companyInfo
        },
        orientation
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
      <span>{loading ? "Preparing Report..." : t("print", lang) || "Journal Print"}</span>
    </Button>
  );
}
