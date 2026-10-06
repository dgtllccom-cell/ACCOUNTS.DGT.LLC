import { requireErpSession } from "@/lib/auth/session";
import { BusinessHandovers } from "@/features/shipping/components/business-handovers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Business → Shipping Handovers — ERP" };

export default async function HandoversPage() {
  const session = await requireErpSession();
  return <BusinessHandovers lang={session.preferredLanguage ?? "en"} />;
}
