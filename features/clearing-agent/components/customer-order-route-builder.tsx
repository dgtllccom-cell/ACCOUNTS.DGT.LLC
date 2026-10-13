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
  ExternalLink,
  Pencil,
  Users,
  UserCheck,
  X
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { CustomerOrderRouteStopModal } from "@/features/clearing-agent/components/customer-order-route-stop-modal";

export type RouteStop = {
  id?: string;
  countryId: string;
  countryName: string;
  locationId?: string;
  locationName: string;
  gateId?: string;
  gateName?: string;
  customsOfficeId?: string;
  customsTreatment?: string;
  mode: "by_sea" | "by_road" | "by_air" | "by_rail";
  customsPoint?: string;
  handlerType?: "our_branch" | "external_partner";
  branchCountryId?: string;
  branchCountryName?: string;
  branchId?: string;
  branchName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  partnerType?: string;
  partnerName?: string;
  partnerAccountId?: string;
  partnerAccountNumber?: string;
  partnerCountryName?: string;
  hasPortalAccess?: boolean;
  portalUsername?: string;
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
  countryBranches?: { id: string; name: string; countryId: string; code?: string | null }[];
  cityBranches?: { id: string; name: string; countryBranchId: string; code?: string | null }[];
  assignableUsers?: { id: string; name: string; email?: string }[];
  ports?: { id: string; port_name: string; country_id?: string }[];
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
  countryBranches = [],
  cityBranches = [],
  assignableUsers = [],
  ports = [],
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

  // Direct Route handler state (for single leg routes)
  const [directHandlerType, setDirectHandlerType] = useState<"our_branch" | "external_partner">(() => {
    return legs?.[0]?.handlerType || legs?.[0]?.handler_type || "our_branch";
  });
  const [isDirectHandlerModalOpen, setIsDirectHandlerModalOpen] = useState(false);
  // Our Branch assignment state
  const [directBranchCountryId, setDirectBranchCountryId] = useState(() => legs?.[0]?.branchCountryId || legs?.[0]?.branch_country_id || "");
  const [directBranchCountryName, setDirectBranchCountryName] = useState(() => legs?.[0]?.branchCountryName || legs?.[0]?.branch_country_name || "");
  const [directBranchId, setDirectBranchId] = useState(() => legs?.[0]?.branchId || legs?.[0]?.branch_id || "");
  const [directBranchName, setDirectBranchName] = useState(() => legs?.[0]?.branchName || legs?.[0]?.branch_name || "");
  const [directAssignedUserId, setDirectAssignedUserId] = useState(() => legs?.[0]?.assignedUserId || legs?.[0]?.assigned_user_id || "");
  const [directAssignedUserName, setDirectAssignedUserName] = useState(() => legs?.[0]?.assignedUserName || legs?.[0]?.assigned_user_name || "");

  // External Partner configuration state
  const [directPartnerType, setDirectPartnerType] = useState(() => legs?.[0]?.partnerType || legs?.[0]?.partner_type || "customs_agent");
  const [directPartnerName, setDirectPartnerName] = useState(() => legs?.[0]?.partnerName || legs?.[0]?.partner_name || "");
  const [directPartnerAccountId, setDirectPartnerAccountId] = useState(() => legs?.[0]?.partnerAccountId || legs?.[0]?.partner_account_id || "");
  const [directHasPortalAccess, setDirectHasPortalAccess] = useState(() => Boolean(legs?.[0]?.hasPortalAccess ?? legs?.[0]?.has_portal_access));
  const [directPortalUsername, setDirectPortalUsername] = useState(() => legs?.[0]?.portalUsername || legs?.[0]?.portal_username || "");
  const [directInsuranceRequired, setDirectInsuranceRequired] = useState(() => Boolean(legs?.[0]?.insuranceRequired ?? legs?.[0]?.insurance_required));

  // Filtered branches for direct route
  const directFilteredBranches = useMemo(() => {
    if (!directBranchCountryId) return [...cityBranches, ...countryBranches];
    const matchingCountryBranches = countryBranches.filter((b) => b.countryId === directBranchCountryId);
    const cbIds = new Set(matchingCountryBranches.map((b) => b.id));
    const matchingCityBranches = cityBranches.filter((b) => cbIds.has(b.countryBranchId));
    return matchingCityBranches.length > 0 ? matchingCityBranches : matchingCountryBranches;
  }, [directBranchCountryId, countryBranches, cityBranches]);

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
        locationId: leg.toLocationId || leg.to_location_id || "",
        locationName: leg.toLocationText || leg.to_location_text || leg.portOfDischarge || "",
        gateId: leg.toGateId || leg.to_gate_id || "",
        gateName: leg.toGateName || leg.to_gate_name || "",
        customsOfficeId: leg.customsOfficeId || leg.customs_office_id || "",
        customsTreatment: leg.customsTreatment || leg.customs_treatment || "",
        mode: (leg.transportMode || leg.transport_mode || "by_road") as any,
        customsPoint: leg.customsPointText || leg.customs_point_text || "",
        handlerType: leg.handlerType || leg.handler_type || (leg.partnerName || leg.partner_name ? "external_partner" : "our_branch"),
        branchCountryId: leg.branchCountryId || leg.branch_country_id || "",
        branchCountryName: leg.branchCountryName || leg.branch_country_name || "",
        branchId: leg.branchId || leg.branch_id || "",
        branchName: leg.branchName || leg.branch_name || "",
        assignedUserId: leg.assignedUserId || leg.assigned_user_id || "",
        assignedUserName: leg.assignedUserName || leg.assigned_user_name || "",
        partnerType: leg.partnerType || leg.partner_type || "",
        partnerName: leg.partnerName || leg.partner_name || "",
        partnerAccountId: leg.partnerAccountId || leg.partner_account_id || "",
        partnerAccountNumber: leg.partnerAccountNumber || leg.partner_account_number || "",
        partnerCountryName: leg.partnerCountryName || leg.partner_country_name || "",
        hasPortalAccess: Boolean(leg.hasPortalAccess ?? leg.has_portal_access),
        portalUsername: leg.portalUsername || leg.portal_username || "",
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
      dBranchCountryId?: string;
      dBranchCountryName?: string;
      dBranchId?: string;
      dBranchName?: string;
      dAssignedUserId?: string;
      dAssignedUserName?: string;
      dPType?: string;
      dPName?: string;
      dPAccount?: string;
      dHasPortalAccess?: boolean;
      dPortalUsername?: string;
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
    const effDBranchCountryId = overrides?.dBranchCountryId ?? directBranchCountryId;
    const effDBranchCountryName = overrides?.dBranchCountryName ?? directBranchCountryName;
    const effDBranchId = overrides?.dBranchId ?? directBranchId;
    const effDBranchName = overrides?.dBranchName ?? directBranchName;
    const effDAssignedUserId = overrides?.dAssignedUserId ?? directAssignedUserId;
    const effDAssignedUserName = overrides?.dAssignedUserName ?? directAssignedUserName;

    const effDPType = overrides?.dPType ?? directPartnerType;
    const effDPName = overrides?.dPName ?? directPartnerName;
    const effDPAccount = overrides?.dPAccount ?? directPartnerAccountId;
    const effDHasPortalAccess = overrides?.dHasPortalAccess ?? directHasPortalAccess;
    const effDPortalUsername = overrides?.dPortalUsername ?? directPortalUsername;
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
          branchCountryId: effDHandler === "our_branch" ? effDBranchCountryId || null : null,
          branchCountryName: effDHandler === "our_branch" ? effDBranchCountryName || null : null,
          branchId: effDHandler === "our_branch" ? effDBranchId || null : null,
          branchName: effDHandler === "our_branch" ? effDBranchName || null : null,
          assignedUserId: effDHandler === "our_branch" ? effDAssignedUserId || null : null,
          assignedUserName: effDHandler === "our_branch" ? effDAssignedUserName || null : null,
          partnerType: effDHandler === "external_partner" ? effDPType || null : null,
          partnerName: effDHandler === "external_partner" ? effDPName || null : null,
          partnerAccountId: effDHandler === "external_partner" ? effDPAccount || null : null,
          partnerAccountNumber:
            effDHandler === "external_partner"
              ? activeLedgers.find((l) => l.id === effDPAccount)?.code || null
              : null,
          partnerCountryName: effDHandler === "external_partner" ? receivingCountryName || null : null,
          hasPortalAccess: effDHandler === "external_partner" ? Boolean(effDHasPortalAccess) : false,
          portalUsername: effDHandler === "external_partner" && effDHasPortalAccess ? effDPortalUsername || null : null,
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
        toLocationId: st.locationId || null,
        toGateId: st.gateId || null,
        customsOfficeId: st.customsOfficeId || null,
        customsTreatment: st.customsTreatment || null,
        transportMode: st.mode,
        customsPointText: st.customsPoint || null,
        handlerType: st.handlerType || "our_branch",
        branchCountryId: st.handlerType === "our_branch" ? st.branchCountryId || null : null,
        branchCountryName: st.handlerType === "our_branch" ? st.branchCountryName || null : null,
        branchId: st.handlerType === "our_branch" ? st.branchId || null : null,
        branchName: st.handlerType === "our_branch" ? st.branchName || null : null,
        assignedUserId: st.handlerType === "our_branch" ? st.assignedUserId || null : null,
        assignedUserName: st.handlerType === "our_branch" ? st.assignedUserName || null : null,
        partnerType: st.handlerType === "external_partner" ? st.partnerType || null : null,
        partnerName: st.handlerType === "external_partner" ? st.partnerName || null : null,
        partnerAccountId: st.handlerType === "external_partner" ? st.partnerAccountId || null : null,
        partnerAccountNumber: st.handlerType === "external_partner" ? pAcc?.code || null : null,
        partnerCountryName:
          st.handlerType === "external_partner" ? st.partnerCountryName || st.countryName || null : null,
        hasPortalAccess: st.handlerType === "external_partner" ? Boolean(st.hasPortalAccess) : false,
        portalUsername: st.handlerType === "external_partner" && st.hasPortalAccess ? st.portalUsername || null : null,
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

  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopModalMode, setStopModalMode] = useState<"add" | "edit">("add");
  const [selectedStopIdx, setSelectedStopIdx] = useState<number>(0);

  const handleOpenAddModal = () => {
    setStopModalMode("add");
    setSelectedStopIdx(stops.length);
    setStopModalOpen(true);
  };

  const handleOpenEditModal = (idx: number) => {
    setStopModalMode("edit");
    setSelectedStopIdx(idx);
    setStopModalOpen(true);
  };

  const handleSaveModalStop = (stopData: RouteStop, isEdit: boolean, index?: number) => {
    let nextStops: RouteStop[];
    if (isEdit && typeof index === "number" && index >= 0 && index < stops.length) {
      nextStops = stops.map((s, i) => (i === index ? stopData : s));
    } else {
      nextStops = [...stops, stopData];
    }
    setStops(nextStops);
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

          {/* Add Stop Button - Opens Full Modal */}
          <button
            type="button"
            onClick={handleOpenAddModal}
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
              <button
                type="button"
                onClick={() => handleOpenEditModal(idx)}
                className="rounded-lg bg-sky-100/90 hover:bg-sky-200 dark:bg-sky-950 dark:hover:bg-sky-900 px-2 py-0.5 text-sky-800 dark:text-sky-300 inline-flex items-center gap-1 transition text-left cursor-pointer ring-1 ring-sky-300/40 dark:ring-sky-800"
                title={tt("click_to_edit_stop", "Click to edit stop in modal")}
              >
                {getModeIcon(st.mode)}
                <span className="font-bold">{st.locationName || st.countryName || `Stop ${idx + 1}`}</span>
                {st.handlerType === "external_partner" ? (
                  <span className="rounded bg-indigo-200/80 dark:bg-indigo-900 px-1 py-0.2 text-[9px] font-bold text-indigo-900 dark:text-indigo-200">
                    Ext: {st.partnerName || "Partner"}
                  </span>
                ) : (
                  <span className="rounded bg-blue-200/80 dark:bg-blue-900 px-1 py-0.2 text-[9px] font-bold text-blue-900 dark:text-blue-200">
                    Branch
                  </span>
                )}
                <Pencil className="h-2.5 w-2.5 opacity-60 ml-0.5" />
              </button>
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
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                {tt("direct_leg_handler", "Direct Route Leg Handler:")}
              </span>
              <p className="text-[11px] text-slate-500">
                {tt("direct_handler_sub", "Designate whether our company branch or an external partner oversees direct delivery.")}
              </p>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("our_branch");
                  setIsDirectHandlerModalOpen(true);
                  syncRoute([], true, { dHandler: "our_branch" });
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                  directHandlerType !== "external_partner"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{tt("handler_our_branch", "Our Branch")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("external_partner");
                  setIsDirectHandlerModalOpen(true);
                  syncRoute([], true, { dHandler: "external_partner" });
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                  directHandlerType === "external_partner"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{tt("handler_external_partner", "External Partner")}</span>
              </button>
            </div>
          </div>

          {/* COMPACT MESSAGE SUMMARY (AUDIO 7: "idhar nahi dikhayega, idhar phir ek message ki tarah dikhayega") */}
          {directHandlerType !== "external_partner" ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-blue-900 dark:text-blue-200">
                      {directBranchName || tt("company_branch_office", "Company Branch Office")}
                    </span>
                    {directBranchCountryName && (
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
                        {directBranchCountryName}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800">
                      <UserCheck className="h-3 w-3 text-emerald-600" />
                      <span>{tt("assigned_operator_user", "Assigned Operator:")} {directAssignedUserName || tt("unassigned", "Unassigned")}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                    {tt("internal_branch_msg", "Internal company branch executes direct delivery; tasks route to assigned operator.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("our_branch");
                  setIsDirectHandlerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-300 transition shadow-2xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{tt("edit_branch_assignment", "Edit Branch & User")}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/30">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Users className="h-4 w-4" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                      {directPartnerName || tt("partner_name_label", "External Partner")}
                    </span>
                    <span className="text-[10.5px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md capitalize">
                      {directPartnerType ? directPartnerType.replace("_", " ") : "Customs Agent"}
                    </span>
                    {directPartnerAccountId ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800">
                        {tt("account_master_ledger", "Ledger:")} {activeLedgers.find((l) => l.id === directPartnerAccountId)?.name || "Linked"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200/80 dark:border-amber-800">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>{tt("ledger_pending", "Ledger Pending")}</span>
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      directHasPortalAccess
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {directHasPortalAccess ? (directPortalUsername ? `Portal: ${directPortalUsername}` : "Portal Online") : "Offline / Manual"}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                    {tt("external_partner_msg", "Third-party clearing or transport provider executes delivery; bills post to provider ledger.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirectHandlerType("external_partner");
                  setIsDirectHandlerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-800 dark:text-indigo-300 transition shadow-2xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{tt("edit_partner_setup", "Edit Partner & Ledger")}</span>
              </button>
            </div>
          )}

          {/* DIRECT ROUTE LEG HANDLER MODAL ("Parda" as requested in Audio 7) */}
          {isDirectHandlerModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md ${
                      directHandlerType === "our_branch" ? "bg-blue-600 shadow-blue-600/25" : "bg-indigo-600 shadow-indigo-600/25"
                    }`}>
                      {directHandlerType === "our_branch" ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {directHandlerType === "our_branch"
                          ? tt("internal_branch_modal_title", "Company Branch & Operator Assignment")
                          : tt("external_partner_modal_title", "External Partner & Financial Ledger Setup")}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tt("direct_handler_sub", "Designate whether our company branch or an external partner oversees direct delivery.")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDirectHandlerModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Segmented Switch inside Modal */}
                <div className="flex items-center rounded-xl border border-slate-200 p-1 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectHandlerType("our_branch");
                      syncRoute([], true, { dHandler: "our_branch" });
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-lg transition ${
                      directHandlerType === "our_branch"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>{tt("handler_our_branch", "Our Branch")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectHandlerType("external_partner");
                      syncRoute([], true, { dHandler: "external_partner" });
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-lg transition ${
                      directHandlerType === "external_partner"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>{tt("handler_external_partner", "External Partner")}</span>
                  </button>
                </div>

                {/* Modal Body: Our Branch */}
                {directHandlerType === "our_branch" ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {tt("branch_country", "Operating Country")}
                      </label>
                      <select
                        value={directBranchCountryId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          const cName = countries.find((c) => c.id === cid)?.name || "";
                          setDirectBranchCountryId(cid);
                          setDirectBranchCountryName(cName);
                          setDirectBranchId("");
                          setDirectBranchName("");
                          syncRoute([], true, { dBranchCountryId: cid, dBranchCountryName: cName, dBranchId: "", dBranchName: "" });
                        }}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
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
                        {tt("company_branch_office", "Company Branch Office")} *
                      </label>
                      <select
                        value={directBranchId}
                        onChange={(e) => {
                          const bid = e.target.value;
                          const cBranch = countryBranches.find((b) => b.id === bid);
                          const cityBranch = cityBranches.find((b) => b.id === bid);
                          const bName = cityBranch?.name || cBranch?.name || "";
                          setDirectBranchId(bid);
                          setDirectBranchName(bName);
                          syncRoute([], true, { dBranchId: bid, dBranchName: bName });
                        }}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">— {tt("select_branch_office", "Select Branch Office")} —</option>
                        {directFilteredBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {tt("assigned_operator_user", "Assigned User / Operator")} *
                      </label>
                      <select
                        value={directAssignedUserId}
                        onChange={(e) => {
                          const uid = e.target.value;
                          const uName = assignableUsers.find((u) => u.id === uid)?.name || "";
                          setDirectAssignedUserId(uid);
                          setDirectAssignedUserName(uName);
                          syncRoute([], true, { dAssignedUserId: uid, dAssignedUserName: uName });
                        }}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">— {tt("select_responsible_user", "Select Responsible User")} —</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {directAssignedUserName && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
                        <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          {tt("user_assigned_notice", "Assigned Operator:")} <strong>{directAssignedUserName}</strong>
                          {directBranchName ? ` • ${directBranchName}` : ""}
                          {directBranchCountryName ? ` (${directBranchCountryName})` : ""} — {tt("tasks_will_appear", "Tasks will appear directly on their dashboard.")}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Modal Body: External Partner */
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {tt("partner_type_label", "Partner Type")} *
                        </label>
                        <select
                          value={directPartnerType}
                          onChange={(e) => {
                            setDirectPartnerType(e.target.value);
                            syncRoute([], true, { dPType: e.target.value });
                          }}
                          className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="customs_agent">{tt("pt_customs_agent", "Customs Clearing Agent")}</option>
                          <option value="transporter">{tt("pt_transporter", "Transporter / Trucking Carrier")}</option>
                          <option value="shipping_provider">{tt("pt_shipping_provider", "Shipping Line / Sea Provider")}</option>
                          <option value="airline">{tt("pt_airline", "Airline / Air Freight")}</option>
                          <option value="railway">{tt("pt_railway", "Railway Operator")}</option>
                          <option value="border_escort">{tt("pt_border_escort", "Border Escort / Terminal Partner")}</option>
                          <option value="other_partner">{tt("pt_other_partner", "Other External Partner")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {tt("partner_name_label", "Partner Name")} *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Afghan Express Trans / Pamir Freight"
                          value={directPartnerName}
                          onChange={(e) => {
                            setDirectPartnerName(e.target.value);
                            syncRoute([], true, { dPName: e.target.value });
                          }}
                          className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {tt("account_master_ledger", "Provider Account Ledger")} *
                        </label>
                        <a
                          href="/dashboard/accounts/setup"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-indigo-600 hover:underline dark:text-indigo-400 flex items-center gap-1"
                        >
                          <span>{tt("open_accounts", "Account Master")}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <select
                        value={directPartnerAccountId}
                        onChange={(e) => {
                          const pAccId = e.target.value;
                          setDirectPartnerAccountId(pAccId);
                          syncRoute([], true, { dPAccount: pAccId });
                        }}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">-- {tt("select_account_ledger", "Select Provider Ledger Account")} --</option>
                        {activeLedgers.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code ? `[${l.code}] ` : ""}{l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Portal Access */}
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-slate-700 dark:bg-slate-800 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            {tt("portal_access_question", "External Partner Portal Access?")}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            {tt("portal_access_hint", "Specify whether this partner logs into the portal to submit clearance documents.")}
                          </p>
                        </div>

                        <div className="flex items-center rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 bg-white dark:bg-slate-850">
                          <button
                            type="button"
                            onClick={() => {
                              setDirectHasPortalAccess(true);
                              syncRoute([], true, { dHasPortalAccess: true });
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                              directHasPortalAccess
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {tt("portal_yes", "Has Portal Access")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDirectHasPortalAccess(false);
                              setDirectPortalUsername("");
                              syncRoute([], true, { dHasPortalAccess: false, dPortalUsername: "" });
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                              !directHasPortalAccess
                                ? "bg-slate-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {tt("portal_no", "Offline / Manual")}
                          </button>
                        </div>
                      </div>

                      {directHasPortalAccess && (
                        <div className="pt-2 border-t border-indigo-100 dark:border-slate-700">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {tt("portal_username_label", "Partner Portal Username / Login Email")}
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. partner.ops@afghanexpress.com"
                            value={directPortalUsername}
                            onChange={(e) => {
                              setDirectPortalUsername(e.target.value);
                              syncRoute([], true, { dPortalUsername: e.target.value });
                            }}
                            className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                      )}
                    </div>

                    {!directPartnerAccountId && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{tt("select_ledger_notice", "Select an Account Master ledger. Registered account required before bills can be posted.")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDirectHandlerModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                  >
                    {tt("cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      syncRoute([], true);
                      setIsDirectHandlerModalOpen(false);
                    }}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                  >
                    {tt("save_apply_handler", "Save & Apply Handler")}
                  </button>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 pt-1">
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
        </div>
      )}

      {/* Intermediate Transit Waypoints / Crossings Cards */}
      {stops.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>{tt("intermediate_stops_list", "Intermediate Transit Waypoints / Crossings:")}</span>
            <span className="text-[10px] text-sky-700 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
              {stops.length} {stops.length === 1 ? tt("stop_single", "Stop") : tt("stops_plural", "Stops")}
            </span>
          </div>

          <div className="space-y-2">
            {stops.map((st, idx) => (
              <div
                key={st.id || idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-850 shadow-2xs hover:border-sky-300 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono text-xs font-black shadow-2xs shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-xs text-slate-900 dark:text-white">
                        {st.locationName || `Stop ${idx + 1}`}
                      </span>
                      {st.countryName && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ({st.countryName})
                        </span>
                      )}
                      {st.customsPoint && (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9.5px] font-mono text-slate-600 dark:text-slate-300">
                          {st.customsPoint}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                        {getModeIcon(st.mode)}
                        <span>{getModeLabel(st.mode)}</span>
                      </span>

                      {st.handlerType === "external_partner" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300">
                          <Users className="h-3 w-3" />
                          <span>Ext: {st.partnerName || "Partner"}</span>
                          {st.partnerAccountNumber && (
                            <span className="font-mono text-[9px] opacity-75">[{st.partnerAccountNumber}]</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 dark:text-blue-300">
                          <Building2 className="h-3 w-3" />
                          <span>{tt("handler_our_branch", "Our Branch")}</span>
                        </span>
                      )}

                      {st.insuranceRequired && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                          <ShieldCheck className="h-3 w-3" />
                          <span>{tt("insurance_short", "Insured")}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(idx)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>{tt("edit_stop_btn", "Edit Details")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title={tt("remove_stop", "Remove Stop")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 italic py-1">
          {tt(
            "direct_route_hint",
            "Direct route selected: cargo proceeds directly from origin to destination without intermediate corridor waypoints."
          )}
        </div>
      )}

      {/* Full Modal / Parda for Adding / Editing Stops */}
      <CustomerOrderRouteStopModal
        open={stopModalOpen}
        onClose={() => setStopModalOpen(false)}
        lang={lang}
        mode={stopModalMode}
        stopIndex={selectedStopIdx}
        initialValues={stopModalMode === "edit" ? stops[selectedStopIdx] : undefined}
        countries={countries}
        countryBranches={countryBranches}
        cityBranches={cityBranches}
        assignableUsers={assignableUsers}
        ports={ports}
        ledgers={activeLedgers}
        originName={loadingCityName || loadingCountryName || "Origin"}
        destinationName={destinationCityName || receivingCountryName || "Destination"}
        onSave={handleSaveModalStop}
      />
    </div>
  );
}
