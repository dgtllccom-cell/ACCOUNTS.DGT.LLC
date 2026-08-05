import Link from "next/link";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";

const DAILY_PAYMENT_REPORT_LINKS = [
  { href: "/dashboard/roznamcha/reports/cash-entry", label: "Cash Entry Report" },
  { href: "/dashboard/roznamcha/reports/bank", label: "Bank Report" },
  { href: "/dashboard/roznamcha/reports/transfer", label: "Transfer Report" },
  { href: "/dashboard/roznamcha/reports/all", label: "All Roznamcha Report" }
] as const;

export default async function CashEntryPage() {
  const lang = await getRequestLanguage();

  return (
    <div className="w-full px-2 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Daily Payment Reports:</span>
        {DAILY_PAYMENT_REPORT_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href as any}
            className="rounded-full border bg-background px-3 py-1 font-medium text-foreground hover:bg-muted"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <CashEntryForm
        lang={lang}
        pageTitle={t(lang, "nav.cash_entry")}
        scopeMode="auto"
      />
    </div>
  );
}
