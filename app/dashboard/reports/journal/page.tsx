import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportContext } from "@/lib/reports/resolve-report-context";
import { JournalReportingView } from "@/features/reports/journal-reporting/journal-reporting-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journal Reporting — ERP" };

// Journal Reporting — single dynamic, filter-driven report covering journal/ledger entries.
// Auth + session-scope resolution only happens here (server); all data fetching is client-side
// against app/api/erp/reports/journal (which re-validates scope server-side on every request —
// this page passing a ReportContext is presentation only, never a security boundary).
export default async function JournalReportingPage() {
  const session = await requireErpSession();
  const context = await resolveReportContext(session);

  return <JournalReportingView context={context} />;
}
