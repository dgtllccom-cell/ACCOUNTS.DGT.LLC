import { redirect } from "next/navigation";
import type { Route } from "next";

export const metadata = { title: "Company Setup — Settings" };

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams?: Promise<{ companyId?: string; action?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  if (params?.companyId) {
    redirect(`/dashboard/settings/company?companyId=${encodeURIComponent(params.companyId)}` as Route);
  }
  redirect("/dashboard/settings/company?action=new" as Route);
}
