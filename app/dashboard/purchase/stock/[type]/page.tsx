import { notFound } from "next/navigation";
import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";
import { requireErpSession } from "@/lib/auth/session";
import { JournalBookingStockDashboard } from "@/features/journal/components/journal-booking-stock-dashboard";

const stockPages: Record<string, { title: string; description: string; stage: any }> = {
  journal: {
    title: "Journal Stock",
    description: "Purchase Booking & Local Purchase entries pending loading.",
    stage: "journal"
  },
  loading: {
    title: "Loading Stock",
    description: "Stock loaded into trucks and shipping containers in transit.",
    stage: "loading"
  },
  confirmed: {
    title: "Confirmed Stock",
    description: "Gate-verified loading records confirmed and ready for destination transfer.",
    stage: "confirmed"
  },
  warehouse: {
    title: "Warehouse Stock",
    description: "Inventory received and stored in branch and central warehouses.",
    stage: "warehouse"
  },
  export: {
    title: "Export Stock",
    description: "Stock allocated and staged for international export shipments.",
    stage: "export"
  },
  "local-market": {
    title: "Local Market Stock",
    description: "Goods allocated for branch local market distribution and direct sales.",
    stage: "local_sales"
  },
  transfer: {
    title: "Stock Transfer",
    description: "Transfer confirmed loading goods to Warehouse, Export, or Local Market.",
    stage: "transfer"
  },
  history: {
    title: "Stock Movement History",
    description: "Complete chronological audit trail of all inventory stage transitions.",
    stage: "history"
  },
  // Legacy route aliases
  booking: {
    title: "Booking Stock",
    description: "Purchase Booking entries in Journal Stock.",
    stage: "journal"
  },
  import: {
    title: "Import Stock",
    description: "Import goods loaded in shipping containers.",
    stage: "loading"
  },
  "in-transit": {
    title: "In Transit Stock",
    description: "Goods loaded in transit to final destinations.",
    stage: "loading"
  },
  delivered: {
    title: "Delivered / Local Sales Stock",
    description: "Stock delivered for local market sales.",
    stage: "local_sales"
  }
};

export default async function PurchaseStockPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const page = stockPages[type];
  if (!page) notFound();

  const session = await requireErpSession();
  return <JournalBookingStockDashboard session={session} initialStage={page.stage} />;
}
