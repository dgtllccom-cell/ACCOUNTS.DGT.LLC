"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Customer360View } from "./customer-360-view";
import { SmartCrmControlCenter } from "./smart-crm-control-center";
import { CrmSpecializedReportView } from "./crm-specialized-reports";
import { CrmReportsView } from "./crm-reports-view";
import type { ErpSession } from "@/lib/auth/session";

interface SmartCrmWorkspaceProps {
  session?: ErpSession;
}

export function SmartCrmWorkspace({ session }: SmartCrmWorkspaceProps) {
  const searchParams = useSearchParams();
  const report = (searchParams.get("report") || "").toLowerCase().trim();
  const tab = (searchParams.get("tab") || "").toLowerCase().trim();

  // If a specific due/action tab is requested or explicitly "due-followup", render SmartCrmControlCenter
  if (tab || report === "due-followup") {
    return <SmartCrmControlCenter />;
  }

  // If universal CRM reports requested
  if (report === "reports") {
    return <CrmReportsView session={session || ({} as any)} />;
  }

  // If specialized report views requested
  if (
    report === "executive" ||
    report === "pipeline" ||
    report === "payments-recovery" ||
    report === "city-branch" ||
    report === "team-performance"
  ) {
    return <CrmSpecializedReportView reportType={report as any} />;
  }

  // Default view is the approved Customer 360 Screen!
  return <Customer360View />;
}
