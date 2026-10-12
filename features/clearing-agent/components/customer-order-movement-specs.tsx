"use client";

import React, { useState } from "react";
import {
  Ship,
  Truck,
  Plane,
  Train,
  ArrowRightLeft,
  Repeat2,
  RotateCw,
  Calendar,
  Building2,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Navigation,
  CheckCircle2,
  Sparkles,
  MapPin,
  FileCheck2,
  Info
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type MovementType = "import" | "export" | "re_export" | "up_transit" | "down_transit" | "transit" | "domestic";
export type TransportMode = "by_sea" | "by_road" | "by_air" | "by_rail";

interface CountryRow {
  id: string;
  name: string;
}

interface PortRow {
  id: string;
  port_name: string;
  country_id?: string | null;
  transport_type?: string | null;
}

interface Props {
  lang: SupportedLanguage;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  countries: CountryRow[];
  ports: PortRow[];
  handleLoadingCountryChange: (countryId: string) => void;
  handleLoadingPortChange: (portId: string) => void;
  handleReceivingCountryChange: (countryId: string) => void;
  handleDestinationPortChange: (portId: string) => void;
  portsFor: (countryId: string, keepId?: string) => PortRow[];
  locLabel: (role: "loading" | "entry" | "exit" | "discharge") => string;
  selectClass: string;
  inputClass: string;
  tt: (key: string, fb: string) => string;
}

// Regional Presets for quick-select based on the selected country
const COUNTRY_PORT_PRESETS: Record<string, { name: string; mode: string }[]> = {
  // Pakistan
  PK: [
    { name: "Karachi Port (KPT)", mode: "sea" },
    { name: "Port Qasim (PQA)", mode: "sea" },
    { name: "Gwadar Port", mode: "sea" },
    { name: "Torkham Border", mode: "road" },
    { name: "Chaman Border", mode: "road" },
    { name: "Taftan Border", mode: "road" },
    { name: "Khunjerab / Sost", mode: "road" },
    { name: "Wagah Border", mode: "road" }
  ],
  // United Arab Emirates
  AE: [
    { name: "Jebel Ali Port (JAFZA)", mode: "sea" },
    { name: "Port Rashid", mode: "sea" },
    { name: "Khalifa Port (Abu Dhabi)", mode: "sea" },
    { name: "Sharjah Port Khalid", mode: "sea" },
    { name: "DXB Air Cargo", mode: "air" },
    { name: "Ghuwaifat (KSA Border)", mode: "road" },
    { name: "Hatta (Oman Border)", mode: "road" }
  ],
  // Afghanistan
  AF: [
    { name: "Torkham Border", mode: "road" },
    { name: "Spin Boldak / Chaman", mode: "road" },
    { name: "Islam Qala (Iran Border)", mode: "road" },
    { name: "Hairatan (Uzbekistan Border)", mode: "road" },
    { name: "Shir Khan Bandar (Tajikistan)", mode: "road" },
    { name: "Zaranj Border", mode: "road" }
  ],
  // Iran
  IR: [
    { name: "Bandar Abbas (Shahid Rajaee)", mode: "sea" },
    { name: "Chabahar Port", mode: "sea" },
    { name: "Mirjaveh Border", mode: "road" },
    { name: "Dogharoon Border", mode: "road" }
  ],
  // India
  IN: [
    { name: "Nhava Sheva (JNPT)", mode: "sea" },
    { name: "Mundra Port", mode: "sea" },
    { name: "Attari / Wagah Border", mode: "road" },
    { name: "Chennai Port", mode: "sea" }
  ]
};

const COMMON_CUSTOMS_HOUSES: Record<string, string[]> = {
  PK: [
    "Karachi Custom House",
    "Port Muhammad Bin Qasim Customs",
    "Torkham Customs Station",
    "Chaman Customs Station",
    "Air Freight Unit (AFU) Karachi",
    "Lahore Dry Port Customs",
    "Peshawar Dry Port Customs"
  ],
  AE: [
    "Dubai Customs — Jebel Ali Port & FZ",
    "Dubai Customs — Cargo Village (DXB)",
    "Abu Dhabi Customs — Khalifa Port",
    "Sharjah Customs — Port Khalid",
    "Ghuwaifat Customs Center (KSA Border)"
  ],
  AF: [
    "Kabul Customs Directorate",
    "Nangarhar (Torkham) Customs",
    "Kandahar (Spin Boldak) Customs",
    "Herat (Islam Qala) Customs",
    "Balkh (Hairatan) Customs"
  ]
};

export function CustomerOrderMovementSpecs({
  lang,
  formData,
  setFormData,
  countries,
  ports,
  handleLoadingCountryChange,
  handleLoadingPortChange,
  handleReceivingCountryChange,
  handleDestinationPortChange,
  portsFor,
  locLabel,
  selectClass,
  inputClass,
  tt
}: Props) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Customs required toggle state (defaults to true if customs_point_text has content, otherwise true)
  const isCustomsRequired = formData.customs_required !== false;

  const setCustomsRequired = (required: boolean) => {
    setFormData((c: any) => ({
      ...c,
      customs_required: required,
      ...(required ? {} : { customs_point_text: "" })
    }));
  };

  const getCountryCode = (countryId: string): string => {
    const c = countries.find((item) => item.id === countryId);
    if (!c) return "";
    const name = c.name.toLowerCase();
    if (name.includes("pakistan")) return "PK";
    if (name.includes("emirates") || name.includes("uae") || name.includes("dubai")) return "AE";
    if (name.includes("afghanistan")) return "AF";
    if (name.includes("iran")) return "IR";
    if (name.includes("india")) return "IN";
    return "";
  };

  const modeIcon = () => {
    const m = String(formData.transport_mode || "by_sea");
    if (m === "by_road") return <Truck className="h-4 w-4 text-emerald-600" />;
    if (m === "by_air") return <Plane className="h-4 w-4 text-sky-600" />;
    if (m === "by_rail") return <Train className="h-4 w-4 text-amber-600" />;
    return <Ship className="h-4 w-4 text-blue-600" />;
  };

  const arrivedAtEntry = formData.movement_type === "import" && formData.import_scenario === "arrived_at_entry";

  // Quick preset chips helper
  const renderPresets = (countryCode: string, onSelectPreset: (label: string) => void) => {
    const list = COUNTRY_PORT_PRESETS[countryCode];
    if (!list || !list.length) return null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-semibold text-slate-400">
          {tt("quick_suggestions", "Suggestions:")}
        </span>
        {list.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPreset(item.name)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 transition"
          >
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderCustomsHouses = (countryCode: string) => {
    const list = COMMON_CUSTOMS_HOUSES[countryCode] || COMMON_CUSTOMS_HOUSES["PK"];
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-semibold text-slate-400">
          {tt("custom_house_suggestions", "Customs House:")}
        </span>
        {list.map((ch, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setFormData((c: any) => ({ ...c, customs_point_text: ch, customs_clearance_office: ch }))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 transition"
          >
            <span>{ch}</span>
          </button>
        ))}
      </div>
    );
  };

  // Customs Yes/No Selector Block
  const renderCustomsSwitch = (label?: string) => (
    <div className="space-y-2 rounded-xl border border-slate-200/90 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
            <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{label || tt("customs_clearance_required_q", "Customs Clearance Required?")}</span>
          </label>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {isCustomsRequired
              ? tt("customs_required_sub", "Customs declaration, inspection and official clearance required.")
              : tt("customs_exempt_sub", "Exempt from customs clearance / direct cargo release.")}
          </p>
        </div>

        {/* Yes / No Segmented Button */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCustomsRequired(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
              isCustomsRequired
                ? "bg-white text-blue-700 shadow-2xs dark:bg-slate-900 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{tt("yes_customs_required", "Yes — Required")}</span>
          </button>
          <button
            type="button"
            onClick={() => setCustomsRequired(false)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
              !isCustomsRequired
                ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{tt("no_customs_exempt", "No — Direct / Exempt")}</span>
          </button>
        </div>
      </div>

      {isCustomsRequired ? (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-150">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("customs_clearance_point", "Customs Clearance Point / Port")} *
          </label>
          <input
            type="text"
            placeholder={tt("ph_customs_point", "e.g. Karachi Custom House / Torkham Customs")}
            value={formData.customs_point_text || ""}
            onChange={(e) =>
              setFormData((c: any) => ({
                ...c,
                customs_point_text: e.target.value,
                customs_clearance_office: e.target.value
              }))
            }
            className={inputClass}
          />
          {renderCustomsHouses(getCountryCode(formData.receiving_country_id || formData.loading_country_id))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{tt("customs_exempt_badge", "No Customs Clearance Required — Direct Movement & Delivery")}</span>
        </div>
      )}
    </div>
  );

  // =========================================================================
  // SCENARIO 1: STANDARD IMPORT (سادہ امپورٹ)
  // =========================================================================
  if (formData.movement_type === "import") {
    const originCountryCode = getCountryCode(formData.loading_country_id);
    const entryCountryCode = getCountryCode(formData.receiving_country_id);

    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-4 dark:border-sky-900/60 dark:bg-sky-950/20 shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-200/70 pb-2.5 dark:border-sky-900/60">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white shadow-xs">
              <Ship className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-sky-900 dark:text-sky-200">
                {tt("import_movement_route", "Import Movement & Route Specifications")}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tt("import_route_subtitle", "Configure origin loading, entry gateway border/port, customs requirement and destination.")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-sky-200 dark:bg-slate-900 dark:border-sky-900 text-sky-800 dark:text-sky-300">
              {modeIcon()}
              <span>{locLabel("entry")}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-600 text-white shadow-2xs">
              {tt("import_clearance_badge", "Import Clearance")}
            </span>
          </div>
        </div>

        {/* Import scenario selector: collect from origin vs already arrived */}
        <div className="rounded-xl border border-sky-100 bg-white/80 p-3 dark:border-sky-900/50 dark:bg-slate-900/60">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("import_scenario_label", "Import Scenario")} *
          </label>
          <select
            value={formData.import_scenario}
            onChange={(e) =>
              setFormData((c: any) => ({
                ...c,
                import_scenario: e.target.value as "collect_from_origin" | "arrived_at_entry"
              }))
            }
            className={selectClass}
          >
            <option value="collect_from_origin">
              {tt("import_scn_origin", "Collect goods from the foreign origin and arrange the journey (بیرون ملک سے مال اٹھانا اور لانا)")}
            </option>
            <option value="arrived_at_entry">
              {tt("import_scn_arrived", "Goods already arrived at the entry border / port — clear and arrange onward delivery (مال پورٹ پہنچ چکا ہے)")}
            </option>
          </select>
        </div>

        {/* Row 1: Foreign Origin Country & Loading Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("foreign_origin_country", "Loading Country (Origin)")} *
            </label>
            <select
              value={formData.loading_country_id}
              onChange={(e) => handleLoadingCountryChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— {tt("select_origin_country", "Select Origin Country")} —</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className={arrivedAtEntry ? "hidden" : ""}>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {locLabel("loading")}
            </label>
            <select
              value={formData.loading_port_id}
              onChange={(e) => handleLoadingPortChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— {tt("loc_select_generic", "Select location")} —</option>
              {portsFor(formData.loading_country_id, formData.loading_port_id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.port_name}
                </option>
              ))}
            </select>
            {renderPresets(originCountryCode, (val) => {
              const matched = ports.find((p) => p.port_name.toLowerCase().includes(val.toLowerCase()));
              if (matched) handleLoadingPortChange(matched.id);
              else setFormData((c: any) => ({ ...c, loading_source_name: val, loading_port_name: val }));
            })}
          </div>
        </div>

        {/* Row 2: Entry Gateway & Arrival Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {locLabel("entry")} *
            </label>
            <select
              value={formData.entry_border_port_id}
              onChange={(e) => {
                const p = ports.find((item) => item.id === e.target.value);
                setFormData((c: any) => ({
                  ...c,
                  entry_border_port_id: e.target.value,
                  entry_border_port_name: p?.port_name || ""
                }));
              }}
              className={selectClass}
            >
              <option value="">— {tt("loc_select_generic", "Select location")} —</option>
              {portsFor(formData.receiving_country_id, formData.entry_border_port_id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.port_name}
                </option>
              ))}
            </select>
            {renderPresets(entryCountryCode || "PK", (val) => {
              const matched = ports.find((p) => p.port_name.toLowerCase().includes(val.toLowerCase()));
              if (matched) {
                setFormData((c: any) => ({
                  ...c,
                  entry_border_port_id: matched.id,
                  entry_border_port_name: matched.port_name
                }));
              } else {
                setFormData((c: any) => ({
                  ...c,
                  entry_border_port_name: val
                }));
              }
            })}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {arrivedAtEntry
                ? tt("arrived_on_date", "Arrival Date at Entry")
                : tt("expected_border_entry_date", "Expected Border Entry Date")}
            </label>
            <input
              type="date"
              value={formData.border_entry_date}
              onChange={(e) => setFormData((c: any) => ({ ...c, border_entry_date: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 3: Customs Clearance Yes / No Switch */}
        {renderCustomsSwitch()}

        {/* Row 4: Destination Delivery City & Final Delivery Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("destination_delivery_city", "Destination Delivery City")}
            </label>
            <input
              type="text"
              placeholder={tt("ph_destination_city_pk", "e.g. Lahore / Islamabad / Peshawar / Dubai")}
              value={formData.destination_city}
              onChange={(e) => setFormData((c: any) => ({ ...c, destination_city: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("final_delivery_location", "Final Destination / Warehouse Address")}
            </label>
            <input
              type="text"
              placeholder={tt("ph_final_delivery", "e.g. Consignee Warehouse, Plot 14, Industrial Area")}
              value={formData.final_delivery_location}
              onChange={(e) => setFormData((c: any) => ({ ...c, final_delivery_location: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCENARIO 2: IMPORT RE-EXPORT (امپورٹ ری ایکسپورٹ - Inward Import + Outward Export)
  // =========================================================================
  if (formData.movement_type === "re_export") {
    const originCountryCode = getCountryCode(formData.loading_country_id);
    const destCountryCode = getCountryCode(formData.receiving_country_id);

    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-200/70 pb-2.5 dark:border-indigo-900/60">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <RotateCw className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                {tt("reexport_movement_route", "Import Re-Export & Transit Hub Setup")}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tt("reexport_subtitle", "Multi-stage cross-trade: Inbound from foreign origin into hub, followed by outbound re-export.")}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white shadow-2xs">
            {tt("reexport_clearance_badge", "Re-Export / Cross-Trade")}
          </span>
        </div>

        {/* Panel A: Inbound / Import Phase */}
        <div className="rounded-xl border border-indigo-200/80 bg-white/90 p-3.5 space-y-3 dark:border-indigo-900/70 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-800 dark:text-indigo-300">
              <ArrowDownLeft className="h-3.5 w-3.5 text-indigo-600" />
              <span>{tt("inbound_phase_title", "Phase 1: Inbound / Import Journey (درآمدی مرحلہ)")}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              {tt("origin_to_hub", "Origin → Transit Hub")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tt("foreign_origin_country", "Loading Country (Origin)")} *
              </label>
              <select
                value={formData.loading_country_id}
                onChange={(e) => handleLoadingCountryChange(e.target.value)}
                className={selectClass}
              >
                <option value="">— {tt("select_origin_country", "Select Origin Country")} —</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locLabel("loading")}
              </label>
              <select
                value={formData.loading_port_id}
                onChange={(e) => handleLoadingPortChange(e.target.value)}
                className={selectClass}
              >
                <option value="">— {tt("loc_select_generic", "Select location")} —</option>
                {portsFor(formData.loading_country_id, formData.loading_port_id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.port_name}
                  </option>
                ))}
              </select>
              {renderPresets(originCountryCode, (val) => {
                const matched = ports.find((p) => p.port_name.toLowerCase().includes(val.toLowerCase()));
                if (matched) handleLoadingPortChange(matched.id);
                else setFormData((c: any) => ({ ...c, loading_source_name: val, loading_port_name: val }));
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locLabel("entry")} (Hub Entry Gateway) *
              </label>
              <select
                value={formData.entry_border_port_id}
                onChange={(e) => {
                  const p = ports.find((item) => item.id === e.target.value);
                  setFormData((c: any) => ({
                    ...c,
                    entry_border_port_id: e.target.value,
                    entry_border_port_name: p?.port_name || ""
                  }));
                }}
                className={selectClass}
              >
                <option value="">— {tt("loc_select_generic", "Select location")} —</option>
                {portsFor("", formData.entry_border_port_id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.port_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tt("expected_hub_entry_date", "Expected Arrival Date at Hub")}
              </label>
              <input
                type="date"
                value={formData.border_entry_date}
                onChange={(e) => setFormData((c: any) => ({ ...c, border_entry_date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Panel B: Outbound / Re-Export Phase */}
        <div className="rounded-xl border border-indigo-200/80 bg-white/90 p-3.5 space-y-3 dark:border-indigo-900/70 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-800 dark:text-indigo-300">
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
              <span>{tt("outbound_phase_title", "Phase 2: Outbound / Re-Export Journey (ری ایکسپورٹ مرحلہ)")}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              {tt("hub_to_dest", "Transit Hub → Destination")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tt("destination_country", "Re-Export Destination Country")} *
              </label>
              <select
                value={formData.receiving_country_id}
                onChange={(e) => handleReceivingCountryChange(e.target.value)}
                className={selectClass}
              >
                <option value="">— {tt("select_destination_country", "Select Destination Country")} —</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locLabel("exit")} (Outbound Gateway) *
              </label>
              <select
                value={formData.exit_border_port_id}
                onChange={(e) => {
                  const p = ports.find((item) => item.id === e.target.value);
                  setFormData((c: any) => ({
                    ...c,
                    exit_border_port_id: e.target.value,
                    exit_border_port_name: p?.port_name || ""
                  }));
                }}
                className={selectClass}
              >
                <option value="">— {tt("loc_select_generic", "Select location")} —</option>
                {portsFor("", formData.exit_border_port_id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.port_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tt("planned_reexport_date", "Planned Departure / Sailing Date")}
              </label>
              <input
                type="date"
                value={formData.planned_border_exit_date}
                onChange={(e) => setFormData((c: any) => ({ ...c, planned_border_exit_date: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {locLabel("discharge")} (Destination City / Port)
              </label>
              <input
                type="text"
                placeholder={tt("ph_destination_city_pk", "e.g. Dubai / Bandar Abbas / Kabul / Mumbai")}
                value={formData.destination_city}
                onChange={(e) => setFormData((c: any) => ({ ...c, destination_city: e.target.value }))}
                className={inputClass}
              />
              {renderPresets(destCountryCode, (val) => {
                setFormData((c: any) => ({ ...c, destination_city: val }));
              })}
            </div>
          </div>
        </div>

        {/* Customs Clearance Switch */}
        {renderCustomsSwitch(tt("reexport_customs_label", "Re-Export Customs Declaration & Inspection Required?"))}
      </div>
    );
  }

  // =========================================================================
  // SCENARIO 3: BONDED TRANSIT (ٹرانزٹ - Up-Transit / Down-Transit / Pure Transit)
  // =========================================================================
  if (
    formData.movement_type === "transit" ||
    formData.movement_type === "up_transit" ||
    formData.movement_type === "down_transit"
  ) {
    const activeTransitFlow =
      formData.movement_type === "down_transit"
        ? "down_transit"
        : formData.movement_type === "transit"
        ? "transit"
        : "up_transit";

    const setTransitFlow = (val: "up_transit" | "down_transit" | "transit") => {
      setFormData((c: any) => ({
        ...c,
        movement_type: val
      }));
    };

    return (
      <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 space-y-4 dark:border-purple-900/60 dark:bg-purple-950/20 shadow-2xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-200/70 pb-2.5 dark:border-purple-900/60">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
              <Repeat2 className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-200">
                {tt("bonded_transit_movement", "Bonded Transit Movement Specifications")}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tt("transit_movement_desc", "Configure bonded transit corridor through national territory to third country destination.")}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white shadow-2xs uppercase">
            {formData.movement_type.replace("_", " ")}
          </span>
        </div>

        {/* Transit Flow Direction Selector (Up-Transit vs Down-Transit vs Through Transit) */}
        <div className="space-y-1.5 rounded-xl border border-purple-200/80 bg-white/90 p-3 dark:border-purple-900/60 dark:bg-slate-900/70">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {tt("transit_flow_label", "Transit Flow Direction (ٹرانزٹ کا رخ)")} *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1. Up-Transit */}
            <button
              type="button"
              onClick={() => setTransitFlow("up_transit")}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                activeTransitFlow === "up_transit"
                  ? "border-purple-500 bg-purple-50/90 ring-2 ring-purple-500/20 dark:bg-purple-950/40"
                  : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <ArrowUpRight className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {tt("up_transit_title", "Up-Transit")}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                  {tt("up_transit_desc", "Seaport / Gateway → Inland Country (e.g. Karachi → Torkham → Afghanistan)")}
                </span>
              </div>
            </button>

            {/* 2. Down-Transit */}
            <button
              type="button"
              onClick={() => setTransitFlow("down_transit")}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                activeTransitFlow === "down_transit"
                  ? "border-purple-500 bg-purple-50/90 ring-2 ring-purple-500/20 dark:bg-purple-950/40"
                  : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <ArrowDownLeft className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {tt("down_transit_title", "Down-Transit")}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                  {tt("down_transit_desc", "Inland Country → Seaport / Exit Gateway (e.g. Afghanistan → Karachi Port)")}
                </span>
              </div>
            </button>

            {/* 3. Through Transit */}
            <button
              type="button"
              onClick={() => setTransitFlow("transit")}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                activeTransitFlow === "transit"
                  ? "border-purple-500 bg-purple-50/90 ring-2 ring-purple-500/20 dark:bg-purple-950/40"
                  : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <Repeat2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {tt("through_transit_title", "Through Transit")}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                  {tt("through_transit_desc", "Border to Border Transit across national territory")}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Row 1: Loading Country & Entry Gateway */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("loading_origin_country", "Origin Country (Where Loaded)")} *
            </label>
            <select
              value={formData.loading_country_id}
              onChange={(e) => handleLoadingCountryChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— {tt("select_country_generic", "Select Country")} —</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {locLabel("entry")} (Inbound Entry Gateway) *
            </label>
            <select
              value={formData.entry_border_port_id}
              onChange={(e) => {
                const p = ports.find((item) => item.id === e.target.value);
                setFormData((c: any) => ({
                  ...c,
                  entry_border_port_id: e.target.value,
                  entry_border_port_name: p?.port_name || ""
                }));
              }}
              className={selectClass}
            >
              <option value="">— {tt("loc_select_generic", "Select location")} —</option>
              {portsFor("", formData.entry_border_port_id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.port_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Inward Arrival Date & Exit Border Checkpoint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("expected_border_entry_date", "Expected Entry Arrival Date")}
            </label>
            <input
              type="date"
              value={formData.border_entry_date}
              onChange={(e) => setFormData((c: any) => ({ ...c, border_entry_date: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("exit_border_checkpoint", "Exit Border Checkpoint (Exit Gateway)")} *
            </label>
            <select
              value={formData.exit_border_port_id}
              onChange={(e) => {
                const p = ports.find((item) => item.id === e.target.value);
                setFormData((c: any) => ({
                  ...c,
                  exit_border_port_id: e.target.value,
                  exit_border_port_name: p?.port_name || ""
                }));
              }}
              className={selectClass}
            >
              <option value="">— {tt("select_exit_border", "Select Exit Border")} —</option>
              {portsFor("", formData.exit_border_port_id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.port_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Planned Border Exit Date & Transit Destination Country */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("planned_border_exit_date", "Planned Border Exit Date")}
            </label>
            <input
              type="date"
              value={formData.planned_border_exit_date}
              onChange={(e) => setFormData((c: any) => ({ ...c, planned_border_exit_date: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("transit_destination_country", "Final Transit Destination Country")} *
            </label>
            <select
              value={formData.receiving_country_id}
              onChange={(e) => handleReceivingCountryChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— {tt("select_country_generic", "Select Country")} —</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4: Final Transit Destination City & Customs Clearance Switch */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("destination_city_label", "Final Destination City")}
          </label>
          <input
            type="text"
            placeholder={tt("ph_destination_city_af", "e.g. Kabul / Kandahar / Mazar-i-Sharif / Tashkent")}
            value={formData.destination_city}
            onChange={(e) => setFormData((c: any) => ({ ...c, destination_city: e.target.value }))}
            className={inputClass}
          />
        </div>

        {renderCustomsSwitch(tt("transit_customs_escort_label", "Transit Customs Bond & Escort Clearance Required?"))}
      </div>
    );
  }

  // =========================================================================
  // SCENARIO 4: STANDARD EXPORT (سادہ ایکسپورٹ)
  // =========================================================================
  const exportCountryCode = getCountryCode(formData.loading_country_id);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2.5 dark:border-emerald-900/60">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <ArrowUpRight className="h-4 w-4" />
          </span>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
              {tt("export_movement_route", "Export Movement & Route Specifications")}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tt("export_movement_desc", "Configure local loading location, departure border/port, export customs and destination country.")}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">
          {tt("export_clearance_badge", "Export Clearance")}
        </span>
      </div>

      {/* Row 1: Origin Loading City / Factory & Exit Border / Port */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("origin_loading_city_location", "Origin Loading City / Location")} *
          </label>
          <input
            type="text"
            placeholder={tt("ph_origin_loading_city", "e.g. Lahore / Sialkot Factory / Karachi Warehouse")}
            value={formData.loading_source_name}
            onChange={(e) => setFormData((c: any) => ({ ...c, loading_source_name: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {locLabel("exit")} *
          </label>
          <select
            value={formData.exit_border_port_id || formData.loading_port_id}
            onChange={(e) => {
              const p = ports.find((item) => item.id === e.target.value);
              setFormData((c: any) => ({
                ...c,
                exit_border_port_id: e.target.value,
                exit_border_port_name: p?.port_name || "",
                loading_port_id: e.target.value,
                loading_port_name: p?.port_name || ""
              }));
            }}
            className={selectClass}
          >
            <option value="">— {tt("loc_select_generic", "Select location")} —</option>
            {portsFor(formData.loading_country_id, formData.exit_border_port_id || formData.loading_port_id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.port_name}
              </option>
            ))}
          </select>
          {renderPresets(exportCountryCode || "PK", (val) => {
            const matched = ports.find((p) => p.port_name.toLowerCase().includes(val.toLowerCase()));
            if (matched) {
              setFormData((c: any) => ({
                ...c,
                exit_border_port_id: matched.id,
                exit_border_port_name: matched.port_name
              }));
            } else {
              setFormData((c: any) => ({ ...c, exit_border_port_name: val }));
            }
          })}
        </div>
      </div>

      {/* Row 2: Planned Border Exit Date & Destination Country */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("planned_border_exit_date", "Planned Departure / Border Exit Date")}
          </label>
          <input
            type="date"
            value={formData.planned_border_exit_date}
            onChange={(e) => setFormData((c: any) => ({ ...c, planned_border_exit_date: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tt("destination_country", "Final Destination Country")} *
          </label>
          <select
            value={formData.receiving_country_id}
            onChange={(e) => handleReceivingCountryChange(e.target.value)}
            className={selectClass}
          >
            <option value="">— {tt("select_destination_country", "Select Destination Country")} —</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Destination Port / City */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
          {locLabel("discharge")} (Destination Port / Delivery City)
        </label>
        <select
          value={formData.destination_port_id}
          onChange={(e) => handleDestinationPortChange(e.target.value)}
          className={selectClass}
        >
          <option value="">— {tt("loc_select_generic", "Select location")} —</option>
          {portsFor(formData.receiving_country_id, formData.destination_port_id).map((p) => (
            <option key={p.id} value={p.id}>
              {p.port_name}
            </option>
          ))}
        </select>
      </div>

      {/* Customs Clearance Switch */}
      {renderCustomsSwitch(tt("export_customs_required_q", "Export Customs Clearance Required?"))}
    </div>
  );
}
