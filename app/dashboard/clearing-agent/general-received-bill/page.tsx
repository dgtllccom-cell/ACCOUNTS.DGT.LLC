import { Suspense } from "react";
import { GeneralReceivedBillView } from "@/features/clearing-agent/components/general-received-bill-view";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Clearing Agent — General Received Bills" };

export default async function GeneralReceivedBillPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">{t(lang, "grb.loading", "Loading customer orders…")}</div>}>
      <GeneralReceivedBillView />
    </Suspense>
  );
}
