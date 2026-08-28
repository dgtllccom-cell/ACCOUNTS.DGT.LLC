import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Companies" };


export default function CompaniesAliasPage() {
  redirect("/dashboard/settings/company" as const);
}
