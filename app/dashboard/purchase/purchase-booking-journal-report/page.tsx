import { PurchaseBookingJournalReportView } from "@/features/purchases/components/purchase-booking-journal-report-view";

export const metadata = { title: "Purchase — Purchase Booking Journal Report" };


export const dynamic = "force-dynamic";

export default function PurchaseBookingJournalReportPage() {
  return <PurchaseBookingJournalReportView />;
}
