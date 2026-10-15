import { requireErpSession } from "@/lib/auth/session";
import { JournalBookingStockDashboard } from "@/features/journal/components/journal-booking-stock-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Journal Stock & Stock Transfer Management"
};

export default async function InventoryJournalStockPage() {
  const session = await requireErpSession();
  return <JournalBookingStockDashboard session={session} />;
}
