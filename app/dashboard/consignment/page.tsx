import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ConsignmentRegisterView } from "@/features/consignment/components/consignment-register-view";

export const metadata: Metadata = {
  title: "Consignment Register — Digital Dock ERP",
  description: "Consignment Stock & Sales Register — track received containers, expenses, sales and collections per Party (tracking only).",
};

export const dynamic = "force-dynamic";

export default async function ConsignmentPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full">
      <ConsignmentRegisterView lang={lang} />
    </div>
  );
}
