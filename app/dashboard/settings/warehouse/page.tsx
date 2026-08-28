import { WarehouseManagement } from "@/features/warehouses/components/warehouse-management";

export const metadata = { title: "Settings — Warehouse" };


export default function WarehousePage() {
  return (
    <div className="p-6">
      <WarehouseManagement />
    </div>
  );
}
