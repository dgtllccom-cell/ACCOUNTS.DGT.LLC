import { LocalPurchaseJournalReportView } from "@/features/purchases/components/local-purchase-journal-report-view";
import { requireErpSession } from "@/lib/auth/session";

export default async function LocalPurchaseJournalReportPage() {
  const session = await requireErpSession();
  return <LocalPurchaseJournalReportView session={session} />;
}
