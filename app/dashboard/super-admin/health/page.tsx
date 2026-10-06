import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { HealthCenterView } from "@/features/health/components/health-center-view";

export const metadata: Metadata = {
  title: "ERP Health & Integrity Center",
  description: "Read-only diagnostics — pages, APIs, navigation, permissions, five-language health, print/PDF, build/deploy",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HealthCenterPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login?redirectTo=/dashboard/super-admin/health");
  if (!session.isSuperAdmin) redirect("/dashboard");
  const lang = await getRequestLanguage();
  return <HealthCenterView lang={lang} />;
}
