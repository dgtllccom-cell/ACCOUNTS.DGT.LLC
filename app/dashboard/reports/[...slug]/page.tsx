import type { Route } from "next";
import { redirect } from "next/navigation";

export default async function ReportsCatchAllRedirect({
  params
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug?.[0];
  if (slug) {
    redirect(`/dashboard/reports?type=${encodeURIComponent(slug)}` as Route);
  }
  redirect("/dashboard/reports" as Route);
}


