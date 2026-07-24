export type WarehouseRecord = {
  id: string;
  warehouse_name: string;
  owner_name: string;
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

// Mock database
let mockWarehouses: WarehouseRecord[] = [
  {
    id: "wh-1",
    warehouse_name: "MAIN WH-A",
    owner_name: "Damaan Group",
    warehouse_type: "Normal Storage",
    country_id: "AE",
    state_province_id: "DU",
    district_id: null,
    city_id: null,
    full_address: "Jebel Ali Free Zone, Dubai",
    contact_number: "+971 4 123 4567",
    status: "Active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export async function fetchWarehouses(): Promise<WarehouseRecord[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  let list = [...mockWarehouses];
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("erp_warehouses");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const ids = new Set(list.map((w) => w.id));
          for (const item of parsed) {
            if (!ids.has(item.id)) {
              list.push(item);
              ids.add(item.id);
            } else {
              const idx = list.findIndex((w) => w.id === item.id);
              if (idx !== -1) list[idx] = { ...list[idx], ...item };
            }
          }
        }
      } catch (e) {}
    }
  }
  return list;
}

export async function createWarehouse(data: Omit<WarehouseRecord, "id" | "created_at" | "updated_at">): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const newId = `wh-${Date.now()}`;
  const newRecord: WarehouseRecord = {
    ...data,
    id: newId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockWarehouses.push(newRecord);
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("erp_warehouses");
      const list = stored ? JSON.parse(stored) : [];
      const updated = Array.isArray(list) ? [...list, newRecord] : [newRecord];
      localStorage.setItem("erp_warehouses", JSON.stringify(updated));
    } catch (e) {}
  }
  return newId;
}
