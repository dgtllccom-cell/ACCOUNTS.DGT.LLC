import { ShippingAccountApprovalsView } from "@/features/shipping/components/shipping-account-approvals-view";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Shipping Line — Account Approvals" };

export default async function ShippingAccountApprovalsPage() {
  const session = await requireErpSession();
  return <ShippingAccountApprovalsView lang={session?.preferredLanguage ?? "en"} />;
}
