import { requireErpSession } from "@/lib/auth/session";
import { TradingGeneralReportView } from "@/features/reports/components/trading-general-report-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trading General Report — Purchase & Sales" };

export default async function TradingGeneralReportPage() {
  await requireErpSession();
  return <TradingGeneralReportView />;
}
