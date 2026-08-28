import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { HrMastersManager } from "@/features/hrm/components/hr-masters-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Departments — HRM",
  description: "Corporate department master: heads, budgets and employee distribution.",
};

export default async function DepartmentsPage() {
  const session = await requireErpSession();
  return <HrMastersManager kind="department" lang={session.preferredLanguage ?? "en"} />;
}
