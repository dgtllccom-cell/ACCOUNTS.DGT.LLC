import { Metadata } from "next";
import { AllDeletedRecordsView } from "@/features/audit/components/all-deleted-records-view";

export const metadata: Metadata = {
  title: "All Deleted Records Control | Digital Dock ERP",
  description: "Complete deletion monitoring, approval evidence, and recoverable record history"
};

export default function DeletedRecordsPage() {
  return <AllDeletedRecordsView />;
}
