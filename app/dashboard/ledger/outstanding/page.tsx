export const dynamic = "force-dynamic";

import { OutstandingRecoveryLedgerView } from "@/features/reports/ledger-report/components/outstanding-recovery-ledger-view";

export const metadata = { title: "Outstanding Balances Ledger" };


export default function OutstandingRecoveryLedgerPage() {
  return <OutstandingRecoveryLedgerView pageTitle="Outstanding & Recovery Ledger" />;
}

