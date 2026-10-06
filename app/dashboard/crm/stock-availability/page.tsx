import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CrmStockAvailability } from "@/features/crm/components/crm-stock-availability";

export const metadata: Metadata = { title: "Stock Availability — Digital Dock ERP" };
export const dynamic = "force-dynamic";

export default async function CrmStockAvailabilityPage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <CrmStockAvailability lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
