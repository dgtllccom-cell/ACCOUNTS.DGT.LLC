"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Route,
  MapPin,
  Building2,
  Users,
  ShieldCheck,
  Truck,
  Ship,
  Plane,
  Train,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Globe2,
  UserCheck,
  CheckCircle2,
  Layers
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { RouteStop } from "@/features/clearing-agent/components/customer-order-route-builder";
import { LocationPicker, GatePicker, CustomsOfficePicker } from "@/features/location-master/components/location-picker";

// Mode-specific presets for quick filling
const MODE_PRESETS: Record<string, Record<string, string[]>> = {
  by_road: {
    PK: ["Torkham Border", "Chaman Border", "Taftan Border", "Khunjerab / Sost", "Wagah Border"],
    AE: ["Ghuwaifat (KSA Border)", "Hatta (Oman Border)", "Mezyad (Oman Border)"],
    AF: ["Torkham Border", "Spin Boldak / Chaman", "Islam Qala (Iran)", "Hairatan (Uzbekistan)", "Nimroz / Zaranj Border", "Shir Khan Bandar"],
    IR: ["Milak Border (Nimroz / Zaranj)", "Mirjaveh Border", "Dogharoon Border", "Bazargan (Turkey)", "Astara (Azerbaijan)"],
    IN: ["Attari / Wagah Border", "Petrapole (Bangladesh)", "Raxaul (Nepal)"],
    UZ: ["Termez / Hairatan Border", "Ayritom Border"]
  },
  by_sea: {
    PK: ["Karachi Port (KPT)", "Port Qasim (PQA)", "Gwadar Port"],
    AE: ["Jebel Ali Port (JAFZA)", "Port Rashid (Dubai)", "Khalifa Port (Abu Dhabi)", "Sharjah Port Khalid", "Fujairah Port"],
    IR: ["Bandar Abbas (Shahid Rajaee)", "Chabahar Port", "Bushehr Port", "Bandar Imam Khomeini"],
    IN: ["Nhava Sheva (JNPT)", "Mundra Port", "Chennai Port", "Cochin Port"],
    OM: ["Sohar Port", "Salalah Port", "Duqm Port"]
  },
  by_air: {
    PK: ["Air Freight Unit (AFU) Karachi", "Islamabad Air Cargo", "Lahore Allama Iqbal Cargo"],
    AE: ["Dubai Cargo Village (DXB)", "Al Maktoum DWC Cargo", "Abu Dhabi Cargo Terminal"],
    AF: ["Kabul Hamid Karzai Cargo", "Mazar-i-Sharif Airport", "Kandahar Airport Cargo"],
    IR: ["Tehran Imam Khomeini Cargo Terminal", "Mashhad Airport Cargo"],
    IN: ["Delhi IGI Cargo Terminal (New Delhi Airport)", "Mumbai Air Cargo Complex"],
    UZ: ["Tashkent International Airport Cargo"]
  },
  by_rail: {
    PK: ["Azakhel Dry Port (Rail)", "Lahore Dry Port (Rail)", "Prem Nagar Inland Port"],
    IR: ["Zahedan Railway Terminal", "Razi Rail Border (Turkey)", "Sarakhs Rail Border (Turkmenistan)"],
    AF: ["Hairatan Rail Terminal", "Torghundi Rail Terminal"]
  }
};

interface CustomerOrderRouteStopModalProps {
  open: boolean;
  onClose: () => void;
  lang?: SupportedLanguage;
  mode: "add" | "edit";
  stopIndex?: number;
  initialValues?: Partial<RouteStop>;
  countries: { id: string; name: string }[];
  countryBranches?: { id: string; name: string; countryId: string; code?: string | null }[];
  cityBranches?: { id: string; name: string; countryBranchId: string; code?: string | null }[];
  assignableUsers?: { id: string; name: string; email?: string }[];
  ports?: { id: string; port_name: string; country_id?: string }[];
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
  countryBranches = [],
  cityBranches = [],
  assignableUsers = [],
  ports = [],
  ledgers = [],
  originName = "Origin",
  destinationName = "Destination",
  onSave
}: CustomerOrderRouteStopModalProps) {
  if (!open) return null;

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  // Core Stop State
  const [transportMode, setTransportMode] = useState<"by_road" | "by_sea" | "by_air" | "by_rail">(
    initialValues?.mode || "by_road"
  );
  const [countryId, setCountryId] = useState(initialValues?.countryId || "");
  const [countryName, setCountryName] = useState(initialValues?.countryName || "");
  const [locationId, setLocationId] = useState(initialValues?.locationId || "");
  const [locationName, setLocationName] = useState(initialValues?.locationName || "");
  const [gateId, setGateId] = useState(initialValues?.gateId || "");
  const [gateName, setGateName] = useState(initialValues?.gateName || "");
  const [customsOfficeId, setCustomsOfficeId] = useState(initialValues?.customsOfficeId || "");
  const [customsTreatment, setCustomsTreatment] = useState(initialValues?.customsTreatment || "import_duty_paid");
  const [customsPoint, setCustomsPoint] = useState(initialValues?.customsPoint || "");

  // Handler Type
  const [handlerType, setHandlerType] = useState<"our_branch" | "external_partner">(
    initialValues?.handlerType || "our_branch"
  );

  // Internal Branch Assignment (Our Branch)
  const [branchCountryId, setBranchCountryId] = useState(initialValues?.branchCountryId || "");
  const [branchCountryName, setBranchCountryName] = useState(initialValues?.branchCountryName || "");
  const [branchId, setBranchId] = useState(initialValues?.branchId || "");
  const [branchName, setBranchName] = useState(initialValues?.branchName || "");
  const [assignedUserId, setAssignedUserId] = useState(initialValues?.assignedUserId || "");
  const [assignedUserName, setAssignedUserName] = useState(initialValues?.assignedUserName || "");

  // External Partner Configuration
  const [partnerType, setPartnerType] = useState(initialValues?.partnerType || "customs_agent");
  const [partnerName, setPartnerName] = useState(initialValues?.partnerName || "");
  const [partnerAccountId, setPartnerAccountId] = useState(initialValues?.partnerAccountId || "");
  const [hasPortalAccess, setHasPortalAccess] = useState(Boolean(initialValues?.hasPortalAccess));
  const [portalUsername, setPortalUsername] = useState(initialValues?.portalUsername || "");

  // Insurance & Notes
  const [insuranceRequired, setInsuranceRequired] = useState(Boolean(initialValues?.insuranceRequired));
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialValues) {
      setTransportMode(initialValues.mode || "by_road");
      setCountryId(initialValues.countryId || "");
      setCountryName(initialValues.countryName || "");
      setLocationId(initialValues.locationId || "");
      setLocationName(initialValues.locationName || "");
      setGateId(initialValues.gateId || "");
      setGateName(initialValues.gateName || "");
      setCustomsOfficeId(initialValues.customsOfficeId || "");
      setCustomsTreatment(initialValues.customsTreatment || "import_duty_paid");
      setCustomsPoint(initialValues.customsPoint || "");
      setHandlerType(initialValues.handlerType || "our_branch");

      setBranchCountryId(initialValues.branchCountryId || initialValues.countryId || "");
      setBranchCountryName(initialValues.branchCountryName || initialValues.countryName || "");
      setBranchId(initialValues.branchId || "");
      setBranchName(initialValues.branchName || "");
      setAssignedUserId(initialValues.assignedUserId || "");
      setAssignedUserName(initialValues.assignedUserName || "");

      setPartnerType(initialValues.partnerType || "customs_agent");
      setPartnerName(initialValues.partnerName || "");
      setPartnerAccountId(initialValues.partnerAccountId || "");
      setHasPortalAccess(Boolean(initialValues.hasPortalAccess));
      setPortalUsername(initialValues.portalUsername || "");

      setInsuranceRequired(Boolean(initialValues.insuranceRequired));
    }
  }, [initialValues, open]);

  // Country Code helper for presets
  const getCountryCode = (cId: string): string => {
    const c = countries.find((item) => item.id === cId);
    if (!c) return "";
    const name = c.name.toLowerCase();
    if (name.includes("pakistan")) return "PK";
    if (name.includes("emirates") || name.includes("uae") || name.includes("dubai")) return "AE";
    if (name.includes("afghanistan")) return "AF";
    if (name.includes("iran")) return "IR";
    if (name.includes("india")) return "IN";
    if (name.includes("oman")) return "OM";
    return "";
  };

  const handleCountryChange = (cid: string) => {
    setCountryId(cid);
    const matched = countries.find((c) => c.id === cid);
    setCountryName(matched?.name || "");
    if (!branchCountryId) {
      setBranchCountryId(cid);
      setBranchCountryName(matched?.name || "");
    }
  };

  const handleBranchCountryChange = (cid: string) => {
    setBranchCountryId(cid);
    const matched = countries.find((c) => c.id === cid);
    setBranchCountryName(matched?.name || "");
    setBranchId("");
    setBranchName("");
  };

  const handleBranchChange = (bid: string) => {
    setBranchId(bid);
    const cBranch = countryBranches.find((b) => b.id === bid);
    const cityBranch = cityBranches.find((b) => b.id === bid);
    setBranchName(cityBranch?.name || cBranch?.name || "");
  };

  const handleUserChange = (uid: string) => {
    setAssignedUserId(uid);
    const u = assignableUsers.find((user) => user.id === uid);
    setAssignedUserName(u?.name || "");
  };

  // Filtered branches for internal branch assignment
  const filteredBranches = useMemo(() => {
    if (!branchCountryId) {
      return [...cityBranches, ...countryBranches];
    }
    const matchingCountryBranches = countryBranches.filter((b) => b.countryId === branchCountryId);
    const cbIds = new Set(matchingCountryBranches.map((b) => b.id));
    const matchingCityBranches = cityBranches.filter((b) => cbIds.has(b.countryBranchId));
    return matchingCityBranches.length > 0 ? matchingCityBranches : matchingCountryBranches;
  }, [branchCountryId, countryBranches, cityBranches]);

  // Mode helpers
  const modePresets = useMemo(() => {
    const code = getCountryCode(countryId);
    const modeMap = MODE_PRESETS[transportMode] || {};
    return modeMap[code] || modeMap["PK"] || [];
  }, [countryId, transportMode]);

  const handleSave = () => {
    if (!locationName.trim() && !countryName.trim()) {
      setErrorMsg(tt("route_stop_req_error", "Please specify a location, city, port, or country for this stop."));
      return;
    }

    const payload: RouteStop = {
      id: initialValues?.id || `stop-${Date.now()}`,
      countryId,
      countryName,
      locationId: locationId || undefined,
      locationName: locationName.trim(),
      gateId: gateId || undefined,
      gateName: gateName || undefined,
      customsOfficeId: customsOfficeId || undefined,
      customsTreatment: customsTreatment || undefined,
      customsPoint: customsPoint.trim(),
      mode: transportMode,
      handlerType,
      // Our Branch
      branchCountryId: handlerType === "our_branch" ? branchCountryId : undefined,
      branchCountryName: handlerType === "our_branch" ? branchCountryName : undefined,
      branchId: handlerType === "our_branch" ? branchId : undefined,
      branchName: handlerType === "our_branch" ? branchName : undefined,
      assignedUserId: handlerType === "our_branch" ? assignedUserId : undefined,
      assignedUserName: handlerType === "our_branch" ? assignedUserName : undefined,
      // External Partner
      partnerType: handlerType === "external_partner" ? partnerType : "",
      partnerName: handlerType === "external_partner" ? partnerName.trim() : "",
      partnerAccountId: handlerType === "external_partner" ? partnerAccountId : "",
      hasPortalAccess: handlerType === "external_partner" ? hasPortalAccess : false,
      portalUsername: handlerType === "external_partner" && hasPortalAccess ? portalUsername.trim() : "",
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <Route className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {mode === "edit"
                    ? `${tt("edit_route_stop_title", "Edit Route Stop")} #${stopIndex + 1}`
                    : tt("add_route_stop_title", "Add Route Stop / Border Crossing")}
                </h3>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Corridor Position Visual Context */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 block mb-1">
              {tt("corridor_position_preview", "Corridor Placement:")}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="rounded-lg bg-white px-2.5 py-1 shadow-2xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-blue-700 dark:text-blue-300">
                {originName || "Origin"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="rounded-lg bg-sky-600 px-3 py-1 text-white shadow-xs inline-flex items-center gap-1.5 font-black ring-2 ring-sky-400/40">
                <MapPin className="h-3.5 w-3.5" />
                <span>{locationName || countryName || `${tt("waypoint", "Stop")} #${stopIndex + 1}`}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="rounded-lg bg-white px-2.5 py-1 shadow-2xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-emerald-700 dark:text-emerald-300">
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

          {/* STEP 1: TRANSPORT MODE FOR THIS LEG (Placed at Top per User Audio) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-850/60 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {tt("section_leg_transport_mode", "Transport Mode For This Leg")} *
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {tt("transport_mode_select_sub", "Select whether this segment moves by road truck, sea vessel, air freight or rail train.")}
                  </p>
                </div>
              </div>

              {/* Mode Dropdown per audio instructions */}
              <div className="w-full sm:w-60">
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value as any)}
                  className={selectClass}
                >
                  <option value="by_road">🚛 By Road (Truck / Trailer)</option>
                  <option value="by_sea">🚢 By Sea (Ocean Vessel)</option>
                  <option value="by_air">✈️ By Air (Air Freight)</option>
                  <option value="by_rail">🚆 By Train (Rail Freight)</option>
                </select>
              </div>
            </div>

            {/* Segmented Quick-Mode Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {[
                { key: "by_road", name: tt("opt_road_truck", "Road (Truck)"), icon: Truck, color: "text-emerald-600" },
                { key: "by_sea", name: tt("opt_sea_vessel", "Sea (Vessel)"), icon: Ship, color: "text-blue-600" },
                { key: "by_air", name: tt("opt_air_flight", "Air (Flight)"), icon: Plane, color: "text-sky-600" },
                { key: "by_rail", name: tt("opt_rail_train", "Rail (Train)"), icon: Train, color: "text-amber-600" }
              ].map((m) => {
                const IconComponent = m.icon;
                const active = transportMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setTransportMode(m.key as any)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition text-left ${
                      active
                        ? "border-blue-600 bg-white text-blue-700 shadow-xs ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-slate-800 dark:text-blue-300"
                        : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    }`}
                  >
                    <IconComponent className={`h-4 w-4 ${active ? m.color : "text-slate-400"}`} />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: STOP LOCATION & CUSTOMS JURISDICTION (Mode Adaptive) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
                2
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {transportMode === "by_sea"
                  ? tt("section_stop_seaport", "Seaport Location & Port Terminal")
                  : transportMode === "by_road"
                  ? tt("section_stop_border", "Border Crossing & Inland Customs Point")
                  : transportMode === "by_air"
                  ? tt("section_stop_airport", "Airport Cargo Terminal & Customs Shed")
                  : tt("section_stop_rail", "Rail Freight Terminal & Dry Port")}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("country", "Country")} *
                </label>
                <select
                  value={countryId}
                  onChange={(e) => {
                    handleCountryChange(e.target.value);
                    setLocationId("");
                    setLocationName("");
                    setGateId("");
                    setGateName("");
                    setCustomsOfficeId("");
                  }}
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
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {transportMode === "by_sea"
                    ? tt("seaport_label", "Seaport / Harbour Name")
                    : transportMode === "by_road"
                    ? tt("border_crossing_label", "Border Crossing / Checkpoint / City")
                    : transportMode === "by_air"
                    ? tt("airport_label", "Airport / Air Cargo Terminal")
                    : tt("rail_terminal_label", "Rail Terminal / Dry Port")} *
                </label>
                <LocationPicker
                  countryId={countryId}
                  transportMode={transportMode}
                  value={locationId}
                  onChange={(id, name) => {
                    setLocationId(id);
                    if (name) setLocationName(name);
                    setGateId("");
                    setGateName("");
                    if (errorMsg) setErrorMsg("");
                  }}
                  label=""
                />
                <input
                  type="text"
                  placeholder={
                    transportMode === "by_sea"
                      ? "Custom port name if not in master..."
                      : transportMode === "by_road"
                      ? "Custom border name if not in master..."
                      : "Custom location name..."
                  }
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>

              {/* Gate / Terminal Master Picker under location */}
              {locationId && !locationId.startsWith("city:") ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {transportMode === "by_sea"
                      ? tt("port_terminal_label", "Port Terminal / Berth (Master)")
                      : tt("gate_terminal_label", "Gate / Terminal Crossing (Master)")}
                  </label>
                  <GatePicker
                    locationId={locationId}
                    value={gateId}
                    onChange={(gid, gnm) => {
                      setGateId(gid);
                      setGateName(gnm);
                      if (gnm && !customsPoint) setCustomsPoint(gnm);
                    }}
                    label=""
                  />
                </div>
              ) : null}

              {/* Central Customs Station & Treatment under country/location/gate */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>{tt("customs_station_treatment", "Customs Office & Treatment (Master)")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {tt("customs_office_station", "Customs Station / Office")}
                    </label>
                    <CustomsOfficePicker
                      countryId={countryId}
                      locationId={locationId}
                      value={customsOfficeId}
                      onChange={(offId, off) => {
                        setCustomsOfficeId(offId);
                        if (off?.office_name) setCustomsPoint(off.office_name);
                        if (off?.allowed_treatments && off.allowed_treatments.length > 0) {
                          setCustomsTreatment(off.allowed_treatments[0]);
                        }
                      }}
                      label=""
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {tt("customs_treatment_choice", "Customs Treatment")}
                    </label>
                    <select
                      value={customsTreatment}
                      onChange={(e) => setCustomsTreatment(e.target.value)}
                      className={selectClass}
                    >
                      <option value="import_duty_paid">{t(lang, "treat_import_duty_paid", "Import - Duty Paid")}</option>
                      <option value="export_clearance">{t(lang, "treat_export_clearance", "Export Clearance")}</option>
                      <option value="transit_bonded">{t(lang, "treat_transit_bonded", "Transit (Bonded)")}</option>
                      <option value="re_export">{t(lang, "treat_re_export", "Re-export")}</option>
                      <option value="free_zone">{t(lang, "treat_free_zone", "Free Zone (JAFZA/Other)")}</option>
                      <option value="local_clearance">{t(lang, "treat_local_clearance", "Local Clearance")}</option>
                      <option value="no_duty_exempt">{t(lang, "treat_no_duty_exempt", "No Duty / Exempt")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: LEG HANDLER CONFIGURATION ("Parda" / Modal / Panel for Our Branch vs External Partner) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
                  3
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {tt("section_leg_handler_config", "Leg Handler Configuration")} *
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {tt("handler_config_subtitle", "Specify whether our internal company branch or an external partner executes this segment.")}
                  </p>
                </div>
              </div>

              {/* Segmented Switch for Our Branch vs External Partner */}
              <div className="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setHandlerType("our_branch")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
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

            {/* CASE A: OUR BRANCH ("Parda" / Dedicated Assignment Panel) */}
            {handlerType === "our_branch" ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h5 className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                        {tt("internal_branch_assignment", "Internal Company Branch & Operator Assignment")}
                      </h5>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        {tt("internal_branch_sub", "Select the operating country, branch office and responsible user so tasks route to their inbox.")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tt("branch_country", "Operating Country")}
                    </label>
                    <select
                      value={branchCountryId}
                      onChange={(e) => handleBranchCountryChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— {tt("all_operating_countries", "All Operating Countries")} —</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tt("company_branch_office", "Company Branch Office")}
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— {tt("select_branch_office", "Select Branch Office")} —</option>
                      {filteredBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tt("assigned_operator_user", "Assigned User / Operator")}
                    </label>
                    <select
                      value={assignedUserId}
                      onChange={(e) => handleUserChange(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— {tt("select_responsible_user", "Select Responsible User")} —</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {assignedUserName && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
                    <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      {tt("user_assigned_notice", "Assigned Operator:")} <strong>{assignedUserName}</strong>
                      {branchName ? ` • ${branchName}` : ""}
                      {branchCountryName ? ` (${branchCountryName})` : ""} — {tt("tasks_will_appear", "Tasks will appear directly on their dashboard.")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* CASE B: EXTERNAL PARTNER ("Parda" / Dedicated Partner & Ledger Panel) */
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                        {tt("external_partner_setup", "External Partner & Financial Ledger Configuration")}
                      </h5>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        {tt("external_partner_sub", "Configure partner classification, company name, Account Master ledger and portal access.")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tt("partner_classification_label", "Partner Classification")} *
                    </label>
                    <select
                      value={partnerType}
                      onChange={(e) => setPartnerType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                      <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                      <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                      <option value="airline">{tt("pt_airline", "Airline / Air Freight Forwarder")}</option>
                      <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                      <option value="border_escort">{tt("pt_border_escort", "Border Escort / Terminal Partner")}</option>
                      <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {tt("partner_company_name_label", "Partner Company Name")} *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Afghan Express Trans / Pamir Freight / Al-Bahar Logistics"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {/* Financial Account Master Ledger */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {tt("account_master_ledger", "Provider Account Master Ledger")}
                      </label>
                      <a
                        href="/dashboard/accounts/setup"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span>{tt("open_accounts", "Chart of Accounts / Setup")}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <select
                      value={partnerAccountId}
                      onChange={(e) => setPartnerAccountId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— {tt("select_account_ledger", "Select Provider Ledger Account")} —</option>
                      {ledgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code ? `[${l.code}] ` : ""}{l.name}{l.currency ? ` (${l.currency})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Portal Access Status Toggle ("portal hai ya nahi hai") */}
                  <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {tt("portal_access_question", "External Partner Portal Access?")}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {tt("portal_access_hint", "Specify whether this partner logs into the customer/clearing portal to submit documents.")}
                        </p>
                      </div>

                      <div className="flex items-center rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
                        <button
                          type="button"
                          onClick={() => setHasPortalAccess(true)}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                            hasPortalAccess
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                          }`}
                        >
                          {tt("portal_yes", "Has Portal Access")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHasPortalAccess(false);
                            setPortalUsername("");
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                            !hasPortalAccess
                              ? "bg-slate-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                          }`}
                        >
                          {tt("portal_no", "Offline / Manual")}
                        </button>
                      </div>
                    </div>

                    {hasPortalAccess && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {tt("portal_username_label", "Partner Portal Username / Login Email")}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. partner.ops@afghanexpress.com / pamir_clearing"
                          value={portalUsername}
                          onChange={(e) => setPortalUsername(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 4: CARGO PROTECTION & INSURANCE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-black">
                4
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {tt("section_leg_insurance_risk", "Cargo Protection & Leg Requirements")}
              </h4>
            </div>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 cursor-pointer transition">
              <input
                type="checkbox"
                checked={insuranceRequired}
                onChange={(e) => setInsuranceRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {tt("insurance_required_toggle", "Cargo insurance required for this leg")}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {tt("insurance_leg_note", "Ensures cargo transit marine/road liability coverage certificate is attached for this leg.")}
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850">
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
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 transition"
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
