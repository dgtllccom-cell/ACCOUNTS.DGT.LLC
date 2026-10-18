import { Suspense } from "react";
import { CustomerBillRegister } from "@/features/clearing-agent/components/customer-bill-register";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Clearing Agent — Customer Bills & Order Transfer Hub" };

export default async function CustomerBillsPage() {
  const lang = await getRequestLanguage();

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-bold">Loading Customer Orders & Bills...</div>}>
      <CustomerBillRegister lang={lang} />
    </Suspense>
  );
}
