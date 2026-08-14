import { requireErpSession } from "@/lib/auth/session";
import InventoryWorkspaceClient from "@/features/inventory/components/inventory-workspace-client";

export const metadata = {
  title: "Stock & Inventory Management | Digital Dock ERP"
};

export default async function InventoryPage() {
  const session = await requireErpSession();
  return <InventoryWorkspaceClient session={session} />;
}
