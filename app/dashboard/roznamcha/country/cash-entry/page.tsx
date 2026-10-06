import { redirect } from "next/navigation";

export const metadata = { title: "Roznamcha — Country — Cash Entry" };


export default async function CountryCashEntryPage() {
  redirect("/dashboard/roznamcha/cash-entry");
}
