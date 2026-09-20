import { BlRecordsRegister } from "@/features/shipping/components/bl-records-register";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Shipping Line — Bl Entry" };


export default async function ShippingBlEntryPage() {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  return <BlRecordsRegister context="shipping" lang={session?.preferredLanguage ?? "en"} />;
}
