import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { LeadReactivationView } from "@/features/customer-inquiry/components/lead-reactivation-view";

export const metadata: Metadata = { title: "Old Lead Reactivation — Digital Dock ERP" };
export const dynamic = "force-dynamic";

export default async function LeadReactivationPage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <LeadReactivationView lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
