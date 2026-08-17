"use client";

import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { WarehouseForm } from "@/features/warehouses/components/warehouse-form";
import { fetchWarehouses, type WarehouseRecord } from "@/features/warehouses/warehouse-api";

export type WarehousePickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelectRecord?: (record: WarehouseRecord | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function WarehousePicker({
  value,
  onValueChange,
  onSelectRecord,
  label = "Warehouse",
  placeholder,
  disabled
}: WarehousePickerProps) {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  async function loadList() {
    try {
      setLoading(true);
      const data = await fetchWarehouses();
      setWarehouses(data);
    } catch (err) {
      console.error("Failed to load warehouses", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  const options = warehouses.map((w) => ({
    value: w.id,
    label: w.warehouse_name,
    description: w.warehouse_type
  }));

  const [viewWarehouse, setViewWarehouse] = useState<WarehouseRecord | null>(null);
  const [editWarehouseId, setEditWarehouseId] = useState<string | null>(null);

  return (
    <>
      <SearchSelect
        label={label}
        value={value ?? ""}
        placeholder={placeholder ?? (loading ? "Loading warehouses..." : "Search warehouse by name, type...")}
        disabled={disabled || loading}
        options={options}
        onValueChange={(val) => {
          onValueChange?.(val);
          const found = warehouses.find((w) => w.id === val) || null;
          onSelectRecord?.(found);
        }}
        createLabel="New Warehouse"
        createButtonPlacement="both"
        onCreateNew={async () => setOpenCreate(true)}
        viewTitle="View Warehouse Details"
        editTitle="Edit Warehouse Master"
        onViewOption={(warehouseId) => {
          const found = warehouses.find((w) => w.id === warehouseId);
          if (found) setViewWarehouse(found);
        }}
        onEditOption={(warehouseId) => {
          setEditWarehouseId(warehouseId);
        }}
      />

      {/* View Warehouse Modal */}
      {viewWarehouse ? (
        <SimpleModal
          title={`Warehouse Details — ${viewWarehouse.warehouse_name}`}
          onClose={() => setViewWarehouse(null)}
          className="w-[96vw] max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl font-sans"
        >
          <div className="p-4 space-y-4 text-xs text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-xl">
              <div>
                <h3 className="text-base font-black uppercase tracking-wide">{viewWarehouse.warehouse_name}</h3>
                <p className="text-xs text-slate-300 font-medium">Type: {viewWarehouse.warehouse_type || "General Storage"}</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                  {viewWarehouse.is_active !== false ? "Active Facility" : "Inactive"}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Code: <span className="font-mono font-bold text-white">{viewWarehouse.warehouse_code || viewWarehouse.id.slice(0, 8)}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Country / City</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.country_name || "UAE"} {viewWarehouse.city_name ? `/ ${viewWarehouse.city_name}` : ""}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Managed Branch</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.branch_name || "Main Branch"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Storage Capacity</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.total_capacity_tons ? `${viewWarehouse.total_capacity_tons} Tons` : "Standard Storage"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Address / Location</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.address || viewWarehouse.area_name || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Manager Contact</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.manager_name || viewWarehouse.phone_number || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cold Storage / Temperature</span>
                <span className="font-bold text-slate-800 dark:text-white">{viewWarehouse.is_cold_storage ? "Cold Storage Facility" : "Ambient Storage"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditWarehouseId(viewWarehouse.id);
                  setViewWarehouse(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition"
              >
                Edit Master
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewWarehouse(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onValueChange?.(viewWarehouse.id);
                    onSelectRecord?.(viewWarehouse);
                    setViewWarehouse(null);
                  }}
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  Select This Warehouse
                </button>
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Edit Warehouse Modal */}
      {editWarehouseId ? (
        <SimpleModal
          title="Edit Warehouse — Warehouse Master Form"
          onClose={() => setEditWarehouseId(null)}
          className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          <WarehouseForm
            mode="embedded"
            initialWarehouse={warehouses.find((w) => w.id === editWarehouseId) || null}
            onSave={(warehouseId, savedRecord) => {
              loadList().catch(() => null);
              onValueChange?.(warehouseId);
              if (savedRecord) onSelectRecord?.(savedRecord);
              setEditWarehouseId(null);
            }}
            onCancel={() => setEditWarehouseId(null)}
          />
        </SimpleModal>
      ) : null}

      {/* Create Warehouse Modal */}
      {openCreate ? (
        <SimpleModal
          title="New Warehouse — Warehouse Master Form"
          onClose={() => setOpenCreate(false)}
          className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          <WarehouseForm
            mode="embedded"
            onSave={(warehouseId, savedRecord) => {
              loadList().catch(() => null);
              onValueChange?.(warehouseId);
              if (savedRecord) onSelectRecord?.(savedRecord);
              setOpenCreate(false);
            }}
            onCancel={() => setOpenCreate(false)}
          />
        </SimpleModal>
      ) : null}
    </>
  );
}
