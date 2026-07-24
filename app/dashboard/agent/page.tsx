import { redirect } from "next/navigation";

export default function AgentDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

