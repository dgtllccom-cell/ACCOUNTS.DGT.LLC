import { LocalPurchaseJournalReportView } from "@/features/purchases/components/local-purchase-journal-report-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Local Purchase Journal Report" };


export const dynamic = "force-dynamic";

export default async function LocalPurchaseJournalReportPage() {
  const session = await requireErpSession();
  return <LocalPurchaseJournalReportView session={session} />;
}
