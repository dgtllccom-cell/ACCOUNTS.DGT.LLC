export const dynamic = "force-dynamic";

import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { OutstandingRecoveryLedgerView } from "@/features/reports/ledger-report/components/outstanding-recovery-ledger-view";

export default async function OutstandingRecoveryLedgerPage() {
  const lang = await getRequestLanguage();
  return <OutstandingRecoveryLedgerView lang={lang} pageTitle={t(lang, "nav.ledger_outstanding")} />;
}
