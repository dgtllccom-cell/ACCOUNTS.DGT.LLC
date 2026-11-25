import Link from "next/link";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { SalesOrderManagementDashboard } from "@/features/sales/components/sales-order-management-dashboard";

export default async function SalesOrdersConsolePage({ searchParams }: { searchParams: Promise<{ transfer?: string }> }) {
  const [{ transfer }, lang] = await Promise.all([searchParams, getRequestLanguage()]);
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <div className="mb-2 flex justify-end">
        <Link href={transfer === "1" ? "/dashboard/sales/sales-order" : "/dashboard/sales/sales-order?transfer=1"}
          className="rounded border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300">
          {transfer === "1" ? t(lang, "nav.sales_order_management", "Sales Order Management")
            : t(lang, "nav.sales_transfer_payment", "Sales Transfer Payment")}
        </Link>
      </div>
      <SalesOrderManagementDashboard transferOnly={transfer === "1"} />
    </div>
  );
}
