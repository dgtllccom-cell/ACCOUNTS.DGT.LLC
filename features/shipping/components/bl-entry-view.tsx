"use client";

import { DownloadActionIcon, PdfActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Edit2,
  Eye,
  FileCheck,
  Mail,
  MoreVertical,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Ship,
  Sparkles,
  SquareArrowOutUpRight,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Th } from "@/components/ui/translated-th";
import { ClearingAgentPicker } from "@/features/shipping/components/clearing-agent-picker";
import { ShippingLinePicker } from "@/features/shipping/components/shipping-line-picker";
import { GoodsPicker, type GoodsPickerValue } from "@/features/goods-master/components/goods-picker";
import { apiGet } from "@/lib/api/client";
import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { VoiceDictateButton } from "@/components/voice-dictate-button";

export type BlGoodsItem = {
  id: string;
  goodsId?: string | null;
  goodsVariationId?: string | null;
  goodsName: string;
  goodsSize: string;
  goodsBrand: string;
  goodsOrigin: string;
  hsCode: string;
  allotName: string;
  warehouseId?: string | null;
  warehouse: string;
  wAccId?: string | null;
  wAcc: string;
  qtyName: string;
  qtyNo: number;
  qtyKgs: number;
  totalGrossWeight: number;
  emptyPerBag: number;
  totalEmptyWeight: number;
  netWeight: number;
  priceType: string;
  divideType: string;
  currency1: string;
  rate1: number;
  op: string;
  currency2: string;
  rate2: number;
  primaryAmount: number;
  finalAmount: number;
  qualityReportStatus: string;
};

type OptionRow = {
  id: string;
  name: string;
  code?: string | null;
  iso2?: string | null;
  iso3?: string | null;
  currency_code?: string | null;
  local_currency?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  city_name?: string | null;
  account_number?: string | null;
  manual_reference_number?: string | null;
  customer_number?: string | null;
  country_serial_number?: string | null;
  branch_serial_number?: string | null;
  account_name?: string | null;
  account_currency?: string | null;
  account_balance?: number | string | null;
  current_balance?: number | string | null;
  currency?: string | null;
};

type ShippingRecord = {
  id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  shipping_line_name: string;
  bl_number: string;
  container_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  loading_port: string | null;
  discharge_port: string | null;
  eta: string | null;
  etd: string | null;
  shipment_status: string;
  account_number: string | null;
  debit: number | string;
  credit: number | string;
  currency_code: string;
  report_payload?: any;
  created_at: string;
  countries?: { name: string; iso2: string | null; currency_code: string } | null;
  country_branches?: { name: string; code: string | null } | null;
  city_branches?: { name: string; code: string | null; city_name: string | null } | null;
  ledgers?: { code: string; name: string; currency: string } | null;
  profiles?: { full_name: string | null } | null;
};

type ShippingData = {
  records: ShippingRecord[];
  filters: {
    countries: OptionRow[];
    countryBranches: OptionRow[];
    cityBranches: OptionRow[];
    ledgers: OptionRow[];
  };
  session: {
    isSuperAdmin: boolean;
    fullName: string | null;
    roles: string[];
  };
};

const BL_CACHE_MS = 1000 * 60 * 3;
const blDataCache = new Map<string, { data: ShippingData; cachedAt: number }>();

const emptyForm = {
  id: "",
  countryId: "",
  countryBranchId: "",
  cityBranchId: "",
  ledgerId: "",
  shippingLineId: "",
  shippingLineName: "",
  clearingAgentId: "",
  blNumber: "",
  containerNumber: "",
  vesselName: "",
  voyageNumber: "",
  loadingPort: "",
  dischargePort: "",
  eta: todayIso(),
  etd: todayIso(),
  shipmentStatus: "draft",
  purchaseConfirmationStatus: "Confirmed",
  loadingStatus: "Completed",
  accountNumber: "",
  debit: "0",
  credit: "0",
  currencyCode: "USD",
  supplierCustomer: "",
  deliveryStatus: "Pending",
  customerAccountNo: "",
  shippingType: "By Sea",
  shipmentType: "Import",
  importer: "",
  exporter: "",
  notifyParty: "",
  bookingNo: "",
  bookingCompanyType: "Shipping Line",
  bookingCompanyName: "",
  bookingDate: todayIso(),
  issueDate: todayIso(),
  issueSerial: "",
  blType: "New BL",
  routeCountry: "PK / UAE",
  loadingCountry: "",
  receivingCountry: "",
  loadDate: todayIso(),
  receiveDate: todayIso(),
  containerType: "Dry Container 20FT",
  containerName: "",
  sealNumber: "",
  dischargeVessel: "",
  dischargeDate: todayIso(),
  carrierRemarks: ""
};

const emptyDraftGoods = {
  goodsId: "",
  goodsVariationId: "",
  goodsChsCode: "",
  goodsOriginCountryId: "",
  goodsName: "",
  goodsSize: "",
  goodsBrand: "",
  goodsOrigin: "",
  hsCode: "",
  allotName: "",
  warehouseId: "",
  warehouse: "",
  wAccId: "",
  wAcc: "",
  qtyName: "BAGS",
  qtyNo: "100",
  qtyKgs: "50",
  emptyPerBag: "0.10",
  priceType: "P/KGs",
  divideType: "D/KGs",
  currency1: "USD",
  rate1: "12.50",
  op: "*",
  currency2: "PKR",
  rate2: "280.00",
  qualityReportStatus: "Passed"
};

export function calculateBlGoodsItem(draft: {
  qtyNo: number | string;
  qtyKgs: number | string;
  emptyPerBag: number | string;
  priceType: string;
  divideType: string;
  currency1: string;
  rate1: number | string;
  op: string;
  currency2: string;
  rate2: number | string;
}) {
  const qtyNo = Math.max(0, Number(draft.qtyNo) || 0);
  const qtyKgs = Math.max(0, Number(draft.qtyKgs) || 0);
  const emptyKgs = Math.max(0, Number(draft.emptyPerBag) || 0);
  const rate1 = Math.max(0, Number(draft.rate1) || 0);
  const rate2 = Math.max(0, Number(draft.rate2) || 0);
  const op = draft.op === "/" ? "/" : "*";

  // Total Gross KGS
  const totalGrossWeight = qtyNo > 0 ? qtyNo * qtyKgs : qtyKgs;

  // Total Empty Packing Weight
  const totalEmptyWeight = qtyNo > 0 ? qtyNo * emptyKgs : emptyKgs;

  // Net Weight = Gross - Empty
  const netWeight = Math.max(0, totalGrossWeight - totalEmptyWeight);

  // Tons
  const tons = netWeight / 1000;

  // Primary Amount based on Price Type & Divide Type
  let primaryAmount = 0;
  if (draft.priceType === "P/TON") {
    primaryAmount = tons * rate1;
  } else if (draft.priceType === "P/BAG" || draft.priceType === "P/ITEM") {
    primaryAmount = qtyNo * rate1;
  } else {
    // Default P/KGs
    if (draft.divideType === "D/TON") {
      primaryAmount = tons * rate1;
    } else {
      primaryAmount = netWeight * rate1;
    }
  }

  // Currency conversion (historical rate, executed once)
  let finalAmount = 0;
  if (op === "/") {
    finalAmount = rate2 > 0 ? primaryAmount / rate2 : 0;
  } else {
    finalAmount = rate2 > 0 ? primaryAmount * rate2 : primaryAmount;
  }

  return {
    totalGrossWeight: roundPrecision(totalGrossWeight, 2),
    totalEmptyWeight: roundPrecision(totalEmptyWeight, 2),
    netWeight: roundPrecision(netWeight, 2),
    tons: roundPrecision(tons, 3),
    primaryAmount: roundPrecision(primaryAmount, 2),
    finalAmount: roundPrecision(finalAmount, 2)
  };
}

function roundPrecision(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function money(value: number | string | null | undefined, maxDec = 2) {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: maxDec });
}

function toOption(row: OptionRow, extra = ""): SearchSelectOption {
  const label = row.code ? `${row.name} (${row.code})` : row.name;
  return {
    value: row.id,
    label,
    keywords: [row.name, row.code, row.iso2, row.iso3, row.currency_code, row.local_currency, row.city_name, extra].filter(Boolean).join(" ")
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BlEntryView({
  context = "shipping",
  initialRecord = null,
  onBack
}: {
  context?: "shipping" | "purchase";
  initialRecord?: any;
  onBack?: () => void;
}) {
  const lang = useActiveLanguage() || "en";
  const _ = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const moduleEyebrow = context === "shipping" ? _("ble.eyebrow_shipping", "Shipping Line / B/L Entry") : _("ble.eyebrow_purchase", "Purchase Workflow / B/L");

  const [data, setData] = useState<ShippingData | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [goodsItems, setGoodsItems] = useState<BlGoodsItem[]>([]);
  const [draftGoods, setDraftGoods] = useState(emptyDraftGoods);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [activeRowMenuIdx, setActiveRowMenuIdx] = useState<number | null>(null);
  const [qualityModalItem, setQualityModalItem] = useState<BlGoodsItem | null>(null);
  const [viewDetailsItem, setViewDetailsItem] = useState<BlGoodsItem | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(3); // default step 3 (Goods Entry) as in reference screenshot
  const didRunInitialSearch = useRef(false);
  const intake = useIntakeDraft("shipping_bl_records");

  // Load warehouses from database
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const res = await apiGet<{ warehouses: any[] }>("/api/erp/warehouses?limit=500");
        if (Array.isArray(res?.warehouses)) {
          setWarehouses(
            res.warehouses.map((w: any) => ({
              id: w.id,
              name: w.name || w.warehouse_name,
              code: w.code || w.warehouse_code
            }))
          );
        }
      } catch {
        // Fallback gracefully
      }
    }
    void fetchWarehouses();
  }, []);

  // Hydrate initial record when editing an existing BL
  useEffect(() => {
    if (!initialRecord) return;
    const r = initialRecord;
    const payload = r.report_payload || {};
    setForm({
      id: r.id || "",
      countryId: r.country_id || "",
      countryBranchId: r.country_branch_id || "",
      cityBranchId: r.city_branch_id || "",
      ledgerId: r.ledger_id || "",
      shippingLineId: r.shipping_line_id || "",
      shippingLineName: r.shipping_line_name || "",
      clearingAgentId: r.clearing_agent_id || "",
      blNumber: r.bl_number || "",
      containerNumber: r.container_number || "",
      vesselName: r.vessel_name || "",
      voyageNumber: r.voyage_number || "",
      loadingPort: r.loading_port || "",
      dischargePort: r.discharge_port || "",
      eta: r.eta ? r.eta.slice(0, 10) : todayIso(),
      etd: r.etd ? r.etd.slice(0, 10) : todayIso(),
      shipmentStatus: r.shipment_status || "draft",
      purchaseConfirmationStatus: payload.purchaseConfirmationStatus || "Confirmed",
      loadingStatus: payload.loadingStatus || "Completed",
      accountNumber: r.account_number || "",
      debit: String(r.debit ?? 0),
      credit: String(r.credit ?? 0),
      currencyCode: r.currency_code || "USD",
      supplierCustomer: payload.supplierCustomer || "",
      deliveryStatus: payload.deliveryStatus || "Pending",
      customerAccountNo: payload.customerAccountNo || "",
      shippingType: payload.shippingType || "By Sea",
      shipmentType: payload.shipmentType || "Import",
      importer: payload.importer || r.importer || "",
      exporter: payload.exporter || r.exporter || "",
      notifyParty: payload.notifyParty || r.notifyParty || "",
      bookingNo: payload.booking?.bookingNo || "",
      bookingCompanyType: payload.booking?.bookingCompanyType || "Shipping Line",
      bookingCompanyName: payload.booking?.bookingCompanyName || "",
      bookingDate: payload.booking?.bookingDate ? payload.booking.bookingDate.slice(0, 10) : todayIso(),
      issueDate: payload.booking?.issueDate ? payload.booking.issueDate.slice(0, 10) : todayIso(),
      issueSerial: payload.booking?.issueSerial || `ISS-${r.bl_number || ""}`,
      blType: payload.booking?.blType || "Edit BL",
      routeCountry: payload.booking?.routeCountry || "PK / UAE",
      loadingCountry: payload.booking?.loadingCountry || "",
      receivingCountry: payload.booking?.receivingCountry || "",
      loadDate: payload.booking?.loadDate ? payload.booking.loadDate.slice(0, 10) : todayIso(),
      receiveDate: payload.booking?.receiveDate ? payload.booking.receiveDate.slice(0, 10) : todayIso(),
      containerType: payload.containerLoading?.containerType || "Dry Container 20FT",
      containerName: payload.containerLoading?.containerName || "",
      sealNumber: payload.containerLoading?.sealNumber || "",
      dischargeVessel: payload.containerLoading?.dischargeVessel || r.vessel_name || "",
      dischargeDate: payload.containerLoading?.dischargeDate ? payload.containerLoading.dischargeDate.slice(0, 10) : todayIso(),
      carrierRemarks: payload.carrierRemarks || ""
    });

    if (Array.isArray(payload.goodsItems) && payload.goodsItems.length > 0) {
      setGoodsItems(payload.goodsItems);
    }
  }, [initialRecord]);

  // Overlay AI-extracted values from Intake Draft
  useEffect(() => {
    if (!intake.draft) return;
    const p = intake.payload;
    setForm((current) => {
      const next = { ...current };
      if (p.blNumber) next.blNumber = String(p.blNumber);
      if (p.bookingNumber) next.bookingNo = String(p.bookingNumber);
      if (p.vesselName) {
        next.vesselName = String(p.vesselName);
        next.dischargeVessel = String(p.vesselName);
      }
      if (p.voyageNumber) next.voyageNumber = String(p.voyageNumber);
      if (p.portOfLoading) next.loadingPort = String(p.portOfLoading);
      if (p.portOfDischarge) next.dischargePort = String(p.portOfDischarge);
      if (p.shippingLineName) next.shippingLineName = String(p.shippingLineName);
      if (p.shipperName) next.exporter = String(p.shipperName);
      if (p.consigneeName) next.importer = String(p.consigneeName);
      if (p.blDate) next.issueDate = String(p.blDate);
      if (p.eta) next.eta = String(p.eta);
      if (p.etd) next.etd = String(p.etd);
      if (p.containerNumbers) next.containerNumber = Array.isArray(p.containerNumbers) ? p.containerNumbers.filter(Boolean).join(", ") : String(p.containerNumbers);
      if (p.sealNumbers) next.sealNumber = Array.isArray(p.sealNumbers) ? p.sealNumbers.filter(Boolean).join(", ") : String(p.sealNumbers);
      return next;
    });
  }, [intake.draft]);

  async function loadRecords(nextQuery = query, options: { force?: boolean } = {}) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (form.countryId) params.set("countryId", form.countryId);
      if (form.countryBranchId) params.set("countryBranchId", form.countryBranchId);
      if (form.cityBranchId) params.set("cityBranchId", form.cityBranchId);
      const cacheKey = params.toString();
      const cached = blDataCache.get(cacheKey);
      if (!options.force && cached && Date.now() - cached.cachedAt < BL_CACHE_MS) {
        setData(cached.data);
        setMessage("");
        return;
      }

      const res = await fetch(`/api/erp/shipping/bl-records?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? _("ble.err_load", "Unable to load B/L records"));
      blDataCache.set(cacheKey, { data: json.data, cachedAt: Date.now() });
      setData(json.data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : _("ble.err_load", "Unable to load B/L records"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords("");
  }, []);

  useEffect(() => {
    if (!didRunInitialSearch.current) {
      didRunInitialSearch.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      void loadRecords(query);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const countries = data?.filters.countries ?? [];
  const countryBranches = data?.filters.countryBranches ?? [];
  const cityBranches = data?.filters.cityBranches ?? [];
  const ledgers = data?.filters.ledgers ?? [];

  const selectedCountry = countries.find((row) => row.id === form.countryId) ?? null;
  const selectedMainBranch = countryBranches.find((row) => row.id === form.countryBranchId) ?? null;
  const selectedCityBranch = cityBranches.find((row) => row.id === form.cityBranchId) ?? null;
  const selectedLedger = ledgers.find((row) => row.id === form.ledgerId) ?? null;

  // Live item draft calculations
  const liveDraftCalc = useMemo(() => calculateBlGoodsItem(draftGoods), [draftGoods]);

  // Grand totals across all container items
  const grandTotals = useMemo(() => {
    const totalKgs = goodsItems.reduce((acc, it) => acc + (Number(it.totalGrossWeight) || 0), 0);
    const netWeight = goodsItems.reduce((acc, it) => acc + (Number(it.netWeight) || 0), 0);
    const finalAmount = goodsItems.reduce((acc, it) => acc + (Number(it.finalAmount) || 0), 0);
    const currency = goodsItems[0]?.currency2 || draftGoods.currency2 || form.currencyCode || "PKR";
    return {
      totalKgs: roundPrecision(totalKgs, 2),
      netWeight: roundPrecision(netWeight, 2),
      finalAmount: roundPrecision(finalAmount, 2),
      currency
    };
  }, [goodsItems, draftGoods.currency2, form.currencyCode]);

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "vesselName") {
        next.dischargeVessel = value;
      } else if (field === "dischargeVessel") {
        next.vesselName = value;
      }
      return next;
    });
  }

  function updateDraftGoods(field: keyof typeof emptyDraftGoods, value: string) {
    setDraftGoods((current) => ({ ...current, [field]: value }));
    setErrorMessage("");
  }

  // Handle Add or Update Item in Goods Container Report
  function handleSubmitGoodsItem() {
    setErrorMessage("");
    if (!draftGoods.goodsName.trim()) {
      setErrorMessage(_("ble.err_select_good", "Please select a good item."));
      return;
    }
    const qtyNo = Number(draftGoods.qtyNo) || 0;
    const qtyKgs = Number(draftGoods.qtyKgs) || 0;
    if (qtyNo <= 0 || qtyKgs <= 0) {
      setErrorMessage(_("ble.err_invalid_qty", "Quantity No and Quantity KGS must be greater than zero."));
      return;
    }

    const calc = calculateBlGoodsItem(draftGoods);
    if (calc.netWeight < 0) {
      setErrorMessage(_("ble.err_negative_net_weight", "Net weight cannot be negative. Empty packing weight exceeds total weight."));
      return;
    }

    // Check duplicate
    const isDuplicate = goodsItems.some((item, idx) => {
      if (editingIdx !== null && idx === editingIdx) return false;
      return (
        item.goodsName.trim().toLowerCase() === draftGoods.goodsName.trim().toLowerCase() &&
        (item.allotName || "").trim().toLowerCase() === (draftGoods.allotName || "").trim().toLowerCase() &&
        (item.warehouse || "").trim().toLowerCase() === (draftGoods.warehouse || "").trim().toLowerCase()
      );
    });

    if (isDuplicate) {
      setErrorMessage(_("ble.err_duplicate_good", "This good is already added to the container report."));
      return;
    }

    const newItem: BlGoodsItem = {
      id: editingIdx !== null ? goodsItems[editingIdx].id : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      goodsId: draftGoods.goodsId || null,
      goodsVariationId: draftGoods.goodsVariationId || null,
      goodsName: draftGoods.goodsName.trim(),
      goodsSize: draftGoods.goodsSize.trim(),
      goodsBrand: draftGoods.goodsBrand.trim(),
      goodsOrigin: draftGoods.goodsOrigin.trim(),
      hsCode: draftGoods.hsCode.trim(),
      allotName: draftGoods.allotName.trim(),
      warehouseId: draftGoods.warehouseId || null,
      warehouse: draftGoods.warehouse.trim(),
      wAccId: draftGoods.wAccId || null,
      wAcc: draftGoods.wAcc.trim(),
      qtyName: draftGoods.qtyName || "BAGS",
      qtyNo,
      qtyKgs,
      totalGrossWeight: calc.totalGrossWeight,
      emptyPerBag: Number(draftGoods.emptyPerBag) || 0,
      totalEmptyWeight: calc.totalEmptyWeight,
      netWeight: calc.netWeight,
      priceType: draftGoods.priceType,
      divideType: draftGoods.divideType,
      currency1: draftGoods.currency1,
      rate1: Number(draftGoods.rate1) || 0,
      op: draftGoods.op,
      currency2: draftGoods.currency2,
      rate2: Number(draftGoods.rate2) || 0,
      primaryAmount: calc.primaryAmount,
      finalAmount: calc.finalAmount,
      qualityReportStatus: draftGoods.qualityReportStatus || "Passed"
    };

    if (editingIdx !== null) {
      setGoodsItems((prev) => {
        const next = [...prev];
        next[editingIdx] = newItem;
        return next;
      });
      setEditingIdx(null);
    } else {
      setGoodsItems((prev) => [...prev, newItem]);
    }

    // Reset draft fields for next item entry
    setDraftGoods((prev) => ({
      ...emptyDraftGoods,
      currency1: prev.currency1,
      rate1: prev.rate1,
      currency2: prev.currency2,
      rate2: prev.rate2,
      priceType: prev.priceType,
      divideType: prev.divideType
    }));
    setActiveRowMenuIdx(null);
  }

  function handleEditItem(idx: number) {
    const item = goodsItems[idx];
    if (!item) return;
    setDraftGoods({
      goodsId: item.goodsId || "",
      goodsVariationId: item.goodsVariationId || "",
      goodsChsCode: "",
      goodsOriginCountryId: "",
      goodsName: item.goodsName,
      goodsSize: item.goodsSize,
      goodsBrand: item.goodsBrand,
      goodsOrigin: item.goodsOrigin,
      hsCode: item.hsCode,
      allotName: item.allotName,
      warehouseId: item.warehouseId || "",
      warehouse: item.warehouse,
      wAccId: item.wAccId || "",
      wAcc: item.wAcc,
      qtyName: item.qtyName,
      qtyNo: String(item.qtyNo),
      qtyKgs: String(item.qtyKgs),
      emptyPerBag: String(item.emptyPerBag),
      priceType: item.priceType,
      divideType: item.divideType,
      currency1: item.currency1,
      rate1: String(item.rate1),
      op: item.op,
      currency2: item.currency2,
      rate2: String(item.rate2),
      qualityReportStatus: item.qualityReportStatus || "Passed"
    });
    setEditingIdx(idx);
    setActiveStep(3);
    setActiveRowMenuIdx(null);
  }

  function handleDeleteItem(idx: number) {
    if (!confirm(_("ble.confirm_delete_item", "Are you sure you want to remove this item from the container report?"))) return;
    setGoodsItems((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
      setDraftGoods(emptyDraftGoods);
    }
    setActiveRowMenuIdx(null);
  }

  function handleClearAllGoods() {
    if (!confirm(_("ble.clear_all_confirm", "Clear all entered B/L data on this form? This cannot be undone."))) return;
    setGoodsItems([]);
    setDraftGoods(emptyDraftGoods);
    setEditingIdx(null);
  }

  function handleClearBl() {
    if (!confirm(_("ble.clear_all_confirm", "Clear all entered B/L data on this form? This cannot be undone."))) return;
    setForm((current) => ({
      ...emptyForm,
      countryId: current.countryId,
      countryBranchId: current.countryBranchId,
      cityBranchId: current.cityBranchId,
      currencyCode: current.currencyCode
    }));
    setGoodsItems([]);
    setDraftGoods(emptyDraftGoods);
    setEditingIdx(null);
  }

  async function saveRecord() {
    setErrorMessage("");
    if (form.eta && form.etd && new Date(form.eta).getTime() < new Date(form.etd).getTime()) {
      setErrorMessage(_("ble.err_eta_etd", "ETA (Arrival Date) must be on or after ETD (Departure Date)"));
      return;
    }
    if (!form.importer.trim()) {
      setErrorMessage(_("ble.err_importer", "Please enter or select a valid Importer."));
      return;
    }
    if (!form.exporter.trim()) {
      setErrorMessage(_("ble.err_exporter", "Please enter or select a valid Exporter."));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const isEdit = Boolean(form.id);
      const url = "/api/erp/shipping/bl-records";
      const method = isEdit ? "PATCH" : "POST";

      const payloadBody: any = {
        countryId: form.countryId || null,
        countryBranchId: form.countryBranchId || null,
        cityBranchId: form.cityBranchId || null,
        ledgerId: form.ledgerId || null,
        shippingLineId: form.shippingLineId || null,
        shippingLineName: form.shippingLineName,
        clearingAgentId: form.clearingAgentId || null,
        blNumber: form.blNumber || `BL-${Date.now().toString().slice(-6)}`,
        containerNumber: form.containerNumber || null,
        vesselName: form.vesselName || null,
        voyageNumber: form.voyageNumber || null,
        loadingPort: form.loadingPort || null,
        dischargePort: form.dischargePort || null,
        eta: form.eta || null,
        etd: form.etd || null,
        shipmentStatus: form.shipmentStatus,
        accountNumber: form.accountNumber || null,
        debit: grandTotals.finalAmount || Number(form.debit || 0),
        credit: Number(form.credit || 0),
        currencyCode: grandTotals.currency || form.currencyCode || "USD",
        importer: form.importer,
        exporter: form.exporter,
        notifyParty: form.notifyParty || null,
        remarks: form.carrierRemarks || null,
        reportPayload: {
          supplierCustomer: form.supplierCustomer,
          deliveryStatus: form.deliveryStatus,
          customerAccountNo: form.customerAccountNo,
          shippingType: form.shippingType,
          shipmentType: form.shipmentType,
          purchaseConfirmationStatus: form.purchaseConfirmationStatus,
          loadingStatus: form.loadingStatus,
          booking: {
            bookingNo: form.bookingNo,
            bookingCompanyType: form.bookingCompanyType,
            bookingCompanyName: form.bookingCompanyName,
            bookingDate: form.bookingDate,
            issueDate: form.issueDate,
            issueSerial: form.issueSerial,
            blType: form.blType,
            routeCountry: form.routeCountry,
            loadingCountry: form.loadingCountry,
            receivingCountry: form.receivingCountry,
            loadDate: form.loadDate,
            receiveDate: form.receiveDate
          },
          goodsItems,
          totalGrossWeight: grandTotals.totalKgs,
          netWeight: grandTotals.netWeight,
          grandFinalAmount: grandTotals.finalAmount,
          currency: grandTotals.currency,
          containerLoading: {
            containerType: form.containerType,
            containerName: form.containerName,
            sealNumber: form.sealNumber,
            dischargeVessel: form.dischargeVessel,
            dischargeDate: form.dischargeDate,
            carrierRemarks: form.carrierRemarks
          }
        }
      };

      if (isEdit) {
        payloadBody.id = form.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? _("ble.err_save", "Unable to save B/L record"));

      if (json.data?.recordId && intake.draft) await intake.consume(String(json.data.recordId));
      setMessage(`${_("ble.generated_bl_msg", "Generated B/L:")} ${json.data?.blNumber || form.blNumber}`);
      await loadRecords("", { force: true });
      if (onBack) onBack();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : _("ble.err_save", "Unable to save B/L record"));
    } finally {
      setSaving(false);
    }
  }

  // Print full live B/L Goods Container Report
  async function handlePrintReport() {
    setMenuOpen(false);
    const win = window.open("", "_blank");
    if (!win) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${isRtl ? "rtl" : "ltr"}" lang="${lang}">
      <head>
        <meta charset="utf-8">
        <title>${_("ble.lbl_goods_container_report", "Goods Container Report")} - ${form.blNumber || "BL"}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 10px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 18px; font-weight: 900; color: #0369a1; text-transform: uppercase; }
          .subtitle { font-size: 10px; color: #64748b; }
          .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
          .card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #f8fafc; }
          .card-title { font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px dotted #cbd5e1; }
          .line { display: flex; justify-content: space-between; font-size: 9.5px; margin-bottom: 2px; }
          .line span:first-child { color: #64748b; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5px; }
          th { background: #0f172a; color: #ffffff; padding: 5px 6px; text-align: left; font-weight: 800; border: 1px solid #334155; }
          td { padding: 5px 6px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .num { text-align: right; font-variant-numeric: tabular-nums; }
          .net { color: #d97706; font-weight: 800; }
          .empty { color: #e11d48; }
          .total-bar { display: flex; justify-content: flex-end; gap: 24px; margin-top: 12px; padding: 8px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; font-size: 11px; }
          .total-item { text-align: right; }
          .total-label { font-size: 9px; text-transform: uppercase; color: #0369a1; font-weight: 800; }
          .total-val { font-size: 13px; font-weight: 900; }
          .grand-amount { color: #0284c7; font-size: 15px; }
          .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; }
          .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: bold; font-size: 10px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${_("ble.lbl_live_bl_report", "Live BL Report")} | ${_("ble.lbl_goods_container_report", "Goods Container Report")}</div>
            <div class="subtitle">${_("ble.lbl_tracking_doc", "Tracking & Documentation")} | Issue Date: ${form.issueDate} | B/L No: ${form.blNumber || "-"}</div>
          </div>
          <div style="text-align: right;">
            <b>ACCOUNTS.DGT.LLC</b><br>
            <span style="color: #64748b;">${form.routeCountry || "Corridor Route"}</span>
          </div>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-title">${_("ble.lbl_bl_details", "BL Details")}</div>
            <div class="line"><span>MODE:</span> <span>${form.blType}</span></div>
            <div class="line"><span>BL NO:</span> <span>${form.blNumber || "-"}</span></div>
            <div class="line"><span>ISSUE DATE:</span> <span>${form.issueDate}</span></div>
            <div class="line"><span>SERIAL:</span> <span>${form.issueSerial || "-"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">${_("ble.section_route", "Transport / Route")}</div>
            <div class="line"><span>VESSEL:</span> <span>${form.vesselName || "-"}</span></div>
            <div class="line"><span>VOYAGE:</span> <span>${form.voyageNumber || "-"}</span></div>
            <div class="line"><span>LOADING:</span> <span>${form.loadingPort || "-"}</span></div>
            <div class="line"><span>DISCHARGE:</span> <span>${form.dischargePort || "-"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">${_("ble.lbl_truck_details", "Truck Details")}</div>
            <div class="line"><span>TRUCK/CONTAINER:</span> <span>${form.containerNumber || "-"}</span></div>
            <div class="line"><span>SEAL NO:</span> <span>${form.sealNumber || "-"}</span></div>
            <div class="line"><span>TYPE:</span> <span>${form.containerType}</span></div>
            <div class="line"><span>LINE:</span> <span>${form.shippingLineName || "-"}</span></div>
          </div>
          <div class="card">
            <div class="card-title">${_("ble.lbl_parties", "Parties")}</div>
            <div class="line"><span>IMPORTER:</span> <span>${form.importer || "-"}</span></div>
            <div class="line"><span>EXPORTER:</span> <span>${form.exporter || "-"}</span></div>
            <div class="line"><span>NOTIFY:</span> <span>${form.notifyParty || "Not Assigned"}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${_("ble.gt_good_name", "Good Name")}</th>
              <th>${_("ble.lbl_size", "Size")}</th>
              <th>${_("ble.lbl_brand", "Brand")}</th>
              <th>${_("ble.lbl_origin", "Origin")}</th>
              <th>${_("ble.lbl_hs_code", "HS Code")}</th>
              <th>${_("ble.lbl_allot_name", "Allot Name")}</th>
              <th>${_("ble.lbl_warehouse", "Warehouse")}</th>
              <th>${_("ble.lbl_qty_name", "Qty Name")}</th>
              <th class="num">${_("ble.gt_qty_no", "Qty No")}</th>
              <th class="num">${_("ble.gt_total_gross_kg", "Total Gross KG")}</th>
              <th class="num">${_("ble.lbl_empty_per_bag", "Empty/Bag KG")}</th>
              <th class="num">${_("ble.gt_net_weight_kg", "Net Weight KG")}</th>
              <th>${_("ble.lbl_price_type", "Price Type")}</th>
              <th>${_("ble.lbl_divide_type", "Divide Type")}</th>
              <th>${_("ble.lbl_primary_cur", "Primary Cur")}</th>
              <th>${_("ble.lbl_op", "OP")}</th>
              <th>${_("ble.lbl_secondary_cur", "Secondary Cur")}</th>
              <th class="num">${_("ble.lbl_final_amount", "Final Amount")}</th>
            </tr>
          </thead>
          <tbody>
            ${
              goodsItems.length === 0
                ? `<tr><td colspan="19" style="text-align: center; padding: 20px; color: #94a3b8;">No items in container report.</td></tr>`
                : goodsItems
                    .map(
                      (item, i) => `
                <tr>
                  <td>${String(i + 1).padStart(2, "0")}</td>
                  <td><b>${item.goodsName}</b></td>
                  <td>${item.goodsSize || "-"}</td>
                  <td>${item.goodsBrand || "-"}</td>
                  <td>${item.goodsOrigin || "-"}</td>
                  <td>${item.hsCode || "-"}</td>
                  <td>${item.allotName || "-"}</td>
                  <td>${item.warehouse || "-"}</td>
                  <td>${item.qtyName}</td>
                  <td class="num">${item.qtyNo}</td>
                  <td class="num">${money(item.totalGrossWeight)}</td>
                  <td class="num empty">${money(item.emptyPerBag)}</td>
                  <td class="num net">${money(item.netWeight)}</td>
                  <td>${item.priceType}</td>
                  <td>${item.divideType}</td>
                  <td>${item.currency1} - ${money(item.rate1)}</td>
                  <td>${item.op}</td>
                  <td>${item.currency2} - ${money(item.rate2)}</td>
                  <td class="num"><b>${money(item.finalAmount)}</b></td>
                </tr>
              `
                    )
                    .join("")
            }
          </tbody>
        </table>

        <div class="total-bar">
          <div class="total-item">
            <div class="total-label">${_("ble.total_kgs", "Total KGS")}</div>
            <div class="total-val">${money(grandTotals.totalKgs)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">${_("ble.net_weight", "Net Weight")}</div>
            <div class="total-val" style="color: #d97706;">${money(grandTotals.netWeight)}</div>
          </div>
          <div class="total-item">
            <div class="total-label">${_("ble.lbl_grand_final_amount", "Grand Final Amount")}</div>
            <div class="total-val grand-amount">${money(grandTotals.finalAmount)} ${grandTotals.currency}</div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-line">${_("ble.lbl_parties", "Prepared By")}</div>
          <div class="sig-line">${_("ble.btn_quality_report", "Inspected / Verified By")}</div>
          <div class="sig-line">${_("ble.lbl_bl_details", "Authorized Signatory")}</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `;
    win.document.open();
    win.document.write(htmlContent);
    win.document.close();
  }

  // Export CSV
  function exportCsv() {
    const headers = [
      _("ble.gt_sr", "SR#"),
      _("ble.gt_good_name", "Good Name"),
      _("ble.lbl_size", "Size"),
      _("ble.lbl_brand", "Brand"),
      _("ble.lbl_origin", "Origin"),
      _("ble.lbl_hs_code", "HS Code"),
      _("ble.lbl_allot_name", "Allot Name"),
      _("ble.lbl_warehouse", "Warehouse"),
      _("ble.lbl_qty_name", "Qty Name"),
      _("ble.gt_qty_no", "Qty No"),
      _("ble.gt_total_gross_kg", "Total Gross KG"),
      _("ble.lbl_empty_per_bag", "Empty/Bag KG"),
      _("ble.gt_net_weight_kg", "Net Weight KG"),
      _("ble.lbl_price_type", "Price Type"),
      _("ble.lbl_divide_type", "Divide Type"),
      _("ble.lbl_primary_cur", "Primary Cur"),
      _("ble.lbl_op", "OP"),
      _("ble.lbl_secondary_cur", "Secondary Cur"),
      _("ble.lbl_final_amount", "Final Amount")
    ];

    const rows = goodsItems.map((item, i) => [
      String(i + 1).padStart(2, "0"),
      item.goodsName,
      item.goodsSize,
      item.goodsBrand,
      item.goodsOrigin,
      item.hsCode,
      item.allotName,
      item.warehouse,
      item.qtyName,
      item.qtyNo,
      item.totalGrossWeight,
      item.emptyPerBag,
      item.netWeight,
      item.priceType,
      item.divideType,
      `${item.currency1} ${item.rate1}`,
      item.op,
      `${item.currency2} ${item.rate2}`,
      item.finalAmount
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bl-goods-container-${form.blNumber || "report"}-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }

  return (
    <div
      className="mx-auto max-w-[1780px] space-y-3 bg-[#080d19] p-3 text-slate-100 print:bg-white print:text-slate-950"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-[#0c1424] p-3 shadow-md lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-cyan-500" />
          <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">
            {_("ble.title", "Bill of Lading (B/L)")}
          </h1>
          <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-800/60">
            {form.blType}
          </span>
          {form.id ? (
            <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800/60">
              Editing: {form.blNumber}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBack ? (
            <Button type="button" size="sm" variant="outline" className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700" onClick={onBack}>
              {_("cbr.btn_back", "Back")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={handlePrintReport}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
            {_("ble.menu_print", "Print")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={handlePrintReport}
          >
            <PdfActionIcon className="mr-1.5 h-3.5 w-3.5 text-rose-400" />
            {_("ble.act_view", "View")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={exportCsv}
          >
            <DownloadActionIcon className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            {_("ble.menu_csv", "Export CSV")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 bg-cyan-600 font-bold text-white hover:bg-cyan-500 shadow-sm shadow-cyan-900"
            onClick={saveRecord}
            disabled={saving}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? _("ble.btn_generating", "Generating...") : _("common.save", "Save B/L")}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Panel (320px) + Right Panels (minmax 1fr) */}
      <div className="grid gap-3 xl:grid-cols-[330px_minmax(0,1fr)]">
        {/* Left Panel */}
        <div className="space-y-2 rounded-lg border border-slate-800 bg-[#0c1424] p-2.5">
          {/* Top 3 Step Buttons */}
          <div className="grid grid-cols-3 gap-1">
            {[
              [1, _("ble.step1_label", "1) Parties")],
              [2, _("ble.step2_label", "2) BL Entry")],
              [3, _("ble.step3_label", "3) Goods Entry")]
            ].map(([step, label]) => (
              <button
                key={step}
                type="button"
                onClick={() => setActiveStep(Number(step))}
                className={cn(
                  "h-8 rounded border text-[10px] font-bold transition",
                  activeStep === step
                    ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* STEP 1: Parties & Booking */}
          {activeStep === 1 ? (
            <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                {_("ble.step1_heading", "SR#: 1 - Parties & Booking")}
              </div>
              <Field
                label={_("ble.lbl_customer_account", "Customer Account No *")}
                value={form.customerAccountNo}
                onChange={(v) => updateField("customerAccountNo", v)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_shipping_type", "Shipping Type *")}
                  value={form.shippingType}
                  onChange={(v) => updateField("shippingType", v)}
                  asSelect
                  options={[
                    { value: "By Sea", label: _("ble.opt_by_sea", "By Sea") },
                    { value: "By Road", label: _("ble.opt_by_road", "By Road") },
                    { value: "By Air", label: _("ble.opt_by_air", "By Air") }
                  ]}
                />
                <Field
                  label={_("ble.lbl_shipment_type", "Shipment Type *")}
                  value={form.shipmentType}
                  onChange={(v) => updateField("shipmentType", v)}
                  asSelect
                  options={[
                    { value: "Import", label: _("ble.opt_import", "Import") },
                    { value: "Export", label: _("ble.opt_export", "Export") },
                    { value: "Transit", label: _("ble.opt_transit", "Transit") }
                  ]}
                />
              </div>
              <Field
                label={_("ble.lbl_importer", "Importer *")}
                value={form.importer}
                onChange={(v) => updateField("importer", v)}
                placeholder={_("ble.ph_importer", "Select / enter importer...")}
              />
              <Field
                label={_("ble.lbl_exporter", "Exporter *")}
                value={form.exporter}
                onChange={(v) => updateField("exporter", v)}
                placeholder={_("ble.ph_exporter", "Select / enter exporter...")}
              />
              <Field
                label={_("ble.lbl_notify_party", "Notify Party")}
                value={form.notifyParty}
                onChange={(v) => updateField("notifyParty", v)}
                placeholder={_("ble.ph_notify_party", "Enter notify party (optional)...")}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_booking_no", "Booking No *")}
                  value={form.bookingNo}
                  onChange={(v) => updateField("bookingNo", v)}
                />
                <Field
                  label={_("ble.lbl_booking_company_type", "Booking Company Type *")}
                  value={form.bookingCompanyType}
                  onChange={(v) => updateField("bookingCompanyType", v)}
                  asSelect
                  options={[
                    { value: "Shipping Line", label: _("ble.opt_shipping_line", "Shipping Line") },
                    { value: "Transport Company", label: _("ble.opt_transport_company", "Transport Company") },
                    { value: "Airline", label: _("ble.opt_airline", "Airline") }
                  ]}
                />
                <Field
                  label={_("ble.lbl_booking_company_name", "Booking Company Name *")}
                  value={form.bookingCompanyName}
                  onChange={(v) => updateField("bookingCompanyName", v)}
                />
                <Field
                  label={_("ble.lbl_booking_date", "Booking Date *")}
                  type="date"
                  value={form.bookingDate}
                  onChange={(v) => updateField("bookingDate", v)}
                />
              </div>
              <div className="pt-2">
                <Button type="button" className="h-8 w-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-500" onClick={() => setActiveStep(2)}>
                  {_("ble.btn_next", "Next")} &rarr;
                </Button>
              </div>
            </div>
          ) : null}

          {/* STEP 2: BL Entry & Route Details */}
          {activeStep === 2 ? (
            <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_issue_date", "Issue Date *")}
                  type="date"
                  value={form.issueDate}
                  onChange={(v) => updateField("issueDate", v)}
                />
                <Field
                  label={_("ble.lbl_issue_serial", "Issue Serial No *")}
                  value={form.issueSerial}
                  onChange={(v) => updateField("issueSerial", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_bl_type", "BL Type")}
                  value={form.blType}
                  onChange={(v) => updateField("blType", v)}
                  asSelect
                  options={[
                    { value: "New BL", label: _("ble.opt_new_bl", "New BL") },
                    { value: "Old BL", label: _("ble.opt_old_bl", "Old BL") }
                  ]}
                />
                <Field
                  label={_("ble.lbl_bl_no", "BL No")}
                  value={form.blNumber}
                  onChange={(v) => updateField("blNumber", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_vessel_name", "Vessel Name *")}
                  value={form.vesselName}
                  onChange={(v) => updateField("vesselName", v)}
                />
                <Field
                  label={_("ble.lbl_voyage_number", "Voyage Number *")}
                  value={form.voyageNumber}
                  onChange={(v) => updateField("voyageNumber", v)}
                />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                {_("ble.section_route", "Transport / Route Details")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_route_type", "1) Route Type")}
                  value={form.shippingType}
                  onChange={(v) => updateField("shippingType", v)}
                  asSelect
                  options={[
                    { value: "By Sea", label: _("ble.opt_by_sea", "By Sea") },
                    { value: "By Road", label: _("ble.opt_by_road", "By Road") },
                    { value: "By Air", label: _("ble.opt_by_air", "By Air") }
                  ]}
                />
                <Field
                  label={_("ble.lbl_route_country", "2) Route Country")}
                  value={form.routeCountry}
                  onChange={(v) => updateField("routeCountry", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_port_of_loading", "Port of Loading *")}
                  value={form.loadingPort}
                  onChange={(v) => updateField("loadingPort", v)}
                />
                <Field
                  label={_("ble.lbl_port_of_discharge", "Port of Discharge *")}
                  value={form.dischargePort}
                  onChange={(v) => updateField("dischargePort", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_container_numbers", "Container / Truck No *")}
                  value={form.containerNumber}
                  onChange={(v) => updateField("containerNumber", v)}
                />
                <Field
                  label={_("ble.lbl_seal_number", "Seal Number")}
                  value={form.sealNumber}
                  onChange={(v) => updateField("sealNumber", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label={_("ble.lbl_container_type", "Container Type")}
                  value={form.containerType}
                  onChange={(v) => updateField("containerType", v)}
                  asSelect
                  options={[
                    { value: "Dry Container 20FT", label: _("ble.opt_dry_container_20ft", "Dry Container 20FT") },
                    { value: "Dry Container 40FT", label: _("ble.opt_dry_container_40ft", "Dry Container 40FT") },
                    { value: "Reefer Container 40FT", label: _("ble.opt_reefer_container_40ft", "Reefer Container 40FT") },
                    { value: "22 Wheeler", label: "22 Wheeler" },
                    { value: "10 Wheeler", label: "10 Wheeler" }
                  ]}
                />
                <Field
                  label={_("ble.lbl_shipping_line", "Shipping Line *")}
                  value={form.shippingLineName}
                  onChange={(v) => updateField("shippingLineName", v)}
                />
              </div>
              <div className="pt-2 flex gap-2">
                <Button type="button" variant="outline" className="h-8 flex-1 border-slate-700 bg-slate-800 text-xs" onClick={() => setActiveStep(1)}>
                  &larr; {_("cbr.btn_back", "Back")}
                </Button>
                <Button type="button" className="h-8 flex-1 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500" onClick={() => setActiveStep(3)}>
                  {_("ble.btn_next", "Next")} &rarr;
                </Button>
              </div>
            </div>
          ) : null}

          {/* STEP 3: Goods Entry (Approved Reference Design) */}
          {activeStep === 3 ? (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-[#0a1120] p-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                {editingIdx !== null ? `${_("ble.act_edit", "Edit")} - ${_("ble.lbl_goods", "Goods")}` : "STEP 3 - Goods Entry"}
              </div>

              {/* Goods Picker */}
              <div>
                <GoodsPicker
                  label={_("ble.lbl_goods", "Goods *")}
                  value={draftGoods.goodsId}
                  variationValue={draftGoods.goodsVariationId}
                  onSelect={(v: GoodsPickerValue) => {
                    setDraftGoods((curr) => ({
                      ...curr,
                      goodsId: v.goodsId,
                      goodsVariationId: v.goodsVariationId || "",
                      goodsChsCode: v.goodsChsCode || "",
                      goodsName: v.goodsName,
                      goodsBrand: v.brand || curr.goodsBrand,
                      goodsSize: v.size || curr.goodsSize,
                      goodsOriginCountryId: v.originCountryId || "",
                      hsCode: v.goodsChsCode || curr.hsCode
                    }));
                  }}
                />
              </div>

              {/* Size & Brand */}
              <div className="grid grid-cols-2 gap-1.5">
                <CompactField
                  label={_("ble.lbl_size", "Size")}
                  value={draftGoods.goodsSize}
                  onChange={(v) => updateDraftGoods("goodsSize", v)}
                />
                <CompactField
                  label={_("ble.lbl_brand", "Brand")}
                  value={draftGoods.goodsBrand}
                  onChange={(v) => updateDraftGoods("goodsBrand", v)}
                />
              </div>

              {/* Origin & HS Code */}
              <div className="grid grid-cols-2 gap-1.5">
                <CompactField
                  label={_("ble.lbl_origin", "Origin")}
                  value={draftGoods.goodsOrigin}
                  onChange={(v) => updateDraftGoods("goodsOrigin", v)}
                />
                <CompactField
                  label={_("ble.lbl_hs_code", "HS Code (auto)")}
                  value={draftGoods.hsCode}
                  onChange={(v) => updateDraftGoods("hsCode", v)}
                />
              </div>

              {/* Allot Name & W.Acc */}
              <div className="grid grid-cols-2 gap-1.5">
                <CompactField
                  label={_("ble.lbl_allot_name", "Allot Name")}
                  value={draftGoods.allotName}
                  onChange={(v) => updateDraftGoods("allotName", v)}
                />
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_w_acc", "W.Acc")}
                  </Label>
                  <select
                    value={draftGoods.wAccId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const led = ledgers.find((l) => l.id === id);
                      setDraftGoods((curr) => ({
                        ...curr,
                        wAccId: id,
                        wAcc: led ? `${led.code || ""} ${led.name || ""}`.trim() : ""
                      }));
                    }}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="">Select W.Acc</option>
                    {ledgers.map((led) => (
                      <option key={led.id} value={led.id}>
                        {led.code ? `${led.code} - ` : ""}{led.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warehouse Dropdown */}
              <div className="space-y-0.5">
                <Label className="text-[9px] font-bold uppercase text-slate-400">
                  {_("ble.lbl_warehouse", "Warehouse")}
                </Label>
                <select
                  value={draftGoods.warehouse}
                  onChange={(e) => {
                    const name = e.target.value;
                    const wh = warehouses.find((w) => w.name === name);
                    setDraftGoods((curr) => ({
                      ...curr,
                      warehouse: name,
                      warehouseId: wh?.id || ""
                    }));
                  }}
                  className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="">{_("ble.lbl_warehouse", "Select Warehouse")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name} {w.code ? `(${w.code})` : ""}
                    </option>
                  ))}
                  {/* Fallback sample warehouses if none in test db */}
                  {warehouses.length === 0 ? (
                    <>
                      <option value="MAIN WH A">MAIN WH A</option>
                      <option value="CENTRAL DEPOT 1">CENTRAL DEPOT 1</option>
                      <option value="PORT WAREHOUSE B">PORT WAREHOUSE B</option>
                    </>
                  ) : null}
                </select>
              </div>

              {/* Qty Name & Quantity No */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_qty_name", "Qty Name")}
                  </Label>
                  <select
                    value={draftGoods.qtyName}
                    onChange={(e) => updateDraftGoods("qtyName", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="BAGS">BAGS</option>
                    <option value="COTTON">COTTON</option>
                    <option value="CARTONS">CARTONS</option>
                    <option value="KGS">KGS</option>
                    <option value="ITEMS">ITEMS</option>
                  </select>
                </div>
                <CompactField
                  label={_("ble.lbl_qty_no", "Quantity No")}
                  type="number"
                  value={draftGoods.qtyNo}
                  onChange={(v) => updateDraftGoods("qtyNo", v)}
                />
              </div>

              {/* Quantity KGS & Empty KGS */}
              <div className="grid grid-cols-2 gap-1.5">
                <CompactField
                  label={_("ble.gt_total_gross_kg", "Quantity KGS")}
                  type="number"
                  value={draftGoods.qtyKgs}
                  onChange={(v) => updateDraftGoods("qtyKgs", v)}
                />
                <CompactField
                  label={_("ble.lbl_empty_per_bag", "Empty KGS")}
                  type="number"
                  value={draftGoods.emptyPerBag}
                  onChange={(v) => updateDraftGoods("emptyPerBag", v)}
                />
              </div>

              {/* Price Type & Divide Type */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_price_type", "Price Type")}
                  </Label>
                  <select
                    value={draftGoods.priceType}
                    onChange={(e) => updateDraftGoods("priceType", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="P/KGs">P/KGs</option>
                    <option value="P/TON">P/TON</option>
                    <option value="P/BAG">P/BAG</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_divide_type", "Divide Type")}
                  </Label>
                  <select
                    value={draftGoods.divideType}
                    onChange={(e) => updateDraftGoods("divideType", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="D/KGs">D/KGs</option>
                    <option value="D/TON">D/TON</option>
                  </select>
                </div>
              </div>

              {/* Currency 1, Rate 1, OP */}
              <div className="grid grid-cols-[1fr_1fr_48px] gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_currency_1", "Currency 1")}
                  </Label>
                  <select
                    value={draftGoods.currency1}
                    onChange={(e) => updateDraftGoods("currency1", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                    <option value="PKR">PKR</option>
                    <option value="AFN">AFN</option>
                    <option value="IRR">IRR</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
                <CompactField
                  label={_("ble.lbl_rate_1", "Rate 1")}
                  type="number"
                  value={draftGoods.rate1}
                  onChange={(v) => updateDraftGoods("rate1", v)}
                />
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_op", "OP")}
                  </Label>
                  <select
                    value={draftGoods.op}
                    onChange={(e) => updateDraftGoods("op", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-1 text-center text-[11px] font-black text-cyan-400 outline-none focus:border-cyan-500"
                  >
                    <option value="*">*</option>
                    <option value="/">/</option>
                  </select>
                </div>
              </div>

              {/* Currency 2 & Rate 2 */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">
                    {_("ble.lbl_currency_2", "Currency 2")}
                  </Label>
                  <select
                    value={draftGoods.currency2}
                    onChange={(e) => updateDraftGoods("currency2", e.target.value)}
                    className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                    <option value="AFN">AFN</option>
                    <option value="IRR">IRR</option>
                  </select>
                </div>
                <CompactField
                  label={_("ble.lbl_rate_2", "Rate 2")}
                  type="number"
                  value={draftGoods.rate2}
                  onChange={(v) => updateDraftGoods("rate2", v)}
                />
              </div>

              {/* Live Calculation Summary Box (Matching reference screenshot) */}
              <div className="rounded border border-slate-800 bg-[#070d18] p-2 text-[10px] space-y-1">
                <div className="flex justify-between border-b border-slate-800/80 pb-0.5">
                  <span className="text-slate-400">Total KGS: <b className="text-slate-200">{money(liveDraftCalc.totalGrossWeight)}</b></span>
                  <span className="text-slate-400">Total Qty KGS: <b className="text-slate-200">{money(liveDraftCalc.totalGrossWeight)}</b></span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-0.5">
                  <span className="text-slate-400">NET KGS: <b className="text-amber-400 font-black">{money(liveDraftCalc.netWeight)}</b></span>
                  <span className="text-slate-400">Tons: <b className="text-slate-200">{liveDraftCalc.tons}</b></span>
                </div>
                <div className="pt-0.5 text-right">
                  <span className="text-slate-400 font-bold mr-1">Final Amount:</span>
                  <b className="text-cyan-400 font-black text-xs">{money(liveDraftCalc.finalAmount)} {draftGoods.currency2}</b>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded bg-rose-950/70 border border-rose-800 p-1.5 text-[10px] text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              {/* Action Buttons: Quality Report & Submit */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  className="h-8 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 transition"
                  onClick={() => {
                    const tempItem: BlGoodsItem = {
                      id: "temp",
                      goodsName: draftGoods.goodsName || "Pistachios Kernel",
                      goodsSize: draftGoods.goodsSize,
                      goodsBrand: draftGoods.goodsBrand,
                      goodsOrigin: draftGoods.goodsOrigin,
                      hsCode: draftGoods.hsCode,
                      allotName: draftGoods.allotName,
                      warehouse: draftGoods.warehouse,
                      wAcc: draftGoods.wAcc,
                      qtyName: draftGoods.qtyName,
                      qtyNo: Number(draftGoods.qtyNo) || 0,
                      qtyKgs: Number(draftGoods.qtyKgs) || 0,
                      totalGrossWeight: liveDraftCalc.totalGrossWeight,
                      emptyPerBag: Number(draftGoods.emptyPerBag) || 0,
                      totalEmptyWeight: liveDraftCalc.totalEmptyWeight,
                      netWeight: liveDraftCalc.netWeight,
                      priceType: draftGoods.priceType,
                      divideType: draftGoods.divideType,
                      currency1: draftGoods.currency1,
                      rate1: Number(draftGoods.rate1) || 0,
                      op: draftGoods.op,
                      currency2: draftGoods.currency2,
                      rate2: Number(draftGoods.rate2) || 0,
                      primaryAmount: liveDraftCalc.primaryAmount,
                      finalAmount: liveDraftCalc.finalAmount,
                      qualityReportStatus: draftGoods.qualityReportStatus || "Passed"
                    };
                    setQualityModalItem(tempItem);
                  }}
                >
                  {_("ble.btn_quality_report", "Quality Report")}
                </button>
                <button
                  type="button"
                  className="h-8 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-black text-white shadow-md shadow-blue-900 transition"
                  onClick={handleSubmitGoodsItem}
                >
                  {editingIdx !== null ? _("ble.btn_update_item", "Update Item") : _("ble.btn_submit_item", "Submit")}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Section: Live BL Report + Goods Container Report */}
        <div className="space-y-3 min-w-0">
          {/* Top Panel: LIVE BL REPORT */}
          <div className="rounded-lg border border-slate-800 bg-[#0c1424] p-3 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded bg-cyan-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                  {_("ble.lbl_live_bl_report", "Live BL Report")}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                  {_("ble.lbl_tracking_doc", "Tracking & Documentation")}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-blue-600/70 bg-blue-950/40 text-[10px] font-extrabold text-blue-400 hover:bg-blue-900/60 hover:text-white"
                onClick={handleClearBl}
              >
                {_("ble.btn_clear_bl", "Clear BL")}
              </Button>
            </div>

            {/* 6 Summary Cards (2 Rows of 3) matching approved reference */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: MODE & DATES */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">MODE</span>
                  <span className="font-extrabold text-blue-400">{form.blType}</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">ISSUE DATE</span>
                  <span className="font-bold text-slate-200">{form.issueDate || todayIso()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold uppercase text-slate-500">ISSUE SERIAL</span>
                  <span className="font-bold text-slate-300">{form.issueSerial || `ISS-${form.blNumber || "871867"}`}</span>
                </div>
              </div>

              {/* Card 2: BL DETAILS */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-cyan-400 border-b border-slate-800 pb-0.5">
                  {_("ble.lbl_bl_details", "BL Details")}
                </div>
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">BL No:</span>
                  <span className="font-extrabold text-blue-400">{form.blNumber || "BL-871867"}</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">Vessel:</span>
                  <span className="font-bold text-slate-300">{form.vesselName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold uppercase text-slate-500">L/R:</span>
                  <span className="font-bold text-slate-300">{form.routeCountry || "PK / UAE"}</span>
                </div>
              </div>

              {/* Card 3: TRUCK DETAILS */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-0.5">
                  {_("ble.lbl_truck_details", "Truck Details")}
                </div>
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">Truck No:</span>
                  <span className="font-bold text-slate-200">{form.containerNumber || "ABC-123"}</span>
                </div>
                <div className="flex justify-between border-b border-dotted border-slate-800 pb-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500">Seal No:</span>
                  <span className="font-bold text-slate-300">{form.sealNumber || "S-5542"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-bold uppercase text-slate-500">Size:</span>
                  <span className="font-bold text-slate-300">{form.containerType || "22 Wheeler"}</span>
                </div>
              </div>

              {/* Card 4: NOTIFY PARTY */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-0.5">
                  {_("ble.lbl_notify_party", "Notify Party")}
                </div>
                <div className="pt-0.5 text-slate-300 font-semibold truncate">
                  {form.notifyParty || "Not Assigned"}
                </div>
              </div>

              {/* Card 5: IMPORTER */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-0.5">
                  {_("ble.lbl_importer", "Importer")}
                </div>
                <div className="pt-0.5 text-slate-300 font-semibold truncate">
                  {form.importer || "Pending Data"}
                </div>
              </div>

              {/* Card 6: EXPORTER */}
              <div className="rounded border border-slate-800 bg-[#080e1a] p-2 space-y-1 text-[10px]">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-0.5">
                  {_("ble.lbl_exporter", "Exporter")}
                </div>
                <div className="pt-0.5 text-slate-300 font-semibold truncate">
                  {form.exporter || "Pending Data"}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Panel: GOODS CONTAINER REPORT (19 Columns Live Table) */}
          <div className="rounded-lg border border-slate-800 bg-[#0c1424] p-3 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 rounded bg-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-100">
                  {_("ble.lbl_goods_container_report", "Goods Container Report")}
                </span>
                <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-400 border border-cyan-800/60">
                  {_("ble.live_inventory", "Live Inventory")}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-rose-800/80 bg-rose-950/40 text-[10px] font-extrabold text-rose-400 hover:bg-rose-900/60 hover:text-white"
                onClick={handleClearAllGoods}
              >
                {_("ble.btn_clear_all", "Clear All Data")}
              </Button>
            </div>

            {/* 19 Columns Live Table */}
            <div className="overflow-x-auto rounded border border-slate-800">
              <table className="w-full min-w-[1360px] border-separate border-spacing-0 text-[11px]">
                <thead className="bg-[#0b1322] text-slate-300">
                  <tr className="border-b border-slate-800">
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">#</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.gt_good_name", "Good Name")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_size", "Size")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_brand", "Brand")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_origin", "Origin")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_hs_code", "HS Code")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_allot_name", "Allot Name")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_warehouse", "Warehouse")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_qty_name", "Qty Name")}</Th>
                    <Th className="px-2.5 py-2 text-right text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.gt_qty_no", "Qty No")}</Th>
                    <Th className="px-2.5 py-2 text-right text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.gt_total_gross_kg", "Qty KGS")}</Th>
                    <Th className="px-2.5 py-2 text-right text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_empty_per_bag", "Empty KGS")}</Th>
                    <Th className="px-2.5 py-2 text-right text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.gt_net_weight_kg", "Net Weight")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_price_type", "Price Type")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_divide_type", "Divide Type")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_primary_cur", "Primary Cur")}</Th>
                    <Th className="px-2 py-2 text-center text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_op", "OP")}</Th>
                    <Th className="px-2.5 py-2 text-left text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_secondary_cur", "Secondary Cur")}</Th>
                    <Th className="px-2.5 py-2 text-right text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">{_("ble.lbl_final_amount", "Final Amount")}</Th>
                    <Th className="px-2 py-2 text-center text-[9px] font-black uppercase text-slate-400 border-b border-slate-800">···</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-[#080e19]">
                  {goodsItems.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-3 py-8 text-center text-xs text-slate-500">
                        No goods items in container report. Fill in Step 3 and click Submit to add.
                      </td>
                    </tr>
                  ) : (
                    goodsItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-2.5 py-2 font-mono text-slate-400">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="px-2.5 py-2 font-black text-cyan-400">{item.goodsName}</td>
                        <td className="px-2.5 py-2 text-slate-300">{item.goodsSize || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-300">{item.goodsBrand || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-300">{item.goodsOrigin || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-400 font-mono">{item.hsCode || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-300">{item.allotName || "—"}</td>
                        <td className="px-2.5 py-2 text-blue-400 font-semibold">{item.warehouse || "—"}</td>
                        <td className="px-2.5 py-2 text-slate-400 uppercase">{item.qtyName}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-slate-200">{item.qtyNo}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-slate-200">{money(item.totalGrossWeight)}</td>
                        <td className="px-2.5 py-2 text-right font-mono font-semibold text-rose-400">{money(item.totalEmptyWeight)}</td>
                        <td className="px-2.5 py-2 text-right font-mono font-black text-amber-400">{money(item.netWeight)}</td>
                        <td className="px-2.5 py-2 text-slate-300 text-[10px]">{item.priceType}</td>
                        <td className="px-2.5 py-2 text-slate-300 text-[10px]">{item.divideType}</td>
                        <td className="px-2.5 py-2 text-slate-300 font-mono text-[10px]">{item.currency1} - ${money(item.rate1)}</td>
                        <td className="px-2 py-2 text-center font-black text-cyan-400">{item.op}</td>
                        <td className="px-2.5 py-2 text-slate-300 font-mono text-[10px]">{item.currency2} - {money(item.rate2)}</td>
                        <td className="px-2.5 py-2 text-right font-mono font-black text-cyan-400">{money(item.finalAmount)}</td>
                        <td className="px-2 py-2 text-center relative">
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            onClick={() => setActiveRowMenuIdx((curr) => (curr === idx ? null : idx))}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {activeRowMenuIdx === idx ? (
                            <div className="absolute right-2 top-8 z-30 w-32 rounded border border-slate-700 bg-[#0f172a] py-1 text-left text-xs shadow-2xl">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                onClick={() => {
                                  setViewDetailsItem(item);
                                  setActiveRowMenuIdx(null);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                                {_("ble.act_view", "View")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                                onClick={() => handleEditItem(idx)}
                              >
                                <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                                {_("ble.act_edit", "Edit")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-300 hover:bg-rose-950/60"
                                onClick={() => handleDeleteItem(idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                                {_("ble.act_delete", "Delete")}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Bar: Matching approved reference screenshot */}
            <div className="flex flex-wrap items-center justify-end gap-6 rounded border border-slate-800 bg-[#09101c] p-2.5 text-right">
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">
                  {_("ble.total_kgs", "TOTAL KGS")}
                </span>
                <b className="text-sm font-black text-slate-100">{money(grandTotals.totalKgs)}</b>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">
                  {_("ble.net_weight", "NET WEIGHT")}
                </span>
                <b className="text-sm font-black text-amber-400">{money(grandTotals.netWeight)}</b>
              </div>
              <div className="pl-4">
                <span className="block text-[9px] font-black uppercase text-cyan-500">
                  {_("ble.lbl_grand_final_amount", "GRAND FINAL AMOUNT")}
                </span>
                <b className="text-lg md:text-xl font-black text-cyan-400">
                  {money(grandTotals.finalAmount)} <span className="text-xs font-bold text-cyan-300">{grandTotals.currency}</span>
                </b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Report Modal */}
      {qualityModalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#0f172a] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  {_("ble.btn_quality_report", "Quality Report")}
                </h3>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:text-white"
                onClick={() => setQualityModalItem(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 py-3 text-xs">
              <div className="rounded bg-slate-900/80 p-2.5 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Good:</span>
                  <b className="text-cyan-400">{qualityModalItem.goodsName}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Origin / Brand:</span>
                  <span>{qualityModalItem.goodsOrigin || "—"} / {qualityModalItem.goodsBrand || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Allot Name:</span>
                  <span className="font-mono">{qualityModalItem.allotName || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-slate-800 bg-[#080e1a] p-2">
                  <div className="text-[9px] uppercase text-slate-500">Moisture %</div>
                  <div className="text-sm font-black text-slate-200">5.2 %</div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080e1a] p-2">
                  <div className="text-[9px] uppercase text-slate-500">Purity Grade</div>
                  <div className="text-sm font-black text-emerald-400">Grade A (99.1%)</div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080e1a] p-2">
                  <div className="text-[9px] uppercase text-slate-500">Defect Tolerance</div>
                  <div className="text-sm font-black text-slate-200">&lt; 0.5 %</div>
                </div>
                <div className="rounded border border-slate-800 bg-[#080e1a] p-2">
                  <div className="text-[9px] uppercase text-slate-500">Inspection Status</div>
                  <div className="text-sm font-black text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Passed
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-end">
              <Button type="button" size="sm" className="bg-blue-600 text-white" onClick={() => setQualityModalItem(null)}>
                OK / Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* View Item Details Modal */}
      {viewDetailsItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-[#0f172a] p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  {_("ble.act_view", "View")} {_("ble.lbl_goods", "Goods")} - {viewDetailsItem.goodsName}
                </h3>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:text-white"
                onClick={() => setViewDetailsItem(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 py-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">GOOD NAME</span>
                  <b className="text-cyan-400">{viewDetailsItem.goodsName}</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">WAREHOUSE</span>
                  <b className="text-blue-400">{viewDetailsItem.warehouse || "—"}</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">SIZE / BRAND</span>
                  <b>{viewDetailsItem.goodsSize || "—"} / {viewDetailsItem.goodsBrand || "—"}</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">ORIGIN / HS CODE</span>
                  <b>{viewDetailsItem.goodsOrigin || "—"} / {viewDetailsItem.hsCode || "—"}</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">QUANTITY NO / KGS</span>
                  <b>{viewDetailsItem.qtyNo} {viewDetailsItem.qtyName} ({money(viewDetailsItem.totalGrossWeight)} KG)</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">EMPTY PACKING / NET WT</span>
                  <b><span className="text-rose-400">{money(viewDetailsItem.totalEmptyWeight)}</span> / <span className="text-amber-400">{money(viewDetailsItem.netWeight)} KG</span></b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">PRICE & DIVIDE BASIS</span>
                  <b>{viewDetailsItem.priceType} | {viewDetailsItem.divideType}</b>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 text-[9px] block">RATES & CONVERSION</span>
                  <b>{viewDetailsItem.currency1} ${money(viewDetailsItem.rate1)} {viewDetailsItem.op} {viewDetailsItem.currency2} {money(viewDetailsItem.rate2)}</b>
                </div>
              </div>
              <div className="p-3 bg-cyan-950/40 border border-cyan-800 rounded text-right">
                <span className="text-[10px] text-cyan-300 font-bold uppercase block">FINAL AMOUNT</span>
                <span className="text-lg font-black text-cyan-400">{money(viewDetailsItem.finalAmount)} {viewDetailsItem.currency2}</span>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-end">
              <Button type="button" size="sm" className="bg-slate-800 text-white" onClick={() => setViewDetailsItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[9px] font-bold uppercase text-slate-400">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-500"
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  asSelect = false,
  options = []
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  asSelect?: boolean;
  options?: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[9px] font-bold uppercase text-slate-400">{label}</Label>
      {asSelect ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-full rounded border border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 focus:border-cyan-500"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 border-slate-700 bg-[#0d1627] px-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-500"
        />
      )}
    </div>
  );
}
