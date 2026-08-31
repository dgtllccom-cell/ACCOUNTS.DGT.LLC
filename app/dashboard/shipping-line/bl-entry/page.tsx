import { BlEntryView } from "@/features/shipping/components/bl-entry-view";
import { requireErpSession } from "@/lib/auth/session";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Shipping Line — Bl Entry" };


export default async function ShippingBlEntryPage() {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  return (
    <EntryMethodSelector targetModule="shipping_bl_records" domain="shipping" lang={session?.preferredLanguage ?? "en"}>
      <BlEntryView context="shipping" />
    </EntryMethodSelector>
  );
}
