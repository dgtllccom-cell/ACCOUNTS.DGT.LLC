"use client";

import React from "react";
import { PurchaseTransferErpReportView as V2ReportView } from "./purchase-transfer-erp-report-view-v2";

export function PurchaseTransferErpReportView(props: { purchaseData?: any }) {
  return <V2ReportView {...props} />;
}
