import { BillCostReportsView } from "@/features/expenses/components/bill-cost-reports-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Bill Cost — Reports" };
export const dynamic = "force-dynamic";

export default async function BillCostProfitReportsPage() {
  const lang = await getRequestLanguage();
  return (
    <div className="container mx-auto p-4 md:p-6">
      <BillCostReportsView lang={lang} />
    </div>
  );
}
