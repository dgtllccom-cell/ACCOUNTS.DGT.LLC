import { PurchaseTransferErpReportView } from "@/features/purchases/components/purchase-transfer-erp-report-view-v2";

export const metadata = { title: "Purchase — Purchase Transfer Verification" };


export const dynamic = "force-dynamic";

export default function PurchaseTransferVerificationPage() {
  return <PurchaseTransferErpReportView />;
}
