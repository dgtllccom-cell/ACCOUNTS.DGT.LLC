"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Warehouse as WarehouseIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleModal } from "@/components/ui/simple-modal";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { WarehouseForm } from "@/features/warehouses/components/warehouse-form";
import {
  deleteWarehouse,
  fetchWarehouses,
  type WarehouseRecord
} from "@/features/warehouses/warehouse-api";
import {
  listAreas,
  listCities,
  listCountries,
  listStates,
  type LocationArea,
  type LocationCity,
  type LocationCountry,
  type LocationState
} from "@/features/locations/location-api";

type WarehouseMode = "create" | "edit";

function parseContactSummary(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.value) : [];
  } catch {
    return [];
  }
}

export function WarehouseManagement() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [states, setStates] = useState<LocationState[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [modalMode, setModalMode] = useState<WarehouseMode>("create");
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null);
  const [viewWarehouse, setViewWarehouse] = useState<WarehouseRecord | null>(null);

  const loadWarehouses = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await fetchWarehouses();
      setWarehouses(rows);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
    void loadWarehouses();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countryRows, stateBatches, cityBatches] = await Promise.all([
          listCountries(),
          listCountries().then((items) =>
            Promise.all(items.map((country) => listStates({ countryId: country.id }).catch(() => [])))
          ),
          listCountries().then((items) =>
            Promise.all(items.map((country) => listCities({ countryId: country.id }).catch(() => [])))
          )
        ]);

        const flatStates = stateBatches.flat();
        const flatCities = cityBatches.flat();
        const areaBatches = await Promise.all(
          flatCities.map((city) => listAreas({ cityId: city.id }).catch(() => []))
        );

        if (cancelled) return;
        setCountries(countryRows);
        setStates(flatStates);
        setCities(flatCities);
        setAreas(areaBatches.flat());
      } catch {
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const locationMaps = useMemo(() => {
    return {
      countries: new Map(countries.map((item) => [item.id, item.name])),
      states: new Map(states.map((item) => [item.id, item.name])),
      cities: new Map(cities.map((item) => [item.id, item.name])),
      areas: new Map(areas.map((item) => [item.id, item.name]))
    };
  }, [areas, cities, countries, states]);

  const filteredWarehouses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return warehouses.filter((warehouse) => {
      if (statusFilter !== "all" && warehouse.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        warehouse.warehouse_name,
        warehouse.owner_name,
        warehouse.warehouse_type,
        warehouse.status,
        warehouse.full_address,
        locationMaps.countries.get(warehouse.country_id || "") || "",
        locationMaps.cities.get(warehouse.city_id || "") || "",
        locationMaps.areas.get(warehouse.area_id || "") || ""
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [locationMaps, search, statusFilter, warehouses]);

  const stats = useMemo(() => {
    const total = warehouses.length;
    const active = warehouses.filter((item) => item.status === "Active").length;
    const inactive = warehouses.filter((item) => item.status !== "Active").length;
    const linkedOwners = warehouses.filter((item) => item.owner_name?.trim()).length;
    return { total, active, inactive, linkedOwners };
  }, [warehouses]);

  const closeFormModal = () => {
    setEditingWarehouse(null);
    setSubmitting(false);
  };

  const handleDelete = async (warehouse: WarehouseRecord) => {
    if (!window.confirm(`Delete warehouse "${warehouse.warehouse_name}"?`)) return;
    try {
      await deleteWarehouse(warehouse.id);
      setMessage(`Deleted warehouse "${warehouse.warehouse_name}".`);
      await loadWarehouses();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete warehouse.");
    }
  };

  const pageTitle = (
    <div className="min-w-0">
      <h1 className="truncate text-xs font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-sm">
        Warehouse Registry & Master Setup
      </h1>
      <p className="hidden text-[9.5px] font-medium text-slate-400 sm:block">
        Real warehouse records linked with customer owners, location scope, and master-data controls.
      </p>
    </div>
  );

  const pageActions = (
    <>
      <div className="hidden items-center gap-1.5 lg:flex">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search warehouses"
            className="h-7 w-[210px] rounded-lg border-slate-200 pl-8 text-[11px] font-medium"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Under Maintenance">Under Maintenance</option>
          <option value="Closed">Closed</option>
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void loadWarehouses()}
        className="h-7 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setModalMode("create");
          setEditingWarehouse({} as WarehouseRecord);
        }}
        className="h-7 gap-1 rounded-lg bg-indigo-600 px-2.5 text-[10px] font-bold text-white hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        New Warehouse
      </Button>
    </>
  );

  return (
    <>
      {titleSlot ? createPortal(pageTitle, titleSlot) : null}
      {actionsSlot ? createPortal(pageActions, actionsSlot) : null}

      <div className="space-y-4 py-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total Warehouses</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
              </div>
              <WarehouseIcon className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active</div>
                <div className="mt-2 text-2xl font-black text-emerald-700">{stats.active}</div>
              </div>
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Non-Active</div>
                <div className="mt-2 text-2xl font-black text-amber-700">{stats.inactive}</div>
              </div>
              <RefreshCw className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Owner Linked</div>
                <div className="mt-2 text-2xl font-black text-sky-700">{stats.linkedOwners}</div>
              </div>
              <Eye className="h-5 w-5 text-sky-600" />
            </div>
          </div>
        </div>

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-4 py-3 lg:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search warehouses, owner, location"
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {error ? (
            <div className="border-b bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
          ) : null}
          {message ? (
            <div className="border-b bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Warehouse</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">City / Area</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      Loading warehouses...
                    </td>
                  </tr>
                ) : filteredWarehouses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      No warehouse records matched the current search and filter.
                    </td>
                  </tr>
                ) : (
                  filteredWarehouses.map((warehouse) => {
                    const countryName = locationMaps.countries.get(warehouse.country_id || "") || "-";
                    const cityName = locationMaps.cities.get(warehouse.city_id || "") || locationMaps.states.get(warehouse.state_province_id || "") || "-";
                    const areaName = locationMaps.areas.get(warehouse.area_id || "") || "";
                    return (
                      <tr key={warehouse.id} className="border-t align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{warehouse.warehouse_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{warehouse.full_address || "No address recorded"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{warehouse.owner_name || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{countryName}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{cityName}</div>
                          {areaName ? <div className="text-xs text-slate-500">{areaName}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{warehouse.warehouse_type}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              warehouse.status === "Active"
                                ? "bg-emerald-50 text-emerald-700"
                                : warehouse.status === "Inactive"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {warehouse.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <UnifiedActionMenu
                            onView={() => setViewWarehouse(warehouse)}
                            onEdit={() => {
                              setModalMode("edit");
                              setEditingWarehouse(warehouse);
                            }}
                            onPrint={() => window.print()}
                            onDelete={() => void handleDelete(warehouse)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editingWarehouse ? (
        <SimpleModal
          title={modalMode === "create" ? "Create Warehouse" : `Edit Warehouse - ${editingWarehouse.warehouse_name}`}
          onClose={closeFormModal}
          className="max-w-6xl"
        >
          <WarehouseForm
            mode="embedded"
            initialWarehouse={modalMode === "edit" ? editingWarehouse : null}
            onCancel={closeFormModal}
            onSave={async () => {
              setSubmitting(true);
              await loadWarehouses();
              setSubmitting(false);
              closeFormModal();
            }}
          />
          {submitting ? <div className="text-xs text-slate-500">Refreshing registry...</div> : null}
        </SimpleModal>
      ) : null}

      {viewWarehouse ? (
        <SimpleModal
          title={`Warehouse Details - ${viewWarehouse.warehouse_name}`}
          onClose={() => setViewWarehouse(null)}
          className="max-w-3xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Warehouse</div>
              <div className="mt-2 text-base font-bold text-slate-900">{viewWarehouse.warehouse_name}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Owner</div>
              <div className="mt-2 text-base font-bold text-slate-900">{viewWarehouse.owner_name || "-"}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Country</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">
                {locationMaps.countries.get(viewWarehouse.country_id || "") || "-"}
              </div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">State / City / Area</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">
                {[
                  locationMaps.states.get(viewWarehouse.state_province_id || "") || null,
                  locationMaps.cities.get(viewWarehouse.city_id || "") || null,
                  locationMaps.areas.get(viewWarehouse.area_id || "") || null
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Type</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{viewWarehouse.warehouse_type}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{viewWarehouse.status}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Address</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">{viewWarehouse.full_address || "-"}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Contacts / Contracts</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {parseContactSummary(viewWarehouse.contact_number).length > 0 ? (
                  parseContactSummary(viewWarehouse.contact_number).map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-lg border bg-white px-3 py-2 text-sm">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.type}</div>
                      <div className="mt-1 font-medium text-slate-800">{item.value}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No contacts saved.</div>
                )}
              </div>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}
