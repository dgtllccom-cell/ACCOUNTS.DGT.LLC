import { requireErpSession } from "@/lib/auth/session";
import JournalStockReportDashboard from "@/features/journal/components/journal-stock-report-dashboard";

export const metadata = {
  title: "All Stock Reports — DGT ERP",
  description: "Comprehensive branch, country, and salesman stock reports and inventory tracking."
};

export const dynamic = "force-dynamic";

export default async function AllStockReportsPage() {
  const session = await requireErpSession();
  return <JournalStockReportDashboard session={session} initialLevel="branch" />;
}
