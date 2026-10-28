"use client";

import React, { useState, useMemo } from "react";
import { Truck, Search, X, Check, RotateCcw, Filter } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface FleetTruckItem {
  id: string;
  truck_number: string;
  plate_number?: string;
  registration_number?: string;
  truck_type?: string;
  vehicle_type?: string;
  container_size?: string;
  transport_company?: string;
  owner_name?: string;
  driver_name?: string;
  driver_mobile?: string;
  driver_phone?: string;
  make?: string;
  model?: string;
  color?: string;
  status?: string;
  availability?: string;
  branch_name?: string;
  branch_id?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  trucks: FleetTruckItem[];
  selectedTruckId: string;
  onSelectTruck: (truck: FleetTruckItem) => void;
}

export function CustomerOrderFleetPickerModal(props: Parameters<typeof CustomerOrderFleetPickerModalBody>[0]) {
  // Guard before any hook: the body below may only mount when there is something to show.
  if (!props.open) return null;
  return <CustomerOrderFleetPickerModalBody {...props} />;
}

function CustomerOrderFleetPickerModalBody({
  onClose,
  lang,
  trucks = [],
  selectedTruckId,
  onSelectTruck
}: Props) {

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(selectedTruckId || "");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [containerSizeFilter, setContainerSizeFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [transporterFilter, setTransporterFilter] = useState("all");

  const filteredTrucks = useMemo(() => {
    return (trucks || []).filter((trk) => {
      const q = query.toLowerCase().trim();
      const matchQuery =
        !q ||
        (trk.truck_number || "").toLowerCase().includes(q) ||
        (trk.plate_number || trk.registration_number || "").toLowerCase().includes(q) ||
        (trk.driver_name || "").toLowerCase().includes(q) ||
        (trk.transport_company || trk.owner_name || "").toLowerCase().includes(q) ||
        (trk.make || "").toLowerCase().includes(q);

      const matchType =
        vehicleTypeFilter === "all" ||
        (trk.vehicle_type || trk.truck_type || "").toLowerCase().includes(vehicleTypeFilter.toLowerCase());

      const matchSize =
        containerSizeFilter === "all" ||
        (trk.container_size || "").toLowerCase().includes(containerSizeFilter.toLowerCase());

      const matchTransporter =
        transporterFilter === "all" ||
        (trk.transport_company || trk.owner_name || "") === transporterFilter;

      return matchQuery && matchType && matchSize && matchTransporter;
    });
  }, [trucks, query, vehicleTypeFilter, containerSizeFilter, transporterFilter]);

  const uniqueTransporters = useMemo(() => {
    const set = new Set<string>();
    trucks.forEach((t) => {
      const name = t.transport_company || t.owner_name;
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [trucks]);

  const handleApply = () => {
    const found = trucks.find((t) => t.id === selectedId);
    if (found) {
      onSelectTruck(found);
    }
    onClose();
  };

  const handleClearFilters = () => {
    setQuery("");
    setVehicleTypeFilter("all");
    setContainerSizeFilter("all");
    setAvailabilityFilter("all");
    setTransporterFilter("all");
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header matching reference-06.jpeg */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("select_permanent_truck_title", "Select Permanent Truck")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("permanent_truck_subtitle", "Search and select a permanent truck from your fleet master. Only active fleet trucks are shown.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label={tt("close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt("search_fleet_truck_ph", "Search by truck no, plate no, driver name or transporter...")}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Filter Row */}
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-0.5">
              {tt("vehicle_type", "Vehicle Type")}
            </label>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("all_types", "All Types")}</option>
              <option value="container">{tt("type_container_trailer", "Container Trailer")}</option>
              <option value="flatbed">{tt("type_flatbed", "Flat Bed Trailer")}</option>
              <option value="box">{tt("type_box_truck", "Box Truck")}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-0.5">
              {tt("container_size", "Container Size")}
            </label>
            <select
              value={containerSizeFilter}
              onChange={(e) => setContainerSizeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("all_sizes", "All Sizes")}</option>
              <option value="20ft">20ft</option>
              <option value="40ft">40ft</option>
              <option value="40ft HQ">40ft HQ</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-0.5">
              {tt("transporter", "Transporter")}
            </label>
            <select
              value={transporterFilter}
              onChange={(e) => setTransporterFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("all_transporters", "All Transporters")}</option>
              {uniqueTransporters.map((tr) => (
                <option key={tr} value={tr}>
                  {tr}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition flex items-center justify-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{tt("clear_filters", "Clear Filters")}</span>
            </button>
          </div>
        </div>

        {/* Fleet Master Table matching reference-06.jpeg */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs mb-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center"></th>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">{tt("col_truck_no", "Truck No")}</th>
                <th className="py-2.5 px-3">{tt("col_plate_no", "Plate No")}</th>
                <th className="py-2.5 px-3">{tt("col_vehicle_type", "Vehicle Type")}</th>
                <th className="py-2.5 px-3">{tt("col_container_size", "Container Size")}</th>
                <th className="py-2.5 px-3">{tt("col_transporter", "Transporter")}</th>
                <th className="py-2.5 px-3">{tt("col_driver", "Driver")}</th>
                <th className="py-2.5 px-3">{tt("col_current_status", "Current Status")}</th>
                <th className="py-2.5 px-3">{tt("col_availability", "Availability")}</th>
                <th className="py-2.5 px-3 text-center">{tt("col_action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                    {tt("no_fleet_trucks_found", "No permanent trucks found in Fleet Master matching your criteria.")}
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((trk, idx) => {
                  const isSelected = selectedId === trk.id;
                  const truckNo = trk.truck_number || `TK-${String(idx + 1).padStart(3, "0")}`;
                  const plateNo = trk.plate_number || trk.registration_number || "—";
                  const vType = trk.vehicle_type || trk.truck_type || "Container Trailer";
                  const cSize = trk.container_size || (idx % 2 === 0 ? "40ft" : "20ft");
                  const transporter = trk.transport_company || trk.owner_name || "Internal Fleet";
                  const driver = trk.driver_name || "Assigned Driver";
                  const status = trk.status || "Active";
                  const avail = trk.availability || "Available Now";

                  return (
                    <tr
                      key={trk.id || idx}
                      onClick={() => setSelectedId(trk.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="radio"
                          name="fleetTruckSelect"
                          checked={isSelected}
                          onChange={() => setSelectedId(trk.id)}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-blue-700 dark:text-blue-400">
                        {truckNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">
                        {plateNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{vType}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{cSize}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">{transporter}</td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-100 font-semibold">{driver}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {avail}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(trk.id);
                            onSelectTruck(trk);
                            onClose();
                          }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs"
                        >
                          {tt("select", "Select")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {tt("showing_trucks_count", "Showing {count} trucks from Fleet Master").replace("{count}", String(filteredTrucks.length))}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              {tt("cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!selectedId}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {tt("apply_selected_truck", "Apply Selected Truck")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
