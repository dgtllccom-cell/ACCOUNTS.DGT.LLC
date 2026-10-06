import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ConsignmentDetailView } from "@/features/consignment/components/consignment-detail-view";

export const metadata: Metadata = {
  title: "Consignment — Digital Dock ERP",
};

export const dynamic = "force-dynamic";

export default async function ConsignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  const { id } = await params;
  return (
    <div className="w-full">
      <ConsignmentDetailView id={id} lang={lang} />
    </div>
  );
}
