import { PurchaseLoadingFormView } from "@/features/purchases/components/purchase-loading-form-view";
import { requireErpSession } from "@/lib/auth/session";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";

export const metadata = { title: "Purchase — Loading Form" };


export const dynamic = "force-dynamic";

export default async function PurchaseLoadingFormPage() {
  // requireErpSession() redirects unauthenticated users to /auth/login — let it.
  const session = await requireErpSession();
  return (
    <EntryMethodSelector targetModule="purchase_loading_records" domain="business" lang={session?.preferredLanguage ?? "en"}>
      <PurchaseLoadingFormView />
    </EntryMethodSelector>
  );
}
