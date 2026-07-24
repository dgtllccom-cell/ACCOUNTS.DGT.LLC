import { requireErpSession } from "@/lib/auth/session";
import JournalReport from "@/features/journal/components/journal-report";

export default async function JournalBranchReportPage() {
  const session = await requireErpSession();
  return <JournalReport session={session} initialLevel="branch" />;
}
