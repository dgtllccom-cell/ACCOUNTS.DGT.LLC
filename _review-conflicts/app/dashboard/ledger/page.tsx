import type { Route } from "next";
import Link from "next/link";

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Ledger views will read only posted entries from the normalized ledger table.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href={"/dashboard/ledger/general-report" as Route} className="rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-sm">
          <h2 className="font-semibold">Ledger General Report</h2>
          <p className="mt-1 text-sm text-muted-foreground">Inspect all ledger and roznamcha postings with filters, totals, and export actions.</p>
        </Link>
        <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Filters planned: company, branch, account, date range, currency, source document, and export status.
        </section>
      </div>
    </div>
  );
}
