"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  Route,
  Ship,
  Train,
  Trash2,
  Truck,
  Zap,
  Plane,
  Building2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type RouteStop = {
  id?: string;
  countryId: string;
  countryName: string;
  locationName: string;
  mode: "by_sea" | "by_road" | "by_air" | "by_rail";
  customsPoint?: string;
  handlerType?: "our_branch" | "external_partner";
  partnerType?: string;
  partnerName?: string;
  partnerAccountId?: string;
  partnerAccountNumber?: string;
  partnerCountryName?: string;
  insuranceRequired?: boolean;
};

interface CustomerOrderRouteBuilderProps {
  routeName: string;
  transportMode: string;
  loadingCountryId: string;
  loadingCountryName: string;
  receivingCountryId: string;
  receivingCountryName: string;
  loadingCityName?: string;
  destinationCityName?: string;
  legs: any[];
  onChange: (routeName: string, legs: any[]) => void;
  countries: { id: string; name: string }[];
  ledgers?: { id: string; name: string; code?: string; currency?: string }[];
  lang: SupportedLanguage;
}

export function CustomerOrderRouteBuilder({
  routeName,
  transportMode,
  loadingCountryId,
  loadingCountryName,
  receivingCountryId,
  receivingCountryName,
  loadingCityName,
  destinationCityName,
  legs,
  onChange,
  countries,
  ledgers: propLedgers,
  lang
}: CustomerOrderRouteBuilderProps) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  const [localLedgers, setLocalLedgers] = useState<{ id: string; name: string; code?: string; currency?: string }[]>([]);

  useEffect(() => {
    if (!propLedgers || propLedgers.length === 0) {
      fetch("/api/erp/ledgers?limit=500")
        .then((r) => r.json())
        .then((j) => {
          const rows = j?.data?.ledgers ?? j?.ledgers ?? j?.data ?? [];
          if (Array.isArray(rows)) {
            setLocalLedgers(rows.map((l: any) => ({ id: l.id, code: l.code ?? null, name: l.name, currency: l.currency ?? null })));
          }
        })
        .catch(() => {});
    }
  }, [propLedgers]);

  const activeLedgers = (propLedgers && propLedgers.length > 0) ? propLedgers : localLedgers;

  // Direct Route partner state (for single leg routes)
  const [directHandlerType, setDirectHandlerType] = useState<"our_branch" | "external_partner">(() => {
    return legs?.[0]?.handlerType || legs?.[0]?.handler_type || "our_branch";
  });
  const [directPartnerType, setDirectPartnerType] = useState(() => legs?.[0]?.partnerType || legs?.[0]?.partner_type || "");
  const [directPartnerName, setDirectPartnerName] = useState(() => legs?.[0]?.partnerName || legs?.[0]?.partner_name || "");
  const [directPartnerAccountId, setDirectPartnerAccountId] = useState(() => legs?.[0]?.partnerAccountId || legs?.[0]?.partner_account_id || "");
  const [directInsuranceRequired, setDirectInsuranceRequired] = useState(() => Boolean(legs?.[0]?.insuranceRequired ?? legs?.[0]?.insurance_required));

  // Final leg partner state (for destination leg of multi-stop routes)
  const [finalLegHandlerType, setFinalLegHandlerType] = useState<"our_branch" | "external_partner">(() => {
    const lastLeg = legs && legs.length > 1 ? legs[legs.length - 1] : null;
    return lastLeg?.handlerType || lastLeg?.handler_type || "our_branch";
  });
  const [finalLegPartnerType, setFinalLegPartnerType] = useState(() => {
    const lastLeg = legs && legs.length > 1 ? legs[legs.length - 1] : null;
    return lastLeg?.partnerType || lastLeg?.partner_type || "";
  });
  const [finalLegPartnerName, setFinalLegPartnerName] = useState(() => {
    const lastLeg = legs && legs.length > 1 ? legs[legs.length - 1] : null;
    return lastLeg?.partnerName || lastLeg?.partner_name || "";
  });
  const [finalLegPartnerAccountId, setFinalLegPartnerAccountId] = useState(() => {
    const lastLeg = legs && legs.length > 1 ? legs[legs.length - 1] : null;
    return lastLeg?.partnerAccountId || lastLeg?.partner_account_id || "";
  });
  const [finalLegInsuranceRequired, setFinalLegInsuranceRequired] = useState(() => {
    const lastLeg = legs && legs.length > 1 ? legs[legs.length - 1] : null;
    return Boolean(lastLeg?.insuranceRequired ?? lastLeg?.insurance_required);
  });

  // Track expanded stop index for partner configuration
  const [expandedStopIdx, setExpandedStopIdx] = useState<number | null>(null);

  // Check if current route is flagged as direct
  const isDirectRoute = useMemo(() => {
    if (!routeName) return false;
    return routeName.toLowerCase().includes("direct") || legs.length <= 1;
  }, [routeName, legs]);

  // Intermediate stops state (excluding origin and destination)
  const [stops, setStops] = useState<RouteStop[]>(() => {
    if (legs && legs.length > 1) {
      return legs.slice(0, -1).map((leg: any, idx: number) => ({
        id: leg.id || `stop-${idx}`,
        countryId: leg.toCountryId || leg.to_country_id || "",
        countryName: leg.toCountryName || leg.to_country_name || "",
        locationName: leg.toLocationText || leg.to_location_text || leg.portOfDischarge || "",
        mode: (leg.transportMode || leg.transport_mode || "by_road") as any,
        customsPoint: leg.customsPointText || leg.customs_point_text || "",
        handlerType: leg.handlerType || leg.handler_type || (leg.partnerName || leg.partner_name ? "external_partner" : "our_branch"),
        partnerType: leg.partnerType || leg.partner_type || "",
        partnerName: leg.partnerName || leg.partner_name || "",
        partnerAccountId: leg.partnerAccountId || leg.partner_account_id || "",
        partnerAccountNumber: leg.partnerAccountNumber || leg.partner_account_number || "",
        partnerCountryName: leg.partnerCountryName || leg.partner_country_name || "",
        insuranceRequired: Boolean(leg.insuranceRequired ?? leg.insurance_required)
      }));
    }
    return [];
  });

  useEffect(() => {
    if (legs && legs.length > 1) {
      setStops(
        legs.slice(0, -1).map((leg: any, idx: number) => ({
          id: leg.id || `stop-${idx}`,
          countryId: leg.toCountryId || leg.to_country_id || "",
          countryName: leg.toCountryName || leg.to_country_name || "",
          locationName: leg.toLocationText || leg.to_location_text || leg.portOfDischarge || "",
          mode: (leg.transportMode || leg.transport_mode || "by_road") as any,
          customsPoint: leg.customsPointText || leg.customs_point_text || "",
          handlerType: leg.handlerType || leg.handler_type || (leg.partnerName || leg.partner_name ? "external_partner" : "our_branch"),
          partnerType: leg.partnerType || leg.partner_type || "",
          partnerName: leg.partnerName || leg.partner_name || "",
          partnerAccountId: leg.partnerAccountId || leg.partner_account_id || "",
          partnerAccountNumber: leg.partnerAccountNumber || leg.partner_account_number || "",
          partnerCountryName: leg.partnerCountryName || leg.partner_country_name || "",
          insuranceRequired: Boolean(leg.insuranceRequired ?? leg.insurance_required)
        }))
      );
      const lastLeg = legs[legs.length - 1];
      if (lastLeg) {
        setFinalLegHandlerType(lastLeg.handlerType || lastLeg.handler_type || "our_branch");
        setFinalLegPartnerType(lastLeg.partnerType || lastLeg.partner_type || "");
        setFinalLegPartnerName(lastLeg.partnerName || lastLeg.partner_name || "");
        setFinalLegPartnerAccountId(lastLeg.partnerAccountId || lastLeg.partner_account_id || "");
        setFinalLegInsuranceRequired(Boolean(lastLeg.insuranceRequired ?? lastLeg.insurance_required));
      }
      if (legs[0]) {
        setDirectHandlerType(legs[0].handlerType || legs[0].handler_type || "our_branch");
        setDirectPartnerType(legs[0].partnerType || legs[0].partner_type || "");
        setDirectPartnerName(legs[0].partnerName || legs[0].partner_name || "");
        setDirectPartnerAccountId(legs[0].partnerAccountId || legs[0].partner_account_id || "");
        setDirectInsuranceRequired(Boolean(legs[0].insuranceRequired ?? legs[0].insurance_required));
      }
    } else if (legs && legs.length === 1) {
      setDirectHandlerType(legs[0].handlerType || legs[0].handler_type || "our_branch");
      setDirectPartnerType(legs[0].partnerType || legs[0].partner_type || "");
      setDirectPartnerName(legs[0].partnerName || legs[0].partner_name || "");
      setDirectPartnerAccountId(legs[0].partnerAccountId || legs[0].partner_account_id || "");
      setDirectInsuranceRequired(Boolean(legs[0].insuranceRequired ?? legs[0].insurance_required));
    }
  }, [legs, routeName]);

  const getModeLabel = (m: string) => {
    switch (m) {
      case "by_sea":
        return tt("mode_sea", "Sea");
      case "by_road":
        return tt("mode_road", "Road");
      case "by_air":
        return tt("mode_air", "Air");
      case "by_rail":
        return tt("mode_rail", "Rail");
      default:
        return tt("mode_road", "Road");
    }
  };

  const getModeIcon = (m: string) => {
    switch (m) {
      case "by_sea":
        return <Ship className="h-3 w-3 text-blue-500" />;
      case "by_road":
        return <Truck className="h-3 w-3 text-amber-500" />;
      case "by_air":
        return <Plane className="h-3 w-3 text-sky-500" />;
      case "by_rail":
        return <Train className="h-3 w-3 text-purple-500" />;
      default:
        return <Truck className="h-3 w-3 text-slate-500" />;
    }
  };

  // Build full corridor string and leg array from stops
  const syncRoute = (
    currentStops: RouteStop[],
    direct: boolean,
    overrides?: {
      dHandler?: "our_branch" | "external_partner";
      dPType?: string;
      dPName?: string;
      dPAccount?: string;
      dInsuranceRequired?: boolean;
      fHandler?: "our_branch" | "external_partner";
      fPType?: string;
      fPName?: string;
      fPAccount?: string;
      fInsuranceRequired?: boolean;
    }
  ) => {
    const originLocation = loadingCityName || loadingCountryName || "Origin";
    const destLocation = destinationCityName || receivingCountryName || "Destination";

    const effDHandler = overrides?.dHandler ?? directHandlerType;
    const effDPType = overrides?.dPType ?? directPartnerType;
    const effDPName = overrides?.dPName ?? directPartnerName;
    const effDPAccount = overrides?.dPAccount ?? directPartnerAccountId;
    const effDInsuranceRequired = overrides?.dInsuranceRequired ?? directInsuranceRequired;

    const effFHandler = overrides?.fHandler ?? finalLegHandlerType;
    const effFPType = overrides?.fPType ?? finalLegPartnerType;
    const effFPName = overrides?.fPName ?? finalLegPartnerName;
    const effFPAccount = overrides?.fPAccount ?? finalLegPartnerAccountId;
    const effFInsuranceRequired = overrides?.fInsuranceRequired ?? finalLegInsuranceRequired;

    if (direct || currentStops.length === 0) {
      const modeStr = getModeLabel(transportMode);
      const generatedName = `${originLocation} → ${destLocation} (Direct ${modeStr})`;
      const singleLeg = [
        {
          legNo: 1,
          fromCountryId: loadingCountryId || null,
          fromCountryName: loadingCountryName || null,
          toCountryId: receivingCountryId || null,
          toCountryName: receivingCountryName || null,
          fromLocationText: originLocation,
          toLocationText: destLocation,
          transportMode: transportMode || "by_road",
          handlerType: effDHandler || "our_branch",
          partnerType: effDHandler === "external_partner" ? effDPType || null : null,
          partnerName: effDHandler === "external_partner" ? effDPName || null : null,
          partnerAccountId: effDHandler === "external_partner" ? effDPAccount || null : null,
          partnerAccountNumber:
            effDHandler === "external_partner"
              ? activeLedgers.find((l) => l.id === effDPAccount)?.code || null
              : null,
          partnerCountryName: effDHandler === "external_partner" ? receivingCountryName || null : null,
          insuranceRequired: effDInsuranceRequired,
          status: "pending"
        }
      ];
      onChange(generatedName, singleLeg);
      return;
    }

    // Sequenced Multi-Stop Corridor
    const points: string[] = [originLocation];
    const generatedLegs: any[] = [];

    let prevCountryId = loadingCountryId;
    let prevCountryName = loadingCountryName;
    let prevLocation = originLocation;

    currentStops.forEach((st, idx) => {
      const stopText = st.locationName || st.countryName || `Stop ${idx + 1}`;
      points.push(`${stopText} (${getModeLabel(st.mode)})`);

      const pAcc = activeLedgers.find((l) => l.id === st.partnerAccountId);

      generatedLegs.push({
        legNo: idx + 1,
        fromCountryId: prevCountryId || null,
        fromCountryName: prevCountryName || null,
        toCountryId: st.countryId || null,
        toCountryName: st.countryName || null,
        fromLocationText: prevLocation,
        toLocationText: st.locationName || st.countryName,
        transportMode: st.mode,
        customsPointText: st.customsPoint || null,
        handlerType: st.handlerType || "our_branch",
        partnerType: st.handlerType === "external_partner" ? st.partnerType || null : null,
        partnerName: st.handlerType === "external_partner" ? st.partnerName || null : null,
        partnerAccountId: st.handlerType === "external_partner" ? st.partnerAccountId || null : null,
        partnerAccountNumber: st.handlerType === "external_partner" ? pAcc?.code || null : null,
        partnerCountryName:
          st.handlerType === "external_partner" ? st.partnerCountryName || st.countryName || null : null,
        insuranceRequired: Boolean(st.insuranceRequired),
        status: "pending"
      });

      prevCountryId = st.countryId;
      prevCountryName = st.countryName;
      prevLocation = st.locationName || st.countryName;
    });

    // Final leg to Destination
    points.push(destLocation);
    const finalPAcc = activeLedgers.find((l) => l.id === effFPAccount);

    generatedLegs.push({
      legNo: currentStops.length + 1,
      fromCountryId: prevCountryId || null,
      fromCountryName: prevCountryName || null,
      toCountryId: receivingCountryId || null,
      toCountryName: receivingCountryName || null,
      fromLocationText: prevLocation,
      toLocationText: destLocation,
      transportMode: currentStops[currentStops.length - 1]?.mode || transportMode || "by_road",
      handlerType: effFHandler || "our_branch",
      partnerType: effFHandler === "external_partner" ? effFPType || null : null,
      partnerName: effFHandler === "external_partner" ? effFPName || null : null,
      partnerAccountId: effFHandler === "external_partner" ? effFPAccount || null : null,
      partnerAccountNumber: effFHandler === "external_partner" ? finalPAcc?.code || null : null,
      partnerCountryName: effFHandler === "external_partner" ? receivingCountryName || null : null,
      insuranceRequired: effFInsuranceRequired,
      status: "pending"
    });

    const generatedName = points.join(" → ");
    onChange(generatedName, generatedLegs);
  };

  const handleSetDirect = () => {
    setStops([]);
    syncRoute([], true);
  };

  const handleAddStop = () => {
    const newStop: RouteStop = {
      id: `stop-${Date.now()}`,
      countryId: "",
      countryName: "",
      locationName: "",
      mode: "by_road",
      handlerType: "our_branch"
    };
    const nextStops = [...stops, newStop];
    setStops(nextStops);
    setExpandedStopIdx(nextStops.length - 1);
    syncRoute(nextStops, false);
  };

  const handleUpdateStop = (idx: number, patch: Partial<RouteStop>) => {
    const nextStops = stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setStops(nextStops);
    syncRoute(nextStops, false);
  };

  const handleRemoveStop = (idx: number) => {
    const nextStops = stops.filter((_, i) => i !== idx);
    setStops(nextStops);
    if (expandedStopIdx === idx) setExpandedStopIdx(null);
    syncRoute(nextStops, nextStops.length === 0);
  };

  return (
    <div className="rounded-xl border border-sky-200/90 bg-sky-50/40 p-3 space-y-3 dark:border-sky-900/60 dark:bg-sky-950/20 shadow-2xs">
      {/* Header and Quick Direct Route Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-2 dark:border-sky-900/50">
        <div className="flex items-center gap-1.5">
          <Route className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          <span className="text-xs font-black uppercase text-sky-900 dark:text-sky-200">
            {tt("route_via_builder", "Route Via Corridor Builder")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick One-Click Option: Direct Route */}
          <button
            type="button"
            onClick={handleSetDirect}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
              isDirectRoute && stops.length === 0
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
            title={tt("direct_route_hint", "One-click direct route with no transit stops")}
          >
            <Zap className="h-3 w-3" />
            <span>{tt("direct_route_btn", "Direct Route (No Transit Stops)")}</span>
          </button>

          {/* Add Stop Button */}
          <button
            type="button"
            onClick={handleAddStop}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300 shadow-2xs transition"
          >
            <Plus className="h-3 w-3" />
            <span>{tt("add_corridor_stop", "Add Route Stop / Border")}</span>
          </button>
        </div>
      </div>

      {/* Visual Live Sequenced Path Preview */}
      <div className="rounded-lg bg-white dark:bg-slate-900/80 p-2.5 border border-sky-100 dark:border-sky-900/40 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          {tt("live_corridor_preview", "Live Route Corridor:")}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-blue-700 dark:text-blue-300">
            {loadingCityName || loadingCountryName || "Origin"}
          </span>

          {stops.map((st, idx) => (
            <React.Fragment key={st.id || idx}>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="rounded bg-sky-100/80 dark:bg-sky-950 px-2 py-0.5 text-sky-800 dark:text-sky-300 inline-flex items-center gap-1">
                {getModeIcon(st.mode)}
                <span>{st.locationName || st.countryName || `Stop ${idx + 1}`}</span>
                {st.handlerType === "external_partner" ? (
                  <span className="rounded bg-indigo-200/70 dark:bg-indigo-900 px-1 text-[9px] font-bold text-indigo-900 dark:text-indigo-200">
                    Ext: {st.partnerName || "Partner"}
                  </span>
                ) : null}
                <span className="text-[9px] font-mono opacity-70">({getModeLabel(st.mode)})</span>
              </span>
            </React.Fragment>
          ))}

          <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-emerald-800 dark:text-emerald-300">
            {destinationCityName || receivingCountryName || "Destination"}
          </span>
        </div>
      </div>

      {/* Direct Route Handler Config (When no transit stops) */}
      {stops.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {tt("direct_leg_handler", "Direct Route Leg Handler:")}
            </span>
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("our_branch");
                  syncRoute([], true, { dHandler: "our_branch" });
                }}
                className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
                  directHandlerType !== "external_partner"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {tt("handler_our_branch", "Our Branch")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("external_partner");
                  syncRoute([], true, { dHandler: "external_partner" });
                }}
                className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
                  directHandlerType === "external_partner"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                {tt("handler_external_partner", "External Partner")}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={directInsuranceRequired}
              onChange={(e) => {
                setDirectInsuranceRequired(e.target.checked);
                syncRoute([], true, { dInsuranceRequired: e.target.checked });
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {tt("insurance_required_toggle", "Cargo insurance required for this leg")}
            </span>
          </label>

          {directHandlerType === "external_partner" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("partner_type_label", "Partner Type")}</label>
                <select
                  value={directPartnerType}
                  onChange={(e) => {
                    setDirectPartnerType(e.target.value);
                    syncRoute([], true, { dPType: e.target.value });
                  }}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">{tt("select_partner_type_placeholder", "-- Select Partner Type --")}</option>
                  <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                  <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                  <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                  <option value="airline">{tt("pt_airline", "Airline / Air Freight")}</option>
                  <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                  <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">{tt("partner_name_label", "Partner Name")}</label>
                <input
                  type="text"
                  placeholder="e.g. Afghan Express Trans"
                  value={directPartnerName}
                  onChange={(e) => {
                    setDirectPartnerName(e.target.value);
                    syncRoute([], true, { dPName: e.target.value });
                  }}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">{tt("account_master_ledger", "Provider Account")}</label>
                  <a
                    href="/dashboard/accounts/setup"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {tt("open_accounts", "Account Master →")}
                  </a>
                </div>
                <select
                  value={directPartnerAccountId}
                  onChange={(e) => {
                    setDirectPartnerAccountId(e.target.value);
                    syncRoute([], true, { dPAccount: e.target.value });
                  }}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">-- Select Account Master Ledger --</option>
                  {activeLedgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code ? `[${l.code}] ` : ""}{l.name}
                    </option>
                  ))}
                </select>
              </div>

              {!directPartnerAccountId && (
                <div className="col-span-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 pt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>{tt("select_ledger_notice", "Select an Account Master ledger. Registered account required before bills can be posted.")}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stop Configuration Rows */}
      {stops.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {tt("intermediate_stops_list", "Intermediate Transit Waypoints / Crossings:")}
          </div>
          {stops.map((st, idx) => (
            <div
              key={st.id || idx}
              className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1.5fr_1.5fr_1fr_auto_auto] gap-2 items-center">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono text-xs font-bold">
                  {idx + 1}
                </div>

                {/* Country */}
                <div>
                  <select
                    value={st.countryId}
                    onChange={(e) => {
                      const c = countries.find((item) => item.id === e.target.value);
                      handleUpdateStop(idx, {
                        countryId: e.target.value,
                        countryName: c?.name || ""
                      });
                    }}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">— Select Country —</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location / Port / Border */}
                <div>
                  <input
                    type="text"
                    placeholder={tt("ph_stop_location", "Port, City or Border (e.g. Bandar Abbas, Dogharoon)")}
                    value={st.locationName}
                    onChange={(e) => handleUpdateStop(idx, { locationName: e.target.value })}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Transport Mode */}
                <div>
                  <select
                    value={st.mode}
                    onChange={(e) => handleUpdateStop(idx, { mode: e.target.value as any })}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="by_road">{tt("opt_road_truck", "Road (Truck)")}</option>
                    <option value="by_sea">{tt("opt_sea_vessel", "Sea (Vessel)")}</option>
                    <option value="by_air">{tt("opt_air_flight", "Air (Flight)")}</option>
                    <option value="by_rail">{tt("opt_rail_train", "Rail (Train)")}</option>
                  </select>
                </div>

                {/* Handler Type Toggle Button */}
                <button
                  type="button"
                  onClick={() => setExpandedStopIdx(expandedStopIdx === idx ? null : idx)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition ${
                    st.handlerType === "external_partner"
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Building2 className="h-3 w-3" />
                  <span>{st.handlerType === "external_partner" ? tt("handler_external_partner", "External Partner") : tt("handler_our_branch", "Our Branch")}</span>
                  {expandedStopIdx === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveStop(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title={tt("remove_stop", "Remove Stop")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Expandable Partner Details for this Stop */}
              {expandedStopIdx === idx && (
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {tt("leg_handler_config", "Leg Handler Configuration:")}
                    </span>
                    <div className="flex items-center rounded border border-slate-200 p-0.5 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleUpdateStop(idx, { handlerType: "our_branch" })}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                          st.handlerType !== "external_partner"
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        {tt("handler_our_branch", "Our Branch")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStop(idx, { handlerType: "external_partner" })}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                          st.handlerType === "external_partner"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                        }`}
                      >
                        {tt("handler_external_partner", "External Partner")}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(st.insuranceRequired)}
                      onChange={(e) => handleUpdateStop(idx, { insuranceRequired: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tt("insurance_required_toggle", "Cargo insurance required for this leg")}
                    </span>
                  </label>

                  {st.handlerType === "external_partner" && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          {tt("partner_type_label", "Partner Type *")}
                        </label>
                        <select
                          value={st.partnerType || ""}
                          onChange={(e) => handleUpdateStop(idx, { partnerType: e.target.value })}
                          className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">-- Select Partner Type --</option>
                          <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                          <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                          <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                          <option value="airline">{tt("pt_airline", "Airline / Air Freight")}</option>
                          <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                          <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          {tt("partner_name_label", "Partner / Provider Name *")}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Apex Clearing Kabul"
                          value={st.partnerName || ""}
                          onChange={(e) => handleUpdateStop(idx, { partnerName: e.target.value })}
                          className="w-full h-8 rounded border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            {tt("provider_account_master", "Provider Account *")}
                          </label>
                          <a
                            href="/dashboard/accounts/setup"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {tt("open_accounts", "Account Master →")}
                          </a>
                        </div>
                        <select
                          value={st.partnerAccountId || ""}
                          onChange={(e) => {
                            const row = activeLedgers.find((l) => l.id === e.target.value);
                            handleUpdateStop(idx, {
                              partnerAccountId: e.target.value,
                              partnerAccountNumber: row?.code || ""
                            });
                          }}
                          className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">-- Select Account Master Ledger --</option>
                          {activeLedgers.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code ? `[${l.code}] ` : ""}{l.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!st.partnerAccountId && (
                        <div className="col-span-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{tt("select_ledger_notice", "Select an Account Master ledger. Registered account required before bills can be posted.")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 italic py-1">
          {tt(
            "direct_route_hint",
            "Direct route selected: cargo proceeds directly from origin to destination without intermediate corridor waypoints."
          )}
        </div>
      )}
    </div>
  );
}
