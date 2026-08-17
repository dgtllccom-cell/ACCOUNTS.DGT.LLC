import { redirect } from "next/navigation";

export default function CompaniesAliasPage() {
  redirect("/dashboard/settings/company" as const);
}
