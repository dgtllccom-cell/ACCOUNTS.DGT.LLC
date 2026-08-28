import { PurchaseLoadingFormView } from "@/features/purchases/components/purchase-loading-form-view";

export const metadata = { title: "Purchase — Loading Form" };


export const dynamic = "force-dynamic";

export default function PurchaseLoadingFormPage() {
  return <PurchaseLoadingFormView />;
}
