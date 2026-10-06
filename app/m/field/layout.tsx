import type { Metadata } from "next";
import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Field Operations",
};

export default async function MobileFieldLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: only a mobile_field user (or super admin previewing)
  // reaches any /m/field page. Every API called is separately enforced.
  await requireMobileProfile("mobile_field");
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {children}
    </div>
  );
}
