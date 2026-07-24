import { getRequestLanguage } from "@/lib/i18n/server";
import { DailyExchangeRateManager } from "@/features/currency/daily-exchange-rate-manager";
import { CurrencyMonitoringDashboard } from "@/features/currency/currency-monitoring-dashboard";

export const metadata = {
  title: "Daily Exchange Rate Management | ERP",
  description: "Set and manage daily USD exchange rates for all countries in the ERP system.",
};

export default async function ExchangeRateManagementPage() {
  return (
    <div className="w-full">
      <DailyExchangeRateManager />
    </div>
  );
}
