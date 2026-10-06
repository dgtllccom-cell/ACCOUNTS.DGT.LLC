import { redirect } from "next/navigation";

export const metadata = { title: "Clearing Agents Directory" };


export default function ClearingAgentsAliasPage() {
  redirect("/dashboard/clearing-agent" as const);
}
