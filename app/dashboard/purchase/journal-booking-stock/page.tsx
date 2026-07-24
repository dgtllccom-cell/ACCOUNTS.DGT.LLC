import { requireErpSession } from "@/lib/auth/session";
import { JournalBookingStockDashboard } from "@/features/journal/components/journal-booking-stock-dashboard";

export const metadata = {
  title: "Journal Booking Stock | Digital Dock ERP"
};

export default async function JournalBookingStockPage() {
  const session = await requireErpSession();
  return <JournalBookingStockDashboard session={session} />;
}
