import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PlaceholderScreenNotice } from "@/components/layout/placeholder-screen-notice";

export const metadata = { title: "New Entry — Clearing Agent" };

export default function ClearingAgentEntryPage() {
  return (
    <div className="space-y-4">
      <DashboardPageHeader
        titleKey="dph.clearing_agent_title"
        titleFallback="Clearing Agent"
        descKey="dph.clearing_agent_desc"
        descFallback="Clearing agent forms (customs, duty, bills, documents) will be available here."
      />
      <PlaceholderScreenNotice
        noteKey="dph.clearing_agent_note"
        noteFallback="Approval workflow and audit logs will attach when APIs are enabled."
      />
    </div>
  );
}
