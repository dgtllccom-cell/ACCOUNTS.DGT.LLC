import { Suspense } from "react";
import { CustomerOrderTransferView } from "@/features/clearing-agent/components/customer-order-transfer-view";

export const metadata = { title: "Clearing Agent — Customer Order Transfer" };

export default function CustomerOrderTransferPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Order Transfer...</div>}>
      <CustomerOrderTransferView />
    </Suspense>
  );
}
