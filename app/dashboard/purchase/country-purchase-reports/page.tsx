import { CountryPurchaseReportsView } from "@/features/purchases/components/country-purchase-reports-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Purchase — Country Purchase Reports" };


export const dynamic = "force-dynamic";

export default async function CountryPurchaseReportsPage() {
  await requireErpSession();
  return <CountryPurchaseReportsView />;
}
