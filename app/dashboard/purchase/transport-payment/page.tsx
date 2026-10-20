import { TransportPaymentBookingWorkspace } from "@/features/purchases/components/transport-payment-booking-workspace";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = {
  title: "Purchase — Transport Payment Booking",
  description: "Track transport and freight payments, balances, and transporter details for purchase bookings."
};

export const dynamic = "force-dynamic";

export default async function TransportPaymentBookingPage() {
  await requireErpSession();

  return (
    <div className="w-full">
      <TransportPaymentBookingWorkspace />
    </div>
  );
}
