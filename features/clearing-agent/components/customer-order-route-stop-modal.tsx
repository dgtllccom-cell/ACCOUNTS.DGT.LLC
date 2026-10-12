"use client";

import React, { useState, useEffect } from "react";
import {
  Route,
  MapPin,
  Building2,
  Users,
  ShieldCheck,
  Clock,
  FileText,
  Truck,
  Ship,
  Plane,
  Train,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { RouteStop } from "@/features/clearing-agent/components/customer-order-route-builder";

interface CustomerOrderRouteStopModalProps {
  open: boolean;
  onClose: () => void;
  lang?: SupportedLanguage;
  mode: "add" | "edit";
  stopIndex?: number;
  initialValues?: Partial<RouteStop>;
  countries: { id: string; name: string }[];
  ledgers?: { id: string; name: string; code?: string; currency?: string }[];
  originName?: string;
  destinationName?: string;
  onSave: (stopData: RouteStop, isEdit: boolean, index?: number) => void;
}

export function CustomerOrderRouteStopModal({
  open,
  onClose,
  lang = "en",
  mode,
  stopIndex = 0,
  initialValues,
  countries = [],
  ledgers = [],
  originName = "Origin",
  destinationName = "Destination",
  onSave
}: CustomerOrderRouteStopModalProps) {
  if (!open) return null;

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const [countryId, setCountryId] = useState(initialValues?.countryId || "");
  const [countryName, setCountryName] = useState(initialValues?.countryName || "");
  const [locationName, setLocationName] = useState(initialValues?.locationName || "");
  const [customsPoint, setCustomsPoint] = useState(initialValues?.customsPoint || "");
  const [transportMode, setTransportMode] = useState<"by_road" | "by_sea" | "by_air" | "by_rail">(
    initialValues?.mode || "by_road"
  );
  const [handlerType, setHandlerType] = useState<"our_branch" | "external_partner">(
    initialValues?.handlerType || "our_branch"
  );
  const [partnerType, setPartnerType] = useState(initialValues?.partnerType || "");
  const [partnerName, setPartnerName] = useState(initialValues?.partnerName || "");
  const [partnerAccountId, setPartnerAccountId] = useState(initialValues?.partnerAccountId || "");
  const [insuranceRequired, setInsuranceRequired] = useState(Boolean(initialValues?.insuranceRequired));
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialValues) {
      setCountryId(initialValues.countryId || "");
      setCountryName(initialValues.countryName || "");
      setLocationName(initialValues.locationName || "");
      setCustomsPoint(initialValues.customsPoint || "");
      setTransportMode(initialValues.mode || "by_road");
      setHandlerType(initialValues.handlerType || "our_branch");
      setPartnerType(initialValues.partnerType || "");
      setPartnerName(initialValues.partnerName || "");
      setPartnerAccountId(initialValues.partnerAccountId || "");
      setInsuranceRequired(Boolean(initialValues.insuranceRequired));
    }
  }, [initialValues, open]);

  const handleCountryChange = (cid: string) => {
    setCountryId(cid);
    const matched = countries.find((c) => c.id === cid);
    setCountryName(matched?.name || "");
  };

  const handleSave = () => {
    if (!locationName.trim() && !countryName.trim()) {
      setErrorMsg(tt("route_stop_req_error", "Please specify a location, city, port, or country for this stop."));
      return;
    }

    const payload: RouteStop = {
      id: initialValues?.id || `stop-${Date.now()}`,
      countryId,
      countryName,
      locationName: locationName.trim(),
      customsPoint: customsPoint.trim(),
      mode: transportMode,
      handlerType,
      partnerType: handlerType === "external_partner" ? partnerType : "",
      partnerName: handlerType === "external_partner" ? partnerName.trim() : "",
      partnerAccountId: handlerType === "external_partner" ? partnerAccountId : "",
      insuranceRequired
    };

    onSave(payload, mode === "edit", stopIndex);
    onClose();
  };

  const selectClass =
    "w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const inputClass =
    "w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {mode === "edit"
                    ? `${tt("edit_route_stop_title", "Edit Route Stop")} #${stopIndex + 1}`
                    : tt("add_route_stop_title", "Add Route Stop / Border Crossing")}
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {tt("step_waypoint_badge", "Corridor Waypoint")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tt("route_stop_parda_subtitle", "Configure intermediate border crossing, clearance terminal, handler and transport mode")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label={tt("close", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Corridor Position Visual Context */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 block mb-1">
              {tt("corridor_position_preview", "Corridor Placement:")}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="rounded-md bg-white px-2 py-1 shadow-2xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-blue-700 dark:text-blue-300">
                {originName || "Origin"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="rounded-md bg-sky-600 px-2.5 py-1 text-white shadow-xs inline-flex items-center gap-1.5 font-black ring-2 ring-sky-400/40">
                <MapPin className="h-3.5 w-3.5" />
                <span>{locationName || countryName || `${tt("waypoint", "Stop")} #${stopIndex + 1}`}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="rounded-md bg-white px-2 py-1 shadow-2xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-emerald-700 dark:text-emerald-300">
                {destinationName || "Destination"}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Location & Country */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10.5px] font-black">
                1
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tt("section_stop_location", "Stop Location & Customs Jurisdiction")}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {tt("country", "Country")} *
                </label>
                <select
                  value={countryId}
                  onChange={(e) => handleCountryChange(e.target.value)}
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
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {tt("port_city_border_label", "Port, City or Border Crossing")} *
                </label>
                <input
                  type="text"
                  placeholder={tt("ph_stop_location_full", "e.g. Bandar Abbas, Dogharoon, Islam Qala, Karachi Port")}
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {tt("customs_clearance_terminal_label", "Customs Clearance Point / Border Terminal")}
                </label>
                <input
                  type="text"
                  placeholder={tt("ph_customs_terminal", "e.g. Customs Yard Gate 2, Freezone Terminal, Dry Port")}
                  value={customsPoint}
                  onChange={(e) => setCustomsPoint(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Transport Mode */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10.5px] font-black">
                2
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tt("section_leg_transport_mode", "Transport Mode For This Leg")}
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { key: "by_road", label: tt("opt_road_truck", "Road (Truck)"), icon: Truck },
                { key: "by_sea", label: tt("opt_sea_vessel", "Sea (Vessel)"), icon: Ship },
                { key: "by_air", label: tt("opt_air_flight", "Air (Flight)"), icon: Plane },
                { key: "by_rail", label: tt("opt_rail_train", "Rail (Train)"), icon: Train }
              ].map((m) => {
                const IconComponent = m.icon;
                const active = transportMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setTransportMode(m.key as any)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition ${
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                        : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <IconComponent className={`h-5 w-5 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Leg Handler Configuration */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10.5px] font-black">
                  3
                </span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {tt("section_leg_handler_config", "Leg Handler Configuration")}
                </h4>
              </div>

              {/* Segmented Switch */}
              <div className="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setHandlerType("our_branch")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                    handlerType === "our_branch"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{tt("handler_our_branch", "Our Branch")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHandlerType("external_partner")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                    handlerType === "external_partner"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{tt("handler_external_partner", "External Partner")}</span>
                </button>
              </div>
            </div>

            {handlerType === "our_branch" ? (
              <div className="rounded-xl bg-blue-50/60 p-3 text-xs border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span>
                  {tt("our_branch_desc", "This leg will be managed and coordinated directly by our company branch and local operations team.")}
                </span>
              </div>
            ) : (
              <div className="rounded-xl bg-indigo-50/50 p-3.5 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {tt("partner_type_label", "Partner Classification")} *
                    </label>
                    <select
                      value={partnerType}
                      onChange={(e) => setPartnerType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">{tt("select_partner_type_placeholder", "-- Select Partner Type --")}</option>
                      <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                      <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                      <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                      <option value="airline">{tt("pt_airline", "Airline / Air Freight")}</option>
                      <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                      <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      {tt("partner_name_label", "Partner Company Name")} *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Afghan Express Trans / Pamir Freight"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {tt("account_master_ledger", "Provider Account Master Ledger")}
                      </label>
                      <a
                        href="/dashboard/accounts/setup"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span>{tt("open_accounts", "Account Master")}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <select
                      value={partnerAccountId}
                      onChange={(e) => setPartnerAccountId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">-- {tt("select_account_ledger", "Select Provider Ledger Account")} --</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code ? `[${l.code}] ` : ""}{l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Insurance & Operational Notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10.5px] font-black">
                4
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tt("section_leg_insurance_risk", "Cargo Protection & Leg Requirements")}
              </h4>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 cursor-pointer transition">
              <input
                type="checkbox"
                checked={insuranceRequired}
                onChange={(e) => setInsuranceRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {tt("insurance_required_toggle", "Cargo insurance required for this leg")}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            {tt("cancel", "Cancel")}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
          >
            <Check className="h-4 w-4" />
            <span>
              {mode === "edit"
                ? tt("update_route_stop_btn", "Update Route Stop")
                : tt("apply_route_stop_btn", "Apply & Add Stop")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
