import { Metadata } from "next";
import { AllDeletedRecordsView } from "@/features/audit/components/all-deleted-records-view";

export const metadata: Metadata = {
  title: "All Deleted Records Control",
  description: "Complete deletion monitoring, approval evidence, and recoverable record history"
};

export default function SuperAdminDeletedRecordsPage() {
  return <AllDeletedRecordsView />;
}
