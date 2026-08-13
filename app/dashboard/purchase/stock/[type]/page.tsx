import { notFound } from "next/navigation";
import { PurchaseModuleWorkspace } from "@/features/purchases/components/purchase-module-workspace";

const stockPages: Record<string, { title: string; description: string }> = {
  booking: {
    title: "Booking Stock",
    description: "Canonical booking rows before loading or payment proof moves them forward."
  },
  confirmed: {
    title: "Remaining Stock",
    description: "Loaded vehicle rows that still have payment balance or are waiting for land transfer."
  },
  import: {
    title: "Land Stock",
    description: "Loaded rows whose remaining payment is complete and are ready for destination selection."
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
    description: "Destination stock moved to in-transit after Land Stock selection."
  },
  export: {
    title: "Re-export Stock",
    description: "Destination stock moved to re-export after Land Stock selection."
  },
  delivered: {
    title: "Local Sale / Delivered Stock",
    description: "Destination stock moved to local sale or delivered after Land Stock selection."
  }
};

export default async function PurchaseStockPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const page = stockPages[type];
  if (!page) notFound();
  return <PurchaseModuleWorkspace title={page.title} description={page.description} type="stock" />;
}
