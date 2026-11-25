"use client";

import { useState } from "react";
import { SalesPaymentTransferRegister } from "@/features/sales/components/sales-payment-transfer-register";
import { SalesOrderManagementDashboard } from "@/features/sales/components/sales-order-management-dashboard";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";

export default function SalesOrdersConsolePage() {
  const lang = useActiveLanguage();
  const [view, setView] = useState<"transfer" | "orders">("transfer");

  return (
    <div className="w-full space-y-3 px-3 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={view === "transfer"} className="rounded border px-3 py-2 text-sm font-semibold aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:aria-pressed:bg-slate-800" onClick={() => setView("transfer")}>
          {translateHeader(lang, "Sales Payment Transfer")}
        </button>
        <button type="button" aria-pressed={view === "orders"} className="rounded border px-3 py-2 text-sm font-semibold aria-pressed:border-blue-500 aria-pressed:bg-blue-50 dark:aria-pressed:bg-slate-800" onClick={() => setView("orders")}>
          {t(lang, "nav.sales_order_management", "Sales Order Management")}
        </button>
      </div>
      {view === "transfer" ? <SalesPaymentTransferRegister /> : <SalesOrderManagementDashboard />}
    </div>
  );
}
