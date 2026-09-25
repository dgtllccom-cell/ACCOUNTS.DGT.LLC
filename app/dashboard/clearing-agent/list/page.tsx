import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { clearingAgentsRepository } from "@/lib/repositories/clearing-agents-repository";
import { ClearingAgentListView } from "@/features/clearing-agent/components/clearing-agent-list-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clearing Agent List — Shipping & Clearing",
  description: "View and manage registered clearing agents and customs representatives.",
};

export default async function ClearingAgentListPage() {
  const session = await requireErpSession();
  const res = await clearingAgentsRepository.search({ limit: 100 }).catch(() => ({ clearingAgents: [] }));
  const agents = res.clearingAgents ?? [];

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 dark:bg-slate-950/50 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <ClearingAgentListView initialAgents={agents} />
      </div>
    </div>
  );
}
