import { requireErpSession } from "@/lib/auth/session";
import JournalStockReportDashboard from "@/features/journal/components/journal-stock-report-dashboard";

export const metadata = {
  title: "Country Stock Report | Digital Dock ERP"
};

export default async function CountryStockReportPage() {
  const session = await requireErpSession();
  return <JournalStockReportDashboard session={session} initialLevel="country" />;
}
