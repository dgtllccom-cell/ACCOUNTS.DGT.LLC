import { Suspense } from "react";
import { requireErpSession } from "@/lib/auth/session";
import { StockBalanceReport } from "@/features/stock-balance/components/stock-balance-report";

export const dynamic = "force-dynamic";
export const metadata = { title: "Goods Movement & Stock Report" };

/** Goods Movement & Stock Report: a reporting interface over the existing Stock Journal, purchase, sales and lot records. */
export default async function StockBalanceReportPage() {
  const session = await requireErpSession();
  return (
    <Suspense fallback={null}>
      <StockBalanceReport session={{ fullName: (session as { fullName?: string | null }).fullName ?? null, email: (session as { email?: string | null }).email ?? null }} />
    </Suspense>
  );
}
