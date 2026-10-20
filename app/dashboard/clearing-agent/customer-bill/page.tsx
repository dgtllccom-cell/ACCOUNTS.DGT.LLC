import { Suspense } from "react";
import { CustomerBillRegister } from "@/features/clearing-agent/components/customer-bill-register";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Clearing Agent — Customer Bills & Order Transfer Hub" };

export default async function CustomerBillsPage() {
  const lang = await getRequestLanguage();

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-bold">{t(lang, "cbill.reg_loading", "Loading customer orders and bills...")}</div>}>
      <CustomerBillRegister lang={lang} />
    </Suspense>
  );
}
