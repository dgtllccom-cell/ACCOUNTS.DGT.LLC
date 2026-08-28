import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { HrMastersManager } from "@/features/hrm/components/hr-masters-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Designations — HRM",
  description: "Designation grades, titles and base salary scales.",
};

export default async function DesignationsPage() {
  const session = await requireErpSession();
  return <HrMastersManager kind="designation" lang={session.preferredLanguage ?? "en"} />;
}
