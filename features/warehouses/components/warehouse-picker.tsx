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

  return (
    <>
      <SearchSelect
        label={label}
        value={value}
        placeholder={placeholder ?? (loading ? "Loading warehouses..." : "Search warehouse by name, type...")}
        disabled={disabled || loading}
        options={options}
        onValueChange={(val) => {
          onValueChange?.(val);
          const found = warehouses.find((w) => w.id === val) || null;
          onSelectRecord?.(found);
        }}
        createLabel="+ New Warehouse"
        createButtonPlacement="both"
        onCreateNew={async () => setOpenCreate(true)}
      />

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
