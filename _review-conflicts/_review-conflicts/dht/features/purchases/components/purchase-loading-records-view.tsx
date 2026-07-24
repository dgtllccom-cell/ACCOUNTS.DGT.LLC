"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Download, FileText, Link2, MoreVertical, Plus, Printer, RefreshCcw, Search, Ship, Building2, ArrowDownLeft, ArrowUpRight, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
import { Card, CardContent } from "@/components/ui/card";
import { ErpPageActions } from "@/components/layout/erp-page-actions";
import { cn } from "@/lib/utils";

type LoadingStatus = "draft" | "pending" | "loaded" | "received" | "cancelled";


function CustomDropdown({ record, onLoadDetails }: { record: LoadingRecord, onLoadDetails: (r: LoadingRecord) => void }) {
  return (
    <ViewportActionMenu
      ariaLabel="Loading record actions"
      buttonClassName="grid h-7 w-7 place-items-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 transition"
      trigger={<MoreVertical className="h-3.5 w-3.5" />}
    >
      {(close) => (
        <div className="py-1">
          <button className="flex w-full items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => close()}>Edit Record</button>
          <button className="flex w-full items-center px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition" onClick={() => { close(); onLoadDetails(record); }}>Load Details</button>
          <button className="flex w-full items-center px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30 transition" onClick={() => { close(); window.open(`/dashboard/purchase/purchase-loading-records/${record.id}`, "_self"); }}>View Full Details</button>
        </div>
      )}
    </ViewportActionMenu>
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
  const goods = poData.goodsEntries || [];

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
  const poData = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders)?.form_data || {};
  const poRow = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders) || {};
  const form = poData.form || {};
  const goods = poData.goodsEntries || [];

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
  const [originCountry, setOriginCountry] = useState("India");
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
  const [priceType, setPriceType] = useState("P/KGs");
  const [priceRateC1, setPriceRateC1] = useState("");
  const [qualityReportRef, setQualityReportRef] = useState("Passed");
  const [pricingCurrency, setPricingCurrency] = useState("USD");
  const [exchangeRatePKR, setExchangeRatePKR] = useState(defaultExRate);
  const [blNumber, setBlNumber] = useState("");
  const [containerCount, setContainerCount] = useState("1");
  const [loadingCountryState, setLoadingCountryState] = useState(loadingCountry !== "-" ? loadingCountry : "");
  const [loadingPortState, setLoadingPortState] = useState(loadingPort !== "-" ? loadingPort : "");
  const [receivingCountryState, setReceivingCountryState] = useState(receivingCountry !== "-" ? receivingCountry : "");
  const [receivingPortState, setReceivingPortState] = useState(receivingPort !== "-" ? receivingPort : "");
  const [receivingDateState, setReceivingDateState] = useState(form.receivedDate || form.arrivalDate || "");
  const [vesselName, setVesselName] = useState("");
  const [savingNewLoading, setSavingNewLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [expandedPoNos, setExpandedPoNos] = useState<Record<string, boolean>>({});

  const togglePoExpand = (poNo: string) => {
    setExpandedPoNos(prev => ({ ...prev, [poNo]: !prev[poNo] }));
  };

  const [transferConfirmData, setTransferConfirmData] = useState<{
    loadedQty: number;
    loadedPurchaseAmountFC: number;
    advancePaidLC: number;
    remainingLC: number;
    debitAccountName: string;
    debitAccountCode: string;
    creditAccountName: string;
    creditAccountCode: string;
    finalCurrency: string;
    purchaseCurrency: string;
    exchangeRate: number;
    loadingRecordId: string;
    purchaseOrderNo: string;
    grossWeight: number;
    netWeight: number;
    priceRate: number;
  } | null>(null);

  const handleInitiateTransfer = (hRecord: any) => {
    const poRow = (Array.isArray(hRecord.purchase_orders) ? hRecord.purchase_orders[0] : hRecord.purchase_orders) || {};
    const finance = calcLoadingFinance(hRecord, poRow, form);
    const loadedQty = Number(hRecord.report_payload?.loadedQuantity || hRecord.loadedQuantity || 0);
    const grossWeight = Number(hRecord.report_payload?.grossWeight || finance.grossWeight || 0);
    const netWeight = Number(hRecord.report_payload?.netWeight || finance.netWeight || 0);
    const priceRate = Number(hRecord.report_payload?.priceRateC1 || finance.priceRate || 0);
    
    const poAdvanceAmt = normalizeAdvanceToPurchaseCurrency(Number(poRow.advance_paid || form.advanceAmount || 0), contractPurchaseAmount, finance.exRate || 1);
    const loadedAdvanceUSD = (finance.proRataRatio || 0) * poAdvanceAmt;
    const loadedAdvanceLocal = Math.min(loadedAdvanceUSD * finance.exRate, Math.max(0, finance.amountPKR));
    const remainingLC = Math.max(0, finance.amountPKR - loadedAdvanceLocal);

    const debitAccountName = form.purchaseAccountName || "Purchase Account";
    const debitAccountCode = form.purchaseAccountNumber || form.purchaseAccountNo || "DR-001";
    const creditAccountName = form.salesAccountName || form.supplierName || "Supplier Account";
    const creditAccountCode = form.salesAccountNumber || form.salesAccountNo || "CR-001";

    setTransferConfirmData({
      loadedQty,
      loadedPurchaseAmountFC: finance.amountUSD,
      advancePaidLC: loadedAdvanceLocal,
      remainingLC,
      debitAccountName,
      debitAccountCode,
      creditAccountName,
      creditAccountCode,
      finalCurrency: localCurrency,
      purchaseCurrency: finance.currency || "USD",
      exchangeRate: finance.exRate,
      loadingRecordId: hRecord.id,
      purchaseOrderNo: hRecord.purchase_order_no || record.purchase_order_no || "",
      grossWeight,
      netWeight,
      priceRate
    });
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

  // Fetch approved daily rate when country is set
  useEffect(() => {
    const countryId = poRow.country_id || record.countries?.id;
    if (!countryId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          countryId: countryId,
          currency: "USD"
        });
        const branchId = poRow.country_branch_id || record.country_branches?.id;
        if (branchId) {
          params.set("countryBranchId", branchId);
        }
        const res = await fetch(`/api/erp/currency/latest-rate?${params.toString()}`).then((r) => r.json());
        if (!cancelled && res?.ok && res?.data) {
          const rateVal = res.data.rate || res.data.sellRate || res.data.buyRate;
          if (rateVal && !editingLoadingId) {
            setExchangeRatePKR(String(rateVal));
          }
        }
      } catch (err) {
        console.error("Failed to load loading exchange rate", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poRow.country_id, poRow.country_branch_id, record.countries?.id, record.country_branches?.id, editingLoadingId]);

  async function handleDeleteHistory(h: LoadingRecord) {
    if (!confirm("Are you sure you want to delete this loading record?")) return;
    try {
      setSavingNewLoading(true);
      const res = await fetch(`/api/erp/purchases/loading-records/${h.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload.error?.message || payload.error || "Failed to delete.");
      setLoadingMessage("Record deleted.");
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
    setOriginCountry(h.report_payload?.originCountry || "India");
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
    setPriceType(h.report_payload?.priceType || "P/KGs");
    setPriceRateC1(h.report_payload?.priceRateC1 || "");
    setQualityReportRef(h.report_payload?.qualityReportRef || "Passed");
    setPricingCurrency(h.report_payload?.pricingCurrency || "USD");
    setExchangeRatePKR(h.report_payload?.exchangeRatePKR || defaultExRate);
    setContainerNumberInput(h.container_number || h.report_payload?.containerNumber || "");
    setSealNumberInput(h.report_payload?.sealNumber || "");
  }



  const [history, setHistory] = useState<LoadingRecord[]>([]);
  useEffect(() => {
    async function fetchHistory() {
      if (!record.purchase_order_id) return;
      try {
        const res = await fetch(`/api/erp/purchases/loading-records?limit=150`);
        const data = await res.json();
        if (data.ok && data.data?.records) {
           const matches = data.data.records.filter((r: LoadingRecord) => 
               r.purchase_order_id === record.purchase_order_id && 
               r.loading_status === "loaded"
           );
           setHistory(matches);
        }
      } catch (e) {}
    }
    fetchHistory();
  }, [record.purchase_order_id, savingNewLoading]);

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

  const newQuantity = Math.max(0, Number(newLoadingQuantity || 0));
  const previewLoadedQuantity = Math.min(totalQuantity || savedLoadedQuantity + newQuantity, savedLoadedQuantity + newQuantity);
  const previewBalanceQuantity = Math.max(0, totalQuantity - previewLoadedQuantity);
  const unitLabel = String(reportPayload.qtyName || form.qtyName || goods?.[0]?.qtyName || qtyName || "Bags");
  const visibleLoadingRows = history.length ? history : (record.loading_status === "loaded" ? [record] : []);
  const historyLoadedQuantity = visibleLoadingRows.reduce((sum, item) => {
    return sum + Number(item.report_payload?.loadedQuantity || item.report_payload?.loadingQuantity || item.loadedQuantity || 0);
  }, 0);
  const previousLoadedQuantity = historyLoadedQuantity || savedLoadedQuantity;
  const currentLoadingQuantity = newQuantity;
  const totalLoadedQuantity = Math.min(totalQuantity || previousLoadedQuantity + currentLoadingQuantity, previousLoadedQuantity + currentLoadingQuantity);
  const remainingToLoadQuantity = Math.max(0, totalQuantity - totalLoadedQuantity);
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
  const contractPurchaseAmount = Number(
    poRow.order_total ||
      poData.totals?.grandFinal ||
      poData.totals?.totalPurchase ||
      poData.totals?.totalAmount ||
      form.totalAmount ||
      0
  );
  const contractPurchaseCurrency = String(form.currency || poRow.currency_code || goods?.[0]?.pricingCurrency || "USD");
  const getAdvanceAppliedLocal = (finance: ReturnType<typeof calcLoadingFinance>, loadedQty: number) => {
    const rawAdvance = Number(poRow.advance_paid || form.advanceAmount || 0);
    const advanceInPurchaseCurrency = normalizeAdvanceToPurchaseCurrency(rawAdvance, contractPurchaseAmount, finance.exRate || 1);
    const ratio = finance.proRataRatio || (totalQuantity > 0 ? loadedQty / totalQuantity : 0);
    const appliedLocal = Math.max(0, ratio * advanceInPurchaseCurrency * (finance.exRate || 1));
    return Math.min(appliedLocal, Math.max(0, finance.amountPKR || appliedLocal));
  };

  function downloadLoadDetails(kind: "json" | "pdf") {
    if (kind === "pdf") {
      window.print();
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
      setLoadingMessage("Enter loading quantity first.");
      return;
    }
    setSavingNewLoading(true);
    setLoadingMessage("");
    try {
      const targetId = editingLoadingId || (record.loading_status === "pending" ? record.id : null);
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
          containerNumber: record.container_number || `LOAD-${Date.now()}`,
          containerType: record.container_type || "40 FT",
          loadingStatus: "loaded",
          loadedAt: new Date(newLoadingDate).toISOString(),
          loadingLocation: loadingPortState || record.loading_location || loadingPort,
          receivingLocation: receivingPortState || record.receiving_location || receivingPort,
          shipmentStatus: previewBalanceQuantity > 0 ? "partial_loaded" : "fully_loaded",
          carrierName: vesselName || record.carrier_name || null,
          remarks: newLoadingNote || record.remarks || null,
          loadedContainers: Number(containerCount) || 1,
          loadedQuantity: newQuantity,
          reportPayload: {
            sourceRecordId: record.id,
            sourceLoadingRecordNo: record.loading_record_no,
            loadedQuantity: newQuantity,
            loadingQuantity: newQuantity,
            runningLoadedQuantity: savedLoadedQuantity + newQuantity,
            balanceQuantity: Math.max(0, totalQuantity - (savedLoadedQuantity + newQuantity)),
            blNumber,
            containerCount: Number(containerCount),
            loadingCountry: loadingCountryState,
            loadingPort: loadingPortState,
            loadingDate: newLoadingDate,
            receivingCountry: receivingCountryState,
            receivingPort: receivingPortState,
            receivingDate: receivingDateState,
            vesselName,
            action: "new_loading_entry",
            originCountry, goodsName, hsCode, allotName, brand, sizeSpec,
            qtyName, quantityNo, oneQtyKgs, oneEmptyKgs, divideType, divideWeightValue,
            priceType, priceRateC1, qualityReportRef, pricingCurrency, exchangeRatePKR
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || payload.error || "Loading entry was not saved.");
      
      const totalContainers = Math.max(1, Number(containerCount) || 1);
      if (currentContainerIndex < totalContainers) {
        const nextIdx = currentContainerIndex + 1;
        setCurrentContainerIndex(nextIdx);
        setContainerNumberInput("");
        setSealNumberInput("");
        setQuantityNo("");
        setNewLoadingQuantity("");
        setLoadingMessage(`✓ Saved Container ${currentContainerIndex} of ${totalContainers} for B/L ${blNumber || record.purchase_order_no}! Please enter details for Container #${nextIdx}.`);
      } else {
        setCurrentContainerIndex(1);
        setLoadingMessage(`✓ All ${totalContainers} container(s) saved for B/L ${blNumber || "record"}!`);
        setEditingLoadingId(null);
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
        setVesselName("");
        setOriginCountry("India");
        setGoodsName("");
        setHsCode("0000");
        setAllotName("ALT-4733");
        setBrand("");
        setSizeSpec("");
        setQtyName("BAGS");
        setQuantityNo("");
        setOneQtyKgs("");
        setOneEmptyKgs("");
        setDivideType("D/KGs");
        setDivideWeightValue("1");
        setPriceType("P/KGs");
        setPriceRateC1("");
        setQualityReportRef("Passed");
        setPricingCurrency("USD");
        setExchangeRatePKR(defaultExRate);
      }
      setQualityReportRef("Passed");
      setPricingCurrency("USD");
      setExchangeRatePKR("287");
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
          <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">Load Details Form</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">Manage loading quantity, checking, brand note, PDF and download actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => {
            if (!showNewLoading) {
               setEditingLoadingId(null);
               setFormStep(1);
               setLoadingCountryState(loadingCountry !== "-" ? loadingCountry : "");
               setLoadingPortState(loadingPort !== "-" ? loadingPort : "");
               setReceivingCountryState(receivingCountry !== "-" ? receivingCountry : "");
               setReceivingPortState(receivingPort !== "-" ? receivingPort : "");
               setReceivingDateState(form.receivedDate || form.arrivalDate || "");
               setNewLoadingDate(form.loadingDate || new Date().toISOString().slice(0, 10));
               setBlNumber("");
               setContainerCount("1");
               setVesselName("");
               setOriginCountry("India");
               setGoodsName("");
               setHsCode("0000");
               setAllotName("ALT-4733");
               setBrand("");
               setSizeSpec("");
               setQtyName("BAGS");
               setQuantityNo("");
               setOneQtyKgs("");
               setOneEmptyKgs("");
               setDivideType("D/KGs");
               setDivideWeightValue("1");
               setPriceType("P/KGs");
               setPriceRateC1("");
               setQualityReportRef("Passed");
               setPricingCurrency("USD");
               setExchangeRatePKR("287");
               setNewLoadingQuantity("");
               setNewLoadingNote("");
            }
            setShowNewLoading((value) => !value);
          }} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Loading
          </Button>
          <ViewportActionMenu
            ariaLabel="Load detail actions"
            buttonClassName="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            trigger={<MoreVertical className="h-4 w-4" />}
          >
            {(close) => (
              <div className="py-1">
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); setLoadingMessage("Brand view selected for this loading report."); }}>
                  <Ship className="h-3.5 w-3.5 text-emerald-600" /> Brand
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); setLoadingMessage("Checking view selected. Review quantity, dates and loading balance before saving."); }}>
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> Checking
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); downloadLoadDetails("json"); }}>
                  <Download className="h-3.5 w-3.5 text-indigo-600" /> Download
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => { close(); downloadLoadDetails("pdf"); }}>
                  <Printer className="h-3.5 w-3.5 text-rose-600" /> PDF Download
                </button>
              </div>
            )}
          </ViewportActionMenu>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
        <div className="w-full space-y-6">
          <div className={cn("grid gap-6 items-start w-full", showNewLoading ? "grid-cols-1 xl:grid-cols-[380px_1fr]" : "grid-cols-1")}>
            {showNewLoading && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 fade-in duration-300">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="mb-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-100">
                        {formStep === 1 ? "New Loading (Step 1 of 2)" : "New Loading (Step 2 of 2)"}
                      </h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-500/30">Live</span>
                    </div>
                    <p className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-200/80">
                      {formStep === 1 ? "Enter shipping and routing details." : "Enter goods, pricing and container details."}
                    </p>
                  </div>

                  {formStep === 1 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 pr-1 pb-2">
                        <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 col-span-2">
                          B/L Number
                      <input
                        value={blNumber}
                        onChange={(e) => setBlNumber(e.target.value)}
                        placeholder="e.g. BL12345"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                      />
                    </label>
                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 col-span-2">
                      Containers Qty
                      <input
                        type="number"
                        min="1"
                        value={containerCount}
                        onChange={(e) => setContainerCount(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                      />
                    </label>

                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Loading Country
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
                        placeholder="Select Country"
                        addOptionLabel="Add New Country"
                      />
                    </label>
                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Loading Port / Border
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
                        placeholder={form.shippingMode === "By Road" ? "Select Border" : "Select Port"}
                        addOptionLabel={form.shippingMode === "By Road" ? "Add New Border" : "Add New Port"}
                        disabled={!loadingCountryState && currentLoadingPorts.length === 0}
                      />
                    </label>

                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Receiving Country
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
                        placeholder="Select Country"
                        addOptionLabel="Add New Country"
                      />
                    </label>
                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Receiving Port / Border
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
                        placeholder={form.shippingMode === "By Road" ? "Select Border" : "Select Port"}
                        addOptionLabel={form.shippingMode === "By Road" ? "Add New Border" : "Add New Port"}
                        disabled={!receivingCountryState && currentReceivedPorts.length === 0}
                      />
                    </label>
                    
                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Loading Date
                      <input
                        type="date"
                        value={newLoadingDate}
                        onChange={(e) => setNewLoadingDate(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                      />
                    </label>
                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Receiving Date
                      <input
                        type="date"
                        value={receivingDateState}
                        onChange={(e) => setReceivingDateState(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                      />
                    </label>

                    <label className="space-y-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 col-span-2">
                      Vessel Name
                      <input
                        value={vesselName}
                        onChange={(e) => setVesselName(e.target.value)}
                        placeholder="e.g. MSC Alina"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950"
                      />
                    </label>

                      </div>
                      <div className="mt-5">
                        <Button
                          type="button"
                          onClick={() => setFormStep(2)}
                          className="w-full h-10 rounded-lg bg-emerald-600 px-4 text-[11px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                        >
                          Next Step
                        </Button>
                      </div>
                    </>
                  ) : formStep === 2 ? (
                    <div className="flex flex-col h-full pr-1 pt-2 pb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">GOODS ENTRY</h4>
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
                            <div className="text-[8px] font-extrabold uppercase text-slate-400">Total</div>
                            <div className="font-mono font-black text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                              {totalQuantity.toLocaleString()} <span className="text-[8px] font-medium text-slate-400">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-slate-500 mt-0.5 font-mono leading-tight">
                              <div><span className="text-slate-400">Net:</span> {contractNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-slate-400">Gross:</span> {contractGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>

                          <div className="bg-emerald-50/70 p-1.5 rounded border border-emerald-200/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                            <div className="text-[8px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">Loaded ({history.length})</div>
                            <div className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-[10px] leading-tight">
                              {totalLoadedQuantity.toLocaleString()} <span className="text-[8px] font-medium text-emerald-600/70">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-emerald-700/80 dark:text-emerald-400 mt-0.5 font-mono leading-tight">
                              <div><span className="text-emerald-600/60">Net:</span> {loadedNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-emerald-600/60">Gross:</span> {loadedGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>

                          <div className="bg-rose-50/70 p-1.5 rounded border border-rose-200/60 dark:border-rose-900/50 dark:bg-rose-950/30">
                            <div className="text-[8px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Remaining</div>
                            <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-[10px] leading-tight">
                              {remainingToLoadQuantity.toLocaleString()} <span className="text-[8px] font-medium text-rose-500/70">{unitLabel}</span>
                            </div>
                            <div className="text-[8px] text-rose-600/80 dark:text-rose-400 mt-0.5 font-mono leading-tight">
                              <div><span className="text-rose-500/60">Net:</span> {remainingNetWeight.toLocaleString()} kg</div>
                              <div><span className="text-rose-500/60">Gross:</span> {remainingGrossWeight.toLocaleString()} kg</div>
                            </div>
                          </div>
                        </div>

                        {currentInputNetKgs > 0 && (
                          <div className="flex items-center justify-between bg-cyan-50 p-1 rounded border border-cyan-200 text-[9.5px] dark:bg-cyan-950/40 dark:border-cyan-800">
                            <span className="font-bold text-cyan-800 dark:text-cyan-300">CURRENT ENTRY WEIGHT:</span>
                            <span className="font-mono font-black text-cyan-900 dark:text-cyan-200">
                              Net: {currentInputNetKgs.toLocaleString()} kg | Gross: {currentInputGrossKgs.toLocaleString()} kg
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          Origin Country
                          <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="India" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          Goods Name*
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
                                if (good.priceType) setPriceType(good.priceType);
                                if (good.coursePrice) setPriceRateC1(String(good.coursePrice));
                              }
                            }}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value="">Select Goods</option>
                            {goods.map((g: any, i: number) => {
                              const name = g.itemName || g.goodsName || g.item;
                              if (!name) return null;
                              return <option key={i} value={name}>{name}</option>;
                            })}
                          </select>
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          HS Code
                          <input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="0000" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Allot Name / ID
                          <input value={allotName} onChange={(e) => setAllotName(e.target.value)} placeholder="ALT-4733" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Brand
                          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Select Brand" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Size Specification
                          <input value={sizeSpec} onChange={(e) => setSizeSpec(e.target.value)} placeholder="Select Size" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Qty Name
                          <input value={qtyName} onChange={(e) => setQtyName(e.target.value)} placeholder="BAGS" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Quantity No *
                          <input value={quantityNo} onChange={(e) => {
                            setQuantityNo(e.target.value);
                            setNewLoadingQuantity(e.target.value);
                          }} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          1 Qty KGS
                          <input value={oneQtyKgs} onChange={(e) => setOneQtyKgs(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          1 Empty KGS
                          <input value={oneEmptyKgs} onChange={(e) => setOneEmptyKgs(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Divide Type
                          <input value={divideType} onChange={(e) => setDivideType(e.target.value)} placeholder="D/KGs" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Divide Weight / Value
                          <input value={divideWeightValue} onChange={(e) => setDivideWeightValue(e.target.value)} placeholder="1" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Price Type
                          <input value={priceType} onChange={(e) => setPriceType(e.target.value)} placeholder="P/KGs" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                        
                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Price Rate (C1)
                          <input value={priceRateC1} onChange={(e) => setPriceRateC1(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>

                        <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 col-span-2">
                          Quality Report Reference
                          <input value={qualityReportRef} onChange={(e) => setQualityReportRef(e.target.value)} placeholder="Passed" className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                        </label>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 mb-6 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400 mb-3">PURCHASE CURRENCY & CONVERSION</h4>
                        
                        <div className="flex flex-col gap-3">
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            Pricing Currency
                            <input value={pricingCurrency} onChange={(e) => setPricingCurrency(e.target.value)} placeholder="USD" className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            Exchange Rate to {localCurrency}
                            <input value={exchangeRatePKR} onChange={(e) => setExchangeRatePKR(e.target.value)} placeholder={defaultExRate} className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            Container Number *
                            <input value={containerNumberInput} onChange={(e) => setContainerNumberInput(e.target.value)} placeholder="e.g. MSCU1234567" className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            Seal Number *
                            <input value={sealNumberInput} onChange={(e) => setSealNumberInput(e.target.value)} placeholder="e.g. SL998877" className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                          <label className="space-y-1 text-[10px] font-bold text-teal-700 dark:text-teal-500">
                            Loading Note
                            <input value={newLoadingNote} onChange={(e) => setNewLoadingNote(e.target.value)} placeholder="e.g. Checking / brand remarks" className="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200" />
                          </label>
                        </div>
                      </div>

                      {/* PO Items Status Summary Table */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 mb-4 dark:border-slate-800 dark:bg-slate-900/30">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">PO ITEMS STATUS SUMMARY</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[9px] border-collapse bg-white dark:bg-slate-950 rounded-lg overflow-hidden border dark:border-slate-850">
                            <thead>
                              <tr className="border-b text-slate-400 font-bold uppercase tracking-wider bg-slate-50/80 dark:bg-slate-900/50">
                                <th className="px-2 py-1.5">Item</th>
                                <th className="px-2 py-1.5 text-right">PO Qty</th>
                                <th className="px-2 py-1.5 text-right">Loaded</th>
                                <th className="px-2 py-1.5 text-right">Balance</th>
                                <th className="px-2 py-1.5 text-right">Rate</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {goods.map((g: any, gIdx: number) => {
                                const name = g.goodsName || g.item || "-";
                                const poQty = Number(g.qtyNo || g.quantity || 0);
                                const loaded = itemLoadBalances[name]?.loaded || 0;
                                const bal = Math.max(0, poQty - loaded);
                                const rate = Number(g.coursePrice || 0);
                                return (
                                  <tr key={gIdx} className="text-slate-655 dark:text-slate-350 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                                    <td className="px-2 py-2 font-bold uppercase truncate max-w-[80px]" title={name}>{name}</td>
                                    <td className="px-2 py-2 text-right font-mono">{poQty.toLocaleString()}</td>
                                    <td className="px-2 py-2 text-right font-mono text-emerald-600 font-bold">{loaded.toLocaleString()}</td>
                                    <td className={cn("px-2 py-2 text-right font-mono font-bold", bal > 0 ? "text-rose-600" : "text-emerald-650")}>{bal.toLocaleString()}</td>
                                    <td className="px-2 py-2 text-right font-mono">{rate.toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" onClick={() => setFormStep(1)} className="rounded-full h-9 px-4 text-xs font-bold">
                          Back
                        </Button>
                        <Button type="button" onClick={() => void saveNewLoading()} disabled={savingNewLoading || !newQuantity || !containerNumberInput} className="rounded-full h-9 bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition active:scale-[0.98] disabled:opacity-50">
                          {savingNewLoading ? "Saving..." : Number(containerCount) > 1 && currentContainerIndex < Number(containerCount) ? `Save & Next Container (${currentContainerIndex + 1}/${containerCount})` : "Save Loading"}
                        </Button>
                      </div>

                    </div>
                  ) : null}
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
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">Branch & Bill Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Branch / Bill No.</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{branchLabel}</div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">User Admin:</span>
                    <span className="font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded text-[10px] dark:bg-emerald-950/50">{adminLabel}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">User ID:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{form.userId || form.userCode || "ADM-001"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Session Timestamp:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Location:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-right truncate pl-2" title={countryLabel}>{countryLabel}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Booking Date:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(record.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-amber-600 uppercase text-[10px]">{record.loading_status || "PENDING"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">System Serial:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{record.purchase_order_no || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-blue-600 dark:text-blue-400">Branch Serial:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{record.loading_record_no}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Branch Mobile:</span>
                    <span className="font-mono font-bold text-blue-600">{form.branchMobile || "+92-300-1234567"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Loading Mode:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">By Sea</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Origin Country:</span>
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
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">Purchase Account Details</h3>
              </div>
              <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Account Code:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.purchaseAccountNumber || form.purchaseAccountNo || "-"}</span>
                  </div>
                  <div className="pt-2 pb-1">
                    <div className="text-[10px] text-slate-400 mb-0.5">Account Name:</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 leading-snug">{form.purchaseAccountName || "مال خرید اکاؤنٹ"}</div>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Branch:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">PAKPKB</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Currency:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{form.currency || "PKR"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Company:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate pl-4" title={form.purchaseAccountName}>{form.purchaseAccountName || "NAJEEB AND COMPANY"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">KIND</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">INCOME</div>
                    </div>
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">TYPE</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Sub-Acct</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50/80 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800">
                     <h4 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-blue-500">SERIALS & REF</h4>
                     <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[10px]">
                       <div>
                         <div className="text-slate-400">Acct S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">6</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Country S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">PAK-000006</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Branch S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">PAK-CHM-000002</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Manual Ref</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">00124</div>
                       </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">OPENING BAL</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">₨ 0</div>
                    </div>
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">CURRENT BAL</div>
                       <div className="text-[11px] font-bold text-emerald-600">₨ 0</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 text-[10px] font-mono text-slate-500">
                    <div>MOB: +92 32283832844</div>
                    <div>WA: +923228383284</div>
                  </div>
              </div>
            </div>

            {/* SALES ACCOUNT (CR) */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">Sales Account (CR)</h3>
              </div>
              <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Account Code:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{form.salesAccountNumber || form.salesAccountNo || "-"}</span>
                  </div>
                  <div className="pt-2 pb-1">
                    <div className="text-[10px] text-slate-400 mb-0.5">Account Name:</div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 leading-snug">{form.salesAccountName || "عزت اللہ تجری کھاتہ"}</div>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Branch:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">PAK-PKBA-001</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Currency:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{form.currency || "PKR"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Company:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate pl-4" title={form.salesAccountName}>{form.salesAccountName || "ABC Trading LLC"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">KIND</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">ASSET</div>
                    </div>
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">TYPE</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Sub-Acct</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50/80 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-800">
                     <h4 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-blue-500">SERIALS & REF</h4>
                     <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[10px]">
                       <div>
                         <div className="text-slate-400">Acct S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">11</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Country S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">PAK-000011</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Branch S/N</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">PAK-CHM-000005</div>
                       </div>
                       <div>
                         <div className="text-slate-400">Manual Ref</div>
                         <div className="font-bold text-slate-700 dark:text-slate-300">C450</div>
                       </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">OPENING BAL</div>
                       <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">₨ 0</div>
                    </div>
                    <div>
                       <div className="text-[9px] uppercase tracking-widest text-slate-400">CURRENT BAL</div>
                       <div className="text-[11px] font-bold text-emerald-600">₨ 0</div>
                    </div>
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
                  <h3 className="font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 text-[10px]">Loading Summary Report</h3>
                </div>
                <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  {loadingProgress.toFixed(1)}% Loaded
                </span>
              </div>
              <div className="space-y-2 text-xs font-semibold">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Contract Quantity</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{totalQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contract Gross Weight</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractGrossWeight.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contract Net Weight</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractNetWeight.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contract Purchase Amount</span>
                  <span className="font-mono font-black text-slate-800 dark:text-slate-100">{contractPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {contractPurchaseCurrency}</span>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Previously Loaded</span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">{previousLoadedQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-blue-50/60 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Current Loading</span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400">{currentLoadingQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-teal-50/60 dark:bg-teal-900/10 p-3 rounded-lg border border-teal-100 dark:border-teal-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Total Loaded</span>
                  <span className="font-mono font-black text-teal-700 dark:text-teal-400">{totalLoadedQuantity.toLocaleString()} {unitLabel}</span>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Remaining to Load</span>
                  <span className="font-mono font-black text-rose-600">{remainingToLoadQuantity.toLocaleString()} {unitLabel}</span>
                </div>

                {remainingToLoadQuantity > 0 && (
                  <Button
                    type="button"
                    onClick={() => handleInitiateTransfer(record)}
                    className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98]"
                  >
                    <Link2 className="h-4 w-4" />
                    Transfer Remaining to Journal
                  </Button>
                )}
              </div>
            </div>

            {/* Transfer Remaining to Journal Confirmation Modal (Requirement 11) */}
      {transferConfirmData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">Transfer Remaining to Journal</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Confirmation summary for loaded goods remaining balance</p>
                </div>
              </div>
              <button onClick={() => setTransferConfirmData(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-xs font-semibold border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center"><span className="text-slate-500">PO Number:</span><span className="font-mono font-bold text-blue-600">{transferConfirmData.purchaseOrderNo}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Loaded Quantity:</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{transferConfirmData.loadedQty.toLocaleString()} Bags</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Loaded Purchase Amount:</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{transferConfirmData.loadedPurchaseAmountFC.toLocaleString(undefined, {minimumFractionDigits: 2})} {transferConfirmData.purchaseCurrency}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Advance Paid Applied:</span><span className="font-mono font-bold text-emerald-600">{transferConfirmData.advancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {transferConfirmData.finalCurrency}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800"><span className="text-rose-600 font-bold uppercase">Remaining Amount to Journal:</span><span className="font-mono font-black text-rose-600 text-sm">{transferConfirmData.remainingLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {transferConfirmData.finalCurrency}</span></div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-slate-400 block">Debit Account (DR)</span><span className="font-bold text-blue-700 dark:text-blue-300">{transferConfirmData.debitAccountName} ({transferConfirmData.debitAccountCode})</span></div>
                <div><span className="text-slate-400 block">Credit Account (CR)</span><span className="font-bold text-rose-700 dark:text-rose-300">{transferConfirmData.creditAccountName} ({transferConfirmData.creditAccountCode})</span></div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                <span>Exchange Rate: <strong className="font-mono text-slate-700 dark:text-slate-200">{transferConfirmData.exchangeRate}</strong></span>
                <span>Final Currency: <strong className="font-mono text-slate-700 dark:text-slate-200">{transferConfirmData.finalCurrency}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransferConfirmData(null)} className="rounded-lg font-bold text-xs">Cancel</Button>
              <Button type="button" size="sm" onClick={() => {
                const queryParams = new URLSearchParams({
                  purchaseOrderNo: transferConfirmData.purchaseOrderNo,
                  fromLoading: "true",
                  loadingRecordId: transferConfirmData.loadingRecordId,
                  loadedQty: String(transferConfirmData.loadedQty),
                  grossWeight: String(transferConfirmData.grossWeight),
                  netWeight: String(transferConfirmData.netWeight),
                  priceRate: String(transferConfirmData.priceRate),
                  amount: String(transferConfirmData.remainingLC / transferConfirmData.exchangeRate),
                  exchangeRate: String(transferConfirmData.exchangeRate),
                  currency: transferConfirmData.purchaseCurrency,
                  amountPKR: String(transferConfirmData.remainingLC)
                }).toString();
                setTransferConfirmData(null);
                window.open(`/dashboard/journal/purchase-order-payment/remaining?${queryParams}`, "_self");
              }} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                Confirm & Transfer to Journal
              </Button>
            </div>
          </div>
        </div>
      )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Current Bill Loading Report</h3>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">Bill quantity, loaded balance, payment conversion and remaining amount.</p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    {visibleLoadingRows.length || 1} Bill Row
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1280px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                        <th className="px-4 py-3">SR#</th>
                        <th className="px-4 py-3">Goods</th>
                        <th className="px-4 py-3 text-right">Contract Qty</th>
                        <th className="px-4 py-3 text-right">Loaded Qty</th>
                        <th className="px-4 py-3 text-right">Remaining Qty</th>
                        <th className="px-4 py-3 text-right">Net Weight</th>
                        <th className="px-4 py-3 text-right">Gross Weight</th>
                        <th className="px-4 py-3 text-right">Purchase Rate</th>
                        <th className="px-4 py-3 text-right">Loaded Purchase</th>
                        <th className="px-4 py-3 text-right">Exchange Rate</th>
                        <th className="px-4 py-3 text-right">Final Amount ({localCurrency})</th>
                        <th className="px-4 py-3 text-right">Approved Advance</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3">Route / Dates</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(visibleLoadingRows.length ? visibleLoadingRows : [record]).map((h, i) => {
                        const rows = visibleLoadingRows.length ? visibleLoadingRows : [record];
                        const finance = calcLoadingFinance(h, poRow, form);
                        const loadedQty = Number(h.report_payload?.loadedQuantity || h.report_payload?.loadingQuantity || h.loadedQuantity || currentLoadingQuantity || 0);
                        const cumulativeLoadedUpToThisRow = rows.slice(0, i + 1).reduce((sum, item) => {
                          return sum + Number(item.report_payload?.loadedQuantity || item.report_payload?.loadingQuantity || item.loadedQuantity || 0);
                        }, 0);
                        const remainingQty = Math.max(0, totalQuantity - cumulativeLoadedUpToThisRow);
                        const advanceLocal = getAdvanceAppliedLocal(finance, loadedQty);
                        const balanceLocal = Math.max(0, (finance.amountPKR || 0) - advanceLocal);
                        const gName = h.report_payload?.goodsName || h.report_payload?.item || form.goodsName || form.itemName || "-";
                        const brandName = h.report_payload?.brand || form.brand || "";
                        const sizeName = h.report_payload?.sizeSpec || form.size || "";
                        const route = [h.report_payload?.loadingPort || loadingPort, h.report_payload?.receivingPort || receivingPort].filter(Boolean).join(" to ") || "-";
                        return (
                          <tr key={h.id || record.id || i} className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3 font-mono font-bold text-slate-500">{String(i + 1).padStart(2, "0")}</td>
                            <td className="px-4 py-3">
                              <div className="font-black text-slate-800 dark:text-slate-100">{gName}</div>
                              <div className="mt-1 text-[10px] font-semibold text-slate-500">{[brandName, sizeName].filter(Boolean).join(" / ") || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-700 dark:text-slate-200">{totalQuantity.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{loadedQty.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-rose-600">{remainingQty.toLocaleString()} {unitLabel}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">{finance.netWeight.toLocaleString()} kg</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">{finance.grossWeight.toLocaleString()} kg</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{finance.priceRate ? finance.priceRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"} {finance.currency}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">{finance.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {finance.currency}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">{finance.exRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-blue-700 dark:text-blue-300">{finance.amountPKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{advanceLocal > 0 ? advanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"} {advanceLocal > 0 ? localCurrency : ""}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-rose-600">{balanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-700 dark:text-slate-200">{route}</div>
                              <div className="mt-1 text-[10px] font-semibold text-slate-500">{h.report_payload?.loadingDate || loadingDate} &rarr; {h.report_payload?.receivingDate || receivingDate || "Pending"}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button type="button" onClick={() => handleEditHistory(h)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">Edit</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Goods & Container Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/50 dark:bg-slate-900/20">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 w-10">SR#</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Country</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Loading No</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Purchase Booking No.</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Sales Account</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Purchase Account</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Goods</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Quantity</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Net Weight</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Gross Weight</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Purchase Amount ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Exchange Rate</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Advance Amount ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Balance Amount ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Payment Date</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Loading Country</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Loading Port</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Loading Date</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Received Country</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Received Port</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Received Date</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(() => {
                    const hasLoading = record.loading_status === "loaded" || Number(record.report_payload?.loadedQuantity || record.loadedQuantity || 0) > 0;
                    
                    if (hasLoading) {
                      const finance = calcLoadingFinance(record, poRow, form);
                      const gName = record.report_payload?.goodsName || record.report_payload?.item || form.itemName || "-";
                      const brandName = record.report_payload?.brand || "";
                      const sizeName = record.report_payload?.sizeSpec || "";
                      const nameCombined = [gName, brandName, sizeName].filter(Boolean).join(" - ") || "-";

                      const loadedQty = Number(record.report_payload?.loadedQuantity || record.report_payload?.loadingQuantity || record.loadedQuantity || 0);
                      const grossWeight = finance.grossWeight;
                      const netWeight = finance.netWeight;

                      const itemFinalAmountPKR = finance.amountPKR;
                      const exRate = finance.exRate;

                      const advancePaidForThisLoadingLocal = getAdvanceAppliedLocal(finance, loadedQty);
                      const balPKR = Math.max(0, itemFinalAmountPKR - advancePaidForThisLoadingLocal);
                      const payDate = form.advancePaymentDate || form.paymentDate || form.clearanceDate || "-";

                      return (
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="px-6 py-3 font-medium text-slate-400">01</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{countryLabel}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{record.loading_record_no || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{record.purchase_order_no || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{form.salesAccountName || form.salesAccountNumber || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{form.purchaseAccountName || form.supplierName || "-"}</td>
                          <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">{nameCombined}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{loadedQty.toLocaleString()}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{netWeight.toLocaleString()}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{grossWeight.toLocaleString()}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{itemFinalAmountPKR > 0 ? itemFinalAmountPKR.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{exRate > 1 ? exRate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-right">{advancePaidForThisLoadingLocal > 0 ? advancePaidForThisLoadingLocal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-rose-600 dark:text-rose-400 text-right">{balPKR !== 0 ? balPKR.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{payDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{loadingCountry}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{loadingPort}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">{loadingDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{receivingCountry}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{receivingPort}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{receivingDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">-</td>
                        </tr>
                      );
                    } else {
                      // Fallback: PO contract value row
                      const poTotal = Number(poRow?.order_total || poData.totals?.grandFinal || form.totalAmount || 0);
                      const exRate = Number(form.exchangeRate || (poData as any).exchange_rate || 1);
                      const itemFinalAmountPKR = poTotal * exRate;
                      const poAdvancePaid = normalizeAdvanceToPurchaseCurrency(Number(poRow.advance_paid || form.advanceAmount || 0), poTotal, exRate || 1);
                      const advancePaidLocal = Math.min(poAdvancePaid * exRate, Math.max(0, itemFinalAmountPKR));
                      const balPKR = Math.max(0, itemFinalAmountPKR - advancePaidLocal);
                      const payDate = form.advancePaymentDate || form.paymentDate || form.purchaseDate || "-";

                      return (
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="px-6 py-3 font-medium text-slate-400">01</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{countryLabel}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{record.loading_record_no || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{record.purchase_order_no || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{form.salesAccountName || form.salesAccountNumber || "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{form.purchaseAccountName || form.supplierName || "-"}</td>
                          <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">
                            {form.goodsName || form.itemName || "-"} {form.itemDetails ? ` - ${form.itemDetails}` : ""}
                          </td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{form.quantity || 0}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{form.netWeight || 0}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{form.grossWeight || 0}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{itemFinalAmountPKR > 0 ? itemFinalAmountPKR.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{exRate > 1 ? exRate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-right">{advancePaidLocal > 0 ? advancePaidLocal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-rose-600 dark:text-rose-400 text-right">{balPKR !== 0 ? balPKR.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "-"}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{payDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{loadingCountry}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{loadingPort}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">{loadingDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{receivingCountry}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{receivingPort}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{receivingDate}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">-</td>
                        </tr>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOADING HISTORY TABLE */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Loading History</h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">All BL/container loading records for this purchase bill.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {history.length} Saved Loading
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-3">SR#</th>
                    <th className="px-4 py-3">BL Number</th>
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Vessel / Vehicle</th>
                    <th className="px-4 py-3 text-right">Load Qty</th>
                    <th className="px-4 py-3 text-right">Purchase Rate</th>
                    <th className="px-4 py-3 text-right">Purchase Amount</th>
                    <th className="px-4 py-3 text-right">Exchange Rate</th>
                    <th className="px-4 py-3 text-right">Final Amount ({localCurrency})</th>
                    <th className="px-4 py-3 text-right">Advance Paid</th>
                    <th className="px-4 py-3 text-right">Balance Remaining</th>
                    <th className="px-4 py-3">Ports / Dates</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.length ? history.map((h, i) => {
                    const finance = calcLoadingFinance(h, poRow, form);
                    const loadedQty = Number(h.report_payload?.loadedQuantity || h.loadedQuantity || 0);
                    const poAdvanceAmt = Number(poRow.advance_paid || form.advanceAmount || 0);
                    const loadedAdvanceUSD = (finance.proRataRatio || 0) * poAdvanceAmt;
                    const advanceLocal = Math.min(loadedAdvanceUSD * finance.exRate, Math.max(0, finance.amountPKR));
                    const balanceLocal = Math.max(0, finance.amountPKR - advanceLocal);
                    return (
                      <tr key={h.id} className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-3 font-mono font-black text-blue-700 dark:text-blue-300">{h.report_payload?.blNumber || "-"}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">{h.container_number || h.report_payload?.containerNumber || "-"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{h.report_payload?.vesselName || h.carrier_name || "-"}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">{loadedQty.toLocaleString()} {unitLabel}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">{finance.priceRate ? finance.priceRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"} {finance.currency}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">{finance.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {finance.currency}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">{finance.exRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-blue-700 dark:text-blue-300">{finance.amountPKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{advanceLocal > 0 ? advanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"} {advanceLocal > 0 ? localCurrency : ""}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-rose-600">{balanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrency}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">{h.report_payload?.loadingPort || h.loading_location || "-"} &rarr; {h.report_payload?.receivingPort || h.receiving_location || "-"}</div>
                          <div className="mt-1 text-[10px] font-semibold text-slate-500">{h.report_payload?.loadingDate || h.loaded_at?.slice(0, 10) || "-"} &rarr; {h.report_payload?.receivingDate || "Pending"}</div>
                        </td>
                        <td className="px-4 py-3"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">Loaded</span></td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const grossWeight = Number(h.report_payload?.grossWeight || finance.grossWeight || 0);
                                const netWeight = Number(h.report_payload?.netWeight || finance.netWeight || 0);
                                const priceRate = Number(h.report_payload?.priceRateC1 || finance.priceRate || 0);
                                const loadedRemainingUSD = Math.max(0, finance.amountUSD - loadedAdvanceUSD);
                                const exchangeRate = finance.exRate || 1;

                                const queryParams = new URLSearchParams({
                                  purchaseOrderNo: record.purchase_order_no || poRow.purchase_order_no || "",
                                  fromLoading: "true",
                                  loadingRecordId: h.id,
                                  blNumber: h.report_payload?.blNumber || "",
                                  containerNumber: h.container_number || h.report_payload?.containerNumber || "",
                                  loadedQty: String(loadedQty),
                                  grossWeight: String(grossWeight),
                                  netWeight: String(netWeight),
                                  priceRate: String(priceRate),
                                  purchaseAmount: String(finance.amountUSD),
                                  loadedPurchaseAmount: String(finance.amountUSD),
                                  finalAmount: String(finance.amountUSD * exchangeRate),
                                  advanceApplied: String(loadedAdvanceUSD),
                                  advanceAppliedLocal: String(loadedAdvanceUSD * exchangeRate),
                                  remainingBalance: String(loadedRemainingUSD),
                                  remainingBalanceLocal: String(loadedRemainingUSD * exchangeRate),
                                  amount: String(loadedRemainingUSD),
                                  exchangeRate: String(exchangeRate),
                                  currency: finance.currency || "USD",
                                  amountPKR: String(loadedRemainingUSD * exchangeRate)
                                }).toString();
                                window.open(`/dashboard/journal/purchase-order-payment/remaining?${queryParams}`, "_self");
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100 hover:border-blue-300 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition shadow-sm"
                              title="Transfer Remaining Loading Balance to Journal"
                            >
                              <Link2 className="h-3 w-3 text-blue-600" />
                              Transfer Remaining
                            </button>
                            <button onClick={() => handleEditHistory(h)} className="rounded-md border border-slate-200 p-1.5 text-blue-600 hover:border-blue-300 hover:bg-blue-50" title="Edit Entry"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDeleteHistory(h)} disabled={savingNewLoading} className="rounded-md border border-slate-200 p-1.5 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50" title="Delete Entry"><Trash2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => window.open(`/dashboard/purchase/purchase-loading-records/${h.id}?print=true`, "_blank")} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-slate-300 hover:bg-slate-50" title="Print"><Printer className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">No saved loading records yet. Click New Loading to create the first BL/container entry.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Loading History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/50 dark:bg-slate-900/20">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 w-10 text-center">Action</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 w-10">SR#</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">BL Number</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500">Vessel Name</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Load Qty</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Purchase Payment</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Exchange Rate</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Final Payment ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Advance Paid ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Balance Remaining ({localCurrency})</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Loading Port</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Load Date</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Receive Port</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Receive Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {history.map((h, i) => {
                      const poRow = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders) || {};
                      const finance = calcLoadingFinance(h, poRow, form);
                      const { amountUSD, exRate, amountPKR, currency } = finance;
                      return (
                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="px-6 py-3 text-center flex items-center justify-center gap-1">
                            <button onClick={() => handleEditHistory(h)} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition" title="Edit Entry">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteHistory(h)} disabled={savingNewLoading} className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition disabled:opacity-50" title="Delete Entry">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => window.open(`/dashboard/purchase/purchase-loading-records/${h.id}?print=true`, "_blank")} 
                              className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-50 transition" 
                              title="Print Loading Slip"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => window.open(`/dashboard/purchase/purchase-loading-records/${h.id}?print=true`, "_blank")} 
                              className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50 transition" 
                              title="Export PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            {h.report_payload?.loadedQuantity && (
                              <button 
                                onClick={() => {
                                  const poRow = (Array.isArray(record.purchase_orders) ? record.purchase_orders[0] : record.purchase_orders) || {};
                                  const finance = calcLoadingFinance(h, poRow, form);
                                  const loadedQty = h.report_payload?.loadedQuantity || h.loadedQuantity || 0;
                                  const grossWeight = h.report_payload?.grossWeight || 0;
                                  const netWeight = h.report_payload?.netWeight || 0;
                                  const priceRate = h.report_payload?.priceRateC1 || 0;
                                  
                                  const poAdvanceAmt = normalizeAdvanceToPurchaseCurrency(Number(poRow.advance_paid || form.advanceAmount || 0), contractPurchaseAmount, finance.exRate || 1);
                                  const loadedAdvanceUSD = Math.min(finance.amountUSD, totalQuantity > 0 ? (loadedQty / totalQuantity) * poAdvanceAmt : poAdvanceAmt);
                                  const loadedRemainingUSD = Math.max(0, finance.amountUSD - loadedAdvanceUSD);
                                  const exchangeRate = finance.exRate || 1;
                                  
                                  const queryParams = new URLSearchParams({
                                    purchaseOrderNo: record.purchase_order_no || "",
                                    fromLoading: "true",
                                    loadingRecordId: h.id,
                                    loadedQty: String(loadedQty),
                                    grossWeight: String(grossWeight),
                                    netWeight: String(netWeight),
                                    priceRate: String(priceRate),
                                    purchaseAmount: String(finance.amountUSD),
                                    loadedPurchaseAmount: String(finance.amountUSD),
                                    finalAmount: String(finance.amountUSD * exchangeRate),
                                    advanceApplied: String(loadedAdvanceUSD),
                                    advanceAppliedLocal: String(loadedAdvanceUSD * exchangeRate),
                                    remainingBalance: String(loadedRemainingUSD),
                                    remainingBalanceLocal: String(loadedRemainingUSD * exchangeRate),
                                    amount: String(loadedRemainingUSD),
                                    exchangeRate: String(exchangeRate),
                                    currency: finance.currency || "USD",
                                    amountPKR: String(loadedRemainingUSD * exchangeRate)
                                  }).toString();
                                  window.open(`/dashboard/journal/purchase-order-payment/remaining?${queryParams}`, "_self");
                                }}
                                className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50 transition"
                                title="Transfer Remaining Balance to Payment Journal"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-3 font-medium text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                          <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">{h.report_payload?.blNumber || "-"}</td>
                          <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">{h.carrier_name || h.report_payload?.vesselName || "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-slate-600 dark:text-slate-300 text-right">{h.report_payload?.loadedQuantity || h.loadedQuantity || "-"}</td>
                          <td className="px-6 py-3 font-mono font-bold text-slate-750 dark:text-slate-300 text-right">{amountUSD > 0 ? `${amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : "-"}</td>
                          <td className="px-6 py-3 font-mono text-slate-600 dark:text-slate-400 text-right">{exRate > 0 ? exRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"}</td>
                          <td className="px-6 py-3 font-mono font-black text-emerald-650 dark:text-emerald-400 text-right">{amountPKR > 0 ? `${amountPKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${localCurrency}` : "-"}</td>
                          <td className="px-6 py-3 font-mono font-bold text-amber-600 dark:text-amber-400 text-right">
                            {(() => {
                              const poAdvanceAmt = normalizeAdvanceToPurchaseCurrency(Number(poRow.advance_paid || form.advanceAmount || 0), contractPurchaseAmount, exRate || 1);
                              const loadedAdvanceUSD = (finance.proRataRatio || 0) * poAdvanceAmt;
                              const loadedAdvanceLocal = Math.min(loadedAdvanceUSD * exRate, Math.max(0, amountPKR));
                              return loadedAdvanceLocal > 0 ? `${loadedAdvanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${localCurrency}` : "-";
                            })()}
                          </td>
                          <td className="px-6 py-3 font-mono font-black text-rose-700 dark:text-rose-500 text-right">
                            {(() => {
                              const poAdvanceAmt = normalizeAdvanceToPurchaseCurrency(Number(poRow.advance_paid || form.advanceAmount || 0), contractPurchaseAmount, exRate || 1);
                              const loadedAdvanceUSD = (finance.proRataRatio || 0) * poAdvanceAmt;
                              const loadedAdvanceLocal = Math.min(loadedAdvanceUSD * exRate, Math.max(0, amountPKR));
                              const loadedBalanceLocal = Math.max(0, amountPKR - loadedAdvanceLocal);
                              return loadedBalanceLocal !== 0 ? `${loadedBalanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${localCurrency}` : "-";
                            })()}
                          </td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{h.report_payload?.loadingPort || h.loading_location || "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">{h.report_payload?.loadingDate ? new Date(h.report_payload.loadingDate).toLocaleDateString() : (h.loaded_at ? new Date(h.loaded_at).toLocaleDateString() : "-")}</td>
                          <td className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">{h.report_payload?.receivingPort || h.receiving_location || "-"}</td>
                          <td className="px-6 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{h.report_payload?.receivingDate ? new Date(h.report_payload.receivingDate).toLocaleDateString() : "-"}</td>
                        </tr>
                      );
                   })}
                   {history.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-6 py-6 text-center font-medium text-slate-500">No loading history found.</td>
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
type LoadingRecord = {
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
  countries?: { name?: string | null; iso2?: string | null } | null;
  country_branches?: { name?: string | null; code?: string | null } | null;
  city_branches?: { name?: string | null; code?: string | null; city_name?: string | null } | null;
  purchase_orders?: { form_data?: any } | null;
  report_payload?: any;
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
  };
  error?: { message?: string } | string;
};

const statusOptions: Array<"all" | LoadingStatus> = ["all", "draft", "pending", "loaded", "received", "cancelled"];
const containerTypes = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Non Reefer"];

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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | LoadingStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(() => emptyForm());
  const [selectedLoadDetailsRecord, setSelectedLoadDetailsRecord] = useState<LoadingRecord | null>(null);

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
      const goods = poData.goodsEntries || [];

      const country = String(r.countries?.name || form.branchCountry || "Unknown Country").trim();
      const branch = String(r.country_branches?.name || form.branchName || "Unassigned Branch").trim();

      const poQty = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || g.quantity || 0), 0) 
        : Number(form.quantity || 0);

      const loadedQty = Number(r.report_payload?.loadedQuantity || r.loadedQuantity || 0);

      const poTotalUSD = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.finalAmount || g.totalAmount || 0), 0) 
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
      const goods = poData.goodsEntries || [];
      const country = String(r.countries?.name || form.branchCountry || "Unknown Country").trim();
      const branch = String(r.country_branches?.name || form.branchName || "Unassigned Branch").trim();

      const poQty = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.qtyNo || g.quantity || 0), 0) 
        : Number(form.quantity || 0);

      const poTotalUSD = goods.length > 0 
        ? goods.reduce((s: number, g: any) => s + Number(g.finalAmount || g.totalAmount || 0), 0) 
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
  }, [query, records, status]);

  async function loadRecords() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/erp/purchases/loading-records?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok || !payload.ok) {
        const error = typeof payload.error === "string" ? payload.error : payload.error?.message;
        throw new Error(error || "Purchase Loading Records could not be loaded.");
      }
      setRecords(payload.data?.records ?? []);
      setSummary(payload.data?.summary ?? { total: 0, loaded: 0, pending: 0, received: 0 });
      setSetupMessage(payload.data?.setupMessage ?? null);
    } catch (error) {
      setRecords([]);
      setSummary({ total: 0, loaded: 0, pending: 0, received: 0 });
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
  }, []);

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
      const goods = poData.goodsEntries || [];

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
          ? goods.reduce((s: number, g: any) => s + Number(g.totalAmount || 0), 0)
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

  return (
    <div className="w-full max-w-none space-y-4 px-2 py-3 text-slate-900 dark:text-slate-100 sm:px-4">
      {selectedLoadDetailsRecord && (
        <LoadDetailsModal record={selectedLoadDetailsRecord} onClose={() => setSelectedLoadDetailsRecord(null)} onSaved={() => void loadRecords()} />
      )}
      {actionsSlot && createPortal(
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <SearchableSelect
            value={selectedInvoicePoNo}
            onChange={(val) => setSelectedInvoicePoNo(val)}
            options={[
              { label: "All Invoices / POs", value: "" },
              ...uniqueInvoiceOptions
            ]}
            placeholder="Select Purchase Invoice / PO..."
            className="w-60 text-xs font-semibold relative z-[45]"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search container / loading no / PO"
              className="h-8 w-52 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>
          <SearchableSelect
            value={status}
            onChange={(val) => setStatus(val as "all" | LoadingStatus)}
            options={statusOptions.map(opt => ({ label: opt === "all" ? "All Status" : opt.toUpperCase(), value: opt }))}
            placeholder="All Status"
            className="w-32 text-xs font-semibold relative z-[45]"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void loadRecords()} disabled={loading} className="h-8 rounded-lg border-slate-200 text-xs font-bold">
            <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
            Apply Filter
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()} className="h-8 rounded-lg border-slate-200 text-xs font-bold">
            <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              if (confirm("Clear all old test loading records and populate 3 fresh test loading entries?")) {
                setLoading(true);
                try {
                  const res = await fetch("/api/erp/purchases/loading-records/reset-test-data", { method: "POST" });
                  const data = await res.json();
                  if (data.ok) {
                    setMessage("Old test records cleared and 3 fresh loading entries created.");
                    await loadRecords();
                  } else {
                    setMessage("Error resetting test data: " + (data.error || "Failed"));
                  }
                } catch (err: any) {
                  setMessage("Error resetting test data: " + err.message);
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="h-8 rounded-lg border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-rose-500" /> Reset Test Data
          </Button>
        </div>,
        actionsSlot
      )}

      {/* Selected Purchase Invoice / Approved Contract Summary Card (Requirement 2) */}
      {activeInvoiceRecord && (() => {
        const poRow = (Array.isArray(activeInvoiceRecord.purchase_orders) ? activeInvoiceRecord.purchase_orders[0] : activeInvoiceRecord.purchase_orders) || {};
        const formData = poRow.form_data || {};
        const form = formData.form || {};
        const goods = formData.goodsEntries || [];
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
                <span className="rounded font-mono font-black text-xs bg-blue-600 text-white px-2.5 py-0.5">SELECTED PO: {activeInvoiceRecord.purchase_order_no}</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Approved Invoice & Contract Details (Read-Only Source of Truth)</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedInvoicePoNo("")} className="h-6 text-[10px] font-bold text-blue-600 hover:text-blue-800">✕ Clear Selection</Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 text-[11px] font-semibold">
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Purchase Code</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{form.purchaseAccountNumber || form.purchaseAccountNo || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Sales Code</span><span className="font-mono font-bold text-slate-800 dark:text-slate-100">{form.salesAccountNumber || form.salesAccountNo || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Supplier</span><span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{form.supplierName || form.purchaseAccountName || "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Company & Branch</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{form.branchName || "Main Branch"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Goods & Brand</span><span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{form.goodsName || form.itemName || "-"} ({form.brand || "-"})</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Contract Qty (Bags)</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{totalPOQty.toLocaleString()}</span></div>
              
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Purchase Rate</span><span className="font-mono font-bold text-blue-600">{finance.priceRate > 0 ? `${finance.priceRate.toLocaleString()} ${finance.currency}` : "-"}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Exchange Rate</span><span className="font-mono font-bold text-blue-600">{finance.exRate}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Total Purchase Amount</span><span className="font-mono font-black text-slate-800 dark:text-slate-100">{poOrderTotalFC.toLocaleString(undefined, {minimumFractionDigits: 2})} {finance.currency}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800"><span className="text-slate-400 block text-[9px] uppercase">Total Advance Paid</span><span className="font-mono font-black text-emerald-600">{poAdvancePaidLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {localCur}</span></div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800 col-span-2"><span className="text-slate-400 block text-[9px] uppercase">Total Remaining Balance</span><span className="font-mono font-black text-rose-600">{poRemainingDueLC.toLocaleString(undefined, {minimumFractionDigits: 2})} {localCur}</span></div>
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
          if (!cName) return '🏳️';
          if (cName.toLowerCase().includes('pakistan')) return '🇵🇰';
          if (cName.toLowerCase().includes('iran')) return '🇮🇷';
          if (cName.toLowerCase().includes('arab emirates') || cName.toLowerCase().includes('uae')) return '🇦🇪';
          if (cName.toLowerCase().includes('afghanistan')) return '🇦🇫';
          if (cName.toLowerCase().includes('india')) return '🇮🇳';
          if (cName.toLowerCase().includes('china')) return '🇨🇳';
          return '🏳️';
        };

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

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
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">1. BRANCH & USER DETAILS</h4>
                </div>
                <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>Country:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">🏳️ All Countries</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Branch Name:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">MAIN BRANCH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>User ID:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">SA001</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>User Name:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">SUPER ADMIN</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Role:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">SUPER ADMIN</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Date & Time:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr}, {timeStr}</span>
                  </div>
                  <div className="flex justify-between items-center mt-auto">
                    <span>Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">Active</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Global Financial Summary */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <div className="bg-emerald-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">2. LOADING SUMMARY (PKR)</h4>
                </div>
                <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>Total Purchase Value:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{formatMoney(totalPurchaseValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Loaded Value:</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatMoney(totalLoadedValue)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-rose-600 dark:text-rose-500 font-bold uppercase">Remaining Value:</span>
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400 truncate">3. ACTIVE OPERATIONS SUMMARY</h4>
                </div>
                <div className="p-4 flex flex-col gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>Total Active Countries:</span>
                    <span className="font-black text-purple-700 dark:text-purple-400 font-mono">{activeCountriesCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Active Branches:</span>
                    <span className="font-black text-purple-700 dark:text-purple-400 font-mono">{activeBranchesCount}</span>
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <span>System Status:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Online</span>
                  </div>
                </div>
              </div>

              {/* Panel 4: Transaction Summary */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
                  <div className="bg-orange-600 p-1 rounded-full text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">4. LOADING QTY SUMMARY</h4>
                </div>
                <div className="p-4 flex flex-col gap-2.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
                  <div className="flex justify-between items-center">
                    <span>Total Loaded Qty:</span>
                    <span className="font-bold text-emerald-600 font-mono">{totalLoadedQty.toLocaleString()} Bags</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Gross Weight:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{totalGrossWeight.toLocaleString()} KG</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Net Weight:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{totalNetWeight.toLocaleString()} KG</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-rose-600 dark:text-rose-500 font-bold uppercase">Total Remaining Qty:</span>
                    <span className="font-black text-rose-700 dark:text-rose-400 font-mono">{totalRemainingQty.toLocaleString()} Bags</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Last Updated:</span>
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
                  All Countries Report Details
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                  {activeCountriesCount} Scoped Countries
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
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Currency</span>
                              <span className="font-black text-slate-800 dark:text-slate-200 text-xs">{r.currency}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Qty</span>
                              <span className="font-black text-slate-800 dark:text-slate-200 font-mono text-[11px]">{totalQty.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Loaded Qty</span>
                              <span className="font-black text-emerald-600 font-mono text-[11px]">{loadedQty.toLocaleString()}</span>
                            </div>
                            <div className="mt-1 flex justify-between items-center border-t border-slate-200 pt-2 dark:border-slate-800">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Remaining Bal. Qty</span>
                              <span className="font-black text-rose-600 dark:text-rose-400 font-mono text-sm">{balQty.toLocaleString()}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between items-center">
                              <span>Branch Breakdown</span>
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
                                      <span className="text-slate-400">Total Qty</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{b.totalQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400">Loaded Qty</span>
                                      <span className="font-bold text-emerald-500 font-mono">{b.loadedQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center col-span-2">
                                      <span className="text-slate-400">Bal. Qty</span>
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
        <Metric label="Total Records" value={summary.total} tone="slate" />
        <Metric label="Loaded" value={summary.loaded} tone="green" />
        <Metric label="Pending" value={summary.pending} tone="amber" />
        <Metric label="Received" value={summary.received} tone="blue" />
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
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Loading Records Report</h2>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide mt-0.5">Independent from Purchase Booking Order unless explicitly linked.</p>
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
                      "Purchase Booking No.",
                      "Sales Account",
                      "Purchase Account",
                      "Goods",
                      "Contract Qty",
                      "Gross Wt",
                      "Tare Wt (Empty)",
                      "Net Wt",
                      "Purchase Price Rate",
                      "Total Purchase Amount (FC)",
                      "Purchase Advance (FC)",
                      "Purchase Remaining (FC)",
                      "Exchange Rate",
                      "Final Amount (LC)",
                      "Final Advance (LC)",
                      "Final Remaining (LC)",
                      "Loaded Qty",
                      "Remaining to Load",
                      "Loading Status",
                      "Action"
                    ].map((head) => (
                      <th key={head} className="whitespace-nowrap px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={24} className="px-3 py-8 text-center text-muted-foreground">
                        Loading records...
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

                      const goods = poRow.form_data?.goodsEntries || [];
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
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-blue-600">
                              <span className="inline-flex items-center gap-1.5">
                                <Link2 className="h-3.5 w-3.5 text-blue-500" />
                                {poNo}
                              </span>
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
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                              {priceRate > 0 ? `${priceRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}` : "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {totalContractAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-amber-600">
                              {purchaseAdvanceUSD > 0 ? `${purchaseAdvanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-rose-600">
                              {purchaseRemainingUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-slate-500">{exRate}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-blue-700 dark:text-blue-300">
                              {finalAmountLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrencyCode}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-amber-600">
                              {finalAdvanceLC > 0 ? `${finalAdvanceLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${localCurrencyCode}` : "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-rose-600">
                              {finalRemainingLC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {localCurrencyCode}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-teal-600 dark:text-teal-400">{totalLoadedQty.toLocaleString()} Bags</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono font-black text-rose-600">{remainingQtyToLoad.toLocaleString()} Bags</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {isFullyLoaded ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm dark:bg-black">
                                  100% Fully Loaded
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
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedLoadDetailsRecord(records[0])}
                                  className="h-7 px-2 text-[10px] font-bold uppercase text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 gap-1 shadow-sm"
                                >
                                  <Plus className="h-3 w-3 text-emerald-600" />
                                  Add Loading
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
                              <td colSpan={24} className="p-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <div className="rounded bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                        <Ship className="h-4 w-4" />
                                      </div>
                                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                        Container Shipment Loading Breakdown for <span className="text-blue-600">{poNo}</span>
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
                                            <th className="px-3 py-2">Loading #</th>
                                            <th className="px-3 py-2">BL Number</th>
                                            <th className="px-3 py-2">Container #</th>
                                            <th className="px-3 py-2">Vessel / Carrier</th>
                                            <th className="px-3 py-2 text-right">Loaded Qty</th>
                                            <th className="px-3 py-2 text-right">Net Wt</th>
                                            <th className="px-3 py-2 text-right">Gross Wt</th>
                                            <th className="px-3 py-2 text-right">Loaded Purchase</th>
                                            <th className="px-3 py-2 text-right">Advance Applied</th>
                                            <th className="px-3 py-2 text-right">Remaining Balance</th>
                                            <th className="px-3 py-2">Loading Route & Date</th>
                                            <th className="px-3 py-2 text-center">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {displayRecords.map((r, childIdx) => {
                                            const payload = r.report_payload || {};
                                            const loadedQty = Number(payload.loadedQuantity || r.loadedQuantity || 0);
                                            const finance = calcLoadingFinance(r, poRow, form);
                                            const blNo = payload.blNumber || "-";
                                            const containerNo = r.container_number || payload.containerNumber || "-";
                                            const vessel = payload.vesselName || r.carrier_name || "-";
                                            const route = [payload.loadingPort || r.loading_location, payload.receivingPort || r.receiving_location].filter(Boolean).join(" ➔ ") || "-";
                                            const loadingDateStr = payload.loadingDate || (r.loaded_at ? new Date(r.loaded_at).toLocaleDateString() : "-");
                                            const poAdvanceAmt = Number(poRow.advance_paid || form.advanceAmount || 0);
                                            const advanceUSD = (finance.proRataRatio || 0) * poAdvanceAmt;
                                            const advanceLocal = Math.min(advanceUSD * finance.exRate, Math.max(0, finance.amountPKR));
                                            const balanceLocal = Math.max(0, (finance.amountPKR || 0) - advanceLocal);
                                            const childCurrency = records[0]?.countries?.currency || form.branchCurrency || "PKR";

                                            return (
                                              <tr key={r.id || childIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="px-3 py-2 font-mono font-bold text-blue-600">{r.loading_record_no}</td>
                                                <td className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-300">{blNo}</td>
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-slate-100">{containerNo}</td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{vessel}</td>
                                                <td className="px-3 py-2 text-right font-mono font-black text-emerald-600">{loadedQty.toLocaleString()} Bags</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{finance.netWeight.toLocaleString()} kg</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{finance.grossWeight.toLocaleString()} kg</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                                                  {finance.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {finance.currency}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-amber-600">
                                                  {advanceLocal > 0 ? `${advanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${childCurrency}` : "-"}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-black text-rose-600">
                                                  {balanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {childCurrency}
                                                </td>
                                                <td className="px-3 py-2 text-[10px]">
                                                  <div className="font-semibold text-slate-700 dark:text-slate-300">{route}</div>
                                                  <div className="text-slate-400 font-mono">{loadingDateStr}</div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      onClick={() => handleInitiateTransfer(r)}
                                                      className="h-6 px-2 text-[9px] font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                                                    >
                                                      Transfer to Journal
                                                    </Button>
                                                    <CustomDropdown record={r} onLoadDetails={setSelectedLoadDetailsRecord} />
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
                                      <p className="text-xs font-semibold text-slate-500">No container shipment loadings created yet for Purchase Booking <span className="font-bold text-blue-600">{poNo}</span>.</p>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setSelectedLoadDetailsRecord(records[0])}
                                        className="h-8 px-4 text-xs font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-sm"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Create First Loading Entry
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
                        No purchase loading records found.
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

function Metric({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "blue" }) {
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



















