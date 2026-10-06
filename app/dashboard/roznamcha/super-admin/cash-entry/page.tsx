import { redirect } from "next/navigation";

export const metadata = { title: "Roznamcha — Super Admin — Cash Entry" };


export default async function SuperAdminCashEntryPage() {
  redirect("/dashboard/roznamcha/cash-entry");
}
