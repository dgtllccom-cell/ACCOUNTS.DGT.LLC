import { ShippingAccountAccessView } from "@/features/shipping/components/shipping-account-access-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Shipping Line — Account Access" };

export default async function ShippingAccountAccessPage() {
  const session = await requireErpSession();
  return <ShippingAccountAccessView lang={session?.preferredLanguage ?? "en"} />;
}
