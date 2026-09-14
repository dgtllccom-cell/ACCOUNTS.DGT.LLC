import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { TransferHandoverCenter } from "@/features/transfer-center/components/transfer-handover-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transfer & Handover Center",
  description: "Unified inbox for shipping, truck, clearing and purchase handovers — Accept, Return for Correction, Reject or Resubmit.",
};

export default async function TransferCenterPage() {
  const session = await requireErpSession();
  return (
    <div className="p-3 sm:p-4">
      <TransferHandoverCenter lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
