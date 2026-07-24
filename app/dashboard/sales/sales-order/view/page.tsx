import { Suspense } from "react";
import { SalesTransferErpReportView } from "@/features/sales/components/sales-transfer-erp-report-view";

export default function SalesOrderViewPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center text-slate-500">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">Loading ERP Transaction Report...</p>
        </div>
      </div>
    }>
      <SalesTransferErpReportView />
    </Suspense>
  );
}
