import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ConsignmentWorkspace } from "@/features/consignment/components/consignment-workspace";

export const metadata: Metadata = {
  title: "Consignment — Digital Dock ERP",
  description: "Loading consignments from Purchase Booking and Local Purchase, destination transfer, and the party Consignment Register.",
};

export const dynamic = "force-dynamic";

export default async function ConsignmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <div className="w-full">
      <ConsignmentWorkspace lang={lang} initialTab={one(sp.tab)} initialSource={one(sp.source)} initialQuery={one(sp.q)} />
    </div>
  );
}
