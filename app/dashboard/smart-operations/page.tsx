import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { SmartDueView } from "@/features/smart-due/components/smart-due-view";

export const metadata: Metadata = {
  title: "Smart Operations & Action Center — Digital Dock ERP",
  description: "Central operational control center — Today / Pending / Overdue / Approvals / Payments Due / Tasks / Containers / Shipping-Clearing / Cheque dates. Read-only aggregation of the real ERP; every item deep-links to the original record.",
};

export const dynamic = "force-dynamic";

export default async function SmartOperationsPage() {
  await requireErpSession();
  return (
    <div className="w-full">
      <SmartDueView />
    </div>
  );
}
