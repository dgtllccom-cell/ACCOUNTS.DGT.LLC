"use client";

import { SalesBookingJournalReportView } from "@/features/sales/components/sales-booking-journal-report-view";

export default function SalesBookingRegisterPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Sales Booking Register</h2>
        <p className="text-sm text-muted-foreground">Detailed logs, weight summaries, quantities, and transactional balances of all sales orders.</p>
      </div>
      <SalesBookingJournalReportView />
    </div>
  );
}
