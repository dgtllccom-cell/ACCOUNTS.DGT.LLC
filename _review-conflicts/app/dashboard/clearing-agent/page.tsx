import { redirect } from "next/navigation";

export default function ClearingAgentDashboardPage() {
  redirect("/dashboard/logistics" as any);
}

