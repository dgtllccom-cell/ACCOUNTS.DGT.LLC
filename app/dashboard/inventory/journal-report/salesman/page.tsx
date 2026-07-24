import { requireErpSession } from "@/lib/auth/session";
import JournalReport from "@/features/journal/components/journal-report";

export default async function JournalSalesmanReportPage() {
  const session = await requireErpSession();
  return <JournalReport session={session} initialLevel="salesman" />;
}
