/**
 * Warehouse data layer — real, DB-backed, secure API calls.
 * (Replaces the previous in-memory/localStorage mock.)
 * Talks to /api/erp/master-data/warehouses which enforces auth + role-based
 * authorization + centralized multilingual translation.
 */
export type WarehouseRecord = {
  id: string;
  warehouse_name: string;
  owner_name: string;
  owner_customer_id?: string | null;
  warehouse_type: string;
  country_id: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_id?: string | null;
  full_address: string | null;
  contact_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const BASE = "/api/erp/master-data/warehouses";

export async function fetchWarehouses(): Promise<WarehouseRecord[]> {
  const res = await fetch(BASE, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load warehouses");
  return (json.warehouses || []) as WarehouseRecord[];
}

export async function createWarehouse(
  data: Omit<WarehouseRecord, "id" | "created_at" | "updated_at">
): Promise<string> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create warehouse");
  return json.warehouse.id as string;
}

export async function updateWarehouse(
  id: string,
  data: Partial<Omit<WarehouseRecord, "id" | "created_at" | "updated_at">>
): Promise<WarehouseRecord> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to update warehouse");
  return json.warehouse as WarehouseRecord;
}

export async function deleteWarehouse(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to delete warehouse");
}
