import { requireErpSession } from "@/lib/auth/session";
import { ShippingHandoverInbox } from "@/features/shipping/components/handover-inbox";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shipping Handover Inbox — ERP" };

export default async function ShippingHandoverInboxPage() {
  const session = await requireErpSession();
  return <ShippingHandoverInbox lang={session.preferredLanguage ?? "en"} />;
}
