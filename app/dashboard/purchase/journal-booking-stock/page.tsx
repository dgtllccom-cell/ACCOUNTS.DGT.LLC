import { requireErpSession } from "@/lib/auth/session";
import { PurchaseJournalBookingRegister } from "@/features/journal/components/purchase-journal-booking-register";

export const dynamic = "force-dynamic";

export const metadata = { title: "Purchase — Journal Booking Stock" };

/**
 * Purchase Journal Booking Stock (issue #38): Purchase Booking bills only, three summary panels + a bill-first register.
 * Same canonical, server-scoped Stock Journal data (GET /api/erp/inventory/journal-stock?view=bills); the general Stock Journal with its
 * Confirm / Issue / Reverse actions stays at /dashboard/purchase/stock/journal (Purchase General Stock).
 */
export default async function JournalBookingStockPage() {
  const session = await requireErpSession();
  return <PurchaseJournalBookingRegister lang={session.preferredLanguage ?? "en"} />;
}
