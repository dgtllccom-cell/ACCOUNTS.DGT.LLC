import { WarehouseForm } from "@/features/warehouses/components/warehouse-form";

export const metadata = {
  title: "Warehouse Master Form",
  description: "Create and manage warehouses for the company.",
};

export default function WarehouseSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <WarehouseForm mode="standalone" />
    </div>
  );
}
