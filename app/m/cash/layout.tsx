import type { Metadata } from "next";
import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cash & Ledger",
};

export default async function MobileCashLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: only a mobile_cash_ledger user (or a super admin previewing)
  // reaches any /m/cash page. Every API these pages call is separately enforced.
  await requireMobileProfile("mobile_cash_ledger");
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {children}
    </div>
  );
}
