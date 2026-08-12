import { WarehouseManagement } from "@/features/warehouses/components/warehouse-management";

export const metadata = {
  title: "Warehouse Master Form",
  description: "Create and manage warehouses for the company.",
};

export default function WarehouseSettingsPage() {
  return <WarehouseManagement />;
}
