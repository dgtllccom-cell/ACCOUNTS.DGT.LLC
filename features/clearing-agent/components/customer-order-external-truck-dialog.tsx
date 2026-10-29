"use client";

import React, { useState, useEffect } from "react";
import { Truck, X, Plus, UploadCloud, CheckCircle2, History, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  temporaryTruckProblems,
  type TemporaryTruckField
} from "@/lib/services/clearing-customer-order-workflow-rules";

export interface ExternalTruckFormData {
  transporterName: string;
  truckNumber: string;
  plateNumber: string;
  driverName: string;
  driverMobile: string;
  vehicleType: string;
  containerSize: string;
  loadingLocation: string;
  arrivalDate: string;
  arrivalTime: string;
  status: string;
  remarks: string;
  photoUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  initialValues?: Partial<ExternalTruckFormData>;
  onApply: (data: ExternalTruckFormData) => void;
}

const RECENT_EXTERNAL_TRUCKS = [
  {
    id: "TK-EXT-001",
    plateNo: "KHI-5567",
    transporter: "Al-Falah Goods Transport",
    driver: "Ali Raza",
    mobile: "+92 300 1234567",
    vehicleType: "Container Trailer",
    containerSize: "40ft",
    usedAgo: "Used 5 days ago"
  },
  {
    id: "TK-EXT-002",
    plateNo: "KHI-9021",
    transporter: "Dawaan Transport",
    driver: "Muhammad Imran",
    mobile: "+92 321 9876543",
    vehicleType: "Container Trailer",
    containerSize: "20ft",
    usedAgo: "Used 12 days ago"
  },
  {
    id: "TK-EXT-003",
    plateNo: "KHI-3345",
    transporter: "National Logistics",
    driver: "Shakeel Ahmad",
    mobile: "+92 333 4567890",
    vehicleType: "Flatbed Trailer",
    containerSize: "40ft",
    usedAgo: "Used 18 days ago"
  },
  {
    id: "TK-EXT-004",
    plateNo: "KHI-7781",
    transporter: "Karachi Freight Services",
    driver: "Asif Ali",
    mobile: "+92 345 6789012",
    vehicleType: "Box Truck",
    containerSize: "20ft",
    usedAgo: "Used 24 days ago"
  },
  {
    id: "TK-EXT-005",
    plateNo: "KHI-1209",
    transporter: "Universal Transport Co.",
    driver: "Bilal Ahmed",
    mobile: "+92 301 2345678",
    vehicleType: "Container Trailer",
    containerSize: "40ft",
    usedAgo: "Used 1 month ago"
  }
];

export function CustomerOrderExternalTruckDialog(props: Parameters<typeof CustomerOrderExternalTruckDialogBody>[0]) {
  // Guard before any hook: the body below may only mount when there is something to show.
  if (!props.open) return null;
  return <CustomerOrderExternalTruckDialogBody {...props} />;
}

function CustomerOrderExternalTruckDialogBody({
  open,
  onClose,
  lang,
  initialValues,
  onApply
}: Props) {

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const [activeTab, setActiveTab] = useState<"existing" | "new">("new");
  const [selectedRecentId, setSelectedRecentId] = useState<string>("");

  const [form, setForm] = useState<ExternalTruckFormData>({
    transporterName: initialValues?.transporterName || "",
    truckNumber: initialValues?.truckNumber || "",
    plateNumber: initialValues?.plateNumber || "",
    driverName: initialValues?.driverName || "",
    driverMobile: initialValues?.driverMobile || "",
    vehicleType: initialValues?.vehicleType || "Container Trailer",
    containerSize: initialValues?.containerSize || "40ft",
    loadingLocation: initialValues?.loadingLocation || "",
    arrivalDate: initialValues?.arrivalDate || new Date().toISOString().slice(0, 10),
    arrivalTime: initialValues?.arrivalTime || "14:30",
    status: initialValues?.status || "Active",
    remarks: initialValues?.remarks || ""
  });

  const [errors, setErrors] = useState<TemporaryTruckField[]>([]);

  useEffect(() => {
    if (open && initialValues) {
      setForm((prev) => ({ ...prev, ...initialValues }));
      setErrors([]);
    }
  }, [open, initialValues]);

  const handleSelectRecent = (trk: typeof RECENT_EXTERNAL_TRUCKS[0]) => {
    setSelectedRecentId(trk.id);
    setForm((prev) => ({
      ...prev,
      transporterName: trk.transporter,
      truckNumber: trk.id,
      plateNumber: trk.plateNo,
      driverName: trk.driver,
      driverMobile: trk.mobile,
      vehicleType: trk.vehicleType,
      containerSize: trk.containerSize
    }));
  };

  const handleSave = () => {
    const problems = temporaryTruckProblems({
      truckNumber: form.truckNumber || form.plateNumber,
      driverName: form.driverName,
      driverMobile: form.driverMobile
    });
    setErrors(problems);
    if (problems.length > 0) return;

    onApply({
      ...form,
      truckNumber: (form.truckNumber || form.plateNumber).trim(),
      plateNumber: (form.plateNumber || form.truckNumber).trim(),
      driverName: form.driverName.trim(),
      driverMobile: form.driverMobile.trim()
    });
    onClose();
  };

  const hasErr = (field: TemporaryTruckField) => errors.includes(field);

  const inputClass = (bad?: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-slate-100 ${
      bad
        ? "border-rose-400 dark:border-rose-700 bg-rose-50/30"
        : "border-slate-200 dark:border-slate-700 bg-white"
    }`;

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

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
        {/* Header matching reference-05.jpeg */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("select_other_external_truck", "Select Other / External Truck")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("external_truck_subtitle", "Search existing contractor trucks or add a new external truck for this order.")}
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

        {/* Top Mode Tabs */}
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("existing")}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              activeTab === "existing"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tt("existing_contractor_trucks", "Existing Contractor Trucks")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "new"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{tt("add_new_external_truck", "Add New External Truck")}</span>
          </button>
        </div>

        {/* 2-Column Content Area matching reference-05.jpeg */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5 mb-5">
          {/* LEFT: Add New External Truck Form */}
          <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-700/60">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Truck className="h-3.5 w-3.5" />
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {tt("add_new_external_truck", "Add New External Truck")}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {tt("external_truck_note", "Details stored for this order only. Does not write to Fleet Master.")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("transporter_contractor", "Transporter / Contractor")} *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={form.transporterName}
                    onChange={(e) => setForm({ ...form, transporterName: e.target.value })}
                    placeholder={tt("select_transporter_ph", "Select or type contractor name...")}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("truck_number", "Truck Number")} *
                </label>
                <input
                  type="text"
                  value={form.truckNumber}
                  onChange={(e) => setForm({ ...form, truckNumber: e.target.value })}
                  placeholder="e.g. TRK-786"
                  className={inputClass(hasErr("truck_number"))}
                />
                {hasErr("truck_number") && (
                  <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
                    {tt("tt_err_number", "Truck number is required.")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("vehicle_plate_no", "Vehicle Plate No")} *
                </label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  placeholder="e.g. KHI-7865"
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("driver_name", "Driver Name")} *
                </label>
                <input
                  type="text"
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  placeholder="e.g. Muhammad Ali"
                  className={inputClass(hasErr("driver_name"))}
                />
                {hasErr("driver_name") && (
                  <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
                    {tt("tt_err_driver", "Driver name is required.")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("driver_mobile", "Driver Mobile")} *
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={form.driverMobile}
                  onChange={(e) => setForm({ ...form, driverMobile: e.target.value })}
                  placeholder="+92 300 1234567"
                  className={inputClass(hasErr("driver_mobile") || hasErr("driver_mobile_invalid"))}
                />
                {(hasErr("driver_mobile") || hasErr("driver_mobile_invalid")) && (
                  <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
                    {tt("tt_err_mobile", "Valid mobile number with country code is required.")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("vehicle_type", "Vehicle Type")} *
                </label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  className={selectClass}
                >
                  <option value="Container Trailer">{tt("container_trailer", "Container Trailer")}</option>
                  <option value="Flat Bed Trailer">{tt("flat_bed_trailer", "Flat Bed Trailer")}</option>
                  <option value="Box Truck">{tt("box_truck", "Box Truck")}</option>
                  <option value="Reefer Truck">{tt("reefer_truck", "Reefer Truck")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("container_size", "Container Size")} *
                </label>
                <select
                  value={form.containerSize}
                  onChange={(e) => setForm({ ...form, containerSize: e.target.value })}
                  className={selectClass}
                >
                  <option value="20ft">20ft</option>
                  <option value="40ft">40ft</option>
                  <option value="40ft HQ">40ft HQ</option>
                  <option value="45ft">45ft</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("loading_location", "Loading Location / Terminal")} *
                </label>
                <input
                  type="text"
                  value={form.loadingLocation}
                  onChange={(e) => setForm({ ...form, loadingLocation: e.target.value })}
                  placeholder="e.g. Jebel Ali Gate 4"
                  className={inputClass()}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("arrival_date_time", "Arrival Date & Time")} *
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={form.arrivalDate}
                    onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })}
                    className={inputClass()}
                  />
                  <input
                    type="time"
                    value={form.arrivalTime}
                    onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                    className={inputClass()}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("truck_operational_status", "Truck Operational Status")} *
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={selectClass}
                >
                  <option value="Active">🟢 Active</option>
                  <option value="Standby">🟡 Standby</option>
                  <option value="Pending Assignment">⚪ Pending Assignment</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("remarks", "Remarks")}
                </label>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder={tt("external_truck_remarks_ph", "Enter any additional remarks about this truck...")}
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Recently Used External Trucks matching reference-05.jpeg */}
          <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-700/60">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <History className="h-3.5 w-3.5" />
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {tt("recently_used_external_trucks", "Recently Used External Trucks")}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {tt("quick_select_contractor_trucks", "Quickly select from previously used contractor trucks.")}
                </p>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {RECENT_EXTERNAL_TRUCKS.map((trk) => {
                const isSelected = selectedRecentId === trk.id;
                return (
                  <div
                    key={trk.id}
                    onClick={() => handleSelectRecent(trk)}
                    className={`cursor-pointer rounded-xl border p-3 transition flex items-start gap-3 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name="recentTruckChoice"
                      checked={isSelected}
                      onChange={() => handleSelectRecent(trk)}
                      className="mt-1 h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span className="font-mono font-black text-xs text-blue-700 dark:text-blue-400">
                            {trk.id}
                          </span>
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                            ({trk.plateNo})
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0 whitespace-nowrap">
                          {trk.usedAgo}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {trk.transporter}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tt("driver_label", "Driver")}: {trk.driver} • <span dir="ltr">{trk.mobile}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            {tt("cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition"
          >
            {tt("save_apply_truck", "Save & Apply Truck")}
          </button>
        </div>
      </div>
    </div>
  );
}
