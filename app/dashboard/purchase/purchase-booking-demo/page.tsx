import { PurchaseBookingViewRedesign } from "@/features/purchases/components/purchase-booking-view-redesign";

// Design preview page (from the uploaded ERP UI package). Renders the redesigned
// Purchase Booking layout with its bundled demo data. chrome={false} hides the
// package's own header/sidebar so it sits cleanly inside the ERP dashboard shell.
export default function PurchaseBookingDemoPage() {
  return <PurchaseBookingViewRedesign chrome={false} />;
}
