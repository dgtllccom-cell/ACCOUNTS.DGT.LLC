"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { openLoadingRecordsPrintReport } from "@/lib/reports/open-loading-records-print-report";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Download, FileText, Link2, MoreVertical, Plus, Printer, RefreshCcw, Search, Ship, Building2, ArrowDownLeft, ArrowUpRight, Pencil, Trash2, ChevronDown, ChevronRight, ArrowRightLeft, Route } from "lucide-react";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { translateOptionLabel } from "@/lib/i18n/option-labels";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { CompanyPicker } from "@/features/companies/components/company-picker";
import { ShippingLinePicker } from "@/features/shipping/components/shipping-line-picker";
import { LANE_STATUS_LABEL, allowedNextStatuses, bulkTransferActions, canCreateNewLoading, isGenuineLoadingRow, loadingRowAction, remainingToLoad, type LaneStatus } from "@/lib/purchases/lane-rules";

type TransportModeUi = "By Road" | "By Sea" | "By Air" | "By Rail";
import { ensureLaneForLoading, fetchLaneStates, laneReportHref, type LaneState } from "@/lib/purchases/lane-client";
function asRecordArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter(Boolean) as T[];
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, T>).filter(Boolean);
  }
  return [];
}

function asFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// NOTE: this can't call useActiveLanguage() itself (module scope, not a component) — every
// component below builds its OWN `tt` via buildTt(activeLang) so the page actually follows the
// selected language instead of always rendering English.
function buildTt(lang: string) {
  return (key: string, fb: string) => t((lang || "en") as any, key as any, fb);
}

const RECEIVABLE_STATUSES = new Set(["loaded", "dispatched", "in_transit", "partially_received"]);

function CustomDropdown({ record, onLoadDetails, onReceive }: { record: LoadingRecord, onLoadDetails: (r: LoadingRecord) => void, onReceive?: (r: LoadingRecord) => void }) {
  const canReceive = onReceive && RECEIVABLE_STATUSES.has(String(record.loading_status || ""));
  return (
    <UnifiedActionMenu
      onView={() => window.open(`/dashboard/purchase/purchase-loading-records/${record.id}`, "_self")}
      onEdit={() => onLoadDetails(record)}
      customItems={[
        { label: "Load Details", icon: <FileText className="h-4 w-4 text-blue-500" />, onClick: () => onLoadDetails(record) },
        ...(canReceive ? [{ label: "Receive", icon: <ArrowDownLeft className="h-4 w-4 text-emerald-600" />, onClick: () => onReceive!(record) }] : [])
      ]}
    />
  );
}

function getDefaultExRate(currency: string) {
  const c = String(currency || "").toUpperCase().trim();
  if (c === "AED") return "3.67";
  if (c === "AFN") return "72.5";
  if (c === "IRR") return "42000";
  if (c === "PKR") return "287";
  if (c === "INR") return "83.5";
  if (c === "USD") return "1";
  return "287";
}

function calcLoadingFinance(h: LoadingRecord, poRow: any = {}, form: any = {}) {
  const reportPayload = h.report_payload || {};
  const qty = Number(reportPayload.loadedQuantity || reportPayload.loadingQuantity || h.loadedQuantity || 0);
  const poData = poRow?.form_data || {};
  const goods = asRecordArray<any>(poData.goodsEntries);

  // Robust total PO quantity resolution
  const totalQuantity = Number(
    poRow.total_quantity ||
    poData.totals?.totalQuantity ||
    poData.workflow?.totalQuantity ||
    goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
    form.totalQuantity ||
    form.quantity ||
    0
  );

  const poTotal = Number(poRow?.order_total || poData.totals?.grandFinal || form.totalAmount || 0);
  const totalContractGross = Number(
    poData.totals?.totalGrossWeight ||
    poData.workflow?.totalGrossWeight ||
    goods.reduce((sum: number, item: any) => sum + Number(item.grossWeight || item.gross_weight || item.grossWt || 0), 0) ||
    form.totalGrossWeight ||
    form.grossWeight ||
    0
  );
  const totalContractNet = Number(
    poData.totals?.totalNetWeight ||
    poData.workflow?.totalNetWeight ||
    goods.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.net_weight || item.netWt || 0), 0) ||
    form.totalNetWeight ||
    form.netWeight ||
    0
  );

  // Find matching good from contract
  const goodName = reportPayload.goodsName || reportPayload.item || "";
  const good = goods.find((g: any) => (g.itemName || g.goodsName || g.item) === goodName) || goods[0] || {};

  // Per-unit weight determination
  let qtyKgs = Number(reportPayload.oneQtyKgs || good.qtyKgs || 0);
  let emptyKgs = Number(reportPayload.oneEmptyKgs || good.emptyKgs || 0);

  if (qtyKgs === 0 && totalQuantity > 0 && totalContractGross > 0) {
    qtyKgs = totalContractGross / totalQuantity;
  }

  let grossWeight = Number(reportPayload.grossWeight || 0);
  let netWeight = Number(reportPayload.netWeight || 0);

  // If stored gross/net weight equals full contract weight or is zero for a partial load, recalculate strictly for `qty`
  if (grossWeight === 0 || (totalContractGross > 0 && grossWeight >= totalContractGross && qty < totalQuantity)) {
    grossWeight = qtyKgs > 0 ? (qty * qtyKgs) : (totalQuantity > 0 ? (qty / totalQuantity) * totalContractGross : 0);
  }

  if (netWeight === 0 || (totalContractNet > 0 && netWeight >= totalContractNet && qty < totalQuantity)) {
    const netPerUnit = Math.max(0, qtyKgs - emptyKgs);
    netWeight = netPerUnit > 0 ? (qty * netPerUnit) : (totalQuantity > 0 ? (qty / totalQuantity) * totalContractNet : 0);
  }

  // Price Rate and Price Type
  let priceRate = Number(reportPayload.priceRateC1 || 0);
  let priceType = String(reportPayload.priceType || "");

  if (priceRate === 0) priceRate = Number(good.coursePrice || 0);
  if (!priceType) priceType = good.priceType || "P/Unit";

  const isPerKg = priceType === "P/KGs" || priceType.toLowerCase().startsWith("p/kg");

  const proRataRatio = totalQuantity > 0 ? (qty / totalQuantity) : (poTotal > 0 && qty > 0 ? 1 : 0);

  // Calculate Purchase Amount strictly for this loaded container quantity
  let amountUSD = 0;
  if (priceRate > 0) {
    if (isPerKg && netWeight > 0) {
      const perKgAmount = netWeight * priceRate;
      // Sanity check: if perKg amount exceeds full contract value for small loading, fallback to per unit
      if (poTotal > 0 && perKgAmount > poTotal * 1.5 && qty < totalQuantity) {
        amountUSD = qty * priceRate;
      } else {
        amountUSD = perKgAmount;
      }
    } else {
      amountUSD = qty * priceRate;
    }
  } else {
    amountUSD = proRataRatio * poTotal;
  }

  const poCountryName = (poRow?.countryName || form.branchCountry || "").toLowerCase();
  const poLocalCurrency = form.branchCurrency || poRow?.countries?.currency || (poCountryName.includes("emirate") || poCountryName.includes("uae") ? "AED" : poCountryName.includes("afghanistan") ? "AFN" : poCountryName.includes("iran") ? "IRR" : poCountryName.includes("china") ? "CNY" : poCountryName.includes("india") ? "INR" : "PKR");
  const fallbackRate = getDefaultExRate(poLocalCurrency);

  const exRate = Number(reportPayload.exchangeRatePKR || form.exchangeRate || poRow?.exchange_rate || fallbackRate);
  const amountPKR = amountUSD * exRate;
  const currency = reportPayload.pricingCurrency || form.currency || poRow?.currency_code || "USD";
  
  return { amountUSD, exRate, amountPKR, currency, grossWeight, netWeight, priceRate, priceType, totalQuantity, proRataRatio };
}
function normalizeAdvanceToPurchaseCurrency(rawAdvance: number, contractPurchaseAmount: number, exchangeRate: number) {
  const advance = Number(rawAdvance || 0);
  const contractAmount = Number(contractPurchaseAmount || 0);
  const rate = Number(exchangeRate || 1);

  if (!advance) return 0;

  // Some old purchase rows store advance in local/base currency. Detect that shape
  // and bring it back to purchase currency before pro-rating by loaded quantity.
  if (rate > 1 && contractAmount > 0 && advance > contractAmount * 1.2) {
    return advance / rate;
  }

  return advance;
}


function LoadDetailsModal({ record, onClose, onSaved }: { record: LoadingRecord; onClose: () => void; onSaved?: () => void }) {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const poData = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders)?.form_data || {};
  const poRow = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders) || {};
  const form = poData.form || {};
  const goods = asRecordArray<any>(poData.goodsEntries);

  const branchLabel = `${record.country_branches?.name || form.branchName || "-"}${record.country_branches?.code ? ` (${record.country_branches.code})` : ""}`;
  const countryLabel = `${record.countries?.name || form.branchCountry || "-"}${record.countries?.iso2 ? ` (${record.countries.iso2})` : ""}`;
  const countryNameForCurrency = (record.countries?.name || form.branchCountry || "").toLowerCase();
  const localCurrency = form.branchCurrency || poRow?.countries?.currency || record.countries?.currency || (countryNameForCurrency.includes("emirate") || countryNameForCurrency.includes("uae") ? "AED" : countryNameForCurrency.includes("afghanistan") ? "AFN" : countryNameForCurrency.includes("iran") ? "IRR" : countryNameForCurrency.includes("china") ? "CNY" : countryNameForCurrency.includes("india") ? "INR" : "PKR");
  const defaultExRate = getDefaultExRate(localCurrency);

  const adminLabel = form.userName || form.userId || "Admin";

  const loadingCountry = form.loadingCountry || form.originCountry || "-";
  const loadingPort = record.loading_location || form.loadingPort || form.exitPort || "-";
  const loadingDate = record.loaded_at ? new Date(record.loaded_at).toLocaleDateString() : (form.loadingDate || "-");

  const receivingCountry = form.receivedCountry || form.destinationCountry || "-";
  const receivingPort = record.receiving_location || form.receivedPort || form.destinationPort || "-";
  const receivingDate = form.receivedDate || form.arrivalDate || "-";
  const workflow = poData.workflow || {};
  const reportPayload = record.report_payload || {};
  const totalQuantity = Number(
    workflow.totalQuantity ||
      poData.totals?.totalQuantity ||
      goods.reduce((acc: number, item: any) => acc + Number(item.qtyNo || item.quantity || 0), 0) ||
      form.quantity ||
      0
  );
  const contractPurchaseAmount = Number(
    poRow.order_total ||
      poData.totals?.grandFinal ||
      poData.totals?.totalPurchase ||
      poData.totals?.totalAmount ||
      form.totalAmount ||
      0
  );
  const contractPurchaseCurrency = String(
    form.currency || poRow.currency_code || goods?.[0]?.pricingCurrency || "USD"
  );
  const savedLoadedQuantity = Number(

    workflow.loadedQuantity ||
      reportPayload.runningLoadedQuantity ||
      reportPayload.loadedQuantity ||
      (record.loading_status === "loaded" ? totalQuantity : 0) ||
      0
  );
  const [showNewLoading, setShowNewLoading] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [editingLoadingId, setEditingLoadingId] = useState<string | null>(null);
  const [containerNumberInput, setContainerNumberInput] = useState("");
  const [sealNumberInput, setSealNumberInput] = useState("");
  const [currentContainerIndex, setCurrentContainerIndex] = useState(1);

  const [newLoadingQuantity, setNewLoadingQuantity] = useState("");
  const [newLoadingDate, setNewLoadingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newLoadingNote, setNewLoadingNote] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [goodsName, setGoodsName] = useState("");
  const [hsCode, setHsCode] = useState("0000");
  const [allotName, setAllotName] = useState("ALT-4733");
  const [brand, setBrand] = useState("");
  const [sizeSpec, setSizeSpec] = useState("");
  const [qtyName, setQtyName] = useState("BAGS");
  const [quantityNo, setQuantityNo] = useState("");
  const [oneQtyKgs, setOneQtyKgs] = useState("");
  const [oneEmptyKgs, setOneEmptyKgs] = useState("");
  const [divideType, setDivideType] = useState("D/KGs");
  const [divideWeightValue, setDivideWeightValue] = useState("1");
  const [qualityReportRef, setQualityReportRef] = useState("");
  // Loading is OPERATIONAL: no purchase currency, exchange rate, purchase rate or converted amount lives here.
  const [containerTypeInput, setContainerTypeInput] = useState(record.container_type || "40 FT");
  const [voyageNo, setVoyageNo] = useState("");
  const [railReference, setRailReference] = useState("");
  const [grossWeightInput, setGrossWeightInput] = useState("");
  const [tareWeightInput, setTareWeightInput] = useState("");
  const [netWeightInput, setNetWeightInput] = useState("");
  const [blNumber, setBlNumber] = useState("");
  const [containerCount, setContainerCount] = useState("1");
  const [loadingCountryState, setLoadingCountryState] = useState(loadingCountry !== "-" ? loadingCountry : "");
  const [loadingPortState, setLoadingPortState] = useState(loadingPort !== "-" ? loadingPort : "");
  const [receivingCountryState, setReceivingCountryState] = useState(receivingCountry !== "-" ? receivingCountry : "");
  const [receivingPortState, setReceivingPortState] = useState(receivingPort !== "-" ? receivingPort : "");
  const [receivingDateState, setReceivingDateState] = useState(form.receivedDate || form.arrivalDate || "");
  const [vesselName, setVesselName] = useState("");
  // Country-to-Country Purchase — Transportation.
  const [transportMode, setTransportMode] = useState<TransportModeUi>("By Sea");
  const [transportCompany, setTransportCompany] = useState("");
  const [transportCompanyId, setTransportCompanyId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [truckId, setTruckId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [shippingLine, setShippingLine] = useState("");
  const [shippingLineId, setShippingLineId] = useState("");
  const [transportReference, setTransportReference] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [truckOptions, setTruckOptions] = useState<Array<{ id: string; truck_number: string; driver_name?: string | null }>>([]);

  useEffect(() => {
    fetch("/api/erp/master-data/trucks?selectable=true")
      .then((r) => (r.ok ? r.json() : { trucks: [] }))
      .then((j) => setTruckOptions(j.trucks || []))
      .catch(() => setTruckOptions([]));
  }, []);
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [transportRemarksInput, setTransportRemarksInput] = useState("");
  const [savingNewLoading, setSavingNewLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [expandedPoNos, setExpandedPoNos] = useState<Record<string, boolean>>({});

  const togglePoExpand = (poNo: string) => {
    setExpandedPoNos(prev => ({ ...prev, [poNo]: !prev[poNo] }));
  };

  // DB ports and countries list states
  const [dbLoadingPorts, setDbLoadingPorts] = useState<any[]>([]);
  const [dbReceivedPorts, setDbReceivedPorts] = useState<any[]>([]);
  const [allCountries, setAllCountries] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadLocationsAndPorts() {
      try {
        const [loadRes, recRes, countryRes] = await Promise.all([
          fetch("/api/erp/ports/loading?all=true&limit=500"),
          fetch("/api/erp/ports/received?all=true&limit=500"),
          fetch("/api/erp/locations/countries?all=true&limit=500")
        ]);
        const loadJson = await loadRes.json().catch(() => ({}));
        const recJson = await recRes.json().catch(() => ({}));
        const countryJson = await countryRes.json().catch(() => ({}));

        const loadPorts = loadJson?.data?.ports || loadJson?.ports || [];
        const recPorts = recJson?.data?.ports || recJson?.ports || [];
        const countriesList = countryJson?.data?.countries || countryJson?.countries || (Array.isArray(countryJson) ? countryJson : []);

        if (!cancelled) {
          setDbLoadingPorts(loadPorts);
          setDbReceivedPorts(recPorts);
          setAllCountries(countriesList);
        }
      } catch (err) {
        console.error("Failed to load ports/countries in loading records view", err);
      }
    }
    void loadLocationsAndPorts();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentLoadingPorts = useMemo(() => {
    let ports = dbLoadingPorts;
    if (loadingCountryState) {
      const targetCountry = (loadingCountryState || "").trim().toLowerCase();
      ports = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry);
    }
    const mode = form.shippingMode || "By Sea";
    if (mode === "By Road") {
      return ports.filter(p => p.transport_type === "road");
    } else if (mode === "By Air") {
      return ports.filter(p => p.transport_type === "air");
    } else if (mode === "By Sea") {
      return ports.filter(p => p.transport_type === "sea");
    }
    return ports;
  }, [dbLoadingPorts, loadingCountryState, form.shippingMode]);

  const currentReceivedPorts = useMemo(() => {
    let ports = dbReceivedPorts;
    if (receivingCountryState) {
      const targetCountry = (receivingCountryState || "").trim().toLowerCase();
      ports = ports.filter(p => (p.country?.name || "").trim().toLowerCase() === targetCountry || (p.country_name || "").trim().toLowerCase() === targetCountry);
    }
    const mode = form.shippingMode || "By Sea";
    if (mode === "By Road") {
      return ports.filter(p => p.transport_type === "road");
    } else if (mode === "By Air") {
      return ports.filter(p => p.transport_type === "air");
    } else if (mode === "By Sea") {
      return ports.filter(p => p.transport_type === "sea");
    }
    return ports;
  }, [dbReceivedPorts, receivingCountryState, form.shippingMode]);

  const handleAddNewLocationItem = async (type: "country" | "port", targetField: string) => {
    const value = window.prompt(`Enter New ${type === 'country' ? 'Country' : 'Port'} Name:`);
    if (!value || !value.trim()) return;
    const trimmed = value.trim();

    setSavingNewLoading(true);
    setLoadingMessage(`Saving new ${type}...`);

    try {
      if (type === "country") {
        const iso2 = trimmed.slice(0, 2).toUpperCase();
        const iso3 = trimmed.slice(0, 3).toUpperCase();
        const code = iso2.toLowerCase();
        
        const response = await fetch("/api/erp/locations/countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            iso2,
            iso3,
            currencyCode: "USD",
            officialEmail: `official.${code}@dgtllc.com`,
            adminEmail: `admin.${code}@dgtllc.com`,
            whatsappNumber: null
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || "Failed to create country.");
        
        const reloadRes = await fetch("/api/erp/locations/countries?all=true&limit=500").then(r => r.json()).catch(() => ({}));
        const countriesData = reloadRes?.data?.countries || reloadRes?.countries;
        if (countriesData) setAllCountries(countriesData);
        
        if (targetField === "loadingCountry") {
          setLoadingCountryState(trimmed);
          setLoadingPortState("");
        } else if (targetField === "receivingCountry") {
          setReceivingCountryState(trimmed);
          setReceivingPortState("");
        }
      } else if (type === "port") {
        let countryName = "";
        let isReceiving = false;
        if (targetField === "loadingPort") {
           countryName = loadingCountryState;
        } else if (targetField === "receivingPort") {
           countryName = receivingCountryState;
           isReceiving = true;
        }
        
        const countryObj = allCountries.find(c => c.name === countryName);
        const countryId = countryObj ? countryObj.id : null;
        
        const transportTypeMapping: Record<string, string> = {
          "By Sea": "sea",
          "By Road": "road",
          "By Air": "air"
        };
        const mode = form.shippingMode || "By Sea";
        const transportType = transportTypeMapping[mode] || "sea";

        const endpoint = isReceiving ? "/api/erp/ports/received" : "/api/erp/ports/loading";
        
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portName: trimmed,
            countryId: countryId,
            portCode: trimmed.slice(0, 3).toUpperCase(),
            transportType: transportType,
            isActive: true
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || payload?.error || "Failed to create port.");

        const [loadRes, recRes] = await Promise.all([
          fetch("/api/erp/ports/loading?all=true&limit=500"),
          fetch("/api/erp/ports/received?all=true&limit=500")
        ]);
        const loadPorts = await loadRes.json().then(r => r?.data?.ports || r?.ports).catch(() => null);
        const recPorts = await recRes.json().then(r => r?.data?.ports || r?.ports).catch(() => null);
        
        if (loadPorts) setDbLoadingPorts(loadPorts);
        if (recPorts) setDbReceivedPorts(recPorts);

        if (targetField === "loadingPort") {
          setLoadingPortState(trimmed);
        } else if (targetField === "receivingPort") {
          setReceivingPortState(trimmed);
        }
      }
    } catch (error: any) {
      alert(error?.message || "Failed to save location item");
    } finally {
      setSavingNewLoading(false);
      setLoadingMessage("");
    }
  };

  async function handleDeleteHistory(h: LoadingRecord) {
    if (!confirm(tt("plr.confirm_delete", "Are you sure you want to delete this loading record?"))) return;
    try {
      setSavingNewLoading(true);
      const res = await fetch(`/api/erp/purchases/loading-records/${h.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload.error?.message || payload.error || "Failed to delete.");
      setLoadingMessage(tt("plr.record_deleted", "Record deleted."));
      window.dispatchEvent(new CustomEvent("erp:purchase-loading-saved"));
    } catch (e: any) {
      alert(e.message || "Failed to delete record.");
    } finally {
      setSavingNewLoading(false);
    }
  }

  function handleEditHistory(h: LoadingRecord) {
    setShowNewLoading(true);
    setFormStep(1);
    setEditingLoadingId(h.id);
    setBlNumber(h.report_payload?.blNumber || "");
    setContainerCount(String(h.report_payload?.containerCount || h.loadedContainers || 1));
    setLoadingCountryState(h.report_payload?.loadingCountry || "");
    setLoadingPortState(h.report_payload?.loadingPort || h.loading_location || "");
    setNewLoadingDate(h.report_payload?.loadingDate || (h.loaded_at ? h.loaded_at.slice(0, 10) : new Date().toISOString().slice(0, 10)));
    setReceivingCountryState(h.report_payload?.receivingCountry || "");
    setReceivingPortState(h.report_payload?.receivingPort || h.receiving_location || "");
    setReceivingDateState(h.report_payload?.receivingDate || "");
    setVesselName(h.report_payload?.vesselName || h.carrier_name || "");
    setNewLoadingQuantity(String(h.report_payload?.loadedQuantity || h.loadedQuantity || ""));
    setNewLoadingNote(h.remarks || "");
    setOriginCountry(h.report_payload?.originCountry || "");
    setGoodsName(h.report_payload?.goodsName || "");
    setHsCode(h.report_payload?.hsCode || "0000");
    setAllotName(h.report_payload?.allotName || "ALT-4733");
    setBrand(h.report_payload?.brand || "");
    setSizeSpec(h.report_payload?.sizeSpec || "");
    setQtyName(h.report_payload?.qtyName || "BAGS");
    setQuantityNo(h.report_payload?.quantityNo || "");
    setOneQtyKgs(h.report_payload?.oneQtyKgs || "");
    setOneEmptyKgs(h.report_payload?.oneEmptyKgs || "");
    setDivideType(h.report_payload?.divideType || "D/KGs");
    setDivideWeightValue(h.report_payload?.divideWeightValue || "1");
    setQualityReportRef(h.report_payload?.qualityReportRef || "");
    setContainerTypeInput(h.container_type || record.container_type || "40 FT");
    setVoyageNo(h.voyage_no || "");
    setRailReference(h.rail_reference || "");
    setGrossWeightInput(h.gross_weight != null ? String(h.gross_weight) : "");
    setTareWeightInput(h.tare_weight != null ? String(h.tare_weight) : "");
    setNetWeightInput(h.net_weight != null ? String(h.net_weight) : "");
    if (h.transport_mode) setTransportMode(h.transport_mode as TransportModeUi);
    setContainerNumberInput(h.container_number || h.report_payload?.containerNumber || "");
    setSealNumberInput(h.report_payload?.sealNumber || "");
  }



  const [history, setHistory] = useState<LoadingRecord[]>([]);
  useEffect(() => {
    async function fetchHistory() {
      if (!record.purchase_order_id && !record.purchase_order_no && !record.id) return;
      try {
        const res = await fetch(`/api/erp/purchases/loading-records?limit=150`);
        const data = await res.json();
        if (data.ok && data.data?.records) {
           const matches = data.data.records.filter((r: LoadingRecord) => 
               ((record.purchase_order_id && r.purchase_order_id === record.purchase_order_id) ||
                (record.purchase_order_no && r.purchase_order_no === record.purchase_order_no) ||
                (record.id && (r.id === record.id || r.report_payload?.sourceRecordId === record.id))) && 
               r.loading_status === "loaded"
           );
           setHistory(matches);
        }
      } catch (e) {}
    }
    void fetchHistory();
    const handleSaved = () => { void fetchHistory(); };
    window.addEventListener("erp:purchase-loading-saved", handleSaved);
    return () => {
      window.removeEventListener("erp:purchase-loading-saved", handleSaved);
    };
  }, [record.purchase_order_id, record.purchase_order_no, record.id, savingNewLoading]);

  const itemLoadBalances = useMemo(() => {
    const balances: Record<string, { loaded: number }> = {};
    if (Array.isArray(history)) {
      history.forEach(h => {
        const gName = h.report_payload?.goodsName || h.report_payload?.item || "";
        const qty = Number(h.report_payload?.quantityNo || h.loadedQuantity || 0);
        if (gName) {
          if (!balances[gName]) balances[gName] = { loaded: 0 };
          balances[gName].loaded += qty;
        }
      });
    }
    return balances;
  }, [history]);

  // Lane state of every saved row: drives the Action column (Send to / Transfer / Track).
  const [laneStates, setLaneStates] = useState<Record<string, LaneState>>({});
  const [laneBusy, setLaneBusy] = useState(false);
  const [laneError, setLaneError] = useState("");
  const [laneSel, setLaneSel] = useState<Set<string>>(new Set());
  const refreshLane = React.useCallback(async (ids: string[]) => {
    const st = await fetchLaneStates(ids);
    setLaneStates(st);
    return st;
  }, []);
  const historyIdsKey = history.map((h) => h.id).join(",");
  useEffect(() => { void refreshLane(historyIdsKey ? historyIdsKey.split(",") : []); }, [historyIdsKey, refreshLane]);

  const laneHref = (p: { laneIds?: string[]; action?: "transfer"; focus?: string }) => laneReportHref({ purchaseOrderId: record.purchase_order_id, ...p });
  /** Make sure every given loading row has its lane row (older loads join on first look) and return the lane ids. */
  async function resolveLaneIds(loadingIds: string[]): Promise<string[]> {
    const out: string[] = [];
    await Promise.all(loadingIds.map(async (id) => {
      const known = laneStates[id];
      if (known) { out.push(known.id); return; }
      out.push(await ensureLaneForLoading(id));
    }));
    return out;
  }
  async function onRowLaneAction(h: LoadingRecord, kind: string) {
    setLaneError("");
    const st = laneStates[h.id];
    try {
      setLaneBusy(true);
      if (kind === "send_to_lane") {
        await resolveLaneIds([h.id]);
        await refreshLane(history.map((x) => x.id));
      } else if (kind === "transfer" && st) {
        window.open(laneHref({ laneIds: [st.id], action: "transfer" }), "_self");
      } else if (st) {
        window.open(laneHref({ focus: st.id }), "_self");
      }
    } catch (e: any) {
      setLaneError(e?.message || "Lane action failed.");
    } finally {
      setLaneBusy(false);
    }
  }
  async function onBulkTransfer(which: "transfer_selected" | "transfer_all") {
    setLaneError("");
    const rowsForBulk = history.filter((h) => {
      const k = loadingRowAction({ laneStatus: laneStates[h.id]?.lane_status, hasLaneRow: !!laneStates[h.id], legNo: laneStates[h.id]?.leg_no, ownerChanged: laneStates[h.id]?.ownerChanged }).kind;
      return k === "send_to_lane" || k === "transfer";
    });
    const targets = which === "transfer_selected" ? rowsForBulk.filter((h) => laneSel.has(h.id)) : rowsForBulk;
    if (!targets.length) return;
    try {
      setLaneBusy(true);
      const laneIds = await resolveLaneIds(targets.map((h) => h.id));
      window.open(laneHref({ laneIds, action: "transfer" }), "_self");
    } catch (e: any) {
      setLaneError(e?.message || "Lane action failed.");
    } finally {
      setLaneBusy(false);
    }
  }

  const newQuantity = Math.max(0, Number(newLoadingQuantity || 0));
  const previewLoadedQuantity = Math.min(totalQuantity || savedLoadedQuantity + newQuantity, savedLoadedQuantity + newQuantity);
  const previewBalanceQuantity = Math.max(0, totalQuantity - previewLoadedQuantity);
  const unitLabel = String(reportPayload.qtyName || form.qtyName || goods?.[0]?.qtyName || qtyName || "Bags");
  const visibleLoadingRows = history.length ? history : (record.loading_status === "loaded" ? [record] : []);
  const historyLoadedQuantity = visibleLoadingRows.reduce((sum, item) => {
    return sum + Number(item.report_payload?.loadedQuantity || item.report_payload?.loadingQuantity || item.loadedQuantity || item.loaded_quantity || 0);
  }, 0);
  const previousLoadedQuantity = historyLoadedQuantity || savedLoadedQuantity;
  const currentLoadingQuantity = newQuantity;
  const totalLoadedQuantity = Math.min(totalQuantity || previousLoadedQuantity + currentLoadingQuantity, previousLoadedQuantity + currentLoadingQuantity);
  const remainingToLoadQuantity = Math.max(0, totalQuantity - totalLoadedQuantity);
  /** Physical quantity still to load, ignoring whatever is being typed in the form. Payment balances never enter here. */
  const remainingBeforeEntry = totalQuantity > 0 ? remainingToLoad(totalQuantity, previousLoadedQuantity) : 1;
  const newLoadingAllowed = canCreateNewLoading({ remainingQuantity: remainingBeforeEntry, editingExisting: Boolean(editingLoadingId) });
  const effectiveContainerNo = (containerNumberInput || (transportMode === "By Road" ? vehicleNo : transportMode === "By Air" ? (transportReference || blNumber) : transportMode === "By Rail" ? railReference : "")).trim();
  const payableRemaining = Number(poRow.remaining_due || 0);
  const loadingProgress = totalQuantity > 0 ? (totalLoadedQuantity / totalQuantity) * 100 : 0;
  const contractGrossWeight = Number(
    poData.totals?.totalGrossWeight ||
      poData.workflow?.totalGrossWeight ||
      goods.reduce((sum: number, item: any) => sum + Number(item.grossWeight || item.gross_weight || item.grossWt || 0), 0) ||
      form.totalGrossWeight ||
      form.grossWeight ||
      0
  );
  const contractNetWeight = Number(
    poData.totals?.totalNetWeight ||
      poData.workflow?.totalNetWeight ||
      goods.reduce((sum: number, item: any) => sum + Number(item.netWeight || item.net_weight || item.netWt || 0), 0) ||
      form.totalNetWeight ||
      form.netWeight ||
      0
  );
  const loadedGrossWeight = useMemo(() => {
    if (!visibleLoadingRows.length) return 0;
    const sum = visibleLoadingRows.reduce((acc, item) => {
      const fin = calcLoadingFinance(item, poRow, form);
      return acc + (fin.grossWeight || 0);
    }, 0);
    if (sum > 0) return sum;
    return totalQuantity > 0 ? Math.round((previousLoadedQuantity / totalQuantity) * contractGrossWeight) : 0;
  }, [visibleLoadingRows, poRow, form, totalQuantity, previousLoadedQuantity, contractGrossWeight]);

  const loadedNetWeight = useMemo(() => {
    if (!visibleLoadingRows.length) return 0;
    const sum = visibleLoadingRows.reduce((acc, item) => {
      const fin = calcLoadingFinance(item, poRow, form);
      return acc + (fin.netWeight || 0);
    }, 0);
    if (sum > 0) return sum;
    return totalQuantity > 0 ? Math.round((previousLoadedQuantity / totalQuantity) * contractNetWeight) : 0;
  }, [visibleLoadingRows, poRow, form, totalQuantity, previousLoadedQuantity, contractNetWeight]);

  const remainingGrossWeight = Math.max(0, contractGrossWeight - loadedGrossWeight);
  const remainingNetWeight = Math.max(0, contractNetWeight - loadedNetWeight);

  const currentInputQty = Number(quantityNo || 0);
  const currentInputQtyKgs = Number(oneQtyKgs || 0);
  const currentInputEmptyKgs = Number(oneEmptyKgs || 0);
  const currentInputGrossKgs = currentInputQty > 0 && currentInputQtyKgs > 0 ? (currentInputQty * currentInputQtyKgs) : 0;
  const currentInputNetKgs = currentInputQty > 0 && currentInputQtyKgs > 0 ? (currentInputQty * Math.max(0, currentInputQtyKgs - currentInputEmptyKgs)) : 0;
  async function downloadLoadDetails(kind: "json" | "pdf") {
    if (kind === "pdf") {
      const { printDomFragmentViaModal } = await import("@/lib/reports/print-dom-fragment");
      if (!printDomFragmentViaModal("loading-record-detail-sheet", `Loading Record ${record.loading_record_no ?? ""}`.trim(), { lang: activeLang })) {
        window.print();
      }
      return;
    }
    const payload = {
      loadingRecord: record.loading_record_no,
      purchaseOrder: record.purchase_order_no,
      branch: branchLabel,
      country: countryLabel,
      totalQuantity,
      loadedQuantity: savedLoadedQuantity,
      balanceQuantity: Math.max(0, totalQuantity - savedLoadedQuantity),
      goods,
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${record.loading_record_no || "loading-record"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function saveNewLoading() {
    if (!newQuantity) {
      setLoadingMessage(tt("plr.enter_qty", "Enter loading quantity first."));
      return;
    }
    const replacedQty = editingLoadingId ? Number(history.find((x) => x.id === editingLoadingId)?.report_payload?.loadedQuantity || history.find((x) => x.id === editingLoadingId)?.loadedQuantity || 0) : 0;
    if (totalQuantity > 0 && newQuantity > remainingBeforeEntry + replacedQty + 0.0001) {
      setLoadingMessage(tt("plr.err_exceeds_remaining", "Loading quantity is more than the quantity still to load.") + ` (${(remainingBeforeEntry + replacedQty).toLocaleString()} ${unitLabel})`);
      return;
    }
    setSavingNewLoading(true);
    setLoadingMessage("");
    try {
      const isSyntheticRecord = !record.id || String(record.id).startsWith("synthetic-");
      const targetId = editingLoadingId || (!isSyntheticRecord && record.loading_status === "pending" && history.length === 0 ? record.id : null);
      const isPatch = !!targetId;
      
      const response = await fetch(isPatch ? `/api/erp/purchases/loading-records/${targetId}` : "/api/erp/purchases/loading-records", {
        method: isPatch ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId: record.country_id ?? null,
          countryBranchId: record.country_branch_id ?? null,
          cityBranchId: record.city_branch_id ?? null,
          purchaseOrderId: record.purchase_order_id ?? null,
          purchaseOrderNo: record.purchase_order_no ?? null,
          containerNumber: effectiveContainerNo || record.container_number || `LOAD-${Date.now()}`,
          containerType: containerTypeInput || record.container_type || "40 FT",
          loadingStatus: "loaded",
          loadedAt: new Date(newLoadingDate).toISOString(),
          loadingLocation: loadingPortState || record.loading_location || loadingPort,
          receivingLocation: receivingPortState || record.receiving_location || receivingPort,
          shipmentStatus: previewBalanceQuantity > 0 ? "partial_loaded" : "fully_loaded",
          carrierName: vesselName || record.carrier_name || null,
          remarks: newLoadingNote || record.remarks || null,
          loadedContainers: 1,
          loadedQuantity: newQuantity,
          // Country-to-Country Purchase — Transportation.
          transportMode,
          transportCompany: transportCompany || null,
          transportCompanyId: transportCompanyId || null,
          vehicleNo: vehicleNo || null,
          truckId: truckId || null,
          driverName: driverName || null,
          driverMobile: driverMobile || null,
          shippingLine: shippingLine || null,
          shippingLineId: shippingLineId || null,
          transportReference: transportReference || null,
          departureDate: departureDate || null,
          expectedArrivalDate: expectedArrivalDate || null,
          transportRemarks: transportRemarksInput || null,
          // Operational cargo data only — never a currency, rate or amount.
          blNumber: blNumber || null,
          grossWeight: grossWeightInput !== "" ? Number(grossWeightInput) : (currentInputGrossKgs > 0 ? currentInputGrossKgs : null),
          tareWeight: tareWeightInput !== "" ? Number(tareWeightInput) : (currentInputGrossKgs > currentInputNetKgs && currentInputNetKgs > 0 ? currentInputGrossKgs - currentInputNetKgs : null),
          netWeight: netWeightInput !== "" ? Number(netWeightInput) : (currentInputNetKgs > 0 ? currentInputNetKgs : null),
          sealNumber: sealNumberInput || null,
          vesselName: transportMode === "By Sea" ? (vesselName || null) : null,
          voyageNo: transportMode === "By Sea" ? (voyageNo || null) : null,
          awbNumber: transportMode === "By Air" ? (transportReference || blNumber || null) : null,
          flightDetails: transportMode === "By Air" ? (vesselName || null) : null,
          railReference: transportMode === "By Rail" ? (railReference || null) : null,
          originText: [loadingCountryState, loadingPortState].filter(Boolean).join(" / ") || null,
          destinationText: [receivingCountryState, receivingPortState].filter(Boolean).join(" / ") || null,
          lotName: allotName || null,
          reportPayload: {
            sourceRecordId: record.id,
            sourceLoadingRecordNo: record.loading_record_no,
            entryCount: 1,
            totalContainerCount: Number(containerCount) || 1,
            loadedQuantity: newQuantity,
            loadingQuantity: newQuantity,
            runningLoadedQuantity: savedLoadedQuantity + newQuantity,
            balanceQuantity: Math.max(0, totalQuantity - (savedLoadedQuantity + newQuantity)),
            blNumber,
            containerCount: Number(containerCount),
            containerNumber: containerNumberInput,
            sealNumber: sealNumberInput,
            currentContainerIndex,
            loadingCountry: loadingCountryState,
            loadingPort: loadingPortState,
            loadingDate: newLoadingDate,
            receivingCountry: receivingCountryState,
            receivingPort: receivingPortState,
            receivingDate: receivingDateState,
            vesselName,
            action: "new_loading_entry",
            goodsEntries: [{
              goodsName,
              quantityNo: quantityNo,
              qtyName,
              oneQtyKgs,
              oneEmptyKgs,
              divideType,
              divideWeightValue,
              qualityReportRef,
              originCountry,
              hsCode,
              allotName,
              brand,
              sizeSpec
            }],
            originCountry, goodsName, hsCode, allotName, brand, sizeSpec,
            qtyName, quantityNo, oneQtyKgs, oneEmptyKgs, divideType, divideWeightValue,
            qualityReportRef
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || payload.error || "Loading entry was not saved.");
      
      const totalContainers = Math.max(1, Number(containerCount) || 1);
      setEditingLoadingId(null);
      if (currentContainerIndex < totalContainers) {
        const nextIdx = currentContainerIndex + 1;
        setCurrentContainerIndex(nextIdx);
        setContainerNumberInput("");
        setSealNumberInput("");
        setQuantityNo("");
        setNewLoadingQuantity("");
        setLoadingMessage(`Saved Container ${currentContainerIndex} of ${totalContainers} for B/L ${blNumber || record.purchase_order_no}. Please enter details for Container #${nextIdx}.`);
      } else {
        setCurrentContainerIndex(1);
        setLoadingMessage(`All ${totalContainers} container(s) saved for B/L ${blNumber || "record"}.`);
        setFormStep(1);
        setNewLoadingQuantity("");
        setNewLoadingNote("");
        setBlNumber("");
        setContainerCount("1");
        setContainerNumberInput("");
        setSealNumberInput("");
        setLoadingCountryState(loadingCountry !== "-" ? loadingCountry : "");
        setLoadingPortState(loadingPort !== "-" ? loadingPort : "");
        setReceivingCountryState(receivingCountry !== "-" ? receivingCountry : "");
        setReceivingPortState(receivingPort !== "-" ? receivingPort : "");
        setReceivingDateState(form.receivedDate || form.arrivalDate || "");
        const defaultGood = goods?.[0] || {};
        setVesselName(form.vesselName || poRow.carrier_name || "");
        setOriginCountry(defaultGood.originCountry || defaultGood.origin || form.originCountry || form.origin || "");
        setGoodsName(defaultGood.itemName || defaultGood.goodsName || defaultGood.item || form.goodsName || "");
        setHsCode(defaultGood.hsCode || form.hsCode || "0000");
        setAllotName("ALT-4733");
        setBrand(defaultGood.brandName || defaultGood.brand || form.brand || "");
        setSizeSpec(defaultGood.sizeSpec || defaultGood.size || form.size || "");
        setQtyName(defaultGood.qtyName || defaultGood.unit || form.qtyName || "BAGS");
        setQuantityNo("");
        setOneQtyKgs(defaultGood.qtyKgs ? String(defaultGood.qtyKgs) : (form.qtyKgs ? String(form.qtyKgs) : ""));
        setOneEmptyKgs(defaultGood.emptyKgs ? String(defaultGood.emptyKgs) : (form.emptyKgs ? String(form.emptyKgs) : ""));
        setDivideType(defaultGood.divideType || form.divideType || "D/KGs");
        setDivideWeightValue(defaultGood.divideWeightValue ? String(defaultGood.divideWeightValue) : (form.divideWeightValue ? String(form.divideWeightValue) : "1"));
        setQualityReportRef("");
        setVoyageNo("");
        setRailReference("");
        setGrossWeightInput("");
        setTareWeightInput("");
        setNetWeightInput("");
      }
      setQualityReportRef("");
      window.dispatchEvent(new CustomEvent("erp:purchase-loading-saved"));
      onSaved?.();
    } catch (error) {
      setLoadingMessage(error instanceof Error ? error.message : "Loading entry was not saved.");
    } finally {
      setSavingNewLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 shadow-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">{tt("plr.title", "Load Details Form")}</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{tt("plr.subtitle", "Manage loading quantity, checking, brand note, PDF and download actions.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={!showNewLoading && !newLoadingAllowed} data-testid="new-loading-btn"
            title={!showNewLoading && !newLoadingAllowed ? tt("plr.new_loading_disabled", "Everything is already loaded. Edit an existing entry to correct it.") : undefined}
            onClick={() => {
            if (!showNewLoading) {
               setEditingLoadingId(null);
               setFormStep(1);
               const defaultGood = goods?.[0] || {};
               const dOrigin = defaultGood.originCountry || defaultGood.origin || form.originCountry || form.origin || (loadingCountry !== "-" ? loadingCountry : "");
               const dGoodsName = defaultGood.itemName || defaultGood.goodsName || defaultGood.item || form.goodsName || "";
               const dHsCode = defaultGood.hsCode || form.hsCode || "0000";
               const dBrand = defaultGood.brandName || defaultGood.brand || form.brand || "";
               const dSizeSpec = defaultGood.sizeSpec || defaultGood.size || form.size || "";
               const dQtyName = defaultGood.qtyName || defaultGood.unit || form.qtyName || "BAGS";
               const dOneQtyKgs = defaultGood.qtyKgs ? String(defaultGood.qtyKgs) : (form.qtyKgs ? String(form.qtyKgs) : "");
               const dOneEmptyKgs = defaultGood.emptyKgs ? String(defaultGood.emptyKgs) : (form.emptyKgs ? String(form.emptyKgs) : "");
               const dDivideType = defaultGood.divideType || form.divideType || "D/KGs";
               const dDivideWeightValue = defaultGood.divideWeightValue ? String(defaultGood.divideWeightValue) : (form.divideWeightValue ? String(form.divideWeightValue) : "1");
               const dTransportMode = (form.shippingMode as TransportModeUi) || "By Sea";

               setLoadingCountryState(loadingCountry !== "-" ? loadingCountry : (form.loadingCountry || ""));
               setLoadingPortState(loadingPort !== "-" ? loadingPort : (form.loadingPort || ""));
               setReceivingCountryState(receivingCountry !== "-" ? receivingCountry : (form.receivedCountry || form.destinationCountry || ""));
               setReceivingPortState(receivingPort !== "-" ? receivingPort : (form.receivedPort || form.destinationPort || ""));
               setReceivingDateState(form.receivedDate || form.arrivalDate || "");
               setNewLoadingDate(form.loadingDate || new Date().toISOString().slice(0, 10));
               setBlNumber("");
               setTransportReference("");
               setContainerCount("1");
               setVesselName(form.vesselName || poRow.carrier_name || "");
               setOriginCountry(dOrigin);
               setGoodsName(dGoodsName);
               setHsCode(dHsCode);
               setAllotName("ALT-4733");
               setBrand(dBrand);
               setSizeSpec(dSizeSpec);
               setQtyName(dQtyName);
               setQuantityNo("");
               setOneQtyKgs(dOneQtyKgs);
               setOneEmptyKgs(dOneEmptyKgs);
               setDivideType(dDivideType);
               setDivideWeightValue(dDivideWeightValue);
               setQualityReportRef("");
               setContainerTypeInput(record.container_type || "40 FT");
               setVoyageNo("");
               setRailReference("");
               setGrossWeightInput("");
               setTareWeightInput("");
               setNetWeightInput("");
               setTransportMode(dTransportMode);
               setNewLoadingQuantity("");
               setNewLoadingNote("");
            }
            setShowNewLoading((value) => !value);
          }} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> {tt("plr.new_loading", "New Loading")}
          </Button>
          <ViewportActionMenu
            ariaLabel={tt("plr.title", "Load detail actions")}
            buttonClassName="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            trigger={<MoreVertical className="h-4 w-4" />}
          >
            {(close) => (
              <div className="py-1">
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); setLoadingMessage("Brand view selected for this loading report."); }}>
                  <Ship className="h-3.5 w-3.5 text-emerald-600" /> {tt("plr.brand", "Brand")}
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); setLoadingMessage("Checking view selected. Review quantity, dates and loading balance before saving."); }}>
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> {tt("plr.checking", "Checking")}
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); downloadLoadDetails("json"); }}>
                  <Download className="h-3.5 w-3.5 text-indigo-600" /> {tt("common.download", "Download")}
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); downloadLoadDetails("pdf"); }}>
                  <Printer className="h-3.5 w-3.5 text-rose-600" /> {tt("plr.pdf_download", "PDF Download")}
                </button>
              </div>
            )}
          </ViewportActionMenu>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition"
            aria-label={tt("plr.a_close", "Close")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
        <div id="loading-record-detail-sheet" className="w-full space-y-6">
          <div className={cn("grid gap-6 items-start w-full", showNewLoading ? "grid-cols-1 xl:grid-cols-[380px_1fr]" : "grid-cols-1")}>
            {showNewLoading && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 fade-in duration-300">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="mb-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-100">
                        {formStep === 1 ? tt("plr.step1", "New Loading (Step 1 of 2)") : tt("plr.step2", "New Loading (Step 2 of 2)")}
                      </h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-500/30">{tt("plr.live", "Live")}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-200/80">
                      {formStep === 1 ? tt("plr.step1_desc", "Enter shipping and routing details.") : tt("plr.step2_desc_op", "Enter goods, container, seal and weight details.")}
                    </p>
                  </div>

                  {formStep === 1 ? (
                    <>
                      {/* Source Bill Banner */}
                      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                              {poRow.purchase_order_no || record.purchase_order_no || "PO"}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {form.supplierName || poRow.supplier_name || tt("plr.unknown_supplier", "Supplier")}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            {goodsName || goods?.[0]?.itemName || goods?.[0]?.goodsName || "-"}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">{tt("plr.contract_qty", "Contract")}</div>
                            <div className="font-mono font-black text-slate-800 dark:text-slate-200">{totalQuantity.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-emerald-600 uppercase">{tt("plr.loaded_qty", "Loaded")}</div>
                            <div className="font-mono font-black text-emerald-600">{totalLoadedQuantity.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-amber-600 uppercase">{tt("plr.remaining_qty", "Remaining")}</div>
                            <div className="font-mono font-black text-amber-600">{remainingToLoadQuantity.toLocaleString()}</div>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="mt-2.5 space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-slate-500">
                            <span>{tt("plr.loading_progress", "Loading Progress")}</span>
                            <span className="font-mono">{loadingProgress.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, loadingProgress))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Entry Counter Banner */}
                      <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{tt("plr.entry_counter", "Entry")} <strong>#{(history.length || 0) + 1}</strong></span>
                          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-300/80">
                            ({history.length} {tt("plr.completed", "completed")}, {remainingToLoadQuantity.toLocaleString()} {unitLabel} {tt("plr.remaining", "remaining")})
                          </span>
                        </div>
                        <span className="rounded bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                          {tt("plr.step_1_of_2", "Step 1/2")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pr-1 pb-2">
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 col-span-2">
                          {tt("plr.entry_count", "Entry Count")}
                          <select
                            value={containerCount}
                            onChange={(e) => setContainerCount(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={String(n)}>{n === 1 ? tt("plr.entry_1", "1 Entry") : `${n} ${tt("plr.entries", "Entries")}`}</option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.loading_country", "Loading Country")}
                          <SearchableSelect
                            value={loadingCountryState}
                            onChange={(val) => {
                              if (val === "__ADD_NEW__") {
                                void handleAddNewLocationItem("country", "loadingCountry");
                              } else {
                                setLoadingCountryState(val);
                                setLoadingPortState("");
                              }
                            }}
                            options={allCountries.map((c) => ({ label: `${c.name} ${c.iso2 ? `(${c.iso2})` : ""}`, value: c.name }))}
                            placeholder={tt("plr.sel_country", "Select Country")}
                            addOptionLabel={tt("plr.add_country", "Add New Country")}
                          />
                        </label>
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.loading_port", "Loading Port / Border")}
                          <SearchableSelect
                            value={loadingPortState}
                            onChange={(val) => {
                              if (val === "__ADD_NEW__") {
                                void handleAddNewLocationItem("port", "loadingPort");
                              } else {
                                setLoadingPortState(val);
                              }
                            }}
                            options={currentLoadingPorts.map((p) => ({ label: `${p.port_name} ${p.port_code ? `[${p.port_code}]` : ""}`, value: p.port_name }))}
                            placeholder={form.shippingMode === "By Road" ? tt("plr.sel_border", "Select Border") : tt("plr.sel_port", "Select Port")}
                            addOptionLabel={form.shippingMode === "By Road" ? tt("plr.add_border", "Add New Border") : tt("plr.add_port", "Add New Port")}
                            disabled={!loadingCountryState && currentLoadingPorts.length === 0}
                          />
                        </label>

                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.receiving_country", "Receiving Country")}
                          <SearchableSelect
                            value={receivingCountryState}
                            onChange={(val) => {
                              if (val === "__ADD_NEW__") {
                                void handleAddNewLocationItem("country", "receivingCountry");
                              } else {
                                setReceivingCountryState(val);
                                setReceivingPortState("");
                              }
                            }}
                            options={allCountries.map((c) => ({ label: `${c.name} ${c.iso2 ? `(${c.iso2})` : ""}`, value: c.name }))}
                            placeholder={tt("plr.sel_country", "Select Country")}
                            addOptionLabel={tt("plr.add_country", "Add New Country")}
                          />
                        </label>
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.receiving_port", "Receiving Port / Border")}
                          <SearchableSelect
                            value={receivingPortState}
                            onChange={(val) => {
                              if (val === "__ADD_NEW__") {
                                void handleAddNewLocationItem("port", "receivingPort");
                              } else {
                                setReceivingPortState(val);
                              }
                            }}
                            options={currentReceivedPorts.map((p) => ({ label: `${p.port_name} ${p.port_code ? `[${p.port_code}]` : ""}`, value: p.port_name }))}
                            placeholder={form.shippingMode === "By Road" ? tt("plr.sel_border", "Select Border") : tt("plr.sel_port", "Select Port")}
                            addOptionLabel={form.shippingMode === "By Road" ? tt("plr.add_border", "Add New Border") : tt("plr.add_port", "Add New Port")}
                            disabled={!receivingCountryState && currentReceivedPorts.length === 0}
                          />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.loading_date", "Loading Date")}
                          <input
                            type="date"
                            value={newLoadingDate}
                            onChange={(e) => setNewLoadingDate(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                          />
                        </label>
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {tt("plr.receiving_date", "Receiving Date")}
                          <input
                            type="date"
                            value={receivingDateState}
                            onChange={(e) => setReceivingDateState(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                          />
                        </label>
                      </div>

                      {/* Country-to-Country Purchase — Transportation */}
                      <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/10">
                        <div className="mb-3 flex items-center justify-between border-b border-indigo-100 pb-2 dark:border-indigo-900/40">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                              {tt("plr.transport_title", "Transportation Details")}
                            </h5>
                          </div>
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                            {translateOptionLabel(activeLang, transportMode)}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 sm:col-span-2">
                            {tt("plr.transport_mode", "Transport Mode")}
                            <select
                              value={transportMode}
                              onChange={(e) => {
                                const mode = e.target.value as TransportModeUi;
                                setTransportMode(mode);
                              }}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                            >
                              <option value="By Sea">{tt("plr.by_sea", "By Sea (Ocean Freight)")}</option>
                              <option value="By Road">{tt("plr.by_road", "By Road (Truck / Trailer)")}</option>
                              <option value="By Air">{tt("plr.by_air", "By Air (Air Freight)")}</option>
                              <option value="By Rail">{tt("plr.by_rail", "By Rail (Train)")}</option>
                            </select>
                          </label>

                          {/* Sea Mode Layout */}
                          {transportMode === "By Sea" && (
                            <>
                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.bl_number", "B/L Reference No.")}
                                <input
                                  value={blNumber}
                                  onChange={(e) => {
                                    setBlNumber(e.target.value);
                                    setTransportReference(e.target.value);
                                  }}
                                  data-testid="ld-bl" placeholder={tt("plr.ph_e_g__bl12345", "e.g. BL12345")}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.vessel_name", "Vessel Name")}
                                <input
                                  value={vesselName}
                                  onChange={(e) => setVesselName(e.target.value)}
                                  placeholder={tt("plr.ph_e_g__msc_alina", "e.g. MSC Alina")}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.voyage_no", "Voyage No.")}
                                <input
                                  value={voyageNo}
                                  onChange={(e) => setVoyageNo(e.target.value)}
                                  data-testid="ld-voyage"
                                  placeholder="e.g. 024E"
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <div className="space-y-1 sm:col-span-2">
                                <ShippingLinePicker
                                  label={tt("plr.shipping_line", "Shipping Line")}
                                  value={shippingLineId}
                                  onValueChange={async (id) => {
                                    setShippingLineId(id);
                                    if (!id) return;
                                    try {
                                      const res = await fetch(`/api/erp/shipping-lines/${id}`);
                                      const json = await res.json();
                                      if (json?.shippingLine?.name) setShippingLine(json.shippingLine.name);
                                    } catch { /* ignore */ }
                                  }}
                                />
                              </div>
                            </>
                          )}

                          {/* Road Mode Layout */}
                          {transportMode === "By Road" && (
                            <>
                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.bilty_ref", "Bilty / Waybill No.")}
                                <input
                                  value={transportReference || blNumber}
                                  onChange={(e) => {
                                    setTransportReference(e.target.value);
                                    setBlNumber(e.target.value);
                                  }}
                                  placeholder={tt("plr.ph_bilty", "e.g. BTY-9801")}
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.vehicle_no", "Truck / Vehicle No.")}
                                <input
                                  value={vehicleNo}
                                  onChange={(e) => setVehicleNo(e.target.value)}
                                  placeholder="e.g. T-8492"
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              {truckOptions.length > 0 && (
                                <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 sm:col-span-2">
                                  {tt("plr.registered_truck", "Select From Registered Trucks")}
                                  <select
                                    value={truckId}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      setTruckId(id);
                                      const tr = truckOptions.find((x) => x.id === id);
                                      if (tr) {
                                        setVehicleNo(tr.truck_number || vehicleNo);
                                        if (tr.driver_name) setDriverName(tr.driver_name);
                                      }
                                    }}
                                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                  >
                                    <option value="">{tt("plr.select_truck", "Select Truck (optional)")}</option>
                                    {truckOptions.map((tr) => (
                                      <option key={tr.id} value={tr.id}>
                                        {tr.truck_number} {tr.driver_name ? `(${tr.driver_name})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.driver_name", "Driver Name")}
                                <input
                                  value={driverName}
                                  onChange={(e) => setDriverName(e.target.value)}
                                  placeholder="Driver name"
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.driver_mobile", "Driver Contact / Mobile")}
                                <input
                                  value={driverMobile}
                                  onChange={(e) => setDriverMobile(e.target.value)}
                                  placeholder="+971 / +92 ..."
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <div className="space-y-1 sm:col-span-2">
                                <CompanyPicker
                                  label={tt("plr.transport_company", "Transport Company")}
                                  value={transportCompanyId}
                                  onValueChange={async (companyId) => {
                                    setTransportCompanyId(companyId);
                                    if (!companyId) return;
                                    try {
                                      const res = await fetch(`/api/erp/companies/${companyId}`);
                                      const json = await res.json();
                                      if (json?.company?.name) setTransportCompany(json.company.name);
                                    } catch { /* ignore */ }
                                  }}
                                />
                              </div>
                            </>
                          )}

                          {/* Air Mode Layout */}
                          {transportMode === "By Air" && (
                            <>
                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.awb_no", "AWB Number / Ref")}
                                <input
                                  value={transportReference || blNumber}
                                  onChange={(e) => {
                                    setTransportReference(e.target.value);
                                    setBlNumber(e.target.value);
                                  }}
                                  placeholder="e.g. AWB-12345678"
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                {tt("plr.flight_carrier", "Flight No. / Carrier")}
                                <input
                                  value={vesselName}
                                  onChange={(e) => setVesselName(e.target.value)}
                                  placeholder="e.g. EK-601"
                                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                                />
                              </label>

                              <div className="space-y-1 sm:col-span-2">
                                <CompanyPicker
                                  label={tt("plr.airline_forwarder", "Airline / Air Forwarder")}
                                  value={transportCompanyId}
                                  onValueChange={async (companyId) => {
                                    setTransportCompanyId(companyId);
                                    if (!companyId) return;
                                    try {
                                      const res = await fetch(`/api/erp/companies/${companyId}`);
                                      const json = await res.json();
                                      if (json?.company?.name) setTransportCompany(json.company.name);
                                    } catch { /* ignore */ }
                                  }}
                                />
                              </div>
                            </>
                          )}

                          {/* Rail Mode Layout */}
                          {transportMode === "By Rail" && (
                            <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 sm:col-span-2">
                              {tt("plr.rail_ref", "Rail / Wagon Reference")}
                              <input
                                value={railReference}
                                onChange={(e) => setRailReference(e.target.value)}
                                data-testid="ld-rail"
                                placeholder="e.g. RW-55021"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                              />
                            </label>
                          )}

                          {/* Common Dates */}
                          <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                            {tt("plr.departure_date", "Departure Date")}
                            <input
                              type="date"
                              value={departureDate}
                              onChange={(e) => setDepartureDate(e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                            />
                          </label>

                          <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                            {tt("plr.expected_arrival_date", "Expected Arrival Date")}
                            <input
                              type="date"
                              value={expectedArrivalDate}
                              onChange={(e) => setExpectedArrivalDate(e.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                            />
                          </label>

                          <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 sm:col-span-2">
                            {tt("plr.transport_remarks", "Transport Remarks")}
                            <input
                              value={transportRemarksInput}
                              onChange={(e) => setTransportRemarksInput(e.target.value)}
                              placeholder="Optional transport notes..."
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mt-5">
                        <Button
                          type="button"
                          onClick={() => setFormStep(2)}
                          className="w-full h-10 rounded-lg bg-emerald-600 px-4 text-[11px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                        >
                          {tt("common.next_step", "Next Step")}
                        </Button>
                      </div>
                    </>
                  ) : formStep === 2 ? (
                    <div className="flex flex-col h-full pr-1 pt-2 pb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{tt("plr.goods_entry", "Goods Entry")}</h4>
                      </div>

                      <div className="mb-3 flex items-center justify-between rounded-lg bg-blue-50 p-2.5 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                            B/L {blNumber || record.purchase_order_no || "ENTRY"}
                          </span>
                          <span className="text-xs font-black text-blue-900 dark:text-blue-100">
                            Container {currentContainerIndex} of {Math.max(1, Number(containerCount) || 1)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          {Number(containerCount) > 1 ? `Container #${currentContainerIndex} Entry` : "Single Container Entry"}
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-2.5 mb-4 text-[10px] space-y-2 dark:border-slate-800 dark:bg-slate-900/60 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-1.5 font-bold">
                          <span className="text-slate-500 uppercase tracking-wider text-[9px] flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            PO SUMMARY ({history.length} {history.length === 1 ? 'Entry' : 'Entries'})
                          </span>
                          <span className="font-mono text-[9px] text-slate-600 dark:text-slate-300">
                            Total: <strong className="font-black text-slate-900 dark:text-white">{totalQuantity.toLocaleString()}</strong> {unitLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-white p-1.5 rounded border border-slate-100 dark:border-slate-800 dark:bg-slate-950">
                            <div className="text-[8px] font-extrabold uppercase text-slate-400">{tt("plr.word_total", "Total")}</div>
                            <div className="font-mono font-black text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                              {totalQuantity.toLocaleString()} <span className="text-[8px] font-medium text-slate-400">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-slate-500 mt-0.5 font-mono leading-tight">
                              <div><span className="text-slate-400">{tt("plr.f_net", "Net:")}</span> {contractNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-slate-400">{tt("plr.f_gross", "Gross:")}</span> {contractGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>

                          <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-200/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                            <div className="text-[8px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">Loaded ({history.length})</div>
                            <div className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-[10px] leading-tight">
                              {totalLoadedQuantity.toLocaleString()} <span className="text-[8px] font-medium text-emerald-600/70">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-emerald-700/80 dark:text-emerald-400 mt-0.5 font-mono leading-tight">
                              <div><span className="text-emerald-600/60">{tt("plr.f_net", "Net:")}</span> {loadedNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-emerald-600/60">{tt("plr.f_gross", "Gross:")}</span> {loadedGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>

                          <div className="bg-rose-50/70 p-1.5 rounded border border-rose-200/60 dark:border-rose-900/50 dark:bg-rose-950/30">
                            <div className="text-[8px] font-extrabold uppercase text-rose-600 dark:text-rose-400">{tt("plr.word_remaining", "Remaining")}</div>
                            <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-[10px] leading-tight">
                              {remainingToLoadQuantity.toLocaleString()} <span className="text-[8px] font-medium text-rose-500/70">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-rose-600/80 dark:text-rose-400 mt-0.5 font-mono leading-tight">
                              <div><span className="text-rose-500/60">{tt("plr.f_net", "Net:")}</span> {remainingNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-rose-500/60">{tt("plr.f_gross", "Gross:")}</span> {remainingGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>
                        </div>

                        {currentInputNetKgs > 0 && (
                          <div className="flex items-center justify-between bg-cyan-50 p-1 rounded border border-cyan-200 text-[9.5px] dark:bg-cyan-950/40 dark:border-cyan-800">
                            <span className="font-bold text-cyan-800 dark:text-cyan-300">{tt("plr.current_entry_weight", "Current Entry Weight")}:</span>
                            <span className="font-mono font-black text-cyan-900 dark:text-cyan-200">
                              Net: {currentInputNetKgs.toLocaleString()} kg | Gross: {currentInputGrossKgs.toLocaleString()} kg
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          {tt("plr.origin_country", "Origin Country")}
                          <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder={tt("plr.ph_india", "India")} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          {tt("plr.goods_name", "Goods Name")}
                          <select
                            value={goodsName}
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              setGoodsName(selectedName);
                              const good = goods.find((g: any) => (g.itemName || g.goodsName || g.item) === selectedName);
                              if (good) {
                                if (good.hsCode) setHsCode(good.hsCode);
                                if (good.brandName || good.brand) setBrand(good.brandName || good.brand);
                                if (good.originCountry || good.origin) setOriginCountry(good.originCountry || good.origin);
                                if (good.qtyName || good.unit) setQtyName(good.qtyName || good.unit);
                                if (good.sizeSpec || good.size) setSizeSpec(good.sizeSpec || good.size);
                                // Quantity No is explicitly left empty for manual user entry as requested
                                if (good.qtyKgs) setOneQtyKgs(String(good.qtyKgs));
                                if (good.emptyKgs) setOneEmptyKgs(String(good.emptyKgs));
                                if (good.divideType) setDivideType(good.divideType);
                                if (good.divideWeightValue) setDivideWeightValue(String(good.divideWeightValue));
                              }
                            }}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value="">{tt("plr.select_goods", "Select Goods")}</option>
                            {goods.map((g: any, i: number) => {
                              const name = g.itemName || g.goodsName || g.item;
                              if (!name) return null;
                              return <option key={i} value={name}>{name}</option>;
                            })}
                          </select>
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.hs_code", "HS Code")}
                          <input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="0000" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.allot_name", "Allot Name / ID")}
                          <input value={allotName} onChange={(e) => setAllotName(e.target.value)} placeholder="ALT-4733" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.brand_label", "Brand")}
                          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={tt("plr.select_brand", "Select Brand")} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.size_spec", "Size Specification")}
                          <input value={sizeSpec} onChange={(e) => setSizeSpec(e.target.value)} placeholder={tt("plr.select_size", "Select Size")} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.qty_name", "Qty Name")}
                          <input value={qtyName} onChange={(e) => setQtyName(e.target.value)} placeholder="BAGS" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.qty_number", "Quantity No")}
                          <input data-testid="ld-qty" value={quantityNo} onChange={(e) => {
                            setQuantityNo(e.target.value);
                            setNewLoadingQuantity(e.target.value);
                          }} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.gross_per_unit", "Gross Wt / Unit (KGS)")}
                          <input value={oneQtyKgs} onChange={(e) => setOneQtyKgs(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.empty_per_unit", "Empty Wt / Unit (KGS)")}
                          <input value={oneEmptyKgs} onChange={(e) => setOneEmptyKgs(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.divide_type", "Divide Type")}
                          <input value={divideType} onChange={(e) => setDivideType(e.target.value)} placeholder="D/KGs" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {tt("plr.divide_weight", "Divide Wt / Value")}
                          <input value={divideWeightValue} onChange={(e) => setDivideWeightValue(e.target.value)} placeholder="1" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          {tt("plr.quality_ref", "Quality Report Ref")}
                          <input value={qualityReportRef} onChange={(e) => setQualityReportRef(e.target.value)} placeholder={tt("plr.ph_passed", "Passed")} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 mb-6 dark:border-emerald-900/30 dark:bg-emerald-950/20" data-testid="loading-container-panel">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400 mb-3">{tt("plr.container_section", "Container, Seal & Weights")}</h4>

                        <div className="flex flex-col gap-3">
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            {tt("plr.container_no", "Container No.")}
                            <input value={containerNumberInput} onChange={(e) => setContainerNumberInput(e.target.value)} data-testid="ld-container-no" placeholder={tt("plr.ph_e_g__mscu1234567", "e.g. MSCU1234567")} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            {tt("plr.container_size", "Container Size / Type")}
                            <select value={containerTypeInput} onChange={(e) => setContainerTypeInput(e.target.value)} data-testid="ld-container-type" className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200">
                              {containerTypes.map((c) => (<option key={c} value={c}>{c}</option>))}
                            </select>
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            {tt("plr.seal_no", "Seal No.")}
                            <input value={sealNumberInput} onChange={(e) => setSealNumberInput(e.target.value)} data-testid="ld-seal" placeholder={tt("plr.ph_e_g__sl998877", "e.g. SL998877")} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                              {tt("plr.gross_weight_kg", "Gross (kg)")}
                              <input type="number" min="0" step="0.01" value={grossWeightInput} onChange={(e) => setGrossWeightInput(e.target.value)} data-testid="ld-gross" placeholder={currentInputGrossKgs > 0 ? String(currentInputGrossKgs) : "0"} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                            </label>
                            <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                              {tt("plr.tare_weight_kg", "Tare (kg)")}
                              <input type="number" min="0" step="0.01" value={tareWeightInput} onChange={(e) => setTareWeightInput(e.target.value)} data-testid="ld-tare" placeholder={currentInputGrossKgs > currentInputNetKgs ? String(currentInputGrossKgs - currentInputNetKgs) : "0"} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                            </label>
                            <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                              {tt("plr.net_weight_kg", "Net (kg)")}
                              <input type="number" min="0" step="0.01" value={netWeightInput} onChange={(e) => setNetWeightInput(e.target.value)} data-testid="ld-net" placeholder={currentInputNetKgs > 0 ? String(currentInputNetKgs) : "0"} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                            </label>
                          </div>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            {tt("plr.loading_note", "Loading Note")}
                            <input value={newLoadingNote} onChange={(e) => setNewLoadingNote(e.target.value)} data-testid="ld-note" placeholder={tt("plr.ph_e_g__checking___brand_remarks", "e.g. Checking / brand remarks")} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <div className="rounded-md border border-dashed border-emerald-300 bg-white/70 px-3 py-2 text-[10px] font-semibold text-slate-600 dark:border-emerald-800 dark:bg-slate-900/60 dark:text-slate-300" data-testid="loading-booking-readonly">
                            <span className="uppercase tracking-wider text-slate-400">{tt("plr.booking_amount_ro", "Booking amount (read-only)")}: </span>
                            <span className="font-mono font-black">{contractPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contractPurchaseCurrency}</span>
                            <div className="mt-0.5 text-[9px] font-medium text-slate-400">{tt("plr.booking_amount_note", "Currency, rate and amounts belong to the Purchase Booking and Payment Journal — not to Loading.")}</div>
                          </div>
                        </div>
                      </div>

                      {/* PO Items Status Summary Table */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 mb-4 dark:border-slate-800 dark:bg-slate-900/30">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">{tt("plr.po_items_status", "PO Items Status")}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[9px] border-collapse bg-white dark:bg-slate-950 rounded-lg overflow-hidden border dark:border-slate-850">
                            <thead>
                              <tr className="border-b text-slate-400 font-bold uppercase tracking-wider bg-slate-50/80 dark:bg-slate-900/50">
                                <Th className="px-2 py-1.5">{tt("plr.col_item", "Item")}</Th>
                                <Th className="px-2 py-1.5 text-right">{tt("plr.col_po_qty", "PO Qty")}</Th>
                                <Th className="px-2 py-1.5 text-right">{tt("plr.status_loaded", "Loaded")}</Th>
                                <Th className="px-2 py-1.5 text-right">{tt("plr.col_balance_short", "Balance")}</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {goods.map((g: any, gIdx: number) => {
                                const name = g.goodsName || g.item || "-";
                                const poQty = Number(g.qtyNo || g.quantity || 0);
                                const loaded = itemLoadBalances[name]?.loaded || 0;
                                const bal = Math.max(0, poQty - loaded);
                                return (
                                  <tr key={gIdx} className="text-slate-655 dark:text-slate-350 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                                    <td className="px-2 py-2 font-bold uppercase truncate max-w-[80px]" title={name}>{name}</td>
                                    <td className="px-2 py-2 text-right font-mono">{poQty.toLocaleString()}</td>
                                    <td className="px-2 py-2 text-right font-mono text-emerald-600 font-bold">{loaded.toLocaleString()}</td>
                                    <td className={cn("px-2 py-2 text-right font-mono font-bold", (bal > 0) ? "text-rose-600" : "text-emerald-650")}>{bal.toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 pb-20 sm:pb-0 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" onClick={() => setFormStep(1)} className="rounded-full h-9 px-4 text-xs font-bold">
                          {tt("plr.back", "Back")}
                        </Button>
                        <Button type="button" onClick={() => void saveNewLoading()} disabled={savingNewLoading || !newQuantity || !effectiveContainerNo} data-testid="ld-save" className="rounded-full h-9 bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition active:scale-[0.98] disabled:opacity-50">
                          {savingNewLoading ? tt("plr.saving", "Saving...") : (Number(containerCount) > 1 && (currentContainerIndex < Number(containerCount))) ? tt("plr.save_next", "Save & Next Container") + " (" + String(currentContainerIndex + 1) + "/" + String(containerCount) + ")" : tt("plr.save_loading", "Save Loading")}
                        </Button>
                      </div>

                    </div>
                  ) : null}
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-6 min-w-0">
              <div className={cn("grid gap-4", showNewLoading ? "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4" : "grid-cols-1 lg:grid-cols-4")}>
            {/* BRANCH & BILL DETAILS (Matching Picture 1 Design) */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">{tt("plr.branch_bill_details", "Branch & Bill Details")}</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{tt("plr.branch_bill_no", "Branch / Bill No.")}</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{branchLabel}</div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.user_admin", "User Admin")}:</span>
                    <span className="font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded text-[10px] dark:bg-emerald-950/50">{adminLabel}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.user", "User")} ID:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{form.userId || form.userCode || "ADM-001"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.session_timestamp", "Session Timestamp")}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.location", "Location")}:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-right truncate pl-2" title={countryLabel}>{countryLabel}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.booking_date", "Booking Date")}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(record.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.status", "Status")}:</span>
                    <span className="font-bold text-amber-600 uppercase text-[10px]">{record.loading_status === "loaded" ? tt("plr.status_loaded", "Loaded") : (record.loading_status || "PENDING")}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.system_serial", "System Serial")}:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{record.purchase_order_no || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{tt("plr.branch_serial", "Branch Serial")}:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{record.loading_record_no}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.branch_mobile", "Branch Mobile")}:</span>
                    <span className="font-mono font-bold text-blue-600">{form.branchMobile || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.loading_mode", "Loading Mode")}:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{translateOptionLabel(activeLang, record.transportMode || record.transport_mode || record.shippingMode || "")}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.origin_country", "Origin Country")}:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{loadingCountry}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PURCHASE ACCOUNT DETAILS */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-purple-50 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">{tt("plr.purchase_account_details", "Purchase Account Details")}</h3>
              </div>
              <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.account_code", "Account Code")}:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.purchaseAccountNumber || form.purchaseAccountNo || "-"}</span>
                  </div>
                  <div className="pt-2 pb-1">
                    <div className="text-[10px] text-slate-400 mb-0.5">{tt("plr.account_name", "Account Name")}:</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 leading-snug">{form.purchaseAccountName || "-"}</div>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.branch", "Branch")}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{form.branchName || form.branchCode || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.currency", "Currency")}:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{form.currency || "-"}</span>
                  </div>
              </div>
            </div>

            {/* SALES ACCOUNT (CR) */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">{tt("plr.sales_account_cr", "Sales Account (CR)")}</h3>
              </div>
              <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("plr.account_code", "Account Code")}:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.salesAccountNumber || form.salesAccountNo || "-"}</span>
                  </div>
                  <div className="pt-2 pb-1">
                    <div className="text-[10px] text-slate-400 mb-0.5">{tt("plr.account_name", "Account Name")}:</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 leading-snug">{form.salesAccountName || "-"}</div>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.branch", "Branch")}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{form.branchName || form.branchCode || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">{tt("common.currency", "Currency")}:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{form.currency || "-"}</span>
                  </div>
              </div>
            </div>

            {/* LOADING REPORT SUMMARY (Requirement 7) */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Ship className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">{tt("plr.loading_summary_report", "Loading Summary Report")}</h3>
                </div>
                <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  {loadingProgress.toFixed(1)}% {tt("plr.status_loaded", "Loaded")}
                </span>
              </div>
              <div className="space-y-2 text-xs font-semibold">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.total_contract_qty", "Total Contract Qty")}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{totalQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.contract_gross_weight", "Contract Gross Weight")}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractGrossWeight.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.contract_net_weight", "Contract Net Weight")}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractNetWeight.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.contract_purchase_amount", "Contract Purchase Amt")}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contractPurchaseCurrency}</span>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{tt("plr.previously_loaded", "Previously Loaded")}</span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{previousLoadedQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-blue-50/60 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">{tt("plr.current_loading_qty", "Current Loading")}</span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400">{currentLoadingQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-teal-50/60 dark:bg-teal-900/10 p-3 rounded-lg border border-teal-100 dark:border-teal-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">{tt("plr.total_loaded", "Total Loaded")}</span>
                  <span className="font-mono font-black text-teal-700 dark:text-teal-400">{totalLoadedQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">{tt("plr.remaining_to_load", "Remaining to Load")}</span>
                  <span className="font-mono font-black text-rose-600">{remainingToLoadQuantity.toLocaleString()} {unitLabel}</span>
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300" data-testid="loading-payment-note">
                  <p>{tt("plr.payment_note", "Payment is separate from loading. An outstanding Credit or Final Payment balance stays in Accounts Payable; it never blocks loading and is not part of Remaining to Load.")}</p>
                  {payableRemaining > 0.005 && (
                    <a
                      href={`/dashboard/journal/purchase-order-payment/remaining?purchaseOrderNo=${encodeURIComponent(record.purchase_order_no || poRow.purchase_order_no || "")}`}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
                      data-testid="open-payment-journal"
                    >
                      <Link2 className="h-3 w-3" /> {tt("plr.open_payment_journal", "Open Payment Journal")}
                    </a>
                  )}
                </div>
              </div>
            </div>

              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="bill-loading-report">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">{tt("plr.title_current_bill_loading", "Current Bill Loading Report")}</h3>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">{tt("plr.bill_loading_note", "Physical quantity and weight: contract, loaded and still to load.")}</p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    {tt("plr.bill_summary", "Bill Summary")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                        <Th className="px-4 py-3">{tt("common.sr_no", "SR#")}</Th>
                        <Th className="px-4 py-3">{tt("plr.col_goods", "Goods")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.col_contract_qty", "Contract Qty")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.loaded_qty", "Loaded Qty")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.remaining_to_load", "Remaining to Load")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.col_net_weight", "Net Weight")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.col_gross_weight", "Gross Weight")}</Th>
                        <Th className="px-4 py-3 text-end">{tt("plr.col_booking_amount", "Booking Amount")}</Th>
                        <Th className="px-4 py-3">{tt("plr.col_route_dates", "Route / Dates")}</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const gName = goods?.[0]?.goodsName || goods?.[0]?.item || form.goodsName || form.itemName || "-";
                        const brandName = goods?.[0]?.brand || form.brand || "";
                        const sizeName = goods?.[0]?.size || form.size || "";
                        const route = [loadingPort !== "-" ? loadingPort : form.loadingPort, receivingPort !== "-" ? receivingPort : form.receivedPort].filter(Boolean).join(" \u2192 ") || "-";
                        const displayLoadDate = form.loadingDate || loadingDate || "-";
                        const displayRecDate = form.receivedDate || form.arrivalDate || receivingDate || tt("plr.pending", "Pending");
                        return (
                          <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 font-semibold">
                            <td className="px-4 py-3 font-mono font-bold text-slate-500">01</td>
                            <td className="px-4 py-3">
                              <div className="font-black text-slate-800 dark:text-slate-100">{gName}</div>
                              <div className="mt-1 text-[10px] font-semibold text-slate-500">{[brandName, sizeName].filter(Boolean).join(" / ") || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-end font-mono font-black text-slate-700 dark:text-slate-200">{totalQuantity.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-end font-mono font-black text-emerald-600" data-testid="bill-loaded-qty">{totalLoadedQuantity.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-end font-mono font-black text-rose-600" data-testid="bill-remaining-qty">{remainingToLoadQuantity.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-end font-mono text-slate-600 dark:text-slate-300">{contractNetWeight.toLocaleString()} kg</td>
                            <td className="px-4 py-3 text-end font-mono text-slate-600 dark:text-slate-300">{contractGrossWeight.toLocaleString()} kg</td>
                            <td className="px-4 py-3 text-end font-mono text-slate-700 dark:text-slate-200">{contractPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contractPurchaseCurrency}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-700 dark:text-slate-200">{route}</div>
                              <div className="mt-1 text-[10px] font-semibold text-slate-500">{displayLoadDate} &rarr; {displayRecDate}</div>
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

          {/* LOADING HISTORY — one row per container / load, each with its lane action */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="loading-history">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">{tt("plr.history_title", "Loading History")}</h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">{tt("plr.history_desc", "All BL/container loading records for this purchase bill.")}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" data-testid="history-count">
                {history.length} {tt("plr.saved_loading", "Saved Loading")}
              </span>
            </div>
            {(() => {
              const untransferred = history.filter((h) => {
                const k = loadingRowAction({ laneStatus: laneStates[h.id]?.lane_status, hasLaneRow: !!laneStates[h.id], legNo: laneStates[h.id]?.leg_no, ownerChanged: laneStates[h.id]?.ownerChanged }).kind;
                return k === "send_to_lane" || k === "transfer";
              });
              const selectedCount = untransferred.filter((h) => laneSel.has(h.id)).length;
              const bulk = bulkTransferActions({ untransferredLoads: untransferred.length, selectedLoads: selectedCount });
              return history.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/40" data-testid="loading-lane-bulk">
                  {bulk.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!b.enabled || laneBusy}
                      onClick={() => void onBulkTransfer(b.id)}
                      data-testid={`bulk-${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {tt(`plane.${b.labelKey}`, b.label)} ({b.id === "transfer_selected" ? selectedCount : untransferred.length})
                    </button>
                  ))}
                  <a href={laneHref({})} data-testid="open-lane-report" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:underline dark:text-blue-300">
                    <Route className="h-3.5 w-3.5" /> {tt("plr.open_lane_report", "Open Purchase Transit & Lane")}
                  </a>
                  {laneError && <span role="alert" className="text-[11px] font-semibold text-rose-600" data-testid="lane-action-error">{laneError}</span>}
                </div>
              ) : null;
            })()}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <Th className="px-3 py-3 w-8" />
                    <Th className="px-3 py-3">{tt("common.sr_no", "SR#")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_booking_no", "Purchase Booking No.")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_supplier", "Supplier")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_goods", "Goods")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_bl", "BL Number")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_container", "Container")}</Th>
                    <Th className="px-3 py-3 text-end">{tt("plr.col_load_qty", "Load Qty")}</Th>
                    <Th className="px-3 py-3 text-end">{tt("plr.col_gross_weight", "Gross Weight")}</Th>
                    <Th className="px-3 py-3 text-end">{tt("plr.col_net_weight", "Net Weight")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_vessel", "Vessel / Vehicle")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_ports_dates", "Ports / Dates")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_lane_status", "Lane Status")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_location", "Current Location")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_assigned", "Assigned To")}</Th>
                    <Th className="px-3 py-3">{tt("plr.col_next_action", "Next Action")}</Th>
                    <Th className="px-3 py-3 text-center max-sm:sticky max-sm:end-0 max-sm:z-10 max-sm:bg-slate-50 dark:max-sm:bg-slate-900">{tt("common.actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.length ? history.map((h, i) => {
                    const finance = calcLoadingFinance(h, poRow, form);
                    const loadedQty = Number(h.report_payload?.loadedQuantity || h.loadedQuantity || h.loaded_quantity || 0);
                    const gross = Number(h.gross_weight ?? h.report_payload?.grossWeight ?? finance.grossWeight ?? 0);
                    const net = Number(h.net_weight ?? h.report_payload?.netWeight ?? finance.netWeight ?? 0);
                    const ls = laneStates[h.id];
                    const act = loadingRowAction({ laneStatus: ls?.lane_status, hasLaneRow: !!ls, legNo: ls?.leg_no, ownerChanged: ls?.ownerChanged });
                    const stKey = ls ? (LANE_STATUS_LABEL[ls.lane_status as LaneStatus]?.key ?? ls.lane_status) : "";
                    const stEn = ls ? (LANE_STATUS_LABEL[ls.lane_status as LaneStatus]?.en ?? ls.lane_status) : "";
                    const nx = ls ? allowedNextStatuses(ls.lane_status as LaneStatus)[0] : null;
                    const nextText = !ls
                      ? tt("plane.act_send_to_lane", "Send to Purchase Lane")
                      : ls.lane_status === "transfer_pending" ? tt("plane.act_accept", "Accept transfer")
                      : ls.lane_status === "final_disposition_pending" ? tt("plane.act_dispose", "Choose final disposition")
                      : nx ? `${tt("plane.act_mark", "Mark")} ${tt(`plane.${LANE_STATUS_LABEL[nx].key}`, LANE_STATUS_LABEL[nx].en)}`
                      : "-";
                    const selectable = act.kind === "send_to_lane" || act.kind === "transfer";
                    return (
                      <tr key={h.id} className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60" data-testid={`history-row-${h.container_number || h.id}`} data-lane-kind={act.kind}>
                        <td className="px-3 py-3">
                          {selectable && (
                            <input
                              type="checkbox"
                              checked={laneSel.has(h.id)}
                              onChange={() => setLaneSel((prev) => { const n = new Set(prev); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); return n; })}
                              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                              aria-label={tt("plr.select_row", "Select")}
                              data-testid="row-select"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-slate-500">{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-3 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{h.purchase_order_no || record.purchase_order_no || "-"}</td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{form.supplierName || form.purchaseAccountName || "-"}</td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{h.report_payload?.goodsName || goods?.[0]?.goodsName || "-"}</td>
                        <td className="px-3 py-3 font-mono font-black text-blue-700 dark:text-blue-300" data-testid="row-bl">{h.bl_number || h.report_payload?.blNumber || "-"}</td>
                        <td className="px-3 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">
                          <div data-testid="row-container">{h.container_number || h.report_payload?.containerNumber || "-"}</div>
                          <div className="mt-0.5 text-[10px] font-medium text-slate-400">{[h.container_type, h.seal_number || h.report_payload?.sealNumber].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="px-3 py-3 text-end font-mono font-black text-slate-800 dark:text-slate-100">{loadedQty.toLocaleString()} {unitLabel}</td>
                        <td className="px-3 py-3 text-end font-mono text-slate-600 dark:text-slate-300">{gross > 0 ? gross.toLocaleString() : "-"}</td>
                        <td className="px-3 py-3 text-end font-mono text-slate-600 dark:text-slate-300">{net > 0 ? net.toLocaleString() : "-"}</td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{h.vessel_name || h.report_payload?.vesselName || h.carrier_name || h.vehicle_no || "-"}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">{h.report_payload?.loadingPort || h.loading_location || "-"} &rarr; {h.report_payload?.receivingPort || h.receiving_location || "-"}</div>
                          <div className="mt-1 text-[10px] font-semibold text-slate-500">{h.report_payload?.loadingDate || h.loaded_at?.slice(0, 10) || "-"} &rarr; {h.report_payload?.receivingDate || tt("plr.pending", "Pending")}</div>
                        </td>
                        <td className="px-3 py-3" data-testid="row-lane-status">
                          {ls
                            ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase text-sky-700">{tt(`plane.${stKey}`, stEn)}</span>
                            : <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{tt("plr.not_in_lane", "Not in lane")}</span>}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200" data-testid="row-location">{ls?.current_location || h.report_payload?.loadingPort || h.loading_location || "-"}</td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200" data-testid="row-assigned">{ls?.assigned_to || "-"}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300" data-testid="row-next">{nextText}</td>
                        <td className="px-3 py-3 text-center max-sm:sticky max-sm:end-0 max-sm:z-10 max-sm:bg-white max-sm:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] dark:max-sm:bg-slate-900">
                          <div className="inline-flex items-center gap-1.5 max-sm:max-w-[10.5rem] max-sm:flex-wrap max-sm:justify-end">
                            <button
                              type="button"
                              disabled={laneBusy}
                              onClick={() => void onRowLaneAction(h, act.kind)}
                              data-testid="row-lane-action"
                              data-kind={act.kind}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              {tt(`plane.${act.labelKey}`, act.label)}
                            </button>
                            {ls && (
                              <a href={laneHref({ focus: ls.id })} data-testid="row-open-lane" className="whitespace-nowrap rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50" title={tt("plane.act_open_lane", "Open in Purchase Lane")}>
                                <Route className="inline h-3 w-3" /> {tt("plane.act_open_lane", "Open in Purchase Lane")}
                              </a>
                            )}
                            <button onClick={() => handleEditHistory(h)} className="rounded-md border border-slate-200 p-1.5 text-blue-600 hover:border-blue-300 hover:bg-blue-50" title={tt("plr.a_edit_entry", "Edit Entry")}><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDeleteHistory(h)} disabled={savingNewLoading} className="rounded-md border border-slate-200 p-1.5 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50" title={tt("plr.a_delete_entry", "Delete Entry")}><Trash2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => window.open(`/dashboard/purchase/purchase-loading-records/${h.id}?print=true`, "_blank")} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-slate-300 hover:bg-slate-50" title={tt("plr.a_print", "Print")}><Printer className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={17} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">{tt("plr.no_records", "No saved loading records yet. Click New Loading to create the first BL/container entry.")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
type LoadingStatus = "draft" | "pending" | "loaded" | "dispatched" | "in_transit" | "partially_received" | "received" | "cancelled";
type LoadingRecord = {
  [key: string]: any;
  id: string;
  purchase_order_id?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  loading_record_no: string;
  purchase_order_no: string | null;
  container_number: string;
  container_type: string | null;
  loading_status: LoadingStatus;
  loaded_at: string | null;
  loading_location: string | null;
  receiving_location: string | null;
  shipment_status: string | null;
  carrier_name: string | null;
  remarks: string | null;
  created_at: string;
  countries?: { id?: string | null; name?: string | null; iso2?: string | null; currency?: string | null } | null;
  country_branches?: { id?: string | null; name?: string | null; code?: string | null } | null;
  city_branches?: { id?: string | null; name?: string | null; code?: string | null; city_name?: string | null } | null;
  purchase_orders?: { form_data?: any } | null;
  report_payload?: any;
};

type LoadingApiSession = {
  isSuperAdmin: boolean;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  roles?: string[];
  countryIds?: string[];
  countryBranchIds?: string[];
  cityBranchIds?: string[];
};

type LoadingApiScope = {
  type?: "global" | "country" | "country_branch" | "city_branch";
  countries?: Array<{ id?: string; name?: string | null; iso2?: string | null }>;
  countryBranches?: Array<{ id?: string; name?: string | null; code?: string | null; country_id?: string | null }>;
  cityBranches?: Array<{ id?: string; name?: string | null; city_name?: string | null; code?: string | null; country_id?: string | null; country_branch_id?: string | null }>;
};

type ApiPayload = {
  ok: boolean;
  data?: {
    records: LoadingRecord[];
    summary: {
      total: number;
      loaded: number;
      pending: number;
      received: number;
    };
    setupRequired?: boolean;
    setupMessage?: string | null;
    session?: LoadingApiSession;
    scope?: LoadingApiScope;
  };
  error?: { message?: string } | string;
};

const statusOptions: Array<"all" | LoadingStatus> = ["all", "draft", "pending", "loaded", "dispatched", "in_transit", "partially_received", "received", "cancelled"];
const containerTypes = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Non Reefer"];

/**
 * Country-to-Country Purchase — Destination Receiving. Confirms received quantity against a
 * loading record and posts through the SAME stock write path as the rest of the ERP's
 * inventory system (see POST .../loading-records/[id]/receive) — no parallel stock system.
 * Supports partial receiving: can be opened again on the same record until fully received.
 */
function ReceivingModal({ record, onClose, onReceived }: { record: LoadingRecord; onClose: () => void; onReceived?: () => void }) {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang || "en");

  const loadedQuantity = Number(record.loaded_quantity || 0);
  const alreadyReceived = Number(record.received_quantity || 0);
  const remainingToReceive = Math.max(0, loadedQuantity - alreadyReceived);

  const [warehouses, setWarehouses] = useState<Array<{ id: string; warehouse_name: string; warehouse_code: string }>>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState(String(remainingToReceive || ""));
  const [unitCost, setUnitCost] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/erp/master-data/warehouses");
        const data = await res.json();
        if (!cancelled) setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []);
      } catch { /* non-fatal — user can still see the error if they try to submit without one */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function submitReceiving() {
    const qty = Number(receivedQuantity || 0);
    if (!qty || qty <= 0) {
      setMessage(tt("plr.receive_enter_qty", "Enter a received quantity greater than zero."));
      return;
    }
    if (qty > remainingToReceive + 0.0001) {
      setMessage(tt("plr.receive_exceeds_remaining", "Received quantity cannot exceed the remaining quantity to receive."));
      return;
    }
    if (!warehouseId) {
      setMessage(tt("plr.receive_select_warehouse", "Select a destination warehouse."));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/erp/purchases/loading-records/${record.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedQuantity: qty,
          warehouseId,
          unitCost: Number(unitCost || 0),
          remarks: remarks || null
        })
      });
      const body = await res.json();
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error?.message || "Failed to confirm receiving.");
      }
      window.dispatchEvent(new CustomEvent("erp:purchase-loading-saved"));
      onReceived?.();
      onClose();
    } catch (err: any) {
      setMessage(err?.message || tt("plr.receive_failed", "Failed to confirm receiving."));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div dir={isRtl ? "rtl" : "ltr"} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">{tt("plr.receiving_title", "Destination Receiving")}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronDown className="h-4 w-4 rotate-45" /></button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-950">
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{tt("plr.loaded_quantity", "Loaded")}</div>
            <div className="text-sm font-black text-slate-800 dark:text-slate-100">{loadedQuantity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{tt("plr.already_received", "Received")}</div>
            <div className="text-sm font-black text-emerald-600">{alreadyReceived.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{tt("plr.remaining_to_receive", "Remaining")}</div>
            <div className="text-sm font-black text-amber-600">{remainingToReceive.toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            {tt("plr.receiving_warehouse", "Destination Warehouse")}
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950">
              <option value="">{tt("plr.select_warehouse", "Select Warehouse...")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.warehouse_name} {w.warehouse_code ? `(${w.warehouse_code})` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            {tt("plr.received_quantity", "Received Quantity")}
            <input type="number" min="0" max={remainingToReceive} step="0.01" value={receivedQuantity} onChange={(e) => setReceivedQuantity(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="block space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            {tt("plr.unit_cost", "Unit Cost (optional)")}
            <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="block space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
            {tt("plr.receiving_remarks", "Remarks")}
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-950" />
          </label>
        </div>

        {message && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{message}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs font-bold">{tt("common.cancel", "Cancel")}</Button>
          <Button type="button" onClick={() => void submitReceiving()} disabled={saving || remainingToReceive <= 0} className="h-9 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700">
            {saving ? tt("common.saving", "Saving...") : tt("plr.confirm_receiving", "Confirm Receiving")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function emptyForm() {
  return {
    linkPurchaseOrder: false,
    purchaseOrderNo: "",
    containerNumber: "",
    containerType: "40 FT",
    loadingStatus: "pending" as LoadingStatus,
    loadedAt: "",
    loadingLocation: "",
    receivingLocation: "",
    shipmentStatus: "open",
    carrierName: "",
    remarks: ""
  };
}

export function PurchaseLoadingRecordsView({ openRecordId }: { openRecordId?: string }) {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const searchParams = useSearchParams();
  // Country Receiving nav entry links here with ?focus=receiving — same page, same data,
  // just pre-filtered to the records that still have something left to receive, instead of
  // building a second, parallel "receiving" system.
  const receivingFocus = searchParams?.get("focus") === "receiving";
  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.getElementById("erp-page-actions-slot");
    if (el) {
      setActionsSlot(el);
      return;
    }
    const timer = setInterval(() => {
      const el2 = document.getElementById("erp-page-actions-slot");
      if (el2) {
        setActionsSlot(el2);
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, loaded: 0, pending: 0, received: 0 });
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [apiSession, setApiSession] = useState<LoadingApiSession | null>(null);
  const [apiScope, setApiScope] = useState<LoadingApiScope | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | LoadingStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => emptyForm());
  const [selectedLoadDetailsRecord, setSelectedLoadDetailsRecord] = useState<LoadingRecord | null>(null);
  const [receivingRecord, setReceivingRecord] = useState<LoadingRecord | null>(null);

  useEffect(() => {
    if (openRecordId && records.length > 0 && !selectedLoadDetailsRecord) {
      const match = records.find(r => r.id === openRecordId);
      if (match) {
        setSelectedLoadDetailsRecord(match);
      }
    }
  }, [openRecordId, records, selectedLoadDetailsRecord]);

  const [expandedSummaryCountries, setExpandedSummaryCountries] = useState<Record<string, boolean>>({});

  const loadingSummaryRows = useMemo(() => {
    if (!records || records.length === 0) return [];
    
    const groups: Record<string, {
      country: string;
      currency: string;
      totalPOs: Set<string>;
      totalQuantity: number;
      loadedQuantity: number;
      purchaseValue: number;
      loadedValue: number;
      branches: Record<string, {
        branch: string;
        currency: string;
        totalPOs: Set<string>;
        totalQuantity: number;
        loadedQuantity: number;
        purchaseValue: number;
        loadedValue: number;
      }>;
    }> = {};

    records.forEach(r => {
      const poData = (Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders)?.form_data || {};
      const form = poData.form || {};
      const goods = asRecordArray<any>(poData.goodsEntries);

      const country = String(r.countries?.name || form.branchCountry || "Unknown Country").trim();
      const branch = String(r.country_branches?.name || form.branchName || "Unassigned Branch").trim();

      const poQty = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || g.quantity || 0), 0)
        : Number(form.quantity || 0);

      const loadedQty = Number(r.report_payload?.loadedQuantity || r.loadedQuantity || 0);

      const poTotalUSD = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.finalAmount || g.totalAmount || g.amount || 0), 0)
        : Number(form.totalAmount || form.finalAmount || 0);
      const exRate = Number(r.report_payload?.exchangeRatePKR || form.exchangeRate || (poData as any).exchange_rate || 1);
      const poValuePKR = poTotalUSD * exRate;

      const loadedValPKR = poQty > 0 ? (loadedQty / poQty) * poValuePKR : 0;

      const countryNameForCurrency = country.toLowerCase();
      const localCurrency = form.branchCurrency || r.countries?.currency || (countryNameForCurrency.includes("emirate") || countryNameForCurrency.includes("uae") ? "AED" : countryNameForCurrency.includes("afghanistan") ? "AFN" : countryNameForCurrency.includes("iran") ? "IRR" : countryNameForCurrency.includes("china") ? "CNY" : countryNameForCurrency.includes("india") ? "INR" : "PKR");

      if (!groups[country]) {
        groups[country] = {
          country,
          currency: localCurrency,
          totalPOs: new Set(),
          totalQuantity: 0,
          loadedQuantity: 0,
          purchaseValue: 0,
          loadedValue: 0,
          branches: {}
        };
      }

      const g = groups[country];
      if (r.purchase_order_no) g.totalPOs.add(r.purchase_order_no);
      g.loadedQuantity += loadedQty;
      
      if (!g.branches[branch]) {
        g.branches[branch] = {
          branch,
          currency: localCurrency,
          totalPOs: new Set(),
          totalQuantity: 0,
          loadedQuantity: 0,
          purchaseValue: 0,
          loadedValue: 0
        };
      }

      const br = g.branches[branch];
      if (r.purchase_order_no) br.totalPOs.add(r.purchase_order_no);
      br.loadedQuantity += loadedQty;
      br.loadedValue += loadedValPKR;
    });

    const poTotalsCountry: Record<string, { totalQuantity: number; purchaseValue: number }> = {};
    const poTotalsBranch: Record<string, { totalQuantity: number; purchaseValue: number }> = {};

    const uniquePOs: Record<string, { poQty: number; poValuePKR: number; country: string; branch: string }> = {};
    records.forEach(r => {
      if (!r.purchase_order_no) return;
      if (uniquePOs[r.purchase_order_no]) return;
      
      const poData = (Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders)?.form_data || {};
      const form = poData.form || {};
      const goods = asRecordArray<any>(poData.goodsEntries);
      const country = String(r.countries?.name || form.branchCountry || "Unknown Country").trim();
      const branch = String(r.country_branches?.name || form.branchName || "Unassigned Branch").trim();

      const poQty = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || g.quantity || 0), 0)
        : Number(form.quantity || 0);

      const poTotalUSD = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.finalAmount || g.totalAmount || g.amount || 0), 0)
        : Number(form.totalAmount || form.finalAmount || 0);
      const exRate = Number(r.report_payload?.exchangeRatePKR || form.exchangeRate || (poData as any).exchange_rate || 1);
      const poValuePKR = poTotalUSD * exRate;

      uniquePOs[r.purchase_order_no] = { poQty, poValuePKR, country, branch };
    });

    Object.values(uniquePOs).forEach(p => {
      if (!poTotalsCountry[p.country]) {
        poTotalsCountry[p.country] = { totalQuantity: 0, purchaseValue: 0 };
      }
      poTotalsCountry[p.country].totalQuantity += p.poQty;
      poTotalsCountry[p.country].purchaseValue += p.poValuePKR;

      const brKey = `${p.country}-${p.branch}`;
      if (!poTotalsBranch[brKey]) {
        poTotalsBranch[brKey] = { totalQuantity: 0, purchaseValue: 0 };
      }
      poTotalsBranch[brKey].totalQuantity += p.poQty;
      poTotalsBranch[brKey].purchaseValue += p.poValuePKR;
    });

    return Object.values(groups).map(g => {
      const uniquePoTotals = poTotalsCountry[g.country] || { totalQuantity: 0, purchaseValue: 0 };
      g.totalQuantity = uniquePoTotals.totalQuantity;
      g.purchaseValue = uniquePoTotals.purchaseValue;

      const branchList = Object.values(g.branches).map(br => {
        const brKey = `${g.country}-${br.branch}`;
        const uniqueBrTotals = poTotalsBranch[brKey] || { totalQuantity: 0, purchaseValue: 0 };
        br.totalQuantity = uniqueBrTotals.totalQuantity;
        br.purchaseValue = uniqueBrTotals.purchaseValue;
        return br;
      }).sort((a, b) => a.branch.localeCompare(b.branch));

      return {
        ...g,
        branches: branchList
      };
    }).sort((a, b) => a.country.localeCompare(b.country));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => {
      if (status !== "all" && record.loading_status !== status) return false;
      if (receivingFocus && !RECEIVABLE_STATUSES.has(String(record.loading_status || ""))) return false;
      if (!q) return true;
      return [
        record.loading_record_no,
        record.purchase_order_no,
        record.container_number,
        record.container_type,
        record.loading_location,
        record.receiving_location,
        record.carrier_name
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query, records, status, receivingFocus]);

  // Lane state of every genuine loading row (Action column: Send to / Transfer / Track)
  const [listLane, setListLane] = useState<Record<string, LaneState>>({});
  const [listLaneBusy, setListLaneBusy] = useState<string | null>(null);
  const laneIdsKey = records.filter((r) => isGenuineLoadingRow(r)).map((r) => r.id).join(",");
  useEffect(() => {
    let cancelled = false;
    void fetchLaneStates(laneIdsKey ? laneIdsKey.split(",") : []).then((st) => { if (!cancelled) setListLane(st); });
    return () => { cancelled = true; };
  }, [laneIdsKey]);
  async function onListLaneAction(r: LoadingRecord, kind: string, purchaseOrderId: string | null) {
    const st = listLane[r.id];
    try {
      setListLaneBusy(r.id);
      if (kind === "send_to_lane") {
        await ensureLaneForLoading(r.id);
        setListLane(await fetchLaneStates(laneIdsKey.split(",").filter(Boolean)));
      } else if (kind === "transfer" && st) {
        window.open(laneReportHref({ purchaseOrderId, laneIds: [st.id], action: "transfer" }), "_self");
      } else if (st) {
        window.open(laneReportHref({ purchaseOrderId, focus: st.id }), "_self");
      }
    } catch (e: any) {
      setMessage(e?.message || "Lane action failed.");
    } finally {
      setListLaneBusy(null);
    }
  }

  async function loadRecords() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "150", lang: activeLang || "en" });
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/erp/purchases/loading-records?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.ok) {
        const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
        throw new Error(error || "Purchase Loading Records could not be loaded.");
      }
      setRecords(asRecordArray<LoadingRecord>(payload.data?.records));
      setSummary(payload.data?.summary ?? { total: 0, loaded: 0, pending: 0, received: 0 });
      setSetupMessage(payload.data?.setupMessage ?? null);
      setApiSession(payload.data?.session ?? null);
      setApiScope(payload.data?.scope ?? null);
    } catch (error) {
      setRecords([]);
      setSummary({ total: 0, loaded: 0, pending: 0, received: 0 });
      setApiSession(null);
      setApiScope(null);
      setMessage(error instanceof Error ? error.message : "Purchase Loading Records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
    const refresh = () => void loadRecords();
    window.addEventListener("focus", refresh);
    window.addEventListener("erp:purchase-order-saved", refresh);
    window.addEventListener("erp:purchase-transfer-saved", refresh);
    window.addEventListener("erp:purchase-loading-saved", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("erp:purchase-order-saved", refresh);
      window.removeEventListener("erp:purchase-transfer-saved", refresh);
      window.removeEventListener("erp:purchase-loading-saved", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang]);

  async function saveRecord() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/erp/purchases/loading-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderNo: form.linkPurchaseOrder ? form.purchaseOrderNo : null,
          containerNumber: form.containerNumber,
          containerType: form.containerType,
          loadingStatus: form.loadingStatus,
          loadedAt: form.loadedAt ? new Date(form.loadedAt).toISOString() : null,
          loadingLocation: form.loadingLocation,
          receivingLocation: form.receivingLocation,
          shipmentStatus: form.shipmentStatus,
          carrierName: form.carrierName,
          remarks: form.remarks,
          reportPayload: {
            standalone: true,
            explicitPurchaseOrderLink: form.linkPurchaseOrder,
            sourceModule: "purchase-loading-records"
          }
        })
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.ok) {
        const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
        throw new Error(error || "Purchase Loading Record was not saved.");
      }
      setForm(emptyForm());
      setMessage("Purchase Loading Record saved.");
      await loadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase Loading Record was not saved.");
    } finally {
      setSaving(false);
    }
  }

  const [selectedInvoicePoNo, setSelectedInvoicePoNo] = useState("");
  const [expandedPoNos, setExpandedPoNos] = useState<Record<string, boolean>>({});

  const togglePoExpand = (poNo: string) => {
    setExpandedPoNos(prev => ({ ...prev, [poNo]: !prev[poNo] }));
  };

  const uniqueInvoiceOptions = useMemo(() => {
    const map = new Map<string, string>();
    (records || []).forEach(r => {
      if (r.purchase_order_no) {
        const poRow = (Array.isArray(r.purchase_orders) ? r.purchase_orders[0] : r.purchase_orders) || {};
        const form = poRow.form_data?.form || {};
        const supplier = form.supplierName || form.purchaseAccountName || "";
        map.set(r.purchase_order_no, `${r.purchase_order_no}${supplier ? ` - ${supplier}` : ""}`);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ label, value }));
  }, [records]);

  const activeInvoiceRecord = useMemo(() => {
    if (!selectedInvoicePoNo) return null;
    return records.find(r => r.purchase_order_no === selectedInvoicePoNo || r.id === selectedInvoicePoNo) || null;
  }, [records, selectedInvoicePoNo]);

  const poGroups = useMemo(() => {
    const map: Record<string, {
      poRow: any;
      form: any;
      records: any[];
      realRecords: any[];
      totalContractQty: number;
      totalContractGrossWeight: number;
      totalContractNetWeight: number;
      totalContractAmount: number;
      currency: string;
      totalLoadedQty: number;
    }> = {};

    for (const record of filteredRecords) {
      const poRow = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders) || {};
      const poData = poRow.form_data || {};
      const form = poData.form || {};
      const goods = asRecordArray<any>(poData.goodsEntries);

      const poNo = record.purchase_order_no || poRow.purchase_order_no || "UNKNOWN";

      if (!map[poNo]) {
        const totalContractQty = goods.length > 0
          ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || g.quantity || 0), 0)
          : Number(form.quantity || 0);

        const totalContractGrossWeight = goods.length > 0
          ? goods.reduce((s: number, g: any) => s + Number(g.grossWeight || 0), 0)
          : Number(form.grossWeight || 0);

        const totalContractNetWeight = goods.length > 0
          ? goods.reduce((s: number, g: any) => s + Number(g.netWeight || 0), 0)
          : Number(form.netWeight || 0);

        const totalContractAmount = goods.length > 0
          ? goods.reduce((s: number, g: any) => s + Number(g.finalAmount || g.totalAmount || g.amount || 0), 0)
          : Number(form.totalAmount || 0);

        const currency = form.currencyType || form.currency || record.currency_code || "USD";

        map[poNo] = {
          poRow,
          form,
          records: [],
          realRecords: [],
          totalContractQty,
          totalContractGrossWeight,
          totalContractNetWeight,
          totalContractAmount,
          currency,
          totalLoadedQty: 0
        };
      }

      map[poNo].records.push(record);
      const isSynthetic = String(record.id).startsWith("synthetic-") || record.loading_record_no === "PLR-PENDING";
      if (!isSynthetic) {
        map[poNo].realRecords.push(record);
        const rQty = Number(record.report_payload?.loadedQuantity || record.report_payload?.loadingQuantity || record.loadedQuantity || 0);
        map[poNo].totalLoadedQty += rQty;
      }
    }

    return Object.entries(map);
  }, [filteredRecords]);

  const loadingPrintRows = useMemo(() => {
    return poGroups.map(([poNo, group]) => {
      const firstRecord = group.records[0] as LoadingRecord | undefined;
      const poRow = group.poRow || {};
      const form = group.form || {};
      const goods = asRecordArray<any>(poRow.form_data?.goodsEntries);
      const firstGood = goods[0] || {};
      const country = String(firstRecord?.countries?.name || form.branchCountry || "Unassigned Country");
      const branch = String(
        firstRecord?.city_branches?.name ||
        firstRecord?.country_branches?.name ||
        form.cityBranchName ||
        form.branchName ||
        "Unassigned Branch"
      );
      const currencyFc = String(group.currency || form.currency || poRow.currency_code || "USD").toUpperCase();
      const countryKey = country.toLowerCase();
      const currencyLc = String(
        form.branchCurrency ||
        firstRecord?.countries?.currency ||
        (countryKey.includes("emirate") || countryKey.includes("uae") ? "AED" : "PKR")
      ).toUpperCase();
      const exchangeRate = asFiniteNumber(
        firstRecord?.report_payload?.exchangeRatePKR ||
        form.exchangeRate ||
        poRow.exchange_rate ||
        getDefaultExRate(currencyLc),
        1
      );
      const totalPurchaseFc = asFiniteNumber(
        group.totalContractAmount ||
        poRow.order_total ||
        poRow.form_data?.totals?.grandFinal ||
        form.totalAmount
      );
      const advanceFc = Math.min(
        normalizeAdvanceToPurchaseCurrency(
          asFiniteNumber(poRow.advance_paid || form.advanceAmount),
          totalPurchaseFc,
          exchangeRate
        ),
        Math.max(0, totalPurchaseFc)
      );
      const remainingFc = Math.max(0, totalPurchaseFc - advanceFc);
      const loadedQty = asFiniteNumber(group.totalLoadedQty);
      const remainingToLoad = Math.max(0, asFiniteNumber(group.totalContractQty) - loadedQty);
      const loadingPercent = group.totalContractQty > 0 ? (loadedQty / group.totalContractQty) * 100 : 0;
      const loadingStatus = loadingPercent >= 100
        ? "Completed"
        : loadingPercent >= 75
          ? "Almost Complete"
          : loadingPercent > 0
            ? "Partially Loaded"
            : "Not Loaded";

      return {
        id: firstRecord?.id || poNo,
        country,
        branch,
        purchaseBookingNo: poNo,
        salesAccount: String(form.salesAccountName || form.salesAccountNumber || "-"),
        purchaseAccount: String(form.purchaseAccountName || form.purchaseAccountNumber || "-"),
        goods: goods.map((good: any) => good.itemName || good.goodsName || good.item).filter(Boolean).join(", ") || String(form.goodsName || "-"),
        contractQty: asFiniteNumber(group.totalContractQty),
        grossWeight: asFiniteNumber(group.totalContractGrossWeight),
        tareWeight: Math.max(0, asFiniteNumber(group.totalContractGrossWeight) - asFiniteNumber(group.totalContractNetWeight)),
        netWeight: asFiniteNumber(group.totalContractNetWeight),
        purchasePriceRate: asFiniteNumber(firstGood.coursePrice || firstGood.priceRate || form.purchasePriceRate),
        totalPurchaseFc,
        advanceFc,
        remainingFc,
        currencyFc,
        exchangeRate,
        finalAmountLc: totalPurchaseFc * exchangeRate,
        finalAdvanceLc: advanceFc * exchangeRate,
        finalRemainingLc: remainingFc * exchangeRate,
        currencyLc,
        loadedQty,
        remainingToLoad,
        loadingStatus
      };
    });
  }, [poGroups]);

  const handlePrintReport = () => {
    const countryNames = Array.from(new Set(loadingPrintRows.map((row) => row.country).filter(Boolean)));
    const branchNames = Array.from(new Set(loadingPrintRows.map((row) => row.branch).filter(Boolean)));
    openLoadingRecordsPrintReport({
      rows: loadingPrintRows,
      companyInfo: {
        country: countryNames.length === 1 ? countryNames[0] : tt("plr.all_auth_countries", "All Authorized Countries"),
        branch: branchNames.length === 1 ? branchNames[0] : tt("plr.all_auth_branches", "All Authorized Branches"),
        printedBy: apiSession?.fullName || apiSession?.email || "-"
      },
      filters: [
        { label: tt("plr.f_invoice_po", "Invoice / PO"), value: selectedInvoicePoNo || tt("plr.all_invoices", "All Invoices / POs") },
        { label: tt("plr.f_loading_status", "Loading Status"), value: status === "all" ? tt("common.all_status", "All Status") : translateOptionLabel(activeLang, status.toUpperCase()) },
        { label: tt("plr.f_search", "Search"), value: query.trim() || tt("plr.all_records", "All Records") }
      ]
    });
  };

  return (
    <div className="w-full max-w-none space-y-4 px-2 py-3 text-slate-900 dark:text-slate-100 sm:px-4">
      {selectedLoadDetailsRecord && (
        <LoadDetailsModal record={selectedLoadDetailsRecord} onClose={() => setSelectedLoadDetailsRecord(null)} onSaved={() => void loadRecords()} />
      )}
      {receivingRecord && (
        <ReceivingModal record={receivingRecord} onClose={() => setReceivingRecord(null)} onReceived={() => void loadRecords()} />
      )}
      {actionsSlot && createPortal(
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <SearchableSelect
            value={selectedInvoicePoNo}
            onChange={(val) => setSelectedInvoicePoNo(val)}
            options={[
              { label: tt("plr.all_invoices", "All Invoices / POs"), value: "" },
              ...uniqueInvoiceOptions
            ]}
            placeholder={tt("plr.sel_invoice", "Select Purchase Invoice / PO...")}
            className="w-60 text-xs font-semibold relative z-[45]"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tt("plr.search_ph", "Search container / loading no / PO")}
              className="h-8 w-52 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>
          <SearchableSelect
            value={status}
            onChange={(val) => setStatus(val as "all" | LoadingStatus)}
            options={statusOptions.map(opt => ({ label: opt === "all" ? tt("common.all_status", "All Status") : translateOptionLabel(activeLang, opt.toUpperCase()), value: opt }))}
            placeholder={tt("common.all_status", "All Status")}
            className="w-32 text-xs font-semibold relative z-[45]"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRecords()} disabled={loading} className="h-8 rounded-lg border-slate-200 text-xs font-bold">
            <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
            {tt("plr.apply_filter", "Apply Filter")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handlePrintReport} className="h-8 rounded-lg border-slate-200 text-xs font-bold">
            <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> {tt("common.print", "Print")}
          </Button>
        </div>,
        actionsSlot
      )}

      {/* Selected Purchase Invoice / Approved Contract Summary Card (Requirement 2) */}
      {activeInvoiceRecord && (() => {
        const poRow = (Array.isArray(activeInvoiceRecord.purchase_orders) ? activeInvoiceRecord.purchase_orders[0] : activeInvoiceRecord.purchase_orders) || {};
        const formData = poRow.form_data || {};
        const form = formData.form || {};
        const goods = asRecordArray<any>(formData.goodsEntries);
        const finance = calcLoadingFinance(activeInvoiceRecord, poRow, form);
        const totalPOQty = finance.totalQuantity || 1;
        const poOrderTotalFC = Number(poRow.order_total || formData.totals?.grandFinal || form.totalAmount || 0);
        const poOrderTotalLC = poOrderTotalFC * finance.exRate;
        const poAdvancePaid = normalizeAdvanceToPurchaseCurrency(
          Number(poRow.advance_paid || form.advanceAmount || 0),
          poOrderTotalFC,
          finance.exRate || 1
        );
        const poAdvancePaidLC = Math.min(poAdvancePaid * finance.exRate, Math.max(0, poOrderTotalLC));
        const poRemainingDueLC = Math.max(0, poOrderTotalLC - poAdvancePaidLC);
        const countryName = (activeInvoiceRecord.countries?.name || form.branchCountry || "").toLowerCase();
        const localCur = form.branchCurrency || poRow?.countries?.currency || (countryName.includes("emirate") || countryName.includes("uae") ? "AED" : "PKR");

        return (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 mb-4 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between mb-3 border-b border-blue-100 pb-2 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <span className="rounded font-mono font-black text-xs bg-blue-600 text-white px-2.5 py-0.5">{tt("plr.sel_po", "SELECTED PO:")} {activeInvoiceRecord.purchase_order_no}</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{tt("plr.approved_invoice", "Approved Invoice & Contract Details (Read-Only Source of Truth)")}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedInvoicePoNo("")} className="h-6 text-[10px] font-bold text-blue-600 hover:text-blue-800">{tt("plr.clear_selection", "Clear Selection")}</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 text-[11px] font-semibold">
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.purchase_code", "Purchase Code")}</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{form.purchaseAccountNumber || form.purchaseAccountNo || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.sales_code", "Sales Code")}</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{form.salesAccountNumber || form.salesAccountNo || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("common.supplier", "Supplier")}</span><span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{form.supplierName || form.purchaseAccountName || "Purchase Account"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.company_branch", "Company & Branch")}</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{form.branchName || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.goods_brand", "Goods & Brand")}</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{form.goodsName || form.itemName || "-"} ({form.brand || "-"})</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.contract_qty", "Contract Qty (Bags)")}</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{totalPOQty.toLocaleString()}</span></div>
              
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.col_purchase_rate", "Purchase Rate")}</span><span className="font-mono font-bold text-blue-600">{finance.priceRate > 0 ? `${finance.priceRate.toLocaleString()} ${finance.currency}` : "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.col_exchange_rate", "Exchange Rate")}</span><span className="font-mono font-bold text-blue-600">{finance.exRate}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.total_purchase", "Total Purchase Amount")}</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{poOrderTotalFC.toLocaleString(undefined, {minimumFractionDigits: 2})} {finance.currency}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.total_advance", "Total Advance Paid")}</span><span className="font-mono font-black text-emerald-600">{poAdvancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {localCur}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800 col-span-2"><span className="text-slate-400 block text-[9px] uppercase">{tt("plr.total_remaining", "Total Remaining Balance")}</span><span className="font-mono font-black text-rose-600">{poRemainingDueLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {localCur}</span></div>
            </div>
          </div>
        );
      })()}

      {/* Super Admin Country Report Dashboard Header */}
      {loadingSummaryRows.length > 0 && (() => {
        let totalPoQty = 0;
        let totalLoadedQty = 0;
        let totalPurchaseValue = 0;
        let totalLoadedValue = 0;
        let activeBranchesCount = 0;
        let totalGrossWeight = 0;
        let totalNetWeight = 0;
        
        loadingSummaryRows.forEach(r => {
          totalPoQty += r.totalQuantity;
          totalLoadedQty += r.loadedQuantity;
          totalPurchaseValue += r.purchaseValue;
          totalLoadedValue += r.loadedValue;
          activeBranchesCount += r.branches.length;
        });

        (records || []).forEach(rec => {
          const payload = (rec as any).report_payload || {};
          totalGrossWeight += Number(payload.grossWeight || payload.gross_weight || (rec as any).gross_weight || 0);
          totalNetWeight += Number(payload.netWeight || payload.net_weight || (rec as any).net_weight || 0);
        });

        const activeCountriesCount = loadingSummaryRows.length;
        const totalRemainingQty = Math.max(0, totalPoQty - totalLoadedQty);
        const totalRemainingValue = Math.max(0, totalPurchaseValue - totalLoadedValue);

        const formatMoney = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const getFlag = (cName: string) => {
          if (!cName) return '';
          if (cName.toLowerCase().includes('pakistan')) return 'PK';
          if (cName.toLowerCase().includes('iran')) return 'IR';
          if (cName.toLowerCase().includes('arab emirates') || cName.toLowerCase().includes('uae')) return 'AE';
          if (cName.toLowerCase().includes('afghanistan')) return 'AF';
          if (cName.toLowerCase().includes('india')) return 'IN';
          if (cName.toLowerCase().includes('china')) return 'CN';
          return '';
        };

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
        const firstRecord = records[0] ?? null;
        const firstPo = firstRecord ? (Array.isArray(firstRecord.purchase_orders) ? firstRecord.purchase_orders[0] : firstRecord.purchase_orders) : null;
        const firstForm = firstPo?.form_data?.form || {};
        const isSuperAdminScope = Boolean(apiSession?.isSuperAdmin);
        const scopeType = apiScope?.type || (isSuperAdminScope ? "global" : "country");
        const primaryCountry = apiScope?.countries?.[0];
        const primaryMainBranch = apiScope?.countryBranches?.[0];
        const primaryCityBranch = apiScope?.cityBranches?.[0];
        const countryDisplay = isSuperAdminScope && activeCountriesCount !== 1
          ? "All Countries"
          : (primaryCountry?.name || firstRecord?.countries?.name || firstForm.branchCountry || "Assigned Country");
        const countryIso = primaryCountry?.iso2 || firstRecord?.countries?.iso2 || "";
        const branchDisplay = isSuperAdminScope && activeBranchesCount !== 1
          ? "All Branches"
          : scopeType === "city_branch"
            ? (primaryCityBranch?.name || primaryCityBranch?.city_name || firstRecord?.city_branches?.name || firstRecord?.city_branches?.city_name || firstRecord?.country_branches?.name || firstForm.branchName || "Assigned Branch")
            : scopeType === "country_branch"
              ? (primaryMainBranch?.name || firstRecord?.country_branches?.name || firstForm.branchName || "Assigned Main Branch")
              : (activeBranchesCount > 1 ? "All Country Branches" : (firstRecord?.country_branches?.name || firstForm.branchName || "Assigned Branches"));
        const userIdDisplay = apiSession?.userId || "-";
        const userNameDisplay = apiSession?.fullName || apiSession?.email || "Current User";
        const roleDisplay = (apiSession?.roles?.[0] || (isSuperAdminScope ? "super_admin" : scopeType)).replace(/_/g, " ");
        const scopeReportTitle = isSuperAdminScope
          ? "All Countries Report Details"
          : scopeType === "city_branch"
            ? "Branch Loading Report Details"
            : scopeType === "country_branch"
              ? "Main Branch Loading Report Details"
              : "Country Branches Report Details";
        const scopeBadge = isSuperAdminScope
          ? `${activeCountriesCount} scoped countries`
          : scopeType === "city_branch"
            ? "1 branch scope"
            : `${activeBranchesCount} scoped branches`;

        return (
          <div className="flex flex-col mb-6 space-y-4">
            {/* 4 Panels Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Panel 1: Branch & User Details */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="bg-blue-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">{tt("plr.sec_branch_user", "1. Branch & User Details")}</h4>
                </div>
                <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_country", "Country:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {countryDisplay}{countryIso ? ` (${countryIso})` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_branch_name", "Branch Name:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{branchDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_user_id", "User ID:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{userIdDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_user_name", "User Name:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{userNameDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_role", "Role:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{roleDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_date_time", "Date & Time:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
                  </div>
                  <div className="flex justify-between items-center mt-auto">
                    <span>{tt("plr.f_status", "Status:")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{tt("plr.word_active", "Active")}</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Global Financial Summary */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="bg-emerald-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">2. {isSuperAdminScope ? "GLOBAL" : "SCOPED"} LOADING SUMMARY</h4>
                </div>
                <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_total_purchase_value", "Total Purchase Value:")}</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{formatMoney(totalPurchaseValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_total_loaded_value", "Total Loaded Value:")}</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalLoadedValue)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-rose-600 dark:text-rose-500 font-bold uppercase">{tt("plr.f_remaining_value", "Remaining Value:")}</span>
                    <span className="font-black text-rose-700 dark:text-rose-400 font-mono text-sm">{formatMoney(totalRemainingValue)}</span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Active Operations Summary */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="bg-purple-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 truncate">{tt("plr.sec_active_ops", "3. Active Operations Summary")}</h4>
                </div>
                <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>{isSuperAdminScope ? "Total Active Countries:" : "Scoped Countries:"}</span>
                    <span className="font-black text-purple-700 dark:text-purple-400 font-mono">{activeCountriesCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{isSuperAdminScope ? "Total Active Branches:" : "Scoped Branches:"}</span>
                    <span className="font-black text-purple-700 dark:text-purple-400 font-mono">{activeBranchesCount}</span>
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span>{tt("plr.f_system_status", "System Status:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{tt("plr.word_online", "Online")}</span>
                  </div>
                </div>
              </div>

              {/* Panel 4: Transaction Summary */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
                  <div className="bg-orange-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">{tt("plr.sec_loading_qty", "4. Loading Qty Summary")}</h4>
                </div>
                <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_total_loaded_qty", "Total Loaded Qty:")}</span>
                    <span className="font-bold text-emerald-600 font-mono">{totalLoadedQty.toLocaleString()} Bags</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_gross_weight", "Gross Weight:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{totalGrossWeight.toLocaleString()} KG</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{tt("plr.f_net_weight", "Net Weight:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{totalNetWeight.toLocaleString()} KG</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-rose-600 dark:text-rose-500 font-bold uppercase">{tt("plr.f_total_remaining_qty", "Total Remaining Qty:")}</span>
                    <span className="font-black text-rose-700 dark:text-rose-400 font-mono">{totalRemainingQty.toLocaleString()} Bags</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>{tt("plr.f_last_updated", "Last Updated:")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible Country Dashboard Section */}
            <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden" open>
              <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-4 py-3 font-black text-slate-800 hover:bg-slate-100 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900/80 uppercase text-xs tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-90">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </span>
                  {scopeReportTitle}
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 uppercase">
                  {scopeBadge}
                </span>
              </summary>
              
              <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {loadingSummaryRows.map((r, idx) => {
                    const totalQty = r.totalQuantity;
                    const loadedQty = r.loadedQuantity;
                    const balQty = Math.max(0, totalQty - loadedQty);
                    
                    return (
                      <details key={idx} className="group/card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                        <summary className="cursor-pointer list-none">
                          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white flex justify-between items-center">
                            <span className="font-black tracking-wide text-sm flex items-center gap-2">
                              <span className="transition-transform group-open/card:rotate-90">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                              </span>
                              {getFlag(r.country)} {r.country}
                            </span>
                            <span className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm">
                              {r.branches.length} Branches
                            </span>
                          </div>
                        </summary>
                        <div className="p-4">
                          <div className="mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("lpjr.col_cur", "Currency")}</span>
                              <span className="font-black text-slate-800 dark:text-slate-200 text-xs">{r.currency}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.col_total_qty", "Total Qty")}</span>
                              <span className="font-black text-slate-800 dark:text-slate-200 font-mono text-[11px]">{totalQty.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.loaded_qty", "Loaded Qty")}</span>
                              <span className="font-black text-emerald-600 font-mono text-[11px]">{loadedQty.toLocaleString()}</span>
                            </div>
                            <div className="mt-1 flex justify-between items-center border-t border-slate-200 pt-2 dark:border-slate-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tt("plr.col_remaining_bal_qty", "Remaining Bal. Qty")}</span>
                              <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">{balQty.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between items-center">
                              <span>{tt("report.branch_breakdown", "Branch Breakdown")}</span>
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] dark:bg-slate-800">All</span>
                            </h5>
                            {r.branches.map((b, bIdx) => {
                              const bBalQty = Math.max(0, b.totalQuantity - b.loadedQuantity);
                              return (
                                <div key={bIdx} className="flex flex-col gap-1.5 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <div className="flex justify-between items-center">
                                    <span className="font-black text-[10px] uppercase text-slate-700 dark:text-slate-300 truncate pr-2" title={b.branch}>{b.branch}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400">{tt("plr.col_total_qty", "Total Qty")}</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{b.totalQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400">{tt("plr.loaded_qty", "Loaded Qty")}</span>
                                      <span className="font-bold text-emerald-500 font-mono">{b.loadedQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center col-span-2">
                                      <span className="text-slate-400">{tt("plr.col_bal_qty", "Bal. Qty")}</span>
                                      <span className="font-bold text-rose-500 font-mono">{bBalQty.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
        );
      })()}

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric label={tt("plr.total_records", "Total Records")} value={summary.total} tone="slate" />
        <Metric label={tt("plr.loaded", "Loaded")} value={summary.loaded} tone="green" />
        <Metric label={tt("plr.pending", "Pending")} value={summary.pending} tone="amber" />
        <Metric label={tt("plr.received", "Received")} value={summary.received} tone="blue" />
      </div>

      {setupMessage ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {setupMessage}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/20">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-blue-600" />
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{tt("plr.title_loading_records", "Loading Records Report")}</h2>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide mt-0.5">{tt("plr.independent_note", "Independent from Purchase Booking Order unless explicitly linked.")}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                    {[
                      "Expand",
                      "SR#",
                      "Country",
                      "Branch",
                      "Bill / Source",
                      "Sales Account",
                      "Purchase Account",
                      "Goods",
                      "Contract Qty",
                      "Gross Wt",
                      "Tare Wt (Empty)",
                      "Net Wt",
                      "Total Purchase Amount (FC)",
                      "Purchase Advance (FC)",
                      "Purchase Remaining (FC)",
                      "Loaded Qty",
                      "Remaining to Load",
                      "Stage / Payment / Next Step",
                      "Action"
                    ].map((head) => (
                      <Th key={head} className="whitespace-nowrap px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        {head}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={19} className="px-3 py-8 text-center text-muted-foreground">
                        {tt("plr.loading_records", "Loading records...")}
                      </td>
                    </tr>
                  ) : poGroups.length ? (
                    poGroups.map(([poNo, group], groupIdx) => {
                      const { poRow, form, records, realRecords, totalContractQty, totalContractGrossWeight, totalContractNetWeight, totalContractAmount, currency, totalLoadedQty } = group;
                      const isExpanded = !!expandedPoNos[poNo];
                      const displayRecords = realRecords;

                      const salesAccountNo = form.salesAccountNumber || form.salesAccountNo || "-";
                      const salesAccountName = form.salesAccountName || "-";
                      const purchaseAccountNo = form.purchaseAccountNumber || form.purchaseAccountNo || "-";
                      const purchaseAccountName = form.purchaseAccountName || "-";

                      const goods = asRecordArray<any>(poRow.form_data?.goodsEntries);
                      const goodsName = goods.map((g: any) => g.goodsName || g.item_name).filter(Boolean).join(", ") || form.itemName || "-";
                      const goodsDetails = goods.map((g: any) => g.brand || g.size || g.item_details).filter(Boolean).join(", ") || form.itemDetails || "-";
                      const combinedGoods = goodsName !== "-" ? `${goodsName}${goodsDetails !== "-" ? ` - ${goodsDetails}` : ""}` : "-";

                      const remainingQtyToLoad = Math.max(0, totalContractQty - totalLoadedQty);
                      const exRate = Number(poRow.exchange_rate || form.exchangeRate || 1);
                      const rawAdvance = Number(poRow.advance_paid || form.advanceAmount || 0);

                      const contractTareWeight = Math.max(0, totalContractGrossWeight - totalContractNetWeight);
                      const priceRate = totalContractQty > 0 ? (totalContractAmount / totalContractQty) : 0;
                      const purchaseAdvanceUSD = normalizeAdvanceToPurchaseCurrency(rawAdvance, totalContractAmount, exRate);
                      const purchaseRemainingUSD = Math.max(0, totalContractAmount - purchaseAdvanceUSD);

                      const localCurrencyCode = records[0]?.countries?.currency || form.branchCurrency || "PKR";
                      const finalAmountLC = totalContractAmount * exRate;
                      const finalAdvanceLC = purchaseAdvanceUSD * exRate;
                      const finalRemainingLC = Math.max(0, finalAmountLC - finalAdvanceLC);
                      const paymentStatus = String(poRow.payment_status || form.paymentStatus || form.payment_status || "pending");
                      const primaryLoadingRecord = realRecords[0] || records[0] || null;
                      const nextDestination = String(
                        primaryLoadingRecord?.receiving_location ||
                        form.receivedPort ||
                        form.destinationPort ||
                        form.destinationCountry ||
                        "Land / In Transit"
                      );

                      const countryLabel = `${records[0]?.countries?.name || form.branchCountry || "-"}${records[0]?.countries?.iso2 ? ` (${records[0].countries.iso2})` : ""}`;
                      const branchLabel = `${records[0]?.country_branches?.name || form.branchName || "-"}${records[0]?.country_branches?.code ? ` (${records[0].country_branches.code})` : ""}`;

                      const isFullyLoaded = totalLoadedQty >= totalContractQty && totalContractQty > 0;
                      const isPartiallyLoaded = totalLoadedQty > 0 && totalLoadedQty < totalContractQty;

                      return (
                        <React.Fragment key={poNo}>
                          {/* Main Purchase Booking Parent Row */}
                          <tr className={cn(
                            "transition font-semibold",
                            isExpanded ? "bg-blue-50/40 dark:bg-blue-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}>
                            <td className="whitespace-nowrap px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => togglePoExpand(poNo)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-blue-600" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[10px] font-bold text-slate-400">{String(groupIdx + 1).padStart(2, "0")}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold">{countryLabel}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{branchLabel}</td>
                            <td className="whitespace-nowrap px-4 py-3 leading-tight">
                              <div className="inline-flex items-center gap-1.5 font-bold text-blue-600">
                                <Link2 className="h-3.5 w-3.5 text-blue-500" />
                                {poNo}
                              </div>
                              <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                {primaryLoadingRecord?.loading_record_no || "Loading source pending"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 leading-tight">
                              <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">{salesAccountNo}</div>
                              <div className="text-slate-400 text-[9px] uppercase tracking-wider">{salesAccountName}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 leading-tight">
                              <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">{purchaseAccountNo}</div>
                              <div className="text-slate-400 text-[9px] uppercase tracking-wider">{purchaseAccountName}</div>
                            </td>
                            <td className="min-w-[150px] px-4 py-3 text-[11px] text-slate-700 dark:text-slate-200">{combinedGoods}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-slate-900 dark:text-slate-100">{totalContractQty.toLocaleString()} Bags</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono">{totalContractGrossWeight.toLocaleString()} kg</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">{contractTareWeight.toLocaleString()} kg</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono">{totalContractNetWeight.toLocaleString()} kg</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {totalContractAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-amber-600">
                              {purchaseAdvanceUSD > 0 ? `${purchaseAdvanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-rose-600">
                              {purchaseRemainingUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-teal-600 dark:text-teal-400">{totalLoadedQty.toLocaleString()} Bags</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-rose-600">{remainingQtyToLoad.toLocaleString()} Bags</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex flex-col gap-1.5">
                                {isFullyLoaded ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm dark:bg-black">
                                    {tt("plr.fully_loaded_100", "100% Fully Loaded")}
                                  </span>
                                ) : isPartiallyLoaded ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase text-amber-950 shadow-sm">
                                    {((totalLoadedQty / totalContractQty) * 100).toFixed(0)}% Partially Loaded
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm animate-pulse">
                                    0% Loaded (Pending)
                                  </span>
                                )}
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  Payment: <span className="text-slate-800 dark:text-slate-200">{paymentStatus.replace(/_/g, " ")}</span>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  Next: <span className="text-blue-600 dark:text-blue-400">{nextDestination}</span>
                                </span>
                                <span className="text-[10px] font-mono font-black text-rose-600" data-testid="payable-balance">
                                  {tt("plr.payable_balance", "Payable")}: {purchaseRemainingUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedLoadDetailsRecord(records[0])}
                                  disabled={isFullyLoaded}
                                  data-testid={`add-loading-${poNo}`}
                                  title={isFullyLoaded ? tt("plr.new_loading_disabled", "Everything is already loaded. Edit an existing entry to correct it.") : undefined}
                                  className="h-7 px-2 text-[10px] font-bold uppercase text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 gap-1 shadow-sm disabled:opacity-50"
                                >
                                  <Plus className="h-3 w-3 text-emerald-600" />
                                  {tt("plr.add_loading", "Add Loading")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => togglePoExpand(poNo)}
                                  className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider gap-1"
                                >
                                  <Ship className="h-3 w-3 text-blue-600" />
                                  {isExpanded ? "Hide" : `View (${displayRecords.length})`}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Child Loading Breakdown Table */}
                          {isExpanded && (
                            <tr className="bg-slate-100/70 dark:bg-slate-950/60">
                              <td colSpan={19} className="p-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <div className="rounded bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                        <Ship className="h-4 w-4" />
                                      </div>
                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        {tt("plr.container_breakdown_for", "Container Shipment Loading Breakdown for")} <span className="text-blue-600">{poNo}</span>
                                      </h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                                      Loaded: {totalLoadedQty.toLocaleString()} / {totalContractQty.toLocaleString()} Bags
                                    </span>
                                  </div>

                                  {displayRecords.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-500 border-b dark:bg-slate-950">
                                            <Th className="px-3 py-2">{tt("plr.col_loading_no", "Loading #")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_bl", "BL Number")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_container", "Container")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_vessel", "Vessel / Vehicle")}</Th>
                                            <Th className="px-3 py-2 text-end">{tt("plr.loaded_qty", "Loaded Qty")}</Th>
                                            <Th className="px-3 py-2 text-end">{tt("plr.col_net_weight", "Net Weight")}</Th>
                                            <Th className="px-3 py-2 text-end">{tt("plr.col_gross_weight", "Gross Weight")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_lane_status", "Lane Status")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_location", "Current Location")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_assigned", "Assigned To")}</Th>
                                            <Th className="px-3 py-2">{tt("plr.col_route_dates", "Route / Dates")}</Th>
                                            <Th className="px-3 py-2 text-center max-sm:sticky max-sm:end-0 max-sm:z-10 max-sm:bg-slate-50 dark:max-sm:bg-slate-950">{tt("common.actions", "Actions")}</Th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {displayRecords.map((r, childIdx) => {
                                            const payload = r.report_payload || {};
                                            const loadedQty = Number(payload.loadedQuantity || r.loadedQuantity || 0);
                                            const finance = calcLoadingFinance(r, poRow, form);
                                            const blNo = r.bl_number || payload.blNumber || "-";
                                            const containerNo = r.container_number || payload.containerNumber || "-";
                                            const vessel = payload.vesselName || r.carrier_name || "-";
                                            const route = [payload.loadingPort || r.loading_location, payload.receivingPort || r.receiving_location].filter(Boolean).join(" to ") || "-";
                                            const loadingDateStr = payload.loadingDate || (r.loaded_at ? new Date(r.loaded_at).toLocaleDateString() : "-");
                                            const ls = listLane[r.id];
                                            const act = loadingRowAction({ laneStatus: ls?.lane_status, hasLaneRow: !!ls, legNo: ls?.leg_no, ownerChanged: ls?.ownerChanged });
                                            const net = Number(r.net_weight ?? payload.netWeight ?? finance.netWeight ?? 0);
                                            const gross = Number(r.gross_weight ?? payload.grossWeight ?? finance.grossWeight ?? 0);

                                            return (
                                              <tr key={r.id || childIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="px-3 py-2 font-mono font-bold text-blue-600">{r.loading_record_no}</td>
                                                <td className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-300">{blNo}</td>
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100">{containerNo}</td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{vessel}</td>
                                                <td className="px-3 py-2 text-right font-mono font-black text-emerald-600">{loadedQty.toLocaleString()} Bags</td>
                                                <td className="px-3 py-2 text-end font-mono text-slate-600 dark:text-slate-400">{net > 0 ? `${net.toLocaleString()} kg` : "-"}</td>
                                                <td className="px-3 py-2 text-end font-mono text-slate-600 dark:text-slate-400">{gross > 0 ? `${gross.toLocaleString()} kg` : "-"}</td>
                                                <td className="px-3 py-2" data-testid="list-lane-status">
                                                  {ls
                                                    ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase text-sky-700">{tt(`plane.${LANE_STATUS_LABEL[ls.lane_status as LaneStatus]?.key ?? ls.lane_status}`, LANE_STATUS_LABEL[ls.lane_status as LaneStatus]?.en ?? ls.lane_status)}</span>
                                                    : <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{tt("plr.not_in_lane", "Not in lane")}</span>}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{ls?.current_location || payload.loadingPort || r.loading_location || "-"}</td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{ls?.assigned_to || "-"}</td>
                                                <td className="px-3 py-2 text-[10px]">
                                                  <div className="font-semibold text-slate-700 dark:text-slate-300">{route}</div>
                                                  <div className="text-slate-400 font-mono">{loadingDateStr}</div>
                                                </td>
                                                <td className="px-3 py-2 text-center max-sm:sticky max-sm:end-0 max-sm:z-10 max-sm:bg-white max-sm:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] dark:max-sm:bg-slate-900">
                                                  <div className="flex items-center justify-center gap-1.5 max-sm:max-w-[9.5rem] max-sm:flex-wrap">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      disabled={listLaneBusy === r.id}
                                                      onClick={() => void onListLaneAction(r, act.kind, poRow.id ?? r.purchase_order_id ?? null)}
                                                      data-testid="list-lane-action"
                                                      data-kind={act.kind}
                                                      className="h-6 gap-1 rounded bg-indigo-600 px-2 text-[9px] font-bold uppercase text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                                                    >
                                                      <ArrowRightLeft className="h-3 w-3" />
                                                      {tt(`plane.${act.labelKey}`, act.label)}
                                                    </Button>
                                                    <CustomDropdown record={r} onLoadDetails={setSelectedLoadDetailsRecord} onReceive={setReceivingRecord} />
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="p-6 text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                      <p className="text-xs font-semibold text-slate-500">{tt("plr.no_container_loadings", "No container shipment loadings created yet for Purchase Booking")} <span className="font-bold text-blue-600">{poNo}</span>.</p>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setSelectedLoadDetailsRecord(records[0])}
                                        className="h-8 px-4 text-xs font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-sm"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        {tt("plr.create_first_loading", "Create First Loading Entry")}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={18} className="px-3 py-8 text-center text-muted-foreground">
                        {tt("plr.no_records_found", "No purchase loading records found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "blue" | "slate" }) {
  const color = tone === "green" ? "text-emerald-600 dark:text-emerald-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : tone === "blue" ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-100";
  const bg = tone === "green" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50" : tone === "amber" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50" : tone === "blue" ? "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";
  
  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", bg)}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn("mt-1 text-2xl font-black font-mono tracking-tight", color)}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: LoadingStatus }) {
  const classes =
    status === "loaded" || status === "received"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : status === "cancelled"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return <span className={cn("rounded-full px-2 py-1 text-xs font-black capitalize", classes)}>{status}</span>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
