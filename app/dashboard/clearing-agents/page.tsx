import { redirect } from "next/navigation";

export default function ClearingAgentsAliasPage() {
  redirect("/dashboard/clearing-agent" as const);
}
