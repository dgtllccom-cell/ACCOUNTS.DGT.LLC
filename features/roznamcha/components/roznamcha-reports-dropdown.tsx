"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, BarChart3, Globe, Building2, Banknote, RefreshCw, FileText, ArrowRightLeft, ScrollText } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

type ReportItem = {
  href: string;
  labelKey: string;
  defaultLabel: string;
  icon: any;
};

const REPORT_ITEMS: ReportItem[] = [
  { href: "/dashboard/roznamcha/super-admin", labelKey: "nav.super_admin_reports", defaultLabel: "Super Admin / Country Reports", icon: Globe },
  { href: "/dashboard/roznamcha/branch", labelKey: "nav.branch_reports", defaultLabel: "Branch Reports", icon: Building2 },
  { href: "/dashboard/roznamcha/reports/cash-entry", labelKey: "nav.cash_entry_report", defaultLabel: "Cash Entry Report", icon: Banknote },
  { href: "/dashboard/roznamcha/reports/bank", labelKey: "nav.bank_report_roz", defaultLabel: "Bank Report", icon: Building2 },
  { href: "/dashboard/roznamcha/reports/transfer", labelKey: "roz.transfer_report", defaultLabel: "Transfer Report", icon: ArrowRightLeft },
  { href: "/dashboard/roznamcha/reports/invoice", labelKey: "nav.invoice_report", defaultLabel: "Invoice Report", icon: FileText },
  { href: "/dashboard/roznamcha/reports/business", labelKey: "nav.business_report", defaultLabel: "Business Report", icon: ScrollText },
  { href: "/dashboard/roznamcha/reports/all", labelKey: "nav.all_roznamcha_reports", defaultLabel: "All Roznamcha Report", icon: BarChart3 },
];

export function RoznamchaReportsDropdown({ lang }: { lang: SupportedLanguage }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition"
      >
        <BarChart3 className="h-4 w-4" />
        <span>{t(lang, "nav.general_roznamcha_reports", "Roznamcha Reports")}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-slate-800 dark:bg-slate-900">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
            {t(lang, "roz.daily_payment_reports", "Daily Payment Reports")}
          </div>

          <div className="space-y-0.5">
            {REPORT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition"
                >
                  <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{t(lang, item.labelKey, item.defaultLabel)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
