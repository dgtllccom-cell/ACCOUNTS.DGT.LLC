import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { OrderWorkflowView } from "@/features/clearing-agent/components/order-workflow-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping / Clearing Pipeline",
  description: "Customer Order operational stages — truck assignment, goods verification, customs, handover.",
};

export default async function OrderWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireErpSession();
  const { id } = await params;
  return (
    <div className="p-3 sm:p-4">
      <OrderWorkflowView orderId={id} lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
