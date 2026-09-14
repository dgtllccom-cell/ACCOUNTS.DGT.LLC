import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ClearingWorkspaceView } from "@/features/clearing-agent/components/clearing-workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clearing Workspace",
  description: "Country-aware Customs & Clearing workspace across all Customer Order legs.",
};

export default async function ClearingWorkspacePage() {
  const session = await requireErpSession();
  return (
    <div className="p-3 sm:p-4">
      <ClearingWorkspaceView lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
