import { notFound } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { JournalBookingStockDashboard, type StockTab } from "@/features/journal/components/journal-booking-stock-dashboard";
import type { DestinationType } from "@/lib/stock-journal/model";

/**
 * Every /dashboard/purchase/stock/<type> URL is the SAME Stock Journal screen; the segment only chooses the opening tab.
 * (Legacy aliases keep their old bookmarks working.)
 */
const opening: Record<string, { tab: StockTab; destination?: DestinationType }> = {
  journal: { tab: "all" },
  booking: { tab: "booking" },
  loading: { tab: "transit" },
  import: { tab: "transit" },
  "in-transit": { tab: "transit" },
  confirmed: { tab: "ready" },
  transfer: { tab: "ready" },
  warehouse: { tab: "available", destination: "warehouse" },
  "local-market": { tab: "available", destination: "local_sales" },
  delivered: { tab: "available", destination: "local_sales" },
  export: { tab: "available", destination: "export" },
  history: { tab: "sold" },
};

export default async function PurchaseStockPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const page = opening[type];
  if (!page) notFound();

  const session = await requireErpSession();
  return <JournalBookingStockDashboard session={session} initialStage={page.tab} initialDestination={page.destination} />;
}
