import { redirect } from "next/navigation";

export const metadata = { title: "Agent Dashboard" };


export default function AgentDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

