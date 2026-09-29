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
  Plane
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
  lang
}: CustomerOrderRouteBuilderProps) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  // Check if current route is flagged as direct
  const isDirectRoute = useMemo(() => {
    if (!routeName) return false;
    return routeName.toLowerCase().includes("direct") || legs.length <= 1;
  }, [routeName, legs]);

  // Intermediate stops state (excluding origin and destination)
  const [stops, setStops] = useState<RouteStop[]>(() => {
    if (legs && legs.length > 1) {
      // Reconstruct stops from legs
      return legs.slice(0, -1).map((leg: any, idx: number) => ({
        id: leg.id || `stop-${idx}`,
        countryId: leg.toCountryId || "",
        countryName: leg.toCountryName || "",
        locationName: leg.toLocationText || leg.portOfDischarge || "",
        mode: (leg.transportMode as any) || "by_road",
        customsPoint: leg.customsPointText || ""
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
          customsPoint: leg.customsPointText || leg.customs_point_text || ""
        }))
      );
    } else if (!legs || legs.length <= 1) {
      setStops([]);
    }
  }, [legs?.length, routeName]);

  const getModeLabel = (m: string) => {
    switch (m) {
      case "by_sea":
        return "Sea";
      case "by_road":
        return "Road";
      case "by_air":
        return "Air";
      case "by_rail":
        return "Rail";
      default:
        return "Road";
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
  const syncRoute = (currentStops: RouteStop[], direct: boolean) => {
    const originLocation = loadingCityName || loadingCountryName || "Origin";
    const destLocation = destinationCityName || receivingCountryName || "Destination";

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
        status: "pending"
      });

      prevCountryId = st.countryId;
      prevCountryName = st.countryName;
      prevLocation = st.locationName || st.countryName;
    });

    // Final leg to Destination
    points.push(destLocation);
    generatedLegs.push({
      legNo: currentStops.length + 1,
      fromCountryId: prevCountryId || null,
      fromCountryName: prevCountryName || null,
      toCountryId: receivingCountryId || null,
      toCountryName: receivingCountryName || null,
      fromLocationText: prevLocation,
      toLocationText: destLocation,
      transportMode: currentStops[currentStops.length - 1]?.mode || transportMode || "by_road",
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
      mode: "by_road"
    };
    const nextStops = [...stops, newStop];
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

      {/* Stop Configuration Rows */}
      {stops.length > 0 ? (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {tt("intermediate_stops_list", "Intermediate Transit Waypoints / Crossings:")}
          </div>
          {stops.map((st, idx) => (
            <div
              key={st.id || idx}
              className="grid grid-cols-1 sm:grid-cols-[auto_1.5fr_1.5fr_1fr_auto] gap-2 items-center rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-850"
            >
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
                  <option value="by_road">Road (Truck)</option>
                  <option value="by_sea">Sea (Vessel)</option>
                  <option value="by_air">Air (Flight)</option>
                  <option value="by_rail">Rail (Train)</option>
                </select>
              </div>

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
