import { requireErpSession } from "@/lib/auth/session";
import JournalReport from "@/features/journal/components/journal-report";

export default async function JournalCountryReportPage() {
  const session = await requireErpSession();
  return <JournalReport session={session} initialLevel="country" />;
}
