import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ledger — Detailed" };

// CountryDetailedLedgerView was consolidated into UnifiedDetailedLedgerView
// (features/reports/ledger-report/components/unified-detailed-ledger.tsx), which
// already branches on the caller's own role - it is a strict superset, so this
// route now just forwards there instead of keeping a second copy of the page.
export default function CountryDetailedLedgerPage() {
  redirect("/dashboard/ledger/detailed");
}
