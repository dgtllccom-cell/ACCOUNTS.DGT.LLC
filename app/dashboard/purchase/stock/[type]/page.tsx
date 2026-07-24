import { notFound } from "next/navigation";
import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

const stockPages: Record<string, { title: string; description: string }> = {
  booking: {
    title: "Booking Stock",
    description: "Stock reserved immediately after Booking Purchase Order creation before confirmation."
  },
  confirmed: {
    title: "Confirmed Stock",
    description: "Stock linked with booking-confirmed purchase orders before container loading."
  },
  import: {
    title: "Import Stock",
    description: "Imported stock received from finalized purchase orders and linked shipping documents."
  },
  journal: {
    title: "Journal Stock",
    description: "Stock movements connected with journal postings, purchase entries, and accounting traceability."
  },
  warehouse: {
    title: "Warehouse Stock",
    description: "Warehouse inventory for purchase goods, containers, and branch stock balances."
  },
  "in-transit": {
    title: "In Transit Stock",
    description: "Goods currently moving through loading, shipping, and receiving stages."
  },
  export: {
    title: "Export Stock",
    description: "Export-ready stock connected with sales, warehouse, and delivery workflows."
  },
  delivered: {
    title: "Delivered Stock",
    description: "Delivered purchase stock with final branch, warehouse, and customer delivery status."
  }
};

export default async function PurchaseStockPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const page = stockPages[type];
  if (!page) notFound();
  return <PurchaseModuleWorkspace title={page.title} description={page.description} type="stock" />;
}
