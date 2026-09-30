import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CrmPipelineBoard } from "@/features/customer-inquiry/components/crm-pipeline-board";

export const metadata: Metadata = { title: "Sales Pipeline — Digital Dock ERP" };
export const dynamic = "force-dynamic";

export default async function CrmPipelinePage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <CrmPipelineBoard lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
