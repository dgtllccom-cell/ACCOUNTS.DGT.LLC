import { BillDrilldownView } from "@/features/expenses/components/bill-drilldown-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Bill Cost — Drill-down" };
export const dynamic = "force-dynamic";

export default async function BillCostProfitDrilldownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getRequestLanguage();
  return (
    <div className="container mx-auto p-4 md:p-6">
      <BillDrilldownView id={id} lang={lang} />
    </div>
  );
}
