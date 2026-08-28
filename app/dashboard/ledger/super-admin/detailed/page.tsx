export const dynamic = "force-dynamic";

import { SuperAdminDetailedLedgerView } from "@/features/reports/ledger-report/components/super-admin-detailed-ledger";

export const metadata = { title: "Ledger — Super Admin — Detailed" };


export default function SuperAdminDetailedLedgerPage() {
  return <SuperAdminDetailedLedgerView />;
}
