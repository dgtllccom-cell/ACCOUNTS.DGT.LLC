import { Metadata } from "next";
import { EnterpriseAuditMonitoringDashboard } from "@/features/audit/components/enterprise-audit-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Enterprise Audit & Monitoring Center",
  description: "Comprehensive multi-country edit version timelines, deleted records vault, and daily branch monitoring."
};

export default function AuditMonitoringPage() {
  return <EnterpriseAuditMonitoringDashboard />;
}
