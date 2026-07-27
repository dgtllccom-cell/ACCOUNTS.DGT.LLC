"use client";

import { DailyExchangeRateManager } from "@/features/currency/daily-exchange-rate-manager";

export default function ExchangeRatesPage() {
  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <DailyExchangeRateManager />
    </div>
  );
}
