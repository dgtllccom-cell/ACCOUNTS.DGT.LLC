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
  owner_person_id?: string | null;
  responsible_person_id?: string | null;
  warehouse_type: string;
  country_id: string | null;
  country_name?: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  city_name?: string | null;
  area_id?: string | null;
  area_name?: string | null;
  full_address: string | null;
  contact_number: string | null;
  status: string;
  warehouse_code?: string | null;
  branch_name?: string | null;
  total_capacity_tons?: number | string | null;
  address?: string | null;
  manager_name?: string | null;
  phone_number?: string | null;
  is_cold_storage?: boolean | null;
  is_active?: boolean | null;
  created_at: string;
  updated_at: string;
};

const BASE = "/api/erp/master-data/warehouses";

export async function fetchWarehouses(lang?: string): Promise<WarehouseRecord[]> {
  const url = lang ? `${BASE}?lang=${encodeURIComponent(lang)}` : BASE;
  const res = await fetch(url, { cache: "no-store" });
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
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to delete warehouse");
  }
}
