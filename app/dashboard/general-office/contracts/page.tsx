import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ContractControlCenter } from "@/features/contracts/components/contract-control-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central Contract Control Center — ERP",
  description:
    "One linked register for every employment, purchase and sales contract — each row links live to its source module.",
};

export default async function ContractControlCenterPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return <ContractControlCenter lang={lang} />;
}
