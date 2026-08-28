import { redirect } from "next/navigation";

export const metadata = { title: "Clearing Agent Workspace" };


export default function ClearingAgentDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

