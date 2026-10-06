import { redirect } from "next/navigation";

export const metadata = { title: "Roznamcha — Branch — Cash Entry" };


export default async function BranchCashEntryPage() {
  redirect("/dashboard/roznamcha/cash-entry");
}
