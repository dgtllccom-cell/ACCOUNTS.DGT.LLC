"use client";

import { SalesBookingJournalReportView } from "@/features/sales/components/sales-booking-journal-report-view";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export default function SalesBookingRegisterPage() {
  const lang = useActiveLanguage();
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t(lang, "sbjr.page_title", "Sales Booking Register")}</h2>
        <p className="text-sm text-muted-foreground">{t(lang, "sbjr.page_desc", "Detailed logs, weight summaries, quantities, and transactional balances of all sales orders.")}</p>
      </div>
      <SalesBookingJournalReportView />
    </div>
  );
}
