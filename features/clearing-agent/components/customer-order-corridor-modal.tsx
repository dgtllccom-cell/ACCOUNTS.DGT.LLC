"use client";

import React, { useState, useEffect } from "react";
import {
  Route,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Trash2,
  Ship,
  Plane,
  Truck,
  Train,
  X,
  Check,
  Clock,
  Sparkles,
  MapPin,
  Anchor
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface RouteTransitLeg {
  id?: string;
  legNo: number;
  transportMode: "by_sea" | "by_road" | "by_air" | "by_rail";
  fromLocation: string;
  toLocation: string;
  carrierOrNotes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  originCountryId: string;
  originCountryName: string;
  originPortId: string;
  originPortName: string;
  destinationCountryId: string;
  destinationCountryName: string;
  destinationPortId: string;
  destinationPortName: string;
  currentRouteName: string;
  currentTransportMode: string;
  currentTransitDays?: number | string;
  initialLegs?: any[];
  countries: { id: string; name: string }[];
  ports: { id: string; name: string; country_id?: string; code?: string }[];
  onApplyRoute: (data: {
    routeName: string;
    transportMode: string;
    originCountryId: string;
    originCountryName: string;
    originPortId: string;
    originPortName: string;
    destinationCountryId: string;
    destinationCountryName: string;
    destinationPortId: string;
    destinationPortName: string;
    estimatedTransitDays: number;
    legs: RouteTransitLeg[];
    remarks?: string;
  }) => void;
}

export function CustomerOrderCorridorModal(props: Parameters<typeof CustomerOrderCorridorModalBody>[0]) {
  // Guard before any hook: the body below may only mount when there is something to show.
  if (!props.open) return null;
  return <CustomerOrderCorridorModalBody {...props} />;
}

function CustomerOrderCorridorModalBody({
  onClose,
  lang,
  originCountryId,
  originCountryName,
  originPortId,
  originPortName,
  destinationCountryId,
  destinationCountryName,
  destinationPortId,
  destinationPortName,
  currentRouteName,
  currentTransportMode,
  currentTransitDays,
  initialLegs = [],
  countries,
  ports,
  onApplyRoute
}: Props) {

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const [activeTab, setActiveTab] = useState<"quick" | "saved" | "recent" | "templates">("quick");
  const [fromCountryId, setFromCountryId] = useState(originCountryId || "");
  const [fromPortId, setFromPortId] = useState(originPortId || "");
  const [toCountryId, setToCountryId] = useState(destinationCountryId || "");
  const [toPortId, setToPortId] = useState(destinationPortId || "");

  const [legs, setLegs] = useState<RouteTransitLeg[]>(() => {
    if (initialLegs && initialLegs.length > 0) {
      return initialLegs.map((l: any, i: number) => ({
        id: l.id || `leg-${i + 1}`,
        legNo: i + 1,
        transportMode: l.transportMode || l.mode || "by_sea",
        fromLocation: l.fromLocationText || l.fromPortName || l.fromCountryName || "",
        toLocation: l.toLocationText || l.toPortName || l.toCountryName || "",
        carrierOrNotes: l.carrierOrNotes || ""
      }));
    }
    return [
      {
        id: "leg-1",
        legNo: 1,
        transportMode: "by_sea",
        fromLocation: originPortName || "Origin Port",
        toLocation: "Transit Hub",
        carrierOrNotes: ""
      },
      {
        id: "leg-2",
        legNo: 2,
        transportMode: "by_sea",
        fromLocation: "Transit Hub",
        toLocation: destinationPortName || "Destination Port",
        carrierOrNotes: ""
      }
    ];
  });

  const [transportMode, setTransportMode] = useState(currentTransportMode || "by_sea");
  const [transitDays, setTransitDays] = useState<number | string>(currentTransitDays || 22);
  const [remarks, setRemarks] = useState("");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [routeName, setRouteName] = useState(currentRouteName || "");

  const fromCountryName = countries.find((c) => c.id === fromCountryId)?.name || originCountryName || "";
  const toCountryName = countries.find((c) => c.id === toCountryId)?.name || destinationCountryName || "";
  const fromPortName = ports.find((p) => p.id === fromPortId)?.name || originPortName || "";
  const toPortName = ports.find((p) => p.id === toPortId)?.name || destinationPortName || "";

  // Auto-compose route name if empty or default
  useEffect(() => {
    const o = fromPortName || fromCountryName || "Origin";
    const d = toPortName || toCountryName || "Destination";
    const transitParts = legs
      .map((l) => l.toLocation)
      .filter((loc) => loc && loc !== d && loc !== "Transit Hub");
    const modeLabel = transportMode === "multi" ? "Multi-Modal" : transportMode.replace("by_", "");
    const generated =
      transitParts.length > 0
        ? `${o} → ${transitParts.join(" → ")} → ${d} (${modeLabel})`
        : `${o} → ${d} (${modeLabel})`;
    setRouteName(generated);
  }, [fromCountryName, toCountryName, fromPortName, toPortName, legs, transportMode]);

  const handleSwap = () => {
    const tmpC = fromCountryId;
    const tmpP = fromPortId;
    setFromCountryId(toCountryId);
    setFromPortId(toPortId);
    setToCountryId(tmpC);
    setToPortId(tmpP);
  };

  const handleAddLeg = () => {
    setLegs((prev) => [
      ...prev,
      {
        id: `leg-${prev.length + 1}`,
        legNo: prev.length + 1,
        transportMode: "by_road",
        fromLocation: prev[prev.length - 1]?.toLocation || toPortName || "",
        toLocation: "Destination City / Warehouse",
        carrierOrNotes: ""
      }
    ]);
  };

  const handleRemoveLeg = (idx: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, legNo: i + 1 })));
  };

  const handleApply = () => {
    onApplyRoute({
      routeName: routeName || `${fromCountryName} → ${toCountryName}`,
      transportMode,
      originCountryId: fromCountryId,
      originCountryName: fromCountryName,
      originPortId: fromPortId,
      originPortName: fromPortName,
      destinationCountryId: toCountryId,
      destinationCountryName: toCountryName,
      destinationPortId: toPortId,
      destinationPortName: toPortName,
      estimatedTransitDays: Number(transitDays) || 0,
      legs,
      remarks
    });
    onClose();
  };

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

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
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header matching reference-07.jpeg */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("corridor_builder_title", "Route via Corridor Builder")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("corridor_builder_subtitle", "Create or select a multi-country/multi-modal route for this order")}
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

        {/* Navigation Tabs */}
        <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === "quick"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tt("tab_quick_route", "Quick Route")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === "saved"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tt("tab_saved_routes", "Saved Routes")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("recent")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === "recent"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tt("tab_recent_routes", "Recent Routes")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === "templates"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {tt("tab_templates", "Templates")}
          </button>
        </div>

        {/* Section 1: Countries & Ports */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
              1
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {tt("step1_select_countries", "1. Select Countries & Ports")}
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
            {/* Origin Side */}
            <div className="space-y-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                {tt("from_origin", "From (Origin)")}
              </span>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("country", "Country")} *
                </label>
                <select
                  value={fromCountryId}
                  onChange={(e) => setFromCountryId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— {tt("select_country", "Select Country")} —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("port_or_city", "Port / City")} *
                </label>
                <select
                  value={fromPortId}
                  onChange={(e) => setFromPortId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— {tt("select_port", "Select Port / Terminal")} —</option>
                  {ports
                    .filter((p) => !fromCountryId || p.country_id === fromCountryId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center my-1 md:my-0">
              <button
                type="button"
                onClick={handleSwap}
                className="h-9 w-9 rounded-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 hover:text-blue-600 hover:scale-105 transition"
                title={tt("swap_origin_destination", "Swap Origin and Destination")}
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            {/* Destination Side */}
            <div className="space-y-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                {tt("to_destination", "To (Destination)")}
              </span>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("country", "Country")} *
                </label>
                <select
                  value={toCountryId}
                  onChange={(e) => setToCountryId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— {tt("select_country", "Select Country")} —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                  {tt("port_or_city", "Port / City")} *
                </label>
                <select
                  value={toPortId}
                  onChange={(e) => setToPortId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— {tt("select_port", "Select Port / Terminal")} —</option>
                  {ports
                    .filter((p) => !toCountryId || p.country_id === toCountryId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.code ? `(${p.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Transit Legs */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
                2
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tt("step2_add_transit", "2. Add Transit (Optional)")}
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              {legs.length} {tt("transit_legs", "Transit Leg(s)")}
            </span>
          </div>

          <div className="space-y-2.5">
            {legs.map((leg, idx) => (
              <div
                key={leg.id || idx}
                className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs">
                  {idx + 1}
                </span>

                {/* Transport Mode */}
                <select
                  value={leg.transportMode}
                  onChange={(e) => {
                    const mode = e.target.value as any;
                    setLegs((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, transportMode: mode } : l))
                    );
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="by_sea">🚢 By Sea</option>
                  <option value="by_road">🚛 By Road</option>
                  <option value="by_air">✈️ By Air</option>
                  <option value="by_rail">🚆 By Train</option>
                </select>

                {/* From Location */}
                <input
                  type="text"
                  value={leg.fromLocation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLegs((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, fromLocation: val } : l))
                    );
                  }}
                  placeholder={tt("from_port_city", "From (Port/City)")}
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                {/* To Location */}
                <input
                  type="text"
                  value={leg.toLocation}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLegs((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, toLocation: val } : l))
                    );
                  }}
                  placeholder={tt("to_transit_hub_port", "To (Transit Hub/Port)")}
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                {/* Delete Leg */}
                <button
                  type="button"
                  onClick={() => handleRemoveLeg(idx)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition shrink-0"
                  title={tt("remove_leg", "Remove Leg")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddLeg}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tt("add_transit_leg", "+ Add Transit Leg")}</span>
            </button>
          </div>
        </div>

        {/* Section 3: Route Details */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
              3
            </span>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {tt("step3_route_details", "3. Route Details")}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                {tt("route_name", "Route Name")} *
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                {tt("transport_mode", "Transport Mode")}
              </label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                className={selectClass}
              >
                <option value="multi">{tt("multi_modal", "Multi-Modal")}</option>
                <option value="by_sea">{tt("mode_sea", "By Sea")}</option>
                <option value="by_road">{tt("mode_road", "By Road")}</option>
                <option value="by_air">{tt("mode_air", "By Air")}</option>
                <option value="by_rail">{tt("mode_train", "By Train")}</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                {tt("estimated_transit_time", "Estimated Transit Time (Days)")}
              </label>
              <input
                type="number"
                min="1"
                value={transitDays}
                onChange={(e) => setTransitDays(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-0.5">
                {tt("route_remarks", "Remarks")}
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={tt("route_remarks_ph", "Enter route remarks (optional)...")}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="saveTemplateCheckbox"
              checked={saveTemplate}
              onChange={(e) => setSaveTemplate(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="saveTemplateCheckbox" className="text-xs text-slate-600 dark:text-slate-300">
              {tt("save_as_template", "Save as Template for future use")}
            </label>
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
            onClick={handleApply}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition"
          >
            {tt("apply_route", "Apply Route")}
          </button>
        </div>
      </div>
    </div>
  );
}
