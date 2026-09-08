import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TempBillsRegisterView } from "@/features/temp-bills/components/temp-bills-register-view";

export const metadata: Metadata = {
  title: "Temporary Purchase Bills — Digital Dock ERP",
  description: "Temporary / historical Purchase & Sales bills tracking. Not main ERP accounting — no Ledger / Roznamcha / Journal / Stock / Voucher posting.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full">
      <TempBillsRegisterView lang={lang} section="purchase" />
    </div>
  );
}
