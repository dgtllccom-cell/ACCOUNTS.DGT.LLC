import { Metadata } from "next";
import { AllEditVersionHistoryView } from "@/features/audit/components/all-edit-version-history-view";

export const metadata: Metadata = {
  title: "All Edit & Version History | Digital Dock ERP",
  description: "Enterprise audit control, version history timeline, and before/after comparisons"
};

export default function SuperAdminEditHistoryPage() {
  return <AllEditVersionHistoryView />;
}
