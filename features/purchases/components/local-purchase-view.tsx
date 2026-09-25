"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
import { fetchWarehouses } from "@/features/warehouses/warehouse-api";
import {
  ShoppingCart, Plus, Search, Scale, Coins,
  TrendingUp, User, CalendarDays, CheckCircle2,
  Trash2, Loader2, ArrowLeftRight, Check, Package,
  Building2, FileText, ArrowDownLeft, ArrowUpRight,
  Pin, X, Layers, Tag, Globe, Pencil, ShieldAlert,
  CreditCard, Truck, Flag, UserCheck, ChevronDown,
  ArrowRight, ArrowLeft, Percent, Warehouse, MapPin, ListPlus,
  Printer, Send, FileSpreadsheet, Eye, MoreVertical, Edit3, Clock,
  RefreshCw, Share2, SlidersHorizontal, RotateCcw, Download, ShieldCheck,
  LayoutGrid, CheckSquare, Users, BookOpen, Receipt
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { AddExpenseBillButton } from "@/features/expenses/components/add-expense-bill-button";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { BranchScopeDropdown } from "@/features/purchases/components/branch-scope-dropdown";
import { deriveLocalPurchasePostingState } from "@/lib/services/local-purchase-posting-state";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { PersonPicker } from "@/components/erp/person-picker";
import { translateOptionLabel } from "@/lib/i18n/option-labels";
import { cn } from "@/lib/utils";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";
import { useSetActiveRecord } from "@/lib/support/active-record-context";
import { VoiceFormFill } from "@/components/voice-form-fill";

const CURRENCIES = ["USD", "AED", "PKR", "AFN", "INR", "IRR"];
const QUANTITY_NAMES = ["Bags", "Cartons", "Boxes", "Crates", "Bales", "Drums", "Pieces", "Custom"];
// DB-value maps rendered via translateOptionLabel(lang, label) — not hardcoded UI strings. tr()
const PAYMENT_MODES = [
  { value: "Cash", label: "Cash" }, // tr()
  { value: "Credit", label: "Credit" }, // tr()
  { value: "Advance", label: "Advance" }, // tr()
  { value: "Bank Transfer", label: "Bank Transfer" }, // tr()
];
const SHIPPING_MODES = [
  { value: "Loading", label: "Loading" }, // tr()
  { value: "Transfer Layout", label: "Transfer Layout" }, // tr()
  { value: "Export", label: "Export" }, // tr()
  { value: "Custom", label: "Custom Mode" }, // tr()
];

// The "Shipment Type" selector (Loading by Truck / Warehouse Transfer / Export
// Shipment) is the actual destination-routing choice the user makes at booking
// time. It must persist as local_purchases.shipping_mode so that, once the
// bill is posted, the destination-stage API/queues (destination-stage/route.ts)
// know which operational queue to route it into. Previously shipmentType was
// local UI state only and was never saved — this mapping keeps the two in sync.
const SHIPMENT_TYPE_TO_SHIPPING_MODE: Record<string, string> = {
  "Loading by Truck": "Loading",
  "Warehouse Transfer": "Transfer Layout",
  "Export Shipment": "Export",
};
const SHIPPING_MODE_TO_SHIPMENT_TYPE: Record<string, string> = {
  "Loading": "Loading by Truck",
  "Transfer Layout": "Warehouse Transfer",
  "Export": "Export Shipment",
};

const UAE_COUNTRY_MATCHERS = ["UNITED ARAB", "UAE", "EMIRATES", "AE"];

function isUaeCountryName(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return UAE_COUNTRY_MATCHERS.some(token => normalized.includes(token));
}

function getCountryFlag(nameOrCode?: string): string {
  const s = String(nameOrCode || "").toUpperCase();
  if (s.includes("EMIRATES") || s.includes("UAE") || s === "AE") return "🇦🇪";
  if (s.includes("PAKISTAN") || s === "PK") return "🇵🇰";
  if (s.includes("AFGHANISTAN") || s === "AF") return "🇦🇫";
  if (s.includes("UNITED STATES") || s === "USA") return "🇺🇸";
  if (s.includes("CHINA") || s === "CN") return "🇨🇳";
  if (s.includes("INDIA") || s === "IN") return "🇮🇳";
  if (s.includes("IRAN") || s === "IR") return "🇮🇷";
  return "🌐";
}

function money(value: unknown, currency?: string) {
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}


function amountToWordsEn(amount: number, currency = "AED") {
  if (!Number.isFinite(amount)) return `${currency} zero only`;
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const chunkToWords = (num: number): string => {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const parts: string[] = [];
    if (hundred) parts.push(`${ones[hundred]} hundred`);
    if (rest < 20) {
      if (rest) parts.push(ones[rest]);
    } else {
      const ten = Math.floor(rest / 10);
      const one = rest % 10;
      parts.push(one ? `${tens[ten]}-${ones[one]}` : tens[ten]);
    }
    return parts.join(" ");
  };
  const whole = Math.floor(Math.abs(amount));
  if (whole === 0) return `${currency} zero only`;
  const scales = ["", "thousand", "million", "billion"];
  const parts: string[] = [];
  let remaining = whole;
  let scaleIndex = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) parts.unshift(`${chunkToWords(chunk)} ${scales[scaleIndex]}`.trim());
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }
  return `${currency} ${parts.join(" ")} only`.replace(/\s+/g, " ");
}

interface MasterOption {
  id: string;
  name: string;
  extra?: string;
}

interface MasterSelectPopoverProps {
  label: string;
  value: string;
  displayValue: string;
  options: MasterOption[];
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onEditItem?: (option: MasterOption) => void;
  canEdit?: boolean;
  addNewLabel: string;
  placeholder?: string;
}

function MasterSelectPopover({
  label,
  value,
  displayValue,
  options,
  onSelect,
  onAddNew,
  onEditItem,
  canEdit = false,
  addNewLabel,
  placeholder = ""
}: MasterSelectPopoverProps) {
  const msLang = useActiveLanguage();
  const th = (x: string) => translateHeader(msLang, x);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 flex items-center justify-between outline-none focus:border-blue-500 transition-all hover:bg-slate-50 shadow-2xs"
      >
        <span className="truncate">{displayValue || placeholder || t(msLang, "lp.select_ph", "Select…")}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-xl bg-white border border-slate-200 shadow-xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length > 4 && (
            <div className="relative mb-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder={t(msLang, "lp.form_search", "Search...")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[11px] bg-slate-50 rounded-md border border-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-2 text-[10px] text-slate-400 text-center font-medium">{t(msLang, "lp.no_matches_found", "No matches found")}</div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.id === value || opt.name === value;
                return (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100 text-slate-700"
                    }`}
                    onClick={() => {
                      onSelect(opt.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="truncate pr-2">{opt.name}</span>
                    {canEdit && onEditItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditItem(opt);
                          setIsOpen(false);
                        }}
                        className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                        title={`Edit ${opt.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              onClick={() => {
                onAddNew();
                setIsOpen(false);
              }}
              className="w-full h-8 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="h-3 w-3" /> {addNewLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface LocalPurchaseViewProps {
  session: any;
  goodsList: any[];
  countryBranches: any[];
  cityBranches: any[];
  companies: any[];
  countries?: any[];
}

export function LocalPurchaseView({
  session,
  goodsList: initialGoodsList,
  countryBranches,
  cityBranches,
  companies,
  countries = []
}: LocalPurchaseViewProps) {
  const router = useRouter();
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const isGlobalUser = Boolean(session?.isSuperAdmin || session?.isSuperAdmin === true || session?.roles?.includes?.("super_admin"));
  const isSuperAdmin = Boolean(
    session?.isSuperAdmin ||
    session?.isSuperAdmin === true ||
    session?.scopes?.isSuperAdmin ||
    session?.roles?.includes?.("super_admin") ||
    session?.role === "super_admin"
  );
  const th = (x: string) => translateHeader(lang, x);
  const [goodsList, setGoodsList] = useState<any[]>(initialGoodsList);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Stepper state: Step 1 (Booking — bill/accounts + payment/logistics/destination)
  // -> Step 2 (Goods Entry) -> Step 3 (Final — review, totals, save). Restyled to the
  // owner-approved Booking/Goods Entry/Final workflow; old Step 3 "Logistics & Others"
  // content now renders alongside Step 1 (see the `currentStep === 1` condition further
  // down that used to read `currentStep === 3`), old Step 4 "Review" is now Step 3.
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Set by "Edit Draft" so handleSubmit updates this SAME row (PATCH by id)
  // instead of POSTing a brand-new duplicate purchase record.
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [showCountryReport, setShowCountryReport] = useState(false);
  const setActiveRecord = useSetActiveRecord();
  useEffect(() => {
    setActiveRecord(editingPurchaseId ? { table: "local_purchases", id: editingPurchaseId } : null);
    return () => setActiveRecord(null);
  }, [editingPurchaseId, setActiveRecord]);
  // Tabs for Local Purchase & Payment modules workflow
  const [activeTab, setActiveTab] = useState<"all" | "accepted" | "posted">("all");
  // Assign a saved bill (any status) to another user via the canonical Transfer
  // Center / TaskHandoverModal engine — same record, no duplicate workflow.
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverTargetRow, setHandoverTargetRow] = useState<any | null>(null);

  // Warehouse setup list and states
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [warehouseAccountNo, setWarehouseAccountNo] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Truck setup list and states — real Truck Master records (Phase 2), not mock data.
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [TRUCK_LIST, setTruckList] = useState<Array<{ id: string; truckNo: string; driverName: string; details: string }>>([]);

  useEffect(() => {
    fetch("/api/erp/master-data/trucks?selectable=true")
      .then((r) => (r.ok ? r.json() : { trucks: [] }))
      .then((j) => {
        const rows = (j.trucks || []).map((tr: any) => ({
          id: tr.id,
          truckNo: tr.truck_number || "",
          driverName: tr.driver_name || "",
          details: [tr.truck_type, tr.transport_company].filter(Boolean).join(" · ")
        }));
        setTruckList(rows);
      })
      .catch(() => setTruckList([]));
  }, []);

  // Fetch warehouses on mount
  useEffect(() => {
    async function loadWarehouses() {
      try {
        setLoadingWarehouses(true);
        const data = await fetchWarehouses();
        setWarehousesList(data);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      } finally {
        setLoadingWarehouses(false);
      }
    }
    loadWarehouses();
  }, []);

  // Draft Bill Items List & Action Menu State
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{ id: string; top: number; bottom: number; right: number } | null>(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<{ id: string; top: number; bottom: number; left: number } | null>(null);
  const [isTopActionsOpen, setIsTopActionsOpen] = useState(false);

  // Scope Selection Modal State
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeCountryId, setScopeCountryId] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState("");
  const [scopeCityBranchId, setScopeCityBranchId] = useState("");

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveActionMenuId(null);
      setActionMenuAnchor(null);
      setActiveStatusDropdownId(null);
      setStatusMenuAnchor(null);
      setIsTopActionsOpen(false);
    };
    const handleScroll = () => {
      if (activeActionMenuId) {
        setActiveActionMenuId(null);
        setActionMenuAnchor(null);
      }
      if (activeStatusDropdownId) {
        setActiveStatusDropdownId(null);
        setStatusMenuAnchor(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeActionMenuId, activeStatusDropdownId]);

  // Permission Check
  const canEditMaster = useMemo(() => {
    if (session?.isSuperAdmin) return true;
    const roles: string[] = session?.roles || session?.scopes?.roles || [];
    return roles.some(r => {
      const lower = r.toLowerCase();
      return lower.includes("super") || lower.includes("country");
    });
  }, [session]);

  // Branch & Country Hierarchy Selection State
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState("");

  // Accounts List State
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Form Fields State
  const [purchaseAccountNo, setPurchaseAccountNo] = useState("");
  const [salesAccountNo, setSalesAccountNo] = useState("");
  const [brokerAccountNo, setBrokerAccountNo] = useState("");
  const [contractNo, setContractNo] = useState("");
  
  // Origin Country & Shipping Mode
  const [shipmentType, setShipmentType] = useState("Loading by Truck");
  const [shippingMode, setShippingMode] = useState("Loading");
  const [customShippingMode, setCustomShippingMode] = useState("");
  const [originCountryId, setOriginCountryId] = useState("");
  const [customOriginCountryName, setCustomOriginCountryName] = useState("");

  // Goods attributes
  const [goodsId, setGoodsId] = useState("");
  const [customGoodsName, setCustomGoodsName] = useState("");
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [size, setSize] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [chassisCode, setChassisCode] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPersonId, setSupplierPersonId] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [quantityName, setQuantityName] = useState("Bags");
  const [customQuantityName, setCustomQuantityName] = useState("");

  // Step 2 Conditional Payment & Date variables
  const [advancePercentage, setAdvancePercentage] = useState("20");
  const [manualAdvanceAmount, setManualAdvanceAmount] = useState("");
  const [advancePaymentDate, setAdvancePaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [remainingDueDate, setRemainingDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const [cashPaymentType, setCashPaymentType] = useState("Cash"); // "Cash" or "Check"
  const [cashPaymentDate, setCashPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Step 2 Logistics Setup
  const [warehouseName, setWarehouseName] = useState("");
  const [warehousePlotNo, setWarehousePlotNo] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [loadingDate, setLoadingDate] = useState(new Date().toISOString().slice(0, 10));

  // Step 1 Remarks
  const [remarks, setRemarks] = useState("");
  const [truckNo, setTruckNo] = useState("");
  const [driverName, setDriverName] = useState("");

  // Modals for Master additions
  const [isAddingGoodsModal, setIsAddingGoodsModal] = useState(false);
  const [newGoodsNameInput, setNewGoodsNameInput] = useState("");
  const [newChsCodeInput, setNewChsCodeInput] = useState("");
  const [submittingNewGoods, setSubmittingNewGoods] = useState(false);

  const [isAddingBrandModal, setIsAddingBrandModal] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState("");
  const [submittingNewBrand, setSubmittingNewBrand] = useState(false);

  const [isAddingSizeModal, setIsAddingSizeModal] = useState(false);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [submittingNewSize, setSubmittingNewSize] = useState(false);

  // Modals for Editing variations
  const [isEditingGoodsModal, setIsEditingGoodsModal] = useState(false);
  const [editGoodsTarget, setEditGoodsTarget] = useState<any>(null);
  const [editGoodsNameInput, setEditGoodsNameInput] = useState("");
  const [editChsCodeInput, setEditChsCodeInput] = useState("");
  const [submittingEditGoods, setSubmittingEditGoods] = useState(false);

  const [isEditingBrandModal, setIsEditingBrandModal] = useState(false);
  const [editBrandTarget, setEditBrandTarget] = useState<any>(null);
  const [editBrandInput, setEditBrandInput] = useState("");
  const [submittingEditBrand, setSubmittingEditBrand] = useState(false);

  const [isEditingSizeModal, setIsEditingSizeModal] = useState(false);
  const [editSizeTarget, setEditSizeTarget] = useState<any>(null);
  const [editSizeInput, setEditSizeInput] = useState("");
  const [submittingEditSize, setSubmittingEditSize] = useState(false);
  
  const [selectedRowForVoucher, setSelectedRowForVoucher] = useState<any | null>(null);
  
  // Weights (Inputs)
  const [quantityCount, setQuantityCount] = useState("");
  const [weightPerPkg, setWeightPerPkg] = useState("");
  const [manualGrossWeight, setManualGrossWeight] = useState("");
  const [emptyKgs, setEmptyKgs] = useState("");
  const [divideUnit, setDivideUnit] = useState("50_kg");
  const [divideType, setDivideType] = useState("D/KGs");
  const [divideKgs, setDivideKgs] = useState<any>("50");

  // Rate & Financials
  const [rateType, setRateType] = useState("per_kg");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");
  // Booking-level exchange rate to AED — the payload field `exchangeRate` already
  // existed but was always hardcoded to 1 (no real UI input anywhere); this wires a
  // real, user-editable rate into it. Booking-level only (not per goods line): the
  // local_purchases table has no per-line currency, so this does not add one.
  const [exchangeRateToAed, setExchangeRateToAed] = useState("1");
  const [applyTax, setApplyTax] = useState("No");
  const [taxType, setTaxType] = useState("VAT");
  const [taxPercentage, setTaxPercentage] = useState("0");
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allotId, setAllotId] = useState("ALT-5239");
  const [hsCode, setHsCode] = useState("");
  const [variety, setVariety] = useState("");
  const [qualityDetails, setQualityDetails] = useState("");
  const [qualityReportRef, setQualityReportRef] = useState("Passed");
  const [priceType, setPriceType] = useState("Price / Kg");
  const [divideValue, setDivideValue] = useState("1");
  const [selectedDestinationRoute, setSelectedDestinationRoute] = useState("");

  // Smart Filter Bar & Registry States matching reference design
  const [registryFilter, setRegistryFilter] = useState<string>("all");
  const [selectedCountryReportId, setSelectedCountryReportId] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [moreFiltersOpen, setMoreFiltersOpen] = useState<boolean>(false);
  const [showColumnPicker, setShowColumnPicker] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    billNo: true,
    date: true,
    supplier: true,
    goods: true,
    brand: true,
    qty: true,
    unit: true,
    grossWt: true,
    netWt: true,
    rate: true,
    amount: true,
    status: true,
  });

  // Close floating popovers when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveStatusDropdownId(null);
      setShowDatePicker(false);
      setShowColumnPicker(false);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("click", handleOutsideClick);
      return () => window.removeEventListener("click", handleOutsideClick);
    }
  }, []);

  // Sync initialGoodsList
  useEffect(() => {
    setGoodsList(initialGoodsList);
  }, [initialGoodsList]);

  // Auto-open creation form if 'create=true' search query parameter is present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
        setEditingPurchaseId(null);
        setIsFormOpen(true);
        setCurrentStep(1);
      }
    }
  }, []);

  // Derived Country options
  const countryOptions = useMemo(() => {
    const map = new Map<string, string>();
    countryBranches.forEach(b => {
      const cId = b.countryId || b.country_id;
      const cName = b.countryName || b.country_name || b.name;
      if (cId && !map.has(cId)) {
        map.set(cId, cName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [countryBranches]);

  // Scoped Country Branches
  const filteredCountryBranches = useMemo(() => {
    if (!selectedCountryId) return countryBranches;
    const res = countryBranches.filter(b => String(b.countryId || b.country_id) === String(selectedCountryId));
    return res.length > 0 ? res : countryBranches;
  }, [countryBranches, selectedCountryId]);

  const activeBranch = useMemo(() => {
    // Keep the global Super Admin registry truly unfiltered. Falling back to
    // the first branch here made the summary cards display an arbitrary branch
    // even though the table contained all authorized records.
    if (isGlobalUser && !selectedCountryId && !selectedBranchId) return undefined;
    return countryBranches.find(b => b.id === selectedBranchId) || filteredCountryBranches[0] || countryBranches[0];
  }, [countryBranches, filteredCountryBranches, selectedBranchId, selectedCountryId, isGlobalUser]);

  const activeCityBranches = useMemo(() => {
    if (!selectedBranchId) return [];
    return cityBranches.filter(c => c.countryBranchId === selectedBranchId || c.country_branch_id === selectedBranchId);
  }, [cityBranches, selectedBranchId]);

  // Scope modal-local filtered lists (independent of global selectedCountryId / selectedBranchId)
  const scopeFilteredBranches = useMemo(() => {
    if (!scopeCountryId) return countryBranches;
    const res = countryBranches.filter(b => String(b.countryId || b.country_id) === String(scopeCountryId));
    return res.length > 0 ? res : countryBranches;
  }, [countryBranches, scopeCountryId]);

  const scopeCityBranches = useMemo(() => {
    if (!scopeBranchId) return [];
    return cityBranches.filter(c => String(c.countryBranchId || c.country_branch_id) === String(scopeBranchId));
  }, [cityBranches, scopeBranchId]);

  // Default selection based on user scope
  useEffect(() => {
    // Super Admins start on the unfiltered registry so global reports and KPI
    // cards include every authorized country/branch. They can still choose a
    // specific hierarchy node from the shared dropdown when needed.
    if (isGlobalUser) {
      setSelectedCountryId("");
      setSelectedBranchId("");
      setSelectedCityBranchId("");
      return;
    }
    if (countryBranches.length > 0) {
      const userBranch = session.countryBranchIds?.[0] || session.country_branch_ids?.[0];
      const match = countryBranches.find(b => b.id === userBranch) || countryBranches[0];
      if (match) {
        setSelectedCountryId(match.countryId || match.country_id || "");
        setSelectedBranchId(match.id);
      }
    }
  }, [countryBranches, session, isGlobalUser]);

  useEffect(() => {
    if (isGlobalUser && !selectedCountryId && !selectedBranchId) return;
    if (filteredCountryBranches.length > 0 && !filteredCountryBranches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(filteredCountryBranches[0].id);
    }
  }, [filteredCountryBranches, selectedBranchId, selectedCountryId, isGlobalUser]);

  useEffect(() => {
    if (isGlobalUser && !selectedBranchId) {
      setSelectedCityBranchId("");
      return;
    }
    if (activeCityBranches.length > 0) {
      // Don't clobber an already-valid city branch — e.g. one the scope modal's
      // "Confirm Scope" or "Edit Draft" just set explicitly. Without this guard,
      // this default-selection effect re-fires on every selectedBranchId change
      // (it runs in the same tick as Confirm Scope's setSelectedBranchId) and
      // silently overwrote the deliberate choice with activeCityBranches[0],
      // which was a non-business branch — the submit payload then carried the
      // wrong city_branch_id and every "Book & Accept Bill" 403'd with
      // NON_BUSINESS_BRANCH regardless of what the user actually picked.
      if (selectedCityBranchId && activeCityBranches.some(c => c.id === selectedCityBranchId)) {
        return;
      }
      const userCityBranch = session.cityBranchIds?.[0] || session.city_branch_ids?.[0];
      if (userCityBranch && activeCityBranches.some(c => c.id === userCityBranch)) {
        setSelectedCityBranchId(userCityBranch);
      } else {
        setSelectedCityBranchId(activeCityBranches[0].id);
      }
    } else {
      setSelectedCityBranchId("");
    }
  }, [activeCityBranches, session, selectedBranchId, isGlobalUser, selectedCityBranchId]);

  // Origin Country
  const selectedOriginCountryName = useMemo(() => {
    if (originCountryId === "custom") return customOriginCountryName || "Custom";
    if (!originCountryId) return "Local";
    const found = countries.find(c => c.id === originCountryId);
    return found?.name || "Local";
  }, [originCountryId, customOriginCountryName, countries]);

  const localCurrency = useMemo(() => {
    const cName = (activeBranch?.countryName || activeBranch?.country_name || "").toUpperCase();
    if (cName.includes("UNITED ARAB") || cName === "UAE") return "AED";
    if (cName.includes("AFGHANISTAN") || cName === "AF") return "AFN";
    if (cName.includes("INDIA") || cName === "IN") return "INR";
    if (cName.includes("IRAN") || cName === "IR") return "IRR";
    if (cName.includes("PAKISTAN") || cName === "PK") return "PKR";
    return activeBranch?.localCurrency || activeBranch?.local_currency || activeBranch?.currency || "PKR";
  }, [activeBranch]);

  useEffect(() => {
    // Don't override a currency the user actually chose. "Edit Draft" restores
    // the saved row's real purchase_currency in the same click that also sets
    // editingPurchaseId and (often) a different selectedBranchId — which
    // recomputes localCurrency and, without this guard, silently clobbered the
    // restored currency back to the branch's default local currency on reopen.
    if (editingPurchaseId) return;
    if (localCurrency) {
      setPurchaseCurrency(localCurrency);
    }
  }, [localCurrency, editingPurchaseId]);

  useEffect(() => {
    if (divideUnit === "50_kg") setDivideKgs("50");
    else if (divideUnit === "ton_1000" || divideUnit === "1000_ton") setDivideKgs("1000");
    else if (divideUnit === "maund_40" || divideUnit === "40_maund") setDivideKgs("40");
  }, [divideUnit]);



  // Load accounting ledger accounts
  const loadAccounts = async () => {
    if (!selectedBranchId) return;
    setLoadingAccounts(true);
    try {
      const params = new URLSearchParams();
      params.set("countryBranchId", selectedBranchId);
      if (selectedCityBranchId) {
        params.set("cityBranchId", selectedCityBranchId);
      }
      params.set("limit", "1000");
      const res = await fetch(`/api/erp/accounting/accounts?${params.toString()}`);
      const json = await res.json();
      const loadedAccounts = json.data?.accounts || json.accounts || [];
      const strictlyScoped = loadedAccounts.filter((acc: any) => {
        if (acc.country_branch_id || acc.countryBranchId) {
          return (acc.country_branch_id === selectedBranchId || acc.countryBranchId === selectedBranchId);
        }
        return true;
      });
      setAccountsList(strictlyScoped);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      void loadAccounts();
    }
  }, [selectedBranchId, selectedCityBranchId]);

  const selectedPurchaseAccount = useMemo(() => {
    return accountsList.find(acc => acc.code === purchaseAccountNo);
  }, [accountsList, purchaseAccountNo]);

  const selectedSalesAccount = useMemo(() => {
    return accountsList.find(acc => acc.code === salesAccountNo);
  }, [accountsList, salesAccountNo]);

  const selectedBrokerAccount = useMemo(() => {
    return accountsList.find(acc => acc.code === brokerAccountNo);
  }, [accountsList, brokerAccountNo]);

  // A bill serial is issued by the server when the draft is accepted. Never
  // display a random client-side placeholder that could be mistaken for a
  // persisted voucher number.
  const [serialNo] = useState<string>("PENDING");

  // Load registry logs
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = "/api/erp/purchases/local-purchase";
      const params = new URLSearchParams();
      if (selectedCountryId) params.append("countryId", selectedCountryId);
      if (selectedBranchId) params.append("countryBranchId", selectedBranchId);
      if (selectedCityBranchId) params.append("cityBranchId", selectedCityBranchId);
      if (params.toString()) query += `?${params.toString()}`;

      const res = await fetch(query);
      const payload = await res.json();
      if (payload.ok && payload.data?.purchases) {
        setPurchases(payload.data.purchases);
      }
    } catch (err) {
      console.error("Failed to load local purchases:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [selectedCountryId, selectedBranchId, selectedCityBranchId]);

  const selectedGood = useMemo(() => {
    return goodsList.find(g => g.id === goodsId);
  }, [goodsList, goodsId]);

  useEffect(() => {
    if (selectedGood) {
      const gChs = selectedGood.chassisCode || selectedGood.chs_code || selectedGood.code || "";
      const gBrand = selectedGood.brand || "";
      const gSize = selectedGood.size || "";
      if (gChs) setChassisCode(gChs);
      if (gBrand) setBrand(gBrand);
      if (gSize) setSize(gSize);
    }
  }, [selectedGood]);

  const goodsOptions = useMemo(() => {
    return goodsList.map(g => ({
      id: g.id,
      name: g.goodsName || g.goods_name,
      chsCode: g.chsCode || g.chs_code || ""
    }));
  }, [goodsList]);

  const brandOptions = useMemo(() => {
    const variations = selectedGood?.variations || selectedGood?.goods_variations || [];
    const unique = [...new Set<string>(variations.map((v: any) => String(v.brand || "").trim().toUpperCase()).filter(Boolean))];
    return unique.map(b => ({ id: b, name: b }));
  }, [selectedGood]);

  const sizeOptions = useMemo(() => {
    const variations = selectedGood?.variations || selectedGood?.goods_variations || [];
    const unique = [...new Set<string>(variations.map((v: any) => String(v.size || "").trim().toUpperCase()).filter(Boolean))];
    return unique.map(s => ({ id: s, name: s }));
  }, [selectedGood]);

  // Master create/update handlers...
  async function handleCreateGoodsMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoodsNameInput.trim()) return;
    setSubmittingNewGoods(true);
    try {
      const name = newGoodsNameInput.trim().toUpperCase();
      const code = newChsCodeInput.trim() || `G-${Math.floor(1000 + Math.random() * 9000)}`;
      const res = await fetch("/api/erp/goods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsName: name, chsCode: code })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to create Goods.");
      const newGoods = { id: data.data?.goodsId || data.goodsId, goodsName: name, chsCode: code, variations: [] };
      setGoodsList(prev => [...prev, newGoods]);
      setGoodsId(newGoods.id);
      setIsAddingGoodsModal(false);
      setNewGoodsNameInput("");
      setNewChsCodeInput("");
    } catch (err: any) {
      alert(err.message || "Error creating goods.");
    } finally {
      setSubmittingNewGoods(false);
    }
  }

  async function handleEditGoodsMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!editGoodsTarget || !editGoodsNameInput.trim()) return;
    setSubmittingEditGoods(true);
    try {
      const payload = { goodsName: editGoodsNameInput.trim().toUpperCase(), chsCode: editChsCodeInput.trim() };
      const res = await fetch(`/api/erp/goods/${editGoodsTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to update Goods.");
      setGoodsList(prev => prev.map(g => g.id === editGoodsTarget.id ? { ...g, ...payload } : g));
      setIsEditingGoodsModal(false);
      setEditGoodsTarget(null);
    } catch (err: any) {
      alert(err.message || "Error updating goods.");
    } finally {
      setSubmittingEditGoods(false);
    }
  }

  async function handleCreateBrandVariation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGood || !newBrandInput.trim()) return;
    setSubmittingNewBrand(true);
    try {
      const brandName = newBrandInput.trim().toUpperCase();
      const res = await fetch("/api/erp/goods/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsId: selectedGood.id, brand: brandName, size: "STANDARD" })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to add Brand.");
      setGoodsList(prev => prev.map(g => g.id === selectedGood.id ? { ...g, variations: [...(g.variations || []), { brand: brandName, size: "STANDARD" }] } : g));
      setBrand(brandName);
      setIsAddingBrandModal(false);
      setNewBrandInput("");
    } catch (err: any) {
      alert(err.message || "Error adding brand.");
    } finally {
      setSubmittingNewBrand(false);
    }
  }

  async function handleEditBrandVariation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGood || !editGoodsTarget || !editBrandInput.trim()) return;
    setSubmittingEditBrand(true);
    try {
      const res = await fetch(`/api/erp/goods/variations/${editGoodsTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsId: selectedGood.id, brand: editBrandInput.trim().toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to edit Brand.");
      setGoodsList(prev => prev.map(g => g.id === selectedGood.id ? { ...g, variations: (g.variations || []).map((v: any) => v.id === editGoodsTarget.id ? { ...v, brand: editBrandInput.trim().toUpperCase() } : v) } : g));
      setBrand(editBrandInput.trim().toUpperCase());
      setIsEditingBrandModal(false);
    } catch (err: any) {
      alert(err.message || "Error updating brand.");
    } finally {
      setSubmittingEditBrand(false);
    }
  }

  async function handleCreateSizeVariation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGood || !newSizeInput.trim()) return;
    setSubmittingNewSize(true);
    try {
      const sizeName = newSizeInput.trim().toUpperCase();
      const res = await fetch("/api/erp/goods/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsId: selectedGood.id, brand: brand || "STANDARD", size: sizeName })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to add Size.");
      setGoodsList(prev => prev.map(g => g.id === selectedGood.id ? { ...g, variations: [...(g.variations || []), { brand: brand || "STANDARD", size: sizeName }] } : g));
      setSize(sizeName);
      setIsAddingSizeModal(false);
      setNewSizeInput("");
    } catch (err: any) {
      alert(err.message || "Error adding size.");
    } finally {
      setSubmittingNewSize(false);
    }
  }

  async function handleEditSizeVariation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGood || !editGoodsTarget || !editSizeInput.trim()) return;
    setSubmittingEditSize(true);
    try {
      const res = await fetch(`/api/erp/goods/variations/${editGoodsTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goodsId: selectedGood.id, size: editSizeInput.trim().toUpperCase() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to edit Size.");
      setGoodsList(prev => prev.map(g => g.id === selectedGood.id ? { ...g, variations: (g.variations || []).map((v: any) => v.id === editGoodsTarget.id ? { ...v, size: editSizeInput.trim().toUpperCase() } : v) } : g));
      setSize(editSizeInput.trim().toUpperCase());
      setIsEditingSizeModal(false);
    } catch (err: any) {
      alert(err.message || "Error updating size.");
    } finally {
      setSubmittingEditSize(false);
    }
  }

  // Weight & Pricing Calculations
  const calculatedGrossWeight = useMemo(() => {
    const qty = Number(quantityCount || 0);
    const weight = Number(weightPerPkg || divideKgs || 50);
    return qty * weight;
  }, [quantityCount, weightPerPkg, divideKgs]);

  const totalGrossWeight = useMemo(() => {
    if (manualGrossWeight !== "") return Number(manualGrossWeight);
    return calculatedGrossWeight;
  }, [manualGrossWeight, calculatedGrossWeight]);

  const totalEmptyKgs = useMemo(() => {
    const qty = Number(quantityCount || 0);
    const emptyPerPkg = Number(emptyKgs || 0);
    return qty * emptyPerPkg;
  }, [quantityCount, emptyKgs]);

  const netWeight = useMemo(() => {
    return Math.max(0, totalGrossWeight - totalEmptyKgs);
  }, [totalGrossWeight, totalEmptyKgs]);

  const numbers = useMemo(() => {
    const divisor = Number(divideKgs || 0);
    if (divisor <= 0) return 0;
    return netWeight / divisor;
  }, [netWeight, divideKgs]);

  const purchaseCost = useMemo(() => {
    const rate = Number(purchaseRate || 0);
    if (rateType === "Per KG Weight" || rateType === "per_kg") return netWeight * rate;
    return numbers * rate;
  }, [netWeight, numbers, rateType, purchaseRate]);

  const taxAmount = useMemo(() => {
    if (applyTax !== "Yes") return 0;
    const pct = Number(taxPercentage || 0);
    return (purchaseCost * pct) / 100;
  }, [applyTax, taxPercentage, purchaseCost]);

  const finalCost = useMemo(() => {
    return purchaseCost + taxAmount;
  }, [purchaseCost, taxAmount]);

  const combinedBillCost = useMemo(() => {
    // When draft items exist, use their total only (the current form values
    // still reflect the last-added item and would double-count otherwise).
    // When no items have been added yet, use the live form's finalCost.
    const draftTotal = draftItems.reduce((acc, item) => acc + (item.finalCost || 0), 0);
    return draftTotal > 0 ? draftTotal : finalCost;
  }, [draftItems, finalCost]);

  // Final Amount (AED) — combinedBillCost converted at the booking-level exchange
  // rate. Same purchaseCurrency for the whole booking (no per-line rate).
  const finalAmountAed = useMemo(() => {
    return combinedBillCost * (Number(exchangeRateToAed) || 1);
  }, [combinedBillCost, exchangeRateToAed]);

  // Step 2 Settlement & Logistics calculations
  const calculatedAdvanceAmount = useMemo(() => {
    if (manualAdvanceAmount !== "") return Number(manualAdvanceAmount);
    const pct = Number(advancePercentage || 0);
    return (combinedBillCost * pct) / 100;
  }, [combinedBillCost, advancePercentage, manualAdvanceAmount]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, combinedBillCost - calculatedAdvanceAmount);
  }, [combinedBillCost, calculatedAdvanceAmount]);

  function handleAddLineItem() {
    let selectedGoodsName = "";
    if (goodsId === "custom") {
      selectedGoodsName = customGoodsName.trim();
    } else {
      selectedGoodsName = selectedGood ? (selectedGood.goodsName || selectedGood.goods_name || "") : (customGoodsName.trim() || "");
    }

    if (!selectedGoodsName) {
      alert("Please select or enter a Goods Name.");
      return;
    }

    const qtyNo = Number(quantityCount || 0);
    if (qtyNo <= 0) {
      alert("Please enter a valid packages count.");
      return;
    }

    const oneKgVal = Number(weightPerPkg || divideKgs || 0);
    const emptyKgVal = Number(emptyKgs || 0);
    const grossKg = qtyNo * oneKgVal;
    const packagingKg = qtyNo * emptyKgVal;
    const calculatedNet = Math.max(grossKg - packagingKg, 0);
    const netKg = calculatedNet > 0 ? calculatedNet : grossKg;
    const rateVal = Number(purchaseRate || 0);
    const exVal = Number(exchangeRateToAed || 1);

    const isPerUnit = priceType === "Price / Box" || priceType === "Price / Bag" || priceType === "Price / Unit" || rateType === "Per Bag / Package";
    const calcAmount = isPerUnit ? qtyNo * rateVal : (netKg > 0 ? netKg * rateVal : grossKg * rateVal);
    const calcFinalAed = calcAmount * exVal;

    const itemObj = {
      id: `draft-${Date.now()}-${Math.random()}`,
      goodsId: goodsId === "custom" ? null : (goodsId || null),
      goodsName: selectedGoodsName,
      hsCode: hsCode || (selectedGood?.hs_code || selectedGood?.hsCode || ""),
      allotId: allotId || "ALT-5239",
      brand: brand === "custom" ? customBrand.trim() : (brand || "-"),
      size: size === "custom" ? customSize.trim() : (size || "-"),
      variety: variety || "-",
      qualityDetails: qualityDetails || "-",
      quantityName: quantityName || "Box",
      quantityCount: qtyNo,
      quantityKgs: qtyNo,
      oneQtyKg: oneKgVal,
      weightPerPkg: oneKgVal,
      emptyKgs: emptyKgVal,
      totalGrossWeight: grossKg,
      netWeight: netKg,
      divideType: divideType || "Divide / Kg",
      divideKgs: Number(divideValue) || Number(divideKgs) || 1,
      numbers: qtyNo,
      priceType: priceType || "Price / Kg",
      rateType: isPerUnit ? "per_bag" : "per_kg",
      purchaseRate: rateVal,
      currency: purchaseCurrency,
      exchangeRate: exVal,
      amount: calcAmount,
      finalAed: calcFinalAed,
      qualityReportRef: qualityReportRef || "Passed",
      origin: selectedOriginCountryName || "—",
      purchaseCost: calcAmount,
      applyTax: applyTax || "No",
      taxType: taxType || "VAT",
      taxPercentage: Number(taxPercentage || 0),
      taxAmount: 0,
      finalCost: calcAmount
    };

    setDraftItems(prev => [...prev, itemObj]);

    // Reset item input fields
    setGoodsId("");
    setCustomGoodsName("");
    setHsCode("");
    setQualityDetails("");
  }

  async function handleSubmit(e: React.SyntheticEvent, options?: { draftOnly?: boolean }) {
    e.preventDefault();

    const resolvedShippingMode = shippingMode === "Custom" ? customShippingMode.trim() : shippingMode;
    
    // Construct descriptive Payment Mode summary with dates
    let resolvedPaymentMode = paymentMode;
    if (paymentMode === "Advance") {
      resolvedPaymentMode = `Advance (${advancePercentage}% Paid: ${advancePaymentDate}, Bal Due: ${remainingDueDate})`;
    } else if (paymentMode === "Cash" || paymentMode === "Bank Transfer") {
      resolvedPaymentMode = `${paymentMode} (${cashPaymentType} on ${cashPaymentDate})`;
    } else if (paymentMode === "Credit") {
      resolvedPaymentMode = `Credit (Due: ${creditDueDate})`;
    }

    let primaryGoodsName = "";
    let primaryGoodsId = null;
    let primaryQuantityKgs = 0;
    let primaryGrossWeight = 0;
    let primaryEmptyKgs = 0;
    let primaryNetWeight = 0;
    let primaryDivideKgs = 50;
    let primaryNumbers = 0;
    let primaryRateType = "per_kg";
    let primaryPurchaseRate = 0;
    let primaryPurchaseCost = 0;
    let primaryFinalCost = 0;
    let primaryApplyTax = "No";
    let primaryTaxType = "VAT";
    let primaryTaxPercentage = 0;
    let primaryTaxAmount = 0;
    let primaryBrand = brand === "custom" ? customBrand.trim() : brand;
    let primarySize = size === "custom" ? customSize.trim() : size;

    if (draftItems.length > 0) {
      const first = draftItems[0];
      primaryGoodsName = draftItems.map(i => i.goodsName).join(" + ");
      primaryGoodsId = first.goodsId;
      primaryQuantityKgs = draftItems.reduce((acc, i) => acc + i.quantityKgs, 0);
      primaryGrossWeight = draftItems.reduce((acc, i) => acc + i.totalGrossWeight, 0);
      primaryEmptyKgs = draftItems.reduce((acc, i) => acc + i.emptyKgs, 0);
      primaryNetWeight = draftItems.reduce((acc, i) => acc + i.netWeight, 0);
      primaryDivideKgs = first.divideKgs;
      primaryNumbers = draftItems.reduce((acc, i) => acc + i.numbers, 0);
      primaryRateType = first.rateType;
      primaryPurchaseRate = first.purchaseRate;
      primaryPurchaseCost = draftItems.reduce((acc, i) => acc + (i.purchaseCost || 0), 0);
      primaryTaxAmount = draftItems.reduce((acc, i) => acc + (i.taxAmount || 0), 0);
      primaryFinalCost = draftItems.reduce((acc, i) => acc + (i.finalCost || 0), 0);
      primaryApplyTax = first.applyTax || "No";
      primaryTaxType = first.taxType || "VAT";
      primaryTaxPercentage = first.taxPercentage || 0;
    } else {
      if (goodsId === "custom") {
        primaryGoodsName = customGoodsName.trim();
      } else {
        primaryGoodsName = selectedGood ? (selectedGood.goodsName || selectedGood.goods_name || "") : "";
      }
      primaryGoodsId = goodsId === "custom" ? null : goodsId;
      primaryQuantityKgs = Number(quantityCount || 0);
      primaryGrossWeight = totalGrossWeight;
      primaryEmptyKgs = Number(emptyKgs || 0);
      primaryNetWeight = netWeight;
      primaryDivideKgs = Number(divideKgs || 0);
      primaryNumbers = numbers;
      primaryRateType = rateType;
      primaryPurchaseRate = Number(purchaseRate || 0);
      primaryPurchaseCost = purchaseCost;
      primaryTaxAmount = taxAmount;
      primaryFinalCost = finalCost;
      primaryApplyTax = applyTax;
      primaryTaxType = taxType;
      primaryTaxPercentage = Number(taxPercentage || 0);
    }

    if (!primaryGoodsName) {
      alert("Please select or enter at least one Goods Item.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyId: activeBranch?.companyId || activeBranch?.company_id || companies[0]?.id,
        countryId: activeBranch?.countryId || activeBranch?.country_id,
        countryBranchId: selectedBranchId,
        cityBranchId: selectedCityBranchId || null,
        goodsId: primaryGoodsId,
        goodsName: primaryGoodsName,
        purchaseAccountNo: shipmentType === "Warehouse Transfer" ? (warehouseAccountNo || null) : (purchaseAccountNo || null),
        salesAccountNo: salesAccountNo || null,
        brokerAccountNo: brokerAccountNo || null,
        contractNo: contractNo.trim() || null,
        brand: primaryBrand || null,
        size: primarySize || null,
        chassisCode: chassisCode.trim() || null,
        lotNo: lotNo.trim() || null,
        supplierName: supplierName.trim(),
        supplierPersonId: supplierPersonId || null,
        paymentMode: resolvedPaymentMode,
        shippingMode: resolvedShippingMode,
        originCountryId: originCountryId === "custom" ? null : (originCountryId || null),
        originCountryName: selectedOriginCountryName,
        advancePercentage: paymentMode === "Advance" ? Number(advancePercentage || 0) : 0,
        advanceAmount: paymentMode === "Advance" ? calculatedAdvanceAmount : 0,
        remainingBalance: paymentMode === "Advance" ? remainingBalance : 0,
        warehouseName: warehouseName.trim() || null,
        warehouseId: selectedWarehouseId && selectedWarehouseId !== "CUSTOM" ? selectedWarehouseId : null,
        warehousePlotNo: warehousePlotNo.trim() || null,
        transferDate: transferDate || null,
        loadingDate: loadingDate || null,
        truckNo: truckNo.trim() || null,
        driverName: driverName.trim() || null,
        remarks: remarks.trim() || null,
        quantityName: quantityName === "Custom" ? customQuantityName.trim() : quantityName,
        quantityKgs: primaryQuantityKgs,
        totalGrossWeight: primaryGrossWeight,
        emptyKgs: primaryEmptyKgs,
        netWeight: primaryNetWeight,
        divideKgs: primaryDivideKgs,
        numbers: primaryNumbers,
        rateType: primaryRateType,
        purchaseRate: primaryPurchaseRate,
        purchaseCurrency: purchaseCurrency,
        exchangeRate: Number(exchangeRateToAed) || 1,
        localCurrency: purchaseCurrency,
        purchaseCost: primaryPurchaseCost,
        applyTax: primaryApplyTax || "No",
        taxType: primaryTaxType || "VAT",
        taxPercentage: primaryTaxPercentage || 0,
        taxAmount: primaryTaxAmount || 0,
        finalCost: primaryFinalCost
      };

      // editingPurchaseId is set only via "Edit Draft" — update that SAME row
      // by id instead of POSTing, which would otherwise create a brand-new
      // duplicate purchase record and leave the original draft orphaned.
      const isEditingDraft = Boolean(editingPurchaseId);
      const res = await fetch(
        isEditingDraft ? `/api/erp/purchases/local-purchase/${editingPurchaseId}` : "/api/erp/purchases/local-purchase",
        {
          method: isEditingDraft ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to save purchase.");

      const newPurchase = data.data?.purchase || data.purchase;

      // Automatically accept the bill as per workflow (Draft -> Accepted transition) only if
      // draft or newly created, AND the user asked for "Book & Accept" rather than "Save Draft".
      let acceptedRecord = newPurchase;
      const isAlreadyProcessed = isEditingDraft && String(newPurchase?.status || "").toLowerCase() !== "draft";
      const draftOnly = Boolean(options?.draftOnly);

      if (!isAlreadyProcessed && !draftOnly) {
        try {
          const acceptRes = await fetch("/api/erp/purchases/local-purchase/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purchaseId: newPurchase.id })
          });
          const acceptData = await acceptRes.json();
          if (acceptRes.ok && acceptData.ok) {
            acceptedRecord = acceptData.data?.purchase || acceptedRecord;
          }
        } catch (acceptErr) {
          console.error("Auto accept failed:", acceptErr);
        }
      }

      if (draftOnly) {
        alert(
          t(lang, "lp.bill_saved_draft", "Bill saved to draft.") +
          ` (${t(lang, "lp.f_serial", "Serial:")} ${newPurchase?.manual_bill_no || newPurchase?.manualBillNo || newPurchase?.id})`
        );
      } else if (isAlreadyProcessed) {
        alert(
          data?.data?.cascaded
            ? "Local Purchase updated successfully! All transferred and linked records (Roznamcha, Journal, General Ledger) have been synchronized."
            : "Local Purchase updated successfully!"
        );
      } else {
        alert("Local Purchase Bill recorded and transitioned to Payment Module successfully!");
      }

      // Reset form
      setIsFormOpen(false);
      setEditingPurchaseId(null);
      setDraftItems([]);
      setCurrentStep(1);
      setGoodsId("");
      setCustomGoodsName("");
      setSupplierName("");
      setSupplierPersonId("");
      setPaymentMode("Cash");
      setShippingMode("Loading");
      setShipmentType("Loading by Truck");
      setCustomShippingMode("");
      setOriginCountryId("");
      setCustomOriginCountryName("");
      setPurchaseAccountNo("");
      setSalesAccountNo("");
      setBrokerAccountNo("");
      setContractNo("");
      setBrand("");
      setCustomBrand("");
      setSize("");
      setCustomSize("");
      setChassisCode("");
      setLotNo("");
      setQuantityCount("");
      setWeightPerPkg("");
      setManualGrossWeight("");
      setEmptyKgs("");
      setPurchaseRate("");
      setAdvancePercentage("20");
      setManualAdvanceAmount("");
      setWarehouseName("");
      setWarehousePlotNo("");
      setTruckNo("");
      setDriverName("");
      setRemarks("");
      setApplyTax("No");
      setTaxType("VAT");
      setTaxPercentage("0");
      setSelectedWarehouseId("");
      setWarehouseAccountNo("");
      setSelectedTruckId("");
      
      // Reload logs and automatically redirect/open the saved voucher
      await loadHistory();
      if (draftOnly) {
        // Stay on the unfiltered registry and open the saved draft's own voucher —
        // this IS the "reopen the draft" proof: a real row, with a real id, readable
        // right back from the same registry the Edit Draft action uses.
        setRegistryFilter("draft");
        setActiveTab("all");
        setSelectedRowForVoucher(newPurchase);
      } else if (isAlreadyProcessed) {
        const targetTab = String(newPurchase?.status || "").toLowerCase() === "posted" ? "posted" : "accepted";
        setActiveTab(targetTab as any);
        setSelectedRowForVoucher(newPurchase);
      } else {
        setActiveTab("accepted"); // Go to Local Purchase Payment view tab
        setSelectedRowForVoucher(acceptedRecord); // Open the verification view
      }
    } catch (err: any) {
      alert(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  // Booking step is required before Goods Entry — the API rejects a save with
  // no debit account and no credit/broker account anyway (zod .min(1) + the
  // .refine on salesAccountNo/brokerAccountNo), so this just surfaces that same
  // requirement before the user leaves the step, instead of only at save time.
  function validateBookingStep(): boolean {
    if (!purchaseAccountNo.trim()) {
      alert(t(lang, "lp.validation_purchase_account", "Please select the Purchase Account (DR) before continuing."));
      return false;
    }
    if (!salesAccountNo.trim() && !brokerAccountNo.trim()) {
      alert(t(lang, "lp.validation_sales_account", "Please select the Sales Account (CR) or a Broker/Agent Account before continuing."));
      return false;
    }
    return true;
  }

  // Mirrors the "at least one Goods Item" check handleSubmit already enforces at
  // save time — surfaced here too so the "3 Final" tab can't be used to skip
  // straight past Goods Entry from Step 1 with nothing entered.
  function validateGoodsStep(): boolean {
    const hasGoodsItem = draftItems.length > 0 || Boolean(goodsId) || Boolean(customGoodsName.trim());
    if (!hasGoodsItem) {
      alert(t(lang, "lp.validation_goods_item", "Please select or enter at least one Goods Item before continuing."));
      return false;
    }
    return true;
  }

  // Filter history
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const rowStatus = String(p.status || p.bill_status || "draft").toLowerCase();
      const isTransferred = rowStatus === "posted" || rowStatus === "transferred" || Boolean(p.transferred_at) || Boolean(p.roznamcha_entry_id);

      // 1. Registry filter
      if (registryFilter === "draft" && rowStatus !== "draft") return false;
      if (registryFilter === "accepted" && rowStatus !== "accepted") return false;
      if (registryFilter === "posted" && rowStatus !== "posted" && !isTransferred) return false;
      if (registryFilter === "transferred" && !isTransferred) return false;
      if (registryFilter === "not_transferred" && isTransferred) return false;
      if (registryFilter === "pending" && (rowStatus === "posted" || isTransferred)) return false;

      // Active tab backwards-compatibility
      if (activeTab === "accepted" && rowStatus !== "accepted") return false;
      if (activeTab === "posted" && rowStatus !== "posted" && !isTransferred) return false;

      // 2. Scope filters (Country, Main Branch, City Branch)
      if (selectedCountryId) {
        const rowCId = String(p.countryId || p.country_id || "");
        if (rowCId && rowCId !== String(selectedCountryId)) return false;
      }
      if (selectedBranchId) {
        const rowBId = String(p.countryBranchId || p.country_branch_id || p.branchId || p.branch_id || "");
        if (rowBId && rowBId !== String(selectedBranchId)) return false;
      }
      if (selectedCityBranchId) {
        const rowCityId = String(p.cityBranchId || p.city_branch_id || "");
        if (rowCityId && rowCityId !== String(selectedCityBranchId)) return false;
      }

      // 3. Date filter
      if (dateFilter) {
        const rowDate = p.created_at || p.createdAt || "";
        if (rowDate && !rowDate.startsWith(dateFilter)) return false;
      }

      // 4. Search Query (Bill No, Supplier, Goods, Voucher No, Account, Date)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          p.goodsName?.toLowerCase().includes(q) ||
          p.goods_name?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          p.supplier_name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.bill_no?.toLowerCase().includes(q) ||
          p.billNo?.toLowerCase().includes(q) ||
          p.manual_bill_no?.toLowerCase().includes(q) ||
          p.journal_serial_no?.toLowerCase().includes(q) ||
          p.serial_no?.toLowerCase().includes(q) ||
          p.purchase_account_no?.toLowerCase().includes(q) ||
          p.sales_account_no?.toLowerCase().includes(q) ||
          p.broker_account_no?.toLowerCase().includes(q) ||
          p.paymentMode?.toLowerCase().includes(q) ||
          p.payment_mode?.toLowerCase().includes(q) ||
          (p.created_at && new Date(p.created_at).toLocaleDateString("en-GB").includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [purchases, searchQuery, registryFilter, activeTab, selectedCountryId, selectedBranchId, selectedCityBranchId, dateFilter]);

  const acceptedCount = useMemo(
    () => purchases.filter(p => (p.status || p.bill_status || p.billStatus) === "accepted").length,
    [purchases]
  );

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));
  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  const allCurrentPageSelected = paginatedPurchases.length > 0 && paginatedPurchases.every(p => selectedRowIds.has(p.id));
  const toggleSelectAll = () => {
    const next = new Set(selectedRowIds);
    if (allCurrentPageSelected) {
      paginatedPurchases.forEach(p => next.delete(p.id));
    } else {
      paginatedPurchases.forEach(p => next.add(p.id));
    }
    setSelectedRowIds(next);
  };
  const localPurchaseDashboard = useMemo(() => {
    const countryLookup = new Map<string, string>();
    countryOptions.forEach((c: any) => countryLookup.set(String(c.id), c.name || "Unknown Country"));

    const branchLookup = new Map<string, string>();
    countryBranches.forEach((b: any) => branchLookup.set(String(b.id), b.name || b.branchName || b.branch_name || "Main Branch"));

    const cityLookup = new Map<string, string>();
    cityBranches.forEach((b: any) => cityLookup.set(String(b.id), b.name || b.branchName || b.branch_name || "City Branch"));

    const byCountry = new Map<string, any>();
    let totalPurchase = 0;
    let totalTax = 0;
    let totalFinal = 0;
    let postedBills = 0;
    let draftBills = 0;

    filteredPurchases.forEach((row: any) => {
      const postingState = deriveLocalPurchasePostingState(row);
      const status = String(row.status || row.bill_status || "draft").toLowerCase();
      const purchaseAmount = Number(row.purchaseCost || row.purchase_cost || row.sub_total || row.subTotal || 0);
      const taxAmount = Number(row.taxAmount || row.tax_amount || 0);
      const finalAmount = Number(row.finalCost || row.final_cost || row.final_amount || row.finalAmount || purchaseAmount + taxAmount || 0);
      totalPurchase += purchaseAmount;
      totalTax += taxAmount;
      totalFinal += finalAmount;
      if (postingState.isComplete) postedBills += 1;
      if (status === "draft") draftBills += 1;

      const countryId = String(row.countryId || row.country_id || activeBranch?.countryId || activeBranch?.country_id || "all");
      const countryName = row.countryName || row.country_name || countryLookup.get(countryId) || activeBranch?.countryName || activeBranch?.country_name || "Unknown Country";
      const currency = row.localCurrency || row.local_currency || row.purchaseCurrency || row.purchase_currency || activeBranch?.currency || localCurrency || "PKR";
      const branchId = String(row.cityBranchId || row.city_branch_id || row.branchId || row.branch_id || row.countryBranchId || row.country_branch_id || activeBranch?.id || "main");
      const branchName = row.cityBranchName || row.city_branch_name || row.branchName || row.branch_name || cityLookup.get(branchId) || branchLookup.get(branchId) || activeBranch?.name || "Main Branch";

      if (!byCountry.has(countryId)) {
        byCountry.set(countryId, {
          id: countryId,
          countryName,
          currency,
          bills: 0,
          totalPurchase: 0,
          totalTax: 0,
          totalFinal: 0,
          postedBills: 0,
          draftBills: 0,
          branches: new Map<string, any>(),
        });
      }

      const country = byCountry.get(countryId);
      country.bills += 1;
      country.totalPurchase += purchaseAmount;
      country.totalTax += taxAmount;
      country.totalFinal += finalAmount;
      country.postedBills += postingState.isComplete ? 1 : 0;
      country.draftBills += status === "draft" ? 1 : 0;

      if (!country.branches.has(branchId)) {
        country.branches.set(branchId, { branchName, bills: 0, totalPurchase: 0, totalTax: 0, totalFinal: 0, postedBills: 0 });
      }
      const branch = country.branches.get(branchId);
      branch.bills += 1;
      branch.totalPurchase += purchaseAmount;
      branch.totalTax += taxAmount;
      branch.totalFinal += finalAmount;
      branch.postedBills += postingState.isComplete ? 1 : 0;
    });

    const countries = Array.from(byCountry.values()).map((country: any) => ({
      ...country,
      branches: Array.from(country.branches.values()),
    }));

    return {
      totalBills: filteredPurchases.length,
      postedBills,
      draftBills,
      pendingBills: Math.max(filteredPurchases.length - postedBills, 0),
      totalPurchase,
      totalTax,
      totalFinal,
      remainingBalance: Math.max(totalFinal - totalPurchase, 0),
      countries,
    };
  }, [filteredPurchases, countryOptions, countryBranches, cityBranches, activeBranch, localCurrency]);

  const selectedCountryReport = useMemo(() => {
    if (!selectedCountryReportId) return null;
    return localPurchaseDashboard.countries.find((c: any) => String(c.id) === String(selectedCountryReportId)) || null;
  }, [selectedCountryReportId, localPurchaseDashboard.countries]);

  return (
    <div className="w-full px-3 sm:px-6 py-4 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Header & Navigation */}
      {isFormOpen ? (
        /* Voucher / Form Top Action Bar */
        <section data-erp-page-actions className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-xs backdrop-blur-md transition-all dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:border-blue-400 hover:bg-blue-50/80 hover:text-blue-700 hover:shadow-xs active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title={t(lang, "lp.back_to_registry", "Back to Registry")}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-white text-slate-600 shadow-2xs transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-700 dark:text-slate-300">
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">
                {t(lang, "lp.back_to_registry", "Back to Registry")}
              </span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xs font-black text-slate-900 dark:text-slate-100 sm:text-sm">
                    {t(lang, "lp.voucher_title", "Local Purchase Booking Voucher")}
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                    ENTRY MODE
                  </span>
                </div>
                <p className="hidden md:block truncate text-[9.5px] font-medium text-slate-400">
                  {t(lang, "purchase.voucher_subtitle", "Official Bill / Confirmation — document backing for Goods, Shipping & Payment")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTopActionsOpen((prev) => !prev)}
              className="h-8 gap-1 rounded-xl border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "pa.actions", "Actions")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => router.push("/dashboard")}
              className="h-8 w-8 rounded-xl border-rose-200/80 bg-rose-50/70 text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 active:scale-95 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400"
              title={t(lang, "pa.close", "Close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : (
        /* Registry Mode Header & Smart Filter Bar Matching Reference Design */
        <div className="space-y-4">
          {/* 1. Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold px-1">
            <span>{t(lang, "nav.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span>{t(lang, "nav.purchase", "Purchase")}</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">{t(lang, "lp.title", "Local Purchase Registry")}</span>
          </div>

          {/* 2. Top Banner Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs shrink-0">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {t(lang, "lp.title", "Local Purchase Registry")}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    PURCHASE LOCAL
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t(lang, "lp.subtitle", "Record local purchases with custom weights and automated ledger postings.")}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2.5">
              {/* Motto / Quote */}
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-[11px] font-black italic tracking-wide text-slate-700 dark:text-slate-300">
                  &ldquo;&ldquo;&ldquo;&ldquo;Better Purchase Control Stronger Business Tomorrow&rdquo;
                </span>
                <div className="h-0.5 w-10 bg-amber-500 rounded-full mt-0.5 me-3" />
              </div>

              {/* Date Selector & + New Purchase Split Button */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDatePicker((prev) => !prev);
                    }}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      {dateFilter
                        ? new Date(dateFilter).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {showDatePicker && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute end-0 top-full mt-1.5 z-50 p-3 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 w-52 space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500">
                        <span>{t(lang, "lp.purchase_date", "Filter by Date")}</span>
                        {dateFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setDateFilter("");
                              setShowDatePicker(false);
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => {
                          setDateFilter(e.target.value);
                          setShowDatePicker(false);
                        }}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-slate-50 dark:bg-slate-800 dark:text-slate-200 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="relative inline-flex items-center shadow-md shadow-blue-500/20 rounded-xl overflow-hidden">
                  <Button
                    type="button"
                    onClick={() => {
                      setScopeCountryId(selectedCountryId || countryOptions[0]?.id || "");
                      setScopeBranchId(selectedBranchId || filteredCountryBranches[0]?.id || "");
                      setScopeCityBranchId(selectedCityBranchId || activeCityBranches[0]?.id || "");
                      setIsScopeModalOpen(true);
                    }}
                    className="h-9 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t(lang, "lp.create_button", "New Purchase")}</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeCountryId(selectedCountryId || countryOptions[0]?.id || "");
                      setScopeBranchId(selectedBranchId || filteredCountryBranches[0]?.id || "");
                      setScopeCityBranchId(selectedCityBranchId || activeCityBranches[0]?.id || "");
                      setIsScopeModalOpen(true);
                    }}
                    className="h-9 px-2 bg-blue-700 hover:bg-blue-800 text-white border-s border-blue-500/40 flex items-center justify-center transition"
                    title={t(lang, "lp.booking_posting_bill", "New Purchase Options")}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Smart Filter Bar Matching Reference Design */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Country Searchable Dropdown */}
              <div className="flex flex-col gap-1 min-w-[150px] flex-1 sm:flex-initial">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "lp.country", "Country")}
                </span>
                <select
                  value={selectedCountryId}
                  onChange={(e) => {
                    setSelectedCountryId(e.target.value);
                    setSelectedBranchId("");
                    setSelectedCityBranchId("");
                  }}
                  className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">🌐 {t(lang, "lp.all_purchases", "All Countries")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {getCountryFlag(c.name)} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch / City Dropdown (Country -> Main Branch -> City Branch) */}
              <div className="flex flex-col gap-1 min-w-[170px] flex-1 sm:flex-initial">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "lp.branch_name", "Branch / City")}
                </span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setSelectedCityBranchId("");
                  }}
                  className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">🏢 {t(lang, "lp.all_branches", "All Branches")}</option>
                  {filteredCountryBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
                  {t(lang, "common.search", "Search")}
                </span>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t(lang, "lp.search_placeholder", "Search by bill no, supplier, goods, voucher...")}
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 ps-9 pe-3 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Registry Filter Dropdown */}
              <div className="flex flex-col gap-1 min-w-[150px] flex-1 sm:flex-initial">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "lp.title", "Registry")}
                </span>
                <select
                  value={registryFilter}
                  onChange={(e) => setRegistryFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="all">{t(lang, "lp.all_purchases", "All Purchases")}</option>
                  <option value="draft">{t(lang, "lp.draft_bills", "Draft")}</option>
                  <option value="pending">{t(lang, "lp.pending_bills", "Pending")}</option>
                  <option value="posted">{t(lang, "lp.col_posted", "Posted")}</option>
                  <option value="accepted">{t(lang, "lp.posted_accepted", "Accepted")}</option>
                  <option value="transferred">{t(lang, "lp.col_posted", "Transferred")}</option>
                  <option value="not_transferred">{t(lang, "lp.pending_bills", "Not Transferred")}</option>
                </select>
              </div>

              {/* More Filters Toggle */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen((prev) => !prev)}
                  className={cn(
                    "h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition",
                    moreFiltersOpen
                      ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                  <span>{t(lang, "common.filter", "More Filters")}</span>
                </button>
              </div>

              {/* Reset Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  title={t(lang, "common.reset", "Reset Filters")}
                  onClick={() => {
                    setSelectedCountryId("");
                    setSelectedBranchId("");
                    setSelectedCityBranchId("");
                    setSearchQuery("");
                    setRegistryFilter("all");
                    setDateFilter("");
                    setCurrentPage(1);
                  }}
                  className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Collapsible Extra Filters Panel */}
            {moreFiltersOpen && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {t(lang, "lp.city_branch", "City Branch")}
                  </label>
                  <select
                    value={selectedCityBranchId}
                    onChange={(e) => setSelectedCityBranchId(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="">{t(lang, "lp.all_branches", "All City Branches")}</option>
                    {activeCityBranches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Currency
                  </label>
                  <select
                    value={purchaseCurrency}
                    onChange={(e) => setPurchaseCurrency(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local Purchase Voucher Header matching approved Prototype */}
      {isFormOpen && (
        <div className="space-y-2 mb-3">
          {/* Top Toolbar matching Prototype */}
          <div className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between px-3 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                &larr; {t(lang, "common.back", "Back")}
              </button>
              <strong className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-tight">
                {t(lang, "lp.local_purchase_booking", "LOCAL PURCHASE BOOKING")}
              </strong>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 hover:bg-blue-100 transition"
              >
                {t(lang, "lp.local_purchase_report", "LOCAL PURCHASE REPORT")}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t(lang, "common.live", "LIVE")}
              </span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                {t(lang, "common.register", "Register")}
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-full border border-blue-600 bg-blue-600 text-white text-[10px] font-bold shadow-xs"
              >
                {t(lang, "common.new", "New")}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                {t(lang, "common.report", "Report")}
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                {t(lang, "common.actions", "Actions")}
              </button>
            </div>
          </div>

          {/* Top Voucher Bar — matching prototype .top-company bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 px-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                LP
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  {t(lang, "lp.voucher_title", "Local Purchase Booking Voucher")}
                </div>
                <div className="text-[9.5px] text-slate-400 font-medium">
                  {activeBranch?.companyName || "Business Name"} &mdash; {activeBranch?.name || "UAE Main Branch"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
              <span>{t(lang, "lp.country", "Country")}: <strong className="font-bold text-slate-800 dark:text-slate-100">{activeBranch?.countryName || "UAE"}</strong></span>
              <span>{t(lang, "purchase.city", "City")}: <strong className="font-bold text-slate-800 dark:text-slate-100">{activeBranch?.cityName || "Dubai"}</strong></span>
              <span>{t(lang, "common.status", "Status")}: <strong className="font-bold text-amber-600">{editingPurchaseId ? t(lang, "lp.editing_draft", "Draft (Edit)") : t(lang, "purchase.draft_badge", "Draft")}</strong></span>
            </div>
          </div>
        </div>
      )}

      {!isFormOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Branch & User Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                1. {t(lang, "lp.branch_user_details", "Branch & User Details")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">{t(lang, "lp.country", "Country")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                  {activeBranch?.countryName || "All"}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">{t(lang, "lp.branch_name", "Branch Name")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                  {activeBranch?.name || "All Branches"}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 font-medium">{t(lang, "lp.user_name", "User Name")}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                  {session.fullName || session.email || "Super Admin"}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
              <span className="text-slate-400 font-medium">{t(lang, "lp.date_time", "Date & Time")}</span>
              <span suppressHydrationWarning className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          {/* Card 2: Financial Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                2. {t(lang, "lp.financial_summary", "Financial Summary")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_local_purchase_bills", "Total Local Purchase Bills")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{localPurchaseDashboard.totalBills}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_purchase_amount", "Total Purchase Amount")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(localPurchaseDashboard.totalPurchase, localCurrency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_tax_amount", "Total Tax Amount")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{money(localPurchaseDashboard.totalTax, localCurrency)}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{t(lang, "lp.total_final_amount", "Total Final Amount")}</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {money(localPurchaseDashboard.totalFinal, localCurrency)}
              </span>
            </div>
          </div>

          {/* Card 3: Bill Entry Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. {t(lang, "lp.bill_entry_summary", "Bill Entry Summary")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_bills", "Total Bills")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{localPurchaseDashboard.totalBills}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.posted_accepted", "Posted / Accepted")}</span>
                <span className="font-mono font-bold text-emerald-600">{localPurchaseDashboard.postedBills}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.draft_bills", "Draft Bills")}</span>
                <span className="font-mono font-bold text-amber-600">{localPurchaseDashboard.draftBills}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">{t(lang, "lp.pending_bills", "Pending Bills")}</span>
              <span className="font-mono font-bold text-rose-600">{localPurchaseDashboard.pendingBills}</span>
            </div>
          </div>

          {/* Card 4: All Countries Report */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  4. {t(lang, "lp.all_countries_report", "All Countries Report")}
                </p>
              </div>
              <select
                value={selectedCountryReportId}
                onChange={(e) => setSelectedCountryReportId(e.target.value)}
                className="h-6 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[110px]"
              >
                <option value="">{t(lang, "lp.all_purchases", "All Countries")}</option>
                {countryOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="py-1 flex justify-between items-baseline gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {selectedCountryReport ? selectedCountryReport.countryName : `${localPurchaseDashboard.countries.length} ${t(lang, "lp.countries_label", "Countries")}`}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedCountryReport ? selectedCountryReport.bills : localPurchaseDashboard.totalBills} {t(lang, "lp.bills_label", "bills")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-medium block">{t(lang, "lp.total_amount", "Total Amount")}</span>
                <span className="font-mono font-black text-xs text-orange-600 dark:text-orange-400">
                  {selectedCountryReport
                    ? money(selectedCountryReport.totalFinal, selectedCountryReport.currency || localCurrency)
                    : money(localPurchaseDashboard.totalFinal, localCurrency)}
                </span>
              </div>
            </div>

            {/* Mini vertical bar chart illustration */}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-end justify-between gap-1.5 h-10 px-0.5">
                {localPurchaseDashboard.countries.length > 0
                  ? localPurchaseDashboard.countries.slice(0, 6).map((country: any, idx: number) => {
                      const maxBills = Math.max(...localPurchaseDashboard.countries.map((c: any) => c.bills || 1), 1);
                      const heightPct = Math.max(25, Math.min(100, Math.round(((country.bills || 1) / maxBills) * 100)));
                      const barColors = [
                        "bg-blue-500",
                        "bg-emerald-500",
                        "bg-amber-500",
                        "bg-purple-500",
                        "bg-rose-500",
                        "bg-teal-500",
                      ];
                      return (
                        <div key={country.id || idx} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t h-7 flex items-end">
                            <div
                              className={cn("w-full rounded-t transition-all", barColors[idx % barColors.length])}
                              style={{ height: `${heightPct}%` }}
                              title={`${country.countryName}: ${country.bills} bills`}
                            />
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 truncate max-w-[26px]">
                            {country.countryName.slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                      );
                    })
                  : [
                      { h: "45%", label: "UAE", bg: "bg-blue-400" },
                      { h: "85%", label: "PK", bg: "bg-emerald-400" },
                      { h: "60%", label: "AF", bg: "bg-amber-400" },
                      { h: "75%", label: "OM", bg: "bg-purple-400" },
                      { h: "95%", label: "SA", bg: "bg-blue-500" },
                      { h: "50%", label: "UK", bg: "bg-rose-400" },
                    ].map((bar, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t h-7 flex items-end">
                          <div
                            className={cn("w-full rounded-t transition-all", bar.bg)}
                            style={{ height: bar.h }}
                          />
                        </div>
                        <span className="text-[8px] font-bold text-slate-400">{bar.label}</span>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Conditional Content: Form Wizard vs Full-Width Registry Log Table */}
      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="w-full space-y-5 animate-in fade-in duration-200">

          {/* Stepper Navigation — right-aligned matching prototype .core-nav-wrap */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: draft status pill */}
            <span className="text-[9.5px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {editingPurchaseId ? t(lang, "lp.editing_draft", "EDITING DRAFT") : t(lang, "purchase.draft_badge", "DRAFT")}
            </span>
            {/* Right: step pills grid matching prototype's max-width:620px steps grid */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl shadow-xs ms-auto">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                  currentStep === 1 ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t(lang, "lp.step1_tab", "1 Booking")}
              </button>
              <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
              <button
                type="button"
                onClick={() => { if (currentStep === 1 && !validateBookingStep()) return; setCurrentStep(2); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                  currentStep === 2 ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t(lang, "lp.step2_tab", "GOODS")}
              </button>
              <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1) {
                    if (!validateBookingStep()) return;
                    if (!validateGoodsStep()) return;
                  } else if (currentStep === 2 && !validateGoodsStep()) {
                    return;
                  }
                  setCurrentStep(3);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                  currentStep === 3 ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t(lang, "lp.step3_tab_final", "4 Verify")}
              </button>
            </div>
          </div>

          {/* 2-Column Split: Active Step Form (Left) vs Added Goods Table (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-5 items-start">
            {/* Left Column: Form Stepper Card — matches the owner-approved
                local_purchase_workflow_v49 prototype: a gold GRADIENT strip
                header (card-head.yellow-strip: #fff3bf -> #ffe08a) on an
                otherwise plain white card body, not a full amber wash. */}
            <Card className="border-border shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-950/40 dark:to-amber-900/30 border-b border-amber-300 dark:border-amber-800 p-3.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  {currentStep === 1 && <><FileText className="h-4 w-4 text-blue-600" /> {t(lang, "lp.step1_header_booking", "STEP 1: BOOKING")}</>}
                  {currentStep === 2 && <><Package className="h-4 w-4 text-blue-600" /> {t(lang, "lp.step2_header", "STEP 2: GOODS ENTRY")}</>}
                  {currentStep === 3 && <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t(lang, "lp.step3_header_final", "STEP 3: FINAL")}</>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-400 dark:border-amber-700">
                    {t(lang, "purchase.draft_badge", "DRAFT")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="p-1 text-amber-800/70 hover:text-amber-900 hover:bg-amber-300/50 dark:text-amber-300/70 dark:hover:bg-amber-800/50 rounded-lg transition"
                    title={t(lang, "lp.close_form_return", "Close Form & Return to Registry")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>

            <CardContent className="p-5 space-y-4">
              
              {/* STEP 1: BILL INFORMATION */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-blue-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, "lp.bill_accounts_info", "1. Bill & Accounts Information")}</h4>
                  </div>

                  <VoiceFormFill
                    context="purchase"
                    lang={lang}
                    compact
                    onApply={(f) => {
                      if (f.purchaseCurrency && typeof f.purchaseCurrency === "string") {
                        setPurchaseCurrency(String(f.purchaseCurrency).toUpperCase().slice(0, 3));
                      }
                    }}
                  />

                  <div className="space-y-3">
                    {/* 1. Sales Account (CR) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.sales_account_cr", "Sales Account (CR) *")}</label>
                      <select
                        value={salesAccountNo}
                        onChange={e => setSalesAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                        required
                      >
                        <option value="">{t(lang, "lp.select_cr_account", "Select Credit Account...")}</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.code}>
                            {acc.code} - {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Purchase Account (DR) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.purchase_account_dr", "Purchase Account (DR) *")}</label>
                      <select
                        value={purchaseAccountNo}
                        onChange={e => setPurchaseAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                        required
                      >
                        <option value="">{t(lang, "lp.select_dr_account", "Select Debit Account...")}</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.code}>
                            {acc.code} - {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Broker / Agent Account */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <User className="h-3 w-3 text-purple-600" /> {t(lang, "lp.broker_account", "Broker / Agent Account")}
                      </label>
                      <select
                        value={brokerAccountNo}
                        onChange={e => setBrokerAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                      >
                        <option value="">{t(lang, "lp.select_broker", "Select Broker Account...")}</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.code}>
                            {acc.code} - {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3a. Contract No. — matches the approved prototype's "Contract No." field */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        {t(lang, "lp.contract_no", "Contract No.")}
                      </label>
                      <input
                        type="text"
                        value={contractNo}
                        onChange={e => setContractNo(e.target.value)}
                        placeholder={t(lang, "lp.contract_no_ph", "Contract no.")}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                      />
                    </div>

                    {/* 3b. Supplier / Vendor (Person Master) */}
                    <div>
                      <PersonPicker
                        label={t(lang, "lp.supplier", "Supplier / Vendor")}
                        value={supplierPersonId}
                        onValueChange={async (personId) => {
                          setSupplierPersonId(personId);
                          if (!personId) return;
                          try {
                            const res = await fetch(`/api/erp/customers/${personId}`);
                            const json = await res.json();
                            if (json?.customer?.customer_name) setSupplierName(json.customer.customer_name);
                          } catch { /* ignore */ }
                        }}
                      />
                    </div>

                    {/* 4. Shipment Type & 5. Payment Condition */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.shipment_type", "Shipment Type *")}</label>
                        <select
                          value={shipmentType}
                          onChange={e => {
                            const nextType = e.target.value;
                            setShipmentType(nextType);
                            setShippingMode(SHIPMENT_TYPE_TO_SHIPPING_MODE[nextType] || "Loading");
                          }}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-blue-700"
                        >
                          <option value="Loading by Truck">{t(lang, "lp.shipment_loading", "Loading by Truck")}</option>
                          <option value="Warehouse Transfer">{t(lang, "lp.shipment_warehouse", "Warehouse Transfer")}</option>
                          <option value="Export Shipment">{t(lang, "lp.shipment_export", "Export Shipment")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.payment_condition", "Payment Condition *")}</label>
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          {PAYMENT_MODES.map(pm => <option key={pm.value} value={pm.value}>{translateOptionLabel(lang, pm.label)}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* 6. Origin Country */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <Globe className="h-3 w-3 text-blue-600" /> {t(lang, "lp.origin_country", "Origin Country")}
                      </label>
                      <select
                        value={originCountryId}
                        onChange={e => setOriginCountryId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold"
                      >
                        <option value="">{t(lang, "lp.local_branch_country", "Local (Branch Country)")}</option>
                        {countries.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 6b. Purchase Currency + Exchange Rate to AED — booking-level (see
                        finalAmountAed useMemo); the payload field `exchangeRate` already
                        existed and was always hardcoded to 1 before this real input. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                          <Coins className="h-3 w-3 text-emerald-600" /> {t(lang, "lp.purchase_currency", "Purchase Currency *")}
                        </label>
                        <select
                          value={purchaseCurrency}
                          onChange={e => setPurchaseCurrency(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {t(lang, "lp.exchange_rate_to_aed", "Exchange Rate to AED")}
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={exchangeRateToAed}
                          onChange={e => setExchangeRateToAed(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-mono font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    {/* 7. Remarks / Terms Notes */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.remarks_label", "Remarks / Terms Notes")}</label>
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder={t(lang, "lp.ph_remarks", "Write booking terms, shipment notes, or payment instructions...")}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none font-sans"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: GOODS ENTRY */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-emerald-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(lang, "lp.goods_entry_section", "2. Goods Entry & Pricing Metrics")}</h4>
                  </div>

                  <div className="space-y-3">
                    {/* 1. Goods Name */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.goods_selection", "Goods Selection (Goods Name) *")}</label>
                      <select
                        value={goodsId}
                        onChange={e => setGoodsId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                      >
                        <option value="">{t(lang, "lp.select_goods", "Select Goods Master...")}</option>
                        {goodsOptions.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                        <option value="CUSTOM">{t(lang, "lp.custom_entry", "+ Custom Product Entry")}</option>
                      </select>
                      {goodsId === "CUSTOM" && (
                        <input
                          value={customGoodsName}
                          onChange={e => setCustomGoodsName(e.target.value)}
                          placeholder={t(lang, "lp.ph_custom_goods", "Enter Custom Goods Name...")}
                          className="w-full h-9 mt-2 rounded-lg border border-blue-300 bg-blue-50/50 px-3 text-xs font-bold outline-none"
                        />
                      )}
                    </div>

                                        {/* HS Code & Allot Name/ID — Prototype Step 2 fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.hs_code", "HS Code")}</label>
                        <input
                          value={hsCode}
                          onChange={e => setHsCode(e.target.value)}
                          placeholder={t(lang, "lp.ph_hs_code", "HS Code")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.allot_id", "Allot Name / ID")}</label>
                        <input
                          value={allotId}
                          onChange={e => setAllotId(e.target.value)}
                          placeholder="ALT-5239"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                        />
                      </div>
                    </div>

{/* 2. Chassis / Lot Code */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.chassis_lot", "Chassis / Lot Code")}</label>
                        <input
                          value={chassisCode}
                          onChange={e => setChassisCode(e.target.value)}
                          placeholder={t(lang, "lp.ph_chassis", "Auto / Chassis #")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none text-blue-700 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.lot_mark", "Lot Number / Mark")}</label>
                        <input
                          value={lotNo}
                          onChange={e => setLotNo(e.target.value)}
                          placeholder={th("e.g. Lot-100")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    {/* 3. Brand & 4. Size */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Brand with popover + New Brand */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.brand_label", "Brand")}</label>
                        {brandOptions.length > 0 ? (
                          <MasterSelectPopover
                            label=""
                            value={brand}
                            displayValue={brand || ""}
                            options={brandOptions}
                            onSelect={v => setBrand(v)}
                            onAddNew={() => setIsAddingBrandModal(true)}
                            addNewLabel={t(lang, "lp.new_brand", "New Brand")}
                            placeholder={t(lang, "lp.ph_brand", "Select Brand...")}
                          />
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={brand}
                              onChange={e => setBrand(e.target.value)}
                              placeholder={th("e.g. Brand Name")}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                            />
                            {selectedGood && (
                              <button type="button" onClick={() => setIsAddingBrandModal(true)}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                <Plus className="h-3 w-3" /> {th("Add Brand")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Size with popover + New Size */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.size_spec", "Size Specification")}</label>
                        {sizeOptions.length > 0 ? (
                          <MasterSelectPopover
                            label=""
                            value={size}
                            displayValue={size || ""}
                            options={sizeOptions}
                            onSelect={v => setSize(v)}
                            onAddNew={() => setIsAddingSizeModal(true)}
                            addNewLabel={t(lang, "lp.new_size", "New Size")}
                            placeholder={t(lang, "lp.ph_size", "Select Size...")}
                          />
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={size}
                              onChange={e => setSize(e.target.value)}
                              placeholder={th("e.g. Size / Spec")}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                            />
                            {selectedGood && (
                              <button type="button" onClick={() => setIsAddingSizeModal(true)}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                <Plus className="h-3 w-3" /> {th("Add Size")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                                        {/* Variety + Quality/Extra Details — Prototype Step 2 fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.variety", "Variety")}</label>
                        <input
                          value={variety}
                          onChange={e => setVariety(e.target.value)}
                          placeholder={t(lang, "lp.ph_variety", "Select Variety")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.quality_extra", "Quality / Extra Details")}</label>
                        <input
                          value={qualityDetails}
                          onChange={e => setQualityDetails(e.target.value)}
                          placeholder={t(lang, "lp.ph_quality_extra", "Quality / Extra Details")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                        />
                      </div>
                    </div>

{/* 5. Quantity Type & 6. Quantity Number */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.qty_type", "Quantity Type (Packing)")}</label>
                        <select
                          value={quantityName}
                          onChange={e => setQuantityName(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold"
                        >
                          {QUANTITY_NAMES.map(qn => <option key={qn} value={qn}>{qn}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.qty_count", "Quantity Number (Count) *")}</label>
                        <input
                          type="number"
                          value={quantityCount}
                          onChange={e => setQuantityCount(e.target.value)}
                          placeholder="e.g. 800"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    {/* 7. Weight per Quantity (KG) + Empty Tare (KG) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wt_per_pkg", "Weight per Quantity (KG) *")}</label>
                        <input
                          type="number"
                          step="any"
                          value={weightPerPkg}
                          onChange={e => setWeightPerPkg(e.target.value)}
                          placeholder={`Default: ${divideKgs} KG`}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold outline-none text-blue-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.empty_tare", "1 Empty Tare Weight (KG)")}</label>
                        <input
                          type="number"
                          step="any"
                          value={emptyKgs}
                          onChange={e => setEmptyKgs(e.target.value)}
                          placeholder={th("e.g. 1 KG")}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-red-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* 8. Total Weight (Auto Calculate) */}
                    <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                      <label className="block text-[9px] font-bold text-blue-700 uppercase mb-1">Total Weight (Auto Calculate)</label>
                      <input
                        readOnly
                        value={`${netWeight.toLocaleString()} KG (Net Weight)`}
                        className="w-full h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                      />
                    </div>

                    {/* 9. Divide Type & 10. Divide Value */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.divide_type", "Divide Type")}</label>
                        <select
                          value={divideType}
                          onChange={e => setDivideType(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          <option value="D/KGs">{t(lang, "lp.d_kgs", "D/KGs (KG/Bag Divide)")}</option>
                          <option value="D/Ton">{t(lang, "lp.d_ton", "D/Ton (Metric Ton Divide)")}</option>
                          <option value="D/Unit">{t(lang, "lp.d_unit", "D/Unit (Direct Unit Divide)")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.divide_value", "Divide Value (KG)")}</label>
                        <input
                          type="number"
                          step="any"
                          value={divideKgs}
                          onChange={e => setDivideKgs(Number(e.target.value) || 50)}
                          placeholder="50"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-purple-700 outline-none"
                        />
                      </div>
                    </div>

                    {/* 11. Total Divide Units (Auto Calculate) */}
                    <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl">
                      <label className="block text-[9px] font-bold text-purple-700 uppercase mb-1">{t(lang, "lp.total_divide_auto", "Total Divide Units (Auto Calculate)")}</label>
                      <input
                        readOnly
                        value={`${numbers.toLocaleString()} Packs/Units`}
                        className="w-full h-9 rounded-lg border border-purple-200 bg-white px-3 text-xs font-mono font-bold text-purple-700 outline-none"
                      />
                    </div>

                    {/* 12. Price Type & 13. Unit Price */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.price_type", "Price Type (Rate Basis)")}</label>
                        <select
                          value={rateType}
                          onChange={e => setRateType(e.target.value as any)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          <option value="Per KG Weight">{t(lang, "lp.per_kg", "Per KG Weight")}</option>
                          <option value="Per Bag / Package">{t(lang, "lp.per_bag", "Per Bag / Package")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.unit_price_rate", "Unit Price Rate *")}</label>
                        <input
                          type="number"
                          step="any"
                          value={purchaseRate}
                          onChange={e => setPurchaseRate(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold outline-none text-emerald-600"
                        />
                      </div>
                    </div>

                    {/* 14. Final Amount (Auto Calculate) & 15. Tax Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.final_amount_auto", "Final Amount (Auto Calculate)")}</label>
                        <input
                          readOnly
                          value={`${purchaseCurrency} ${finalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-700 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.tax_type_option", "Tax Type Option")}</label>
                        <select
                          value={applyTax}
                          onChange={e => setApplyTax(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none"
                        >
                          <option value="No">{t(lang, "lp.no_tax", "No Tax")}</option>
                          <option value="Yes">{t(lang, "lp.apply_tax", "Apply Tax / VAT")}</option>
                        </select>
                      </div>
                    </div>

                    {/* 16. Tax Percentage (Auto Calculate) */}
                    {applyTax === "Yes" && (
                      <div className="grid grid-cols-2 gap-3 p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.tax_pct", "Tax Percentage (%)")}</label>
                          <input
                            type="number"
                            value={taxPercentage}
                            onChange={e => setTaxPercentage(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.calc_tax", "Calculated Tax Amount")}</label>
                          <input
                            readOnly
                            value={`${purchaseCurrency} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            className="w-full h-9 rounded-lg border-blue-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  
                    {/* Quality Report Reference — Prototype Step 2 field */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.quality_report_ref", "Quality Report Reference")}</label>
                      <input
                        value={qualityReportRef}
                        onChange={e => setQualityReportRef(e.target.value)}
                        placeholder={t(lang, "purchase.quality_passed_placeholder", "Passed")}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none font-bold text-emerald-700"
                      />
                    </div>

<div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="w-1/3 h-9 rounded-xl text-xs font-bold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {th("Back")}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddLineItem}
                      className="w-1/3 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" /> {t(lang, "lp.add_item_to_list", "Add Item to List")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => { if (!validateGoodsStep()) return; setCurrentStep(3); }}
                      className="w-1/3 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm"
                    >
                      {t(lang, "lp.next_final", "Next: Final")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {/* PAYMENT & LOGISTICS — merged into the Step 1 "Booking" display (owner-approved
                  Booking/Goods Entry/Final restyle). Condition changed from the old, separate
                  "STEP 3: PAYMENT & LOGISTICS" (currentStep === 3) so this content renders
                  together with the Step 1 Bill & Accounts fields, matching the prototype's
                  single "Booking" step. Field bindings/logic below are unchanged. */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-purple-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-purple-600" /> {t(lang, "lp.payment_logistics", "3. Payment & Logistics Details")}
                    </h4>
                  </div>

                  <div className="space-y-3">

                    {/* ── A. PAYMENT INFORMATION BLOCK ── */}
                    <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-blue-500" /> {t(lang, "lp.payment_condition_s", "Payment Condition")}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase">{t(lang, "lp.sel_payment_type", "Selected Payment Type")}</label>
                          <span className="font-extrabold text-slate-800 text-[11px] block mt-1">{paymentMode}</span>
                        </div>
                        {paymentMode !== "Advance" && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.payment_date", "Payment Date")}</label>
                            <input
                              type="date"
                              value={cashPaymentDate}
                              onChange={e => setCashPaymentDate(e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Advance Payment Details */}
                      {paymentMode === "Advance" && (
                        <div className="space-y-2 border-t border-slate-200/60 pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_pct", "Advance Payment Percentage (%)")}</label>
                              <input
                                type="number"
                                step="any"
                                value={advancePercentage}
                                onChange={e => setAdvancePercentage(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_amount", "Advance Payment Amount")}</label>
                              <input
                                type="number"
                                step="any"
                                value={manualAdvanceAmount || calculatedAdvanceAmount.toFixed(2)}
                                onChange={e => setManualAdvanceAmount(e.target.value)}
                                className="w-full h-9 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 text-xs font-mono font-bold text-emerald-700 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.remaining_amount", "Remaining Amount")}</label>
                              <input
                                readOnly
                                value={`${purchaseCurrency} ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono font-bold text-red-650 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.total_bill_cost", "Total Bill Cost")}</label>
                              <input
                                readOnly
                                value={`${purchaseCurrency} ${combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono font-bold text-slate-700 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_due_date", "Advance Payment Due Date")}</label>
                              <input
                                type="date"
                                value={advancePaymentDate}
                                onChange={e => setAdvancePaymentDate(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.remaining_due_date", "Remaining Payment Due Date")}</label>
                              <input
                                type="date"
                                value={remainingDueDate}
                                onChange={e => setRemainingDueDate(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── B. WAREHOUSE TRANSFER BLOCK ── */}
                    {shipmentType === "Warehouse Transfer" && (
                      <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-purple-500" /> {t(lang, "lp.wh_transfer", "Warehouse Transfer Details")}
                        </p>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_master", "Warehouse Master Setup")}</label>
                              <select
                                value={selectedWarehouseId}
                                onChange={e => {
                                  const whId = e.target.value;
                                  setSelectedWarehouseId(whId);
                                  const found = warehousesList.find(w => w.id === whId);
                                  setWarehouseName(found ? found.warehouse_name : "");
                                }}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold text-slate-800"
                              >
                                <option value="">{t(lang, "lp.select_warehouse", "Select Warehouse...")}</option>
                                {warehousesList.map(w => (
                                  <option key={w.id} value={w.id}>{w.warehouse_name} ({w.id})</option>
                                ))}
                                <option value="CUSTOM">{t(lang, "lp.custom_manual", "+ Custom Manual Entry")}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_code", "Warehouse Code")}</label>
                              <input
                                value={selectedWarehouseId === "CUSTOM" ? "" : selectedWarehouseId}
                                readOnly={selectedWarehouseId !== "CUSTOM"}
                                onChange={e => selectedWarehouseId === "CUSTOM" && setSelectedWarehouseId(e.target.value)}
                                placeholder={t(lang, "lp.code_word", "Code")}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono outline-none text-slate-600 font-bold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_name_auto", "Warehouse Name (Auto)")}</label>
                              <input
                                value={warehouseName}
                                readOnly={selectedWarehouseId !== "CUSTOM"}
                                onChange={e => setWarehouseName(e.target.value)}
                                placeholder={t(lang, "lp.ph_auto_name", "Auto Loaded Name")}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs outline-none text-slate-800 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_transfer_date", "Warehouse Transfer Date")}</label>
                              <input
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                              />
                            </div>
                          </div>

                          {/* Link to Warehouse stock Account */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_account_link", "Link with Warehouse Account *")}</label>
                            <select
                              value={warehouseAccountNo}
                              onChange={e => setWarehouseAccountNo(e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none text-purple-700 font-bold"
                            >
                              <option value="">{t(lang, "lp.wh_account_link", "Link with Warehouse Account *")}</option>
                              {accountsList.map(acc => (
                                <option key={acc.id} value={acc.code}>
                                  {acc.code} - {acc.name} ({acc.currency})
                                </option>
                              ))}
                            </select>
                            <p className="text-[8px] text-slate-400 mt-1">{t(lang, "lp.wh_stock_auto", "Stock will be automatically transferred to this Warehouse Account upon posting.")}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── C. LOADING BY TRUCK BLOCK ── */}
                    {shipmentType === "Loading by Truck" && (
                      <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Truck className="h-3 w-3 text-purple-500" /> {t(lang, "lp.truck_details", "Loading by Truck Details")}
                        </p>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.truck_master", "Truck Management Master")}</label>
                              <select
                                value={selectedTruckId}
                                onChange={e => {
                                  const tId = e.target.value;
                                  setSelectedTruckId(tId);
                                  const found = TRUCK_LIST.find(t => t.id === tId);
                                  if (found) {
                                    setTruckNo(found.truckNo);
                                    setDriverName(found.driverName);
                                  } else {
                                    setTruckNo("");
                                    setDriverName("");
                                  }
                                }}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold text-slate-800"
                              >
                                <option value="">{t(lang, "lp.select_truck", "Select Registered Truck...")}</option>
                                {TRUCK_LIST.map(t => (
                                  <option key={t.id} value={t.id}>{t.truckNo} - {t.driverName} ({t.details})</option>
                                ))}
                                <option value="CUSTOM">{t(lang, "lp.custom_truck", "+ Custom / Non-Setup Entry")}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.truck_no", "Truck Number *")}</label>
                              <input
                                value={truckNo}
                                readOnly={selectedTruckId !== "CUSTOM" && selectedTruckId !== ""}
                                onChange={e => setTruckNo(e.target.value)}
                                placeholder={t(lang, "lp.ph_truck_no", "Truck Number")}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-indigo-700 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.driver_name", "Driver Name")}</label>
                              <input
                                value={driverName}
                                readOnly={selectedTruckId !== "CUSTOM" && selectedTruckId !== ""}
                                onChange={e => setDriverName(e.target.value)}
                                placeholder={t(lang, "lp.ph_driver", "Driver Name")}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.purchase_date", "Loading Date")}</label>
                              <input
                                type="date"
                                value={loadingDate}
                                onChange={e => setLoadingDate(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── D. EXPORT BLOCK ── */}
                    {shipmentType === "Export Shipment" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2 text-xs text-amber-800">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1">
                          <Flag className="h-3.5 w-3.5 text-amber-600" /> {t(lang, "lp.export_workflow", "Export Shipment Workflow")}
                        </p>
                        <p className="text-[10px] leading-relaxed">
                          {t(lang, "lp.export_note", "This purchase is designated for export. Shipment routes, customs documentation, and container loading tracking must be completed via the Export Loading & Shipping modules after booking.")}
                        </p>
                      </div>
                    )}

                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" onClick={() => { if (!validateBookingStep()) return; setCurrentStep(2); }}
                      className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm">
                      {t(lang, "lp.next_goods_entry", "Next: Goods Entry")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: FINAL PURCHASE */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-blue-600 pl-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                      {t(lang, "lp.final_purchase_title", "FINAL PURCHASE")}
                    </h4>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs shadow-2xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{t(lang, "lp.goods_items", "Goods Items")}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                        {draftItems.length > 0 ? draftItems.length : (goodsId || customGoodsName ? 1 : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{t(lang, "lp.total_quantity", "Total Quantity")}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                        {draftItems.length > 0
                          ? draftItems.reduce((a, i) => a + i.quantityKgs, 0).toLocaleString()
                          : (quantityCount || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{t(lang, "lp.net_weight", "Net Weight")}</span>
                      <span className="font-mono font-bold text-blue-700">
                        {(draftItems.length > 0
                          ? draftItems.reduce((a, i) => a + i.netWeight, 0)
                          : netWeight
                        ).toLocaleString()} KG
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 font-bold">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        AED {finalAmountAed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="h-9 rounded-lg text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    >
                      &larr; {t(lang, "common.back", "Back")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="h-9 bg-[#0f9f6e] hover:bg-[#0c825a] text-white font-extrabold uppercase text-[11px] rounded-lg shadow-sm"
                    >
                      {saving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> {t(lang, "common.saving", "Saving…")}</>
                      ) : (
                        t(lang, "common.save", "SAVE")
                      )}
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={(e) => handleSubmit(e, { draftOnly: true })}
                    className="w-full h-8 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {t(lang, "common.save_draft", "Save Draft")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Info Grid + Dynamic Step Content */}
          <div className="space-y-3 sticky top-4">
            
            {/* ── 4 INFO CARDS (Always visible on all steps at top of right column) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {/* Card 1: BRANCH & USER INFORMATION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[126px] shadow-2xs">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-[9px] flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span className="w-[17px] h-[17px] rounded bg-blue-600 text-white text-[9px] flex items-center justify-center font-black">1</span>
                  {t(lang, "lp.branch_user_info", "BRANCH & USER INFORMATION")}
                </div>
                <div className="p-2 space-y-1 text-[8.5px]">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.branch_name", "Branch Name")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{activeBranch?.name || "Global System"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.branch_code", "Branch Code")}</span>
                    <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{activeBranch?.code || "GLOBAL-00"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.country", "Country")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{activeBranch?.countryName || "UAE"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.city", "City")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{activeBranch?.cityName || "Dubai"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.user_label", "User")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{session.fullName || session.email || "super admin"}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: BILL DETAILS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[126px] shadow-2xs">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-[9px] flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span className="w-[17px] h-[17px] rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center font-black">2</span>
                  {t(lang, "lp.bill_details", "BILL DETAILS")}
                </div>
                <div className="p-2 space-y-1 text-[8.5px]">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.booking_date", "Booking Date")}</span>
                    <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{loadingDate || new Date().toISOString().slice(0, 10)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.fiscal_year", "Fiscal Year")}</span>
                    <span className="font-bold text-right text-slate-800 dark:text-slate-100">2025-26</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.status_label", "Status")}</span>
                    <span className="font-bold text-right text-amber-600">{editingPurchaseId ? t(lang, "lp.draft_edit", "Draft (Edit)") : t(lang, "purchase.draft_badge", "Draft")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.payment_label", "Payment")}</span>
                    <span className="font-bold text-right text-slate-800 dark:text-slate-100">{paymentMode || "Cash"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.origin_country", "Origin Country")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedOriginCountryName || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: PURCHASE ACCOUNT DETAILS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[126px] shadow-2xs">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-[9px] flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span className="w-[17px] h-[17px] rounded bg-purple-600 text-white text-[9px] flex items-center justify-center font-black">3</span>
                  {t(lang, "lp.purchase_account_details", "PURCHASE ACCOUNT DETAILS")}
                </div>
                <div className="p-2 space-y-1 text-[8.5px]">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.account_name", "Account Name")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedPurchaseAccount?.name || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.account_code", "Account Code")}</span>
                    <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{purchaseAccountNo || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.company_label", "Company")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedPurchaseAccount?.company || activeBranch?.companyName || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.country_label", "Country")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedPurchaseAccount?.country || activeBranch?.countryName || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: SALES ACCOUNT DETAILS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[126px] shadow-2xs">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-[9px] flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span className="w-[17px] h-[17px] rounded bg-amber-500 text-white text-[9px] flex items-center justify-center font-black">4</span>
                  {t(lang, "lp.sales_account_details", "SALES ACCOUNT DETAILS")}
                </div>
                <div className="p-2 space-y-1 text-[8.5px]">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.account_name", "Account Name")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedSalesAccount?.name || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.account_code", "Account Code")}</span>
                    <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{salesAccountNo || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.company_label", "Company")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedSalesAccount?.company || activeBranch?.companyName || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.country_label", "Country")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedSalesAccount?.country || activeBranch?.countryName || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── STEP 1: CLEAN WORKSPACE ── */}
            {currentStep === 1 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2 shadow-2xs">
                <FileText className="h-8 w-8 mx-auto text-blue-500/60" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {t(lang, "lp.step1_placeholder_title", "Booking Step Active")}
                </p>
                <p className="text-[11px] max-w-md mx-auto text-slate-400">
                  {t(lang, "lp.step1_placeholder_desc", "Fill in the Bill & Accounts information and click 'Next: Goods Entry' to add items.")}
                </p>
              </div>
            )}

            {/* ── STEP 2: GOODS TABLE WITH COUNT TRACKER ── */}
            {currentStep === 2 && (
              <Card className="border-border shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-950/40 dark:to-amber-900/30 text-amber-900 dark:text-amber-200 p-3 flex flex-row items-center justify-between border-b border-amber-300 dark:border-amber-800">
                  <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600" /> {t(lang, "lp.goods_table_title", "GOODS TABLE")}
                  </CardTitle>
                  <span className="text-[10px] font-mono font-bold bg-blue-600 text-white px-2.5 py-0.5 rounded-full">
                    {draftItems.length} {t(lang, "lp.goods_entered_badge", "Goods Entered")}
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                      <thead className="bg-slate-100 text-slate-700 text-[9px] font-extrabold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                        <tr>
                          <Th className="p-2 border-b text-center">#</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_goods_item", "Goods")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_size", "Size")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_brand", "Brand")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_origin", "Origin")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_packages", "QTY")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_unit", "Unit")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_gross_wt", "Gross Wt")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_net_wt", "Net Wt")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_rate", "Rate")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_amount", "Amount")} ({purchaseCurrency})</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_final_aed", "Final AED")}</Th>
                          <Th className="p-2 border-b text-center">{t(lang, "lp.col_action", "Action")}</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[10px]">
                        {draftItems.length > 0 ? (
                          draftItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-500 text-center">{idx + 1}</td>
                              <td className="p-2">
                                <div className="font-bold text-slate-900">{item.goodsName}</div>
                                {item.hsCode && <div className="text-[8px] text-slate-400 font-mono">{item.hsCode}</div>}
                              </td>
                              <td className="p-2 text-[10px] text-slate-600">{item.size || "-"}</td>
                              <td className="p-2 text-[10px] text-slate-600">{item.brand || "-"}</td>
                              <td className="p-2 text-[10px] font-semibold text-slate-600">{item.origin || "—"}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-800">{item.quantityKgs?.toLocaleString()}</td>
                              <td className="p-2 text-[10px] text-slate-600">{item.quantityName}</td>
                              <td className="p-2 text-right font-mono text-slate-600">{(item.totalGrossWeight || 0).toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono font-bold text-blue-700">{(item.netWeight || 0).toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono">
                                <div className="font-bold text-slate-700">{item.purchaseRate}</div>
                                <div className="text-[8px] text-slate-400 uppercase">{(item.priceType || item.rateType || "").replace("_", " ")}</div>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-slate-700">
                                {(item.finalCost || item.purchaseCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency || purchaseCurrency}
                              </td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600">
                                {((item.finalCost || item.purchaseCost || 0) * Number(exchangeRateToAed || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDraftItems(prev => prev.filter(i => i.id !== item.id))}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 transition"
                                  title={t(lang, "lp.remove_item", "Remove item")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={13} className="p-6 text-center text-slate-400">
                              {t(lang, "lp.no_goods_added_yet", "No goods added yet. Fill out the form on the left and click 'Add Item to List'.")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Goods Bottom Summary — 4-stat compact strip */}
                  <div className="border-t border-amber-100 bg-amber-50/30">
                    <div className="grid grid-cols-4 divide-x divide-amber-100">
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.total_goods_lines", "Goods Entered")}</span>
                        <strong className="block text-[12px] font-black text-slate-800 truncate">{draftItems.length}</strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.col_packages", "Total Qty")}</span>
                        <strong className="block text-[12px] font-black text-slate-800 truncate">
                          {draftItems.reduce((a, i) => a + i.quantityKgs, 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.net_weight", "Net Weight")}</span>
                        <strong className="block text-[12px] font-black text-blue-700 truncate">
                          {draftItems.reduce((a, i) => a + i.netWeight, 0).toLocaleString()} <span className="text-[9px] font-bold">kg</span>
                        </strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                        <strong className="block text-[11px] font-black text-emerald-600 truncate">
                          {purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── STEP 3: GOODS REPORT TABLE + 4 BOTTOM MINI CARDS ── */}
            {currentStep === 3 && (
              <div className="space-y-3">
                {/* GOODS REPORT TABLE (Yellow head matching prototype .goods-report) */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="bg-[#fff3bf] border-b border-[#f2c94c] px-3 py-2 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-[#6b4f00] tracking-wide">
                      {t(lang, "lp.goods_report_head", "GOODS REPORT")}
                    </span>
                    <span className="text-[9.5px] font-bold text-[#6b4f00]">
                      {draftItems.length > 0 ? draftItems.length : 1} {t(lang, "lp.items_confirmed", "Items Confirmed")}
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[340px]">
                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 text-[9px] font-extrabold uppercase border-b border-slate-100">
                        <tr>
                          <Th className="p-2 border-b text-center">#</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_goods_item", "GOODS")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_size", "SIZE")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_brand", "BRAND")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_origin", "ORIGIN")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_packages", "QTY")}</Th>
                          <Th className="p-2 border-b">{t(lang, "lp.col_unit", "UNIT")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_gross_wt", "GROSS WT")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_net_wt", "NET WT")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_rate", "RATE")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_amount", "AMOUNT")} ({purchaseCurrency})</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_final_aed", "FINAL AED")}</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[10px]">
                        {draftItems.length > 0 ? (
                          draftItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="p-2 font-mono font-bold text-slate-500 text-center">{idx + 1}</td>
                              <td className="p-2 font-bold text-slate-900">{item.goodsName}</td>
                              <td className="p-2 text-slate-600">{item.size || "-"}</td>
                              <td className="p-2 text-slate-600">{item.brand || "-"}</td>
                              <td className="p-2 font-semibold text-slate-600">{item.origin || "—"}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-800">{item.quantityKgs?.toLocaleString()}</td>
                              <td className="p-2 text-slate-600">{item.quantityName}</td>
                              <td className="p-2 text-right font-mono text-slate-600">{(item.totalGrossWeight || 0).toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono font-bold text-blue-700">{(item.netWeight || 0).toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-700">{item.purchaseRate}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-700">
                                {(item.finalCost || item.purchaseCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency || purchaseCurrency}
                              </td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600">
                                {((item.finalCost || item.purchaseCost || 0) * Number(exchangeRateToAed || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-slate-500 text-center">1</td>
                            <td className="p-2 font-bold text-slate-900">{selectedGood?.goodsName || customGoodsName || "Goods Item"}</td>
                            <td className="p-2 text-slate-600">{size || "-"}</td>
                            <td className="p-2 text-slate-600">{brand || "-"}</td>
                            <td className="p-2 font-semibold text-slate-600">{selectedOriginCountryName || "—"}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">{quantityCount || 0}</td>
                            <td className="p-2 text-slate-600">{quantityName}</td>
                            <td className="p-2 text-right font-mono text-slate-600">{totalGrossWeight.toLocaleString()} kg</td>
                            <td className="p-2 text-right font-mono font-bold text-blue-700">{netWeight.toLocaleString()} kg</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-700">{purchaseRate || 0}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-700">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-mono font-black text-emerald-600">AED {finalAmountAed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4-stat totals grid */}
                  <div className="border-t border-slate-100 bg-slate-50/60">
                    <div className="grid grid-cols-4 divide-x divide-slate-100">
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.total_goods_lines", "Goods Items")}</span>
                        <strong className="block text-[11px] font-black text-slate-800 truncate">{draftItems.length > 0 ? draftItems.length : 1}</strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.col_packages", "Total Qty")}</span>
                        <strong className="block text-[11px] font-black text-slate-800 truncate">
                          {draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.quantityKgs, 0).toLocaleString() : (quantityCount || 0)}
                        </strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.net_weight", "Net Weight")}</span>
                        <strong className="block text-[11px] font-black text-blue-700 truncate">
                          {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.netWeight, 0) : netWeight).toLocaleString()} kg
                        </strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                        <strong className="block text-[11px] font-black text-emerald-600 truncate">
                          AED {finalAmountAed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 4 BOTTOM SUMMARY MINI CARDS (matching prototype .final-four-cards) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  {/* Mini Card 1: LOADING DETAILS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[82px] shadow-2xs">
                    <div className="p-1.5 px-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <span className="w-[17px] h-[17px] rounded bg-blue-600 text-white text-[9px] flex items-center justify-center font-black">1</span>
                      {t(lang, "lp.card_loading_details", "LOADING DETAILS")}
                    </div>
                    <div className="p-2 space-y-1 text-[8.5px]">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.type_label", "Type")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100 truncate">{shipmentType || "—"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.next_form", "Next Form")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">ERP Route</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Card 2: PAYMENT DETAILS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[82px] shadow-2xs">
                    <div className="p-1.5 px-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <span className="w-[17px] h-[17px] rounded bg-emerald-600 text-white text-[9px] flex items-center justify-center font-black">2</span>
                      {t(lang, "lp.card_payment_details", "PAYMENT DETAILS")}
                    </div>
                    <div className="p-2 space-y-1 text-[8.5px]">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.condition_label", "Condition")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">{paymentMode || "Cash"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.currency_label", "Currency")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">{purchaseCurrency || "USD"}</span>
                      </div>
                      {paymentMode === "Advance" && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <span className="text-slate-400">{t(lang, "lp.adv_part", "Advance Part")} ({advancePercentage}%)</span>
                            <span className="font-mono font-bold text-right text-emerald-600">{purchaseCurrency} {calculatedAdvanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <span className="text-slate-400">{t(lang, "lp.rem_due", "Remaining Due")}</span>
                            <span className="font-mono font-bold text-right text-red-600">{purchaseCurrency} {remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mini Card 3: GOODS DETAILS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[82px] shadow-2xs">
                    <div className="p-1.5 px-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <span className="w-[17px] h-[17px] rounded bg-purple-600 text-white text-[9px] flex items-center justify-center font-black">3</span>
                      {t(lang, "lp.card_goods_details", "GOODS DETAILS")}
                    </div>
                    <div className="p-2 space-y-1 text-[8.5px]">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.total_goods_lines", "Total Goods")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">{draftItems.length > 0 ? draftItems.length : (goodsId || customGoodsName ? 1 : 0)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.col_packages", "Total Quantity")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">
                          {draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.quantityKgs, 0).toLocaleString() : (quantityCount || 0)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.total_gross_wt", "Total Gross Wt")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">
                          {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.totalGrossWeight, 0) : totalGrossWeight).toLocaleString()} kg
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.net_weight", "Total Net Wt")}</span>
                        <span className="font-bold text-right text-blue-700">
                          {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.netWeight, 0) : netWeight).toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Card 4: ORIGIN & TOTAL DETAILS */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg min-h-[82px] shadow-2xs">
                    <div className="p-1.5 px-2 border-b border-slate-100 dark:border-slate-800 text-[9px] font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <span className="w-[17px] h-[17px] rounded bg-amber-500 text-white text-[9px] flex items-center justify-center font-black">4</span>
                      {t(lang, "lp.card_origin_total", "ORIGIN & TOTAL DETAILS")}
                    </div>
                    <div className="p-2 space-y-1 text-[8.5px]">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.origin_label", "Origin")}</span>
                        <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{selectedOriginCountryName || "Mixed"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.price_basis", "Price Basis")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">{rateType?.replace('_', ' ') || "Per Kg"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.purchase_amount", "Purchase Amount")}</span>
                        <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                        <span className="font-mono font-black text-right text-emerald-600">AED {finalAmountAed.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Close Form Button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                className="w-full h-8 text-slate-500 hover:text-slate-700 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
              >
                {t(lang, "lp.close_form", "Close Form")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    ) : (
        /* Full-Width Draft & In-Progress Bills Table matching Reference Design */
        <div className="space-y-4 w-full animate-in fade-in duration-200">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
            {/* Table Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              {/* Left: Title & Subtitle */}
              <div>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span>{t(lang, "lp.title", "Local Purchase Registry")}</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {t(lang, "lp.subtitle", "Branch-level purchase voucher logs, weights, amounts and ledger postings")}
                </p>
              </div>

              {/* Right: Columns, Export, Records Count, Page Size */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Columns Selector Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColumnPicker((prev) => !prev);
                    }}
                    className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
                    <span>{t(lang, "common.columns", "Columns")}</span>
                  </button>

                  {showColumnPicker && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-2xl z-50 animate-in fade-in space-y-1.5 text-xs font-semibold"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        {t(lang, "common.columns", "Columns")}
                      </p>
                      {[
                        { key: "billNo", label: t(lang, "lp.col_voucher_no", "Bill No") },
                        { key: "date", label: t(lang, "lp.col_date", "Date") },
                        { key: "supplier", label: t(lang, "lp.col_supplier", "Supplier") },
                        { key: "goods", label: t(lang, "lp.col_goods_name", "Goods Name") },
                        { key: "brand", label: t(lang, "lp.col_brand", "Brand") },
                        { key: "qty", label: t(lang, "lp.col_qty", "Quantity") },
                        { key: "grossWt", label: t(lang, "lp.col_gross_wt", "Gross Wt") },
                        { key: "netWt", label: t(lang, "lp.col_net_wt", "Net Wt") },
                        { key: "rate", label: t(lang, "lp.col_rate", "Rate") },
                        { key: "amount", label: t(lang, "lp.col_final_amount", "Amount") },
                        { key: "status", label: t(lang, "lp.col_status", "Status") },
                      ].map((col) => (
                        <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key] !== false}
                            onChange={() => setVisibleColumns((prev) => ({ ...prev, [col.key]: !prev[col.key] }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Export Button */}
                <JournalPrintButton
                  title={t(lang, "lp.local_branch_purchase_register", "LOCAL BRANCH PURCHASE REGISTER")}
                  subtitle={t(lang, "lp.a4_print_title", "Official A4 ERP Journal Print Report — Local Purchase Register")}
                  columns={[
                    { key: "voucherNo", label: t(lang, "lp.col_voucher_no", "Voucher No"), align: "left" },
                    { key: "date", label: t(lang, "lp.col_date", "Date"), align: "left" },
                    { key: "supplier", label: t(lang, "lp.col_supplier", "Supplier"), align: "left" },
                    { key: "goods", label: t(lang, "lp.col_goods_name", "Goods Name"), align: "left" },
                    { key: "brand", label: t(lang, "lp.col_brand", "Brand"), align: "left" },
                    { key: "qty", label: t(lang, "lp.col_quantity", "Quantity"), align: "right" },
                    { key: "netWeight", label: t(lang, "lp.col_net_weight", "Net Weight"), align: "right" },
                    { key: "rate", label: t(lang, "lp.col_rate", "Rate"), align: "right" },
                    { key: "finalAmount", label: t(lang, "lp.col_final_amount", "Final Amount ($)"), align: "right", format: "currency" },
                    { key: "status", label: t(lang, "lp.col_status", "Status"), align: "center" }
                  ]}
                  rows={filteredPurchases.map((p) => ({
                    voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                    date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                    supplier: p.supplier_name || "—",
                    goods: p.goods_name || "—",
                    brand: p.brand || "—",
                    qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                    netWeight: `${Number(p.net_weight || 0).toLocaleString()} kg`,
                    rate: `${Number(p.purchase_rate || 0).toFixed(2)} ${p.purchase_currency || ""}`.trim(),
                    finalAmount: Number(p.final_cost || p.purchase_cost || 0),
                    status: (p.status || "DRAFT").toUpperCase()
                  }))}
                  variant="outline"
                  className="h-8 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold gap-1.5 px-3 shadow-2xs"
                />

                {/* Records Count Badge */}
                <div className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 me-1">{t(lang, "common.total_records", "Total Records:")}</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">{filteredPurchases.length}</span>
                </div>

                {/* Page Size Dropdown */}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none shadow-2xs cursor-pointer"
                >
                  <option value={10}>10 {t(lang, "purchase.showing_entries", "entries")}</option>
                  <option value={25}>25 {t(lang, "purchase.showing_entries", "entries")}</option>
                  <option value={50}>50 {t(lang, "purchase.showing_entries", "entries")}</option>
                  <option value={100}>100 {t(lang, "purchase.showing_entries", "entries")}</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            <CardContent className="p-0">
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  {/* Deep Navy Header #0f2942 */}
                  <thead className="bg-[#0f2942] text-white text-[10px] font-black uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-2.5 py-3 text-center w-8 border-e border-[#1a3d5f]">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
                          title={t(lang, "cbill.select_all", "Select all")}
                        />
                      </th>
                      <Th className="px-2 py-3 text-center w-10 border-e border-[#1a3d5f] text-white font-black">#</Th>
                      {visibleColumns.billNo !== false && (
                        <Th className="px-2.5 py-3 border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_voucher_no", "Bill No")}
                        </Th>
                      )}
                      {visibleColumns.date !== false && (
                        <Th className="px-2.5 py-3 border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_date", "Date")}
                        </Th>
                      )}
                      {visibleColumns.supplier !== false && (
                        <Th className="px-3 py-3 border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_supplier_name", "Supplier Name")}
                        </Th>
                      )}
                      {visibleColumns.goods !== false && (
                        <Th className="px-3 py-3 border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_goods_name", "Goods Name")}
                        </Th>
                      )}
                      {visibleColumns.brand !== false && (
                        <Th className="px-2.5 py-3 border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_brand", "Brand")}
                        </Th>
                      )}
                      {visibleColumns.qty !== false && (
                        <Th className="px-2.5 py-3 text-right border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_qty", "Qty")}
                        </Th>
                      )}
                      {visibleColumns.qty !== false && (
                        <Th className="px-2.5 py-3 text-center border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_unit", "Unit")}
                        </Th>
                      )}
                      {visibleColumns.grossWt !== false && (
                        <Th className="px-2.5 py-3 text-right border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_gross_wt", "Gross Wt")}
                        </Th>
                      )}
                      {visibleColumns.netWt !== false && (
                        <Th className="px-2.5 py-3 text-right border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_net_wt", "Net Wt")}
                        </Th>
                      )}
                      {visibleColumns.rate !== false && (
                        <Th className="px-2.5 py-3 text-right border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_rate", "Rate")}
                        </Th>
                      )}
                      {visibleColumns.amount !== false && (
                        <Th className="px-3 py-3 text-right border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_final_amount", "Amount")}
                        </Th>
                      )}
                      {visibleColumns.status !== false && (
                        <Th className="px-3 py-3 text-center border-e border-[#1a3d5f] text-white font-black">
                          {t(lang, "lp.col_posting_status", "Posting & Transfer Status")}
                        </Th>
                      )}
                      <Th className="px-2.5 py-3 text-center w-12 text-white font-black">
                        {t(lang, "lp.col_actions", "Actions")}
                      </Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={15} className="p-12 text-center text-slate-400 font-mono">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                          {t(lang, "lp.loading_bills", "Loading bills...")}
                        </td>
                      </tr>
                    ) : filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="px-5 py-16 text-center text-slate-400 font-sans">
                          <Package className="h-12 w-12 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                          <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                            {t(lang, "lp.no_bills_found", "No bills found")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {t(lang, "lp.click_new_purchase_hint", "Click \"+ New Purchase\" to create a new local purchase bill.")}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedPurchases.map((row, rowIndex) => {
                        const postingState = deriveLocalPurchasePostingState(row);
                        const rowCurrency = row.local_currency || row.localCurrency || row.purchase_currency || row.purchaseCurrency || "PKR";
                        const rowFinalCost = Number(row.final_cost || row.finalCost || row.purchase_cost || row.purchaseCost || 0);
                        const rowTaxAmount = Number(row.tax_amount || row.taxAmount || 0);
                        const rowNetWeight = Number(row.net_weight || row.netWeight || 0);
                        const rowGrossWeight = Number(row.total_gross_weight || row.totalGrossWeight || 0);
                        const rowQty = Number(row.quantity_kgs || row.quantityKgs || 0);
                        const rowRate = Number(row.purchase_rate || row.purchaseRate || 0);

                        const voucherCode = row.journal_serial_no || row.serial_no || row.serialNo || row.bill_no || row.billNo || "—";
                        const rowStatus = String(row.status || row.bill_status || "draft").toLowerCase();
                        const isTransferred = rowStatus === "posted" || rowStatus === "transferred" || Boolean(row.transferred_at) || Boolean(row.roznamcha_entry_id);
                        const hasRoznamcha = Boolean(row.roznamcha_entry_id);
                        const hasLedger = Boolean(rowStatus === "posted" || row.journal_entry_id || row.roznamcha_entry_id);

                        const badge = postingState.visualStatus === "black"
                          ? { bg: "bg-black text-white", label: "BLACK" }
                          : { bg: "bg-red-100 text-red-800 border-red-300", label: "RED" };

                        const isRowSelected = selectedRowIds.has(row.id);
                        const globalRowNumber = (currentPage - 1) * pageSize + rowIndex + 1;

                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-100 dark:border-slate-800/80",
                              isRowSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                            )}
                          >
                            {/* Checkbox */}
                            <td className="px-2.5 py-2.5 text-center border-e border-slate-150 dark:border-slate-800">
                              <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={() => {
                                  const next = new Set(selectedRowIds);
                                  if (next.has(row.id)) next.delete(row.id);
                                  else next.add(row.id);
                                  setSelectedRowIds(next);
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Row Index */}
                            <td className="px-2 py-2.5 font-mono text-[10px] text-slate-400 font-bold text-center border-e border-slate-150 dark:border-slate-800">
                              {globalRowNumber}
                            </td>

                            {/* Bill No (Blue Link) */}
                            {visibleColumns.billNo !== false && (
                              <td className="px-2.5 py-2.5 font-mono text-[10px] font-bold border-e border-slate-150 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRowForVoucher(row)}
                                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold text-left"
                                  title={t(lang, "purchase.print_voucher", "View Voucher")}
                                >
                                  {voucherCode}
                                </button>
                              </td>
                            )}

                            {/* Date */}
                            {visibleColumns.date !== false && (
                              <td className="px-2.5 py-2.5 font-mono text-[10px] text-slate-600 dark:text-slate-400 border-e border-slate-150 dark:border-slate-800" suppressHydrationWarning>
                                {row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt).toLocaleDateString("en-GB") : "—"}
                              </td>
                            )}

                            {/* Supplier Name (Blue Link) */}
                            {visibleColumns.supplier !== false && (
                              <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200 border-e border-slate-150 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRowForVoucher(row)}
                                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-bold text-left truncate max-w-[160px] block"
                                  title={row.supplier_name || row.supplierName || "—"}
                                >
                                  {row.supplier_name || row.supplierName || "—"}
                                </button>
                              </td>
                            )}

                            {/* Goods Name */}
                            {visibleColumns.goods !== false && (
                              <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 border-e border-slate-150 dark:border-slate-800 truncate max-w-[150px]">
                                {row.goods_name || row.goodsName || "—"}
                              </td>
                            )}

                            {/* Brand */}
                            {visibleColumns.brand !== false && (
                              <td className="px-2.5 py-2.5 text-slate-600 dark:text-slate-400 border-e border-slate-150 dark:border-slate-800">
                                {row.brand || "—"}
                              </td>
                            )}

                            {/* Qty */}
                            {visibleColumns.qty !== false && (
                              <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200 border-e border-slate-150 dark:border-slate-800">
                                {rowQty.toLocaleString()}
                              </td>
                            )}

                            {/* Unit */}
                            {visibleColumns.qty !== false && (
                              <td className="px-2.5 py-2.5 text-center text-slate-500 dark:text-slate-400 border-e border-slate-150 dark:border-slate-800">
                                {row.quantity_name || row.quantityName || "Bags"}
                              </td>
                            )}

                            {/* Gross Wt */}
                            {visibleColumns.grossWt !== false && (
                              <td className="px-2.5 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 border-e border-slate-150 dark:border-slate-800">
                                {rowGrossWeight.toLocaleString()} kg
                              </td>
                            )}

                            {/* Net Wt (Highlighted Blue Bold) */}
                            {visibleColumns.netWt !== false && (
                              <td className="px-2.5 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 border-e border-slate-150 dark:border-slate-800">
                                {rowNetWeight.toLocaleString()} kg
                              </td>
                            )}

                            {/* Rate */}
                            {visibleColumns.rate !== false && (
                              <td className="px-2.5 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 border-e border-slate-150 dark:border-slate-800">
                                {rowRate ? rowRate.toFixed(2) : "—"}
                              </td>
                            )}

                            {/* Amount (AED / PKR Formatted) */}
                            {visibleColumns.amount !== false && (
                              <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100 border-e border-slate-150 dark:border-slate-800">
                                {rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            )}

                            {/* Posting & Transfer Status (Interactive Chip Button) */}
                            {visibleColumns.status !== false && (
                              <td className="px-3 py-2.5 text-center border-e border-slate-150 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeStatusDropdownId === row.id) {
                                        setActiveStatusDropdownId(null);
                                        setStatusMenuAnchor(null);
                                      } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setActiveStatusDropdownId(row.id);
                                        setStatusMenuAnchor({
                                          id: row.id,
                                          top: rect.top,
                                          bottom: rect.bottom,
                                          left: Math.max(12, rect.left - 80),
                                        });
                                      }
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-2xs transition active:scale-95 cursor-pointer",
                                      isTransferred
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                        : rowStatus === "accepted"
                                        ? "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                        : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full",
                                        isTransferred ? "bg-emerald-600" : rowStatus === "accepted" ? "bg-blue-600" : "bg-amber-600"
                                      )}
                                    />
                                    <span>
                                      {isTransferred ? "POSTED" : rowStatus === "accepted" ? "ACCEPTED" : "DRAFT"}
                                    </span>
                                    <ChevronDown className="h-3 w-3 opacity-60" />
                                  </button>

                                  {/* Detailed Status Dropdown Popover */}
                                  {activeStatusDropdownId === row.id && (
                                    <div
                                      style={
                                        statusMenuAnchor && statusMenuAnchor.id === row.id
                                          ? {
                                              position: "fixed",
                                              left: `${statusMenuAnchor.left}px`,
                                              ...(statusMenuAnchor.top > 260
                                                ? { bottom: `${Math.max(10, window.innerHeight - statusMenuAnchor.top + 6)}px` }
                                                : { top: `${statusMenuAnchor.bottom + 6}px` }),
                                              zIndex: 99999,
                                            }
                                          : undefined
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-64 rounded-2xl bg-white dark:bg-slate-900 p-3.5 shadow-2xl border border-slate-200 dark:border-slate-800 z-50 text-left space-y-2.5 animate-in fade-in zoom-in-95"
                                    >
                                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                          {t(lang, "lp.col_posting_status", "Posting & Transfer Status")}
                                        </span>
                                        <span
                                          className={cn(
                                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase",
                                            isTransferred ? "bg-emerald-100 text-emerald-800" : rowStatus === "accepted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                                          )}
                                        >
                                          {isTransferred ? "POSTED" : rowStatus === "accepted" ? "ACCEPTED" : "DRAFT"}
                                        </span>
                                      </div>

                                      <div className="space-y-2 text-[11px]">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500 font-medium">Main Status:</span>
                                          <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{rowStatus}</span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500 font-medium">Daily Roznamcha:</span>
                                          {hasRoznamcha ? (
                                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Transferred
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                                              <Clock className="h-3.5 w-3.5 text-slate-400" /> Pending
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500 font-medium">General Ledger:</span>
                                          {hasLedger ? (
                                            <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400">
                                              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Posted
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                                              <Clock className="h-3.5 w-3.5 text-slate-400" /> Pending
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-500 font-medium">Audit Seal:</span>
                                          <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase border", badge.bg)}>
                                            {badge.label}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className="text-slate-500 font-medium">Transfer Date:</span>
                                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                            {row.transferred_at ? new Date(row.transferred_at).toLocaleString() : (row.created_at ? new Date(row.created_at).toLocaleDateString() : "—")}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                                          <span className="text-slate-500 font-medium">{t(lang, "lp.user_name", "User Name")}:</span>
                                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                                            {row.created_by_name || session.fullName || "Super Admin"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Actions (3-Dots Menu) */}
                            <td className="px-2.5 py-2.5 text-center relative" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (activeActionMenuId === row.id) {
                                      setActiveActionMenuId(null);
                                      setActionMenuAnchor(null);
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActiveActionMenuId(row.id);
                                      setActionMenuAnchor({
                                        id: row.id,
                                        top: rect.top,
                                        bottom: rect.bottom,
                                        right: Math.max(12, window.innerWidth - rect.right),
                                      });
                                    }
                                  }}
                                  className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer shadow-2xs"
                                  title={t(lang, "lp.col_actions", "Actions")}
                                >
                                  <MoreVertical className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                                </button>

                                {activeActionMenuId === row.id && (
                                  <div
                                    style={
                                      actionMenuAnchor && actionMenuAnchor.id === row.id
                                        ? {
                                            position: "fixed",
                                            right: `${actionMenuAnchor.right}px`,
                                            ...(actionMenuAnchor.top > 220
                                              ? { bottom: `${Math.max(10, window.innerHeight - actionMenuAnchor.top + 6)}px` }
                                              : { top: `${actionMenuAnchor.bottom + 6}px` }),
                                            zIndex: 99999,
                                          }
                                        : undefined
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-52 rounded-xl bg-white shadow-2xl border border-slate-200 z-50 py-1.5 space-y-0.5 animate-in fade-in text-left dark:bg-slate-900 dark:border-slate-800"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRowForVoucher(row);
                                        setActiveActionMenuId(null);
                                        setActionMenuAnchor(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-600" /> {th("View Voucher")}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRowForVoucher(row);
                                        setActiveActionMenuId(null);
                                        setActionMenuAnchor(null);
                                        setTimeout(() => printDomFragmentViaModal("printable-modal-voucher", "Local Purchase Voucher"), 350);
                                      }}
                                      className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2 transition dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <Printer className="h-3.5 w-3.5 text-purple-600" /> {th("Print / Export PDF")}
                                    </button>

                                    {(rowStatus === "draft" || isSuperAdmin) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsFormOpen(true);
                                          setCurrentStep(1);
                                          setEditingPurchaseId(row.id || null);
                                          setGoodsId(row.goods_id || row.goodsId || "");
                                          setCustomGoodsName(row.goods_name || row.goodsName || "");
                                          setSupplierName(row.supplier_name || row.supplierName || "");
                                          setSupplierPersonId(row.supplier_person_id || row.supplierPersonId || "");
                                          setPurchaseAccountNo(row.purchase_account_no || row.purchaseAccountNo || "");
                                          setSalesAccountNo(row.sales_account_no || row.salesAccountNo || "");
                                          setBrokerAccountNo(row.broker_account_no || row.brokerAccountNo || "");
                                          setContractNo(row.contract_no || row.contractNo || "");
                                          setChassisCode(row.chassis_code || row.chassisCode || "");
                                          setLotNo(row.lot_no || row.lotNo || "");
                                          setPaymentMode(row.payment_mode || row.paymentMode || "Cash");
                                          setShippingMode(row.shipping_mode || row.shippingMode || "Loading");
                                          setShipmentType(SHIPPING_MODE_TO_SHIPMENT_TYPE[row.shipping_mode || row.shippingMode || "Loading"] || "Loading by Truck");
                                          setOriginCountryId(row.origin_country_id || row.originCountryId || "");
                                          setAdvancePercentage(String(row.advance_percentage ?? row.advancePercentage ?? "20"));
                                          setWarehouseName(row.warehouse_name || row.warehouseName || "");
                                          setSelectedWarehouseId(row.warehouse_id || row.warehouseId || "");
                                          setWarehouseAccountNo(row.purchase_account_no || row.purchaseAccountNo || "");
                                          setWarehousePlotNo(row.warehouse_plot_no || row.warehousePlotNo || "");
                                          setTransferDate(row.transfer_date || row.transferDate || new Date().toISOString().slice(0, 10));
                                          setLoadingDate(row.loading_date || row.loadingDate || new Date().toISOString().slice(0, 10));
                                          setTruckNo(row.truck_no || row.truckNo || "");
                                          setDriverName(row.driver_name || row.driverName || "");
                                          setRemarks(row.remarks || "");
                                          setQuantityName(row.quantity_name || row.quantityName || "Bags");
                                          setQuantityCount(String(row.quantity_kgs ?? row.quantityKgs ?? ""));
                                          setEmptyKgs(String(row.empty_kgs ?? row.emptyKgs ?? ""));
                                          setDivideKgs(String(row.divide_kgs ?? row.divideKgs ?? "50"));
                                          setRateType(row.rate_type || row.rateType || "per_kg");
                                          setPurchaseRate(String(row.purchase_rate ?? row.purchaseRate ?? ""));
                                          setPurchaseCurrency(row.purchase_currency || row.purchaseCurrency || "USD");
                                          setExchangeRateToAed(String(row.exchange_rate ?? row.exchangeRate ?? "1"));
                                          setApplyTax(row.apply_tax || row.applyTax || "No");
                                          setTaxType(row.tax_type || row.taxType || "VAT");
                                          setTaxPercentage(String(row.tax_percentage ?? row.taxPercentage ?? "0"));
                                          if (row.country_branch_id || row.countryBranchId) setSelectedBranchId(row.country_branch_id || row.countryBranchId);
                                          if (row.city_branch_id || row.cityBranchId) setSelectedCityBranchId(row.city_branch_id || row.cityBranchId);
                                          setActiveActionMenuId(null);
                                          setActionMenuAnchor(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 transition dark:text-slate-200 dark:hover:bg-slate-800"
                                      >
                                        <Edit3 className="h-3.5 w-3.5 text-emerald-600" /> {rowStatus === "draft" ? th("Edit Draft") : th("Edit Local Purchase")}
                                      </button>
                                    )}

                                    {rowStatus === "draft" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
                                          setActionMenuAnchor(null);
                                          if (!confirm("Accept this bill? Serial numbers will be generated.")) return;
                                          try {
                                            const res = await fetch("/api/erp/purchases/local-purchase/accept", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ purchaseId: row.id })
                                            });
                                            const data = await res.json();
                                            if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to accept.");
                                            alert(`Bill accepted! Serial: ${data.data?.serials?.journalSerialNo || "Generated"}`);
                                            await loadHistory();
                                          } catch (err: any) {
                                            alert(err.message);
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition dark:text-blue-400 dark:hover:bg-slate-800"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> {th("Accept Bill")}
                                      </button>
                                    )}

                                    {rowStatus === "accepted" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
                                          setActionMenuAnchor(null);
                                          if (!confirm(th("Transfer & Post this bill? Journal, Roznamcha, and Ledger entries will be created."))) return;
                                          try {
                                            const res = await fetch("/api/erp/purchases/local-purchase/transfer", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ purchaseId: row.id })
                                            });
                                            const data = await res.json();
                                            if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to transfer.");
                                            alert("Bill posted to Journal, Roznamcha & General Ledger successfully!");
                                            await loadHistory();
                                          } catch (err: any) {
                                            alert(err.message);
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition dark:text-emerald-400 dark:hover:bg-slate-800"
                                      >
                                        <Send className="h-3.5 w-3.5 text-emerald-600" /> {th("Transfer & Post")}
                                      </button>
                                    )}

                                    {rowStatus !== "draft" && (
                                      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">
                                        <AddExpenseBillButton sourceId={row.id} lang={lang} variant="ghost" className="h-auto w-full justify-start p-0 text-[11px] font-bold text-slate-700 hover:text-indigo-600 dark:text-slate-200" />
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        setActionMenuAnchor(null);
                                        setHandoverTargetRow(row);
                                        setHandoverModalOpen(true);
                                      }}
                                      className="w-full px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition border-t border-slate-100 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-slate-800"
                                    >
                                      <Share2 className="h-3.5 w-3.5 text-blue-600" /> {th("Assign to Another User")}
                                    </button>

                                    {rowStatus === "draft" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
                                          setActionMenuAnchor(null);
                                          if (!confirm("Delete this draft bill permanently?")) return;
                                          try {
                                            const res = await fetch(`/api/erp/purchases/local-purchase?id=${row.id}`, { method: "DELETE" });
                                            const data = await res.json();
                                            if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to delete.");
                                            setPurchases((prev: any[]) => prev.filter((p: any) => p.id !== row.id));
                                          } catch (err: any) {
                                            alert(err.message);
                                          }
                                        }}
                                        className="w-full px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition border-t border-slate-100 dark:border-slate-800 dark:text-red-400 dark:hover:bg-slate-800"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600" /> {th("Delete Draft")}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer & Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                {/* Showing entries info */}
                <div className="font-semibold text-slate-500 dark:text-slate-400">
                  {filteredPurchases.length === 0
                    ? "Showing 0 to 0 of 0 entries"
                    : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredPurchases.length)} of ${filteredPurchases.length} entries`}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    {t(lang, "common.previous", "Previous")}
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={page}>
                          {prev && page - prev > 1 && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              "h-8 w-8 rounded-lg text-xs font-bold transition cursor-pointer",
                              currentPage === page
                                ? "bg-blue-600 text-white shadow-xs font-black"
                                : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages || filteredPurchases.length === 0}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    {t(lang, "common.next", "Next")}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Modal: Select Working Location Scope */}
      {isScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" /> {t(lang, "lp.scope_modal_title", "SELECT WORKING LOCATION SCOPE")}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{t(lang, "lp.scope_modal_desc", "Please select the Country, Branch, and City Branch before creating bill.")}</p>
              </div>
              <button onClick={() => setIsScopeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t(lang, "lp.country_required", "Country *")}</label>
                <select
                  value={scopeCountryId}
                  onChange={e => {
                    const cId = e.target.value;
                    setScopeCountryId(cId);
                    // Auto-select first branch of this country
                    const firstBranch = countryBranches.find((cb: any) => String(cb.countryId || cb.country_id) === String(cId));
                    const newBranchId = firstBranch?.id || "";
                    setScopeBranchId(newBranchId);
                    // Auto-select first city of that branch
                    const firstCity = cityBranches.find((c: any) => String(c.countryBranchId || c.country_branch_id) === String(newBranchId));
                    setScopeCityBranchId(firstCity?.id || "");
                  }}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 bg-slate-50"
                >
                  <option value="">{t(lang, "lp.select_country_ph", "Select Country…")}</option>
                  {countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t(lang, "lp.country_branch", "Country Branch *")}</label>
                <select
                  value={scopeBranchId}
                  onChange={e => {
                    const newBranchId = e.target.value;
                    setScopeBranchId(newBranchId);
                    // Auto-select first city of this branch
                    const firstCity = cityBranches.find((c: any) => String(c.countryBranchId || c.country_branch_id) === String(newBranchId));
                    setScopeCityBranchId(firstCity?.id || "");
                  }}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 bg-slate-50"
                >
                  <option value="">{t(lang, "lp.select_branch_ph", "Select Branch…")}</option>
                  {scopeFilteredBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
                {scopeFilteredBranches.length === 0 && scopeCountryId && (
                  <p className="text-[9px] text-red-500 font-bold mt-1">{t(lang, "lp.no_branches_for_country", "No branches found for this country.")}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t(lang, "lp.city_branch", "City Branch")}</label>
                <select
                  value={scopeCityBranchId}
                  onChange={e => setScopeCityBranchId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 bg-slate-50"
                >
                  <option value="">{t(lang, "lp.sel_city_branch", "Select City Branch...")}</option>
                  {scopeCityBranches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {scopeCityBranches.length === 0 && scopeBranchId && (
                  <p className="text-[9px] text-slate-400 font-bold mt-1">{t(lang, "lp.no_city_branches", "No city branches for this branch.")}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScopeModalOpen(false)}
                className="w-1/2 h-9 rounded-xl text-xs font-bold"
              >
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (scopeCountryId) setSelectedCountryId(scopeCountryId);
                  if (scopeBranchId) setSelectedBranchId(scopeBranchId);
                  if (scopeCityBranchId) setSelectedCityBranchId(scopeCityBranchId);
                  setIsScopeModalOpen(false);
                  setEditingPurchaseId(null);
                  setIsFormOpen(true);
                  setCurrentStep(1);
                }}
                className="w-1/2 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-100"
              >
                {t(lang, "lp.btn_confirm_scope", "Confirm Scope")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add New Goods Master */}
      {isAddingGoodsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" /> {t(lang, "lp.create_goods_title", "CREATE NEW GOODS MASTER")}
              </h3>
              <button onClick={() => setIsAddingGoodsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoodsMaster} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.goods_item_name", "Goods Item Name *")}</label>
                <input
                  required
                  autoFocus
                  value={newGoodsNameInput}
                  onChange={e => setNewGoodsNameInput(e.target.value)}
                  placeholder={th("e.g. CASHEW NUTS")}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.col_chassis_hs", "Chassis / HS Code")}</label>
                <input
                  value={newChsCodeInput}
                  onChange={e => setNewChsCodeInput(e.target.value)}
                  placeholder={th("e.g. CHS-9812")}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingGoodsModal(false)}
                  className="w-1/2 h-9 rounded-xl text-xs font-bold"
                >
                  {t(lang, "common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewGoods}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  {t(lang, "lp.btn_save_goods", "Save Goods")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 1b: Edit Goods Master */}
      {isEditingGoodsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-600" /> {th("EDIT GOODS MASTER")}
              </h3>
              <button onClick={() => { setIsEditingGoodsModal(false); setEditGoodsTarget(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditGoodsMaster} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.goods_item_name", "Goods Item Name *")}</label>
                <input
                  required
                  autoFocus
                  value={editGoodsNameInput}
                  onChange={e => setEditGoodsNameInput(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.col_chassis_hs", "Chassis / HS Code")}</label>
                <input
                  value={editChsCodeInput}
                  onChange={e => setEditChsCodeInput(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsEditingGoodsModal(false); setEditGoodsTarget(null); }}
                  className="w-1/2 h-9 rounded-xl text-xs font-bold"
                >
                  {t(lang, "common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingEditGoods}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  {t(lang, "lp.btn_update_goods", "Update Goods")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Brand */}
      {isAddingBrandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-600" /> {th("ADD BRAND VARIATION")}
              </h3>
              <button onClick={() => setIsAddingBrandModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBrandVariation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.new_brand_name", "New Brand Name *")}</label>
                <input
                  required
                  autoFocus
                  value={newBrandInput}
                  onChange={e => setNewBrandInput(e.target.value)}
                  placeholder={th("e.g. AL-KHAIR")}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingBrandModal(false)}
                  className="w-1/2 h-9 rounded-xl text-xs font-bold"
                >
                  {t(lang, "common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewBrand}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  {t(lang, "lp.btn_save_brand", "Save Brand")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Size */}
      {isAddingSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" /> {th("ADD SIZE VARIATION")}
              </h3>
              <button onClick={() => setIsAddingSizeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSizeVariation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.new_size_name", "New Size Name *")}</label>
                <input
                  required
                  autoFocus
                  value={newSizeInput}
                  onChange={e => setNewSizeInput(e.target.value)}
                  placeholder={th("e.g. 50KG STANDARD")}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingSizeModal(false)}
                  className="w-1/2 h-9 rounded-xl text-xs font-bold"
                >
                  {t(lang, "common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewSize}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  {t(lang, "lp.btn_save_size", "Save Size")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Printable A4 Voucher Modal from registry log list */}
      {selectedRowForVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 print:hidden">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> VOUCHER DETAILS FOR LP-{selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}
              </h3>
              <div className="flex gap-2">
                {selectedRowForVoucher.status === "accepted" && (
                  <Button
                    onClick={async () => {
                      if (!confirm("Are you sure you want to transfer this verified bill to general ledger? This will post all accounting journal and roznamcha entries.")) return;
                      try {
                        const res = await fetch("/api/erp/purchases/local-purchase/transfer", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ purchaseId: selectedRowForVoucher.id })
                        });
                        const data = await res.json();
                        if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to transfer.");
                        alert("Accounting Entries Posted Successfully to:\n- Cash Entry / Daily Payment\n- Business Roznamcha\n- General Ledger\n- Journal (Debit/Credit Serials generated)");
                        
                        // Update local row status and reload registry
                        setSelectedRowForVoucher((prev: any | null) => prev ? { ...prev, status: "posted" } : null);
                        await loadHistory();
                      } catch (err: any) {
                        alert(err.message || "An error occurred during transfer.");
                      }
                    }}
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" /> {th("Transfer & Post to GL")}
                  </Button>
                )}
                {(selectedRowForVoucher.status === "draft" || isSuperAdmin) && (
                  <Button
                    type="button"
                    onClick={() => {
                      const row = selectedRowForVoucher;
                      setSelectedRowForVoucher(null);
                      setIsFormOpen(true);
                      setCurrentStep(1);
                      setEditingPurchaseId(row.id || null);
                      setGoodsId(row.goods_id || row.goodsId || "");
                      setCustomGoodsName(row.goods_name || row.goodsName || "");
                      setSupplierName(row.supplier_name || row.supplierName || "");
                      setSupplierPersonId(row.supplier_person_id || row.supplierPersonId || "");
                      setPurchaseAccountNo(row.purchase_account_no || row.purchaseAccountNo || "");
                      setSalesAccountNo(row.sales_account_no || row.salesAccountNo || "");
                      setBrokerAccountNo(row.broker_account_no || row.brokerAccountNo || "");
                      setContractNo(row.contract_no || row.contractNo || "");
                      setChassisCode(row.chassis_code || row.chassisCode || "");
                      setLotNo(row.lot_no || row.lotNo || "");
                      setPaymentMode(row.payment_mode || row.paymentMode || "Cash");
                      setShippingMode(row.shipping_mode || row.shippingMode || "Loading");
                      setShipmentType(SHIPPING_MODE_TO_SHIPMENT_TYPE[row.shipping_mode || row.shippingMode || "Loading"] || "Loading by Truck");
                      setOriginCountryId(row.origin_country_id || row.originCountryId || "");
                      setAdvancePercentage(String(row.advance_percentage ?? row.advancePercentage ?? "20"));
                      setWarehouseName(row.warehouse_name || row.warehouseName || "");
                      setSelectedWarehouseId(row.warehouse_id || row.warehouseId || "");
                      setWarehouseAccountNo(row.purchase_account_no || row.purchaseAccountNo || "");
                      setWarehousePlotNo(row.warehouse_plot_no || row.warehousePlotNo || "");
                      setTransferDate(row.transfer_date || row.transferDate || new Date().toISOString().slice(0, 10));
                      setLoadingDate(row.loading_date || row.loadingDate || new Date().toISOString().slice(0, 10));
                      setTruckNo(row.truck_no || row.truckNo || "");
                      setDriverName(row.driver_name || row.driverName || "");
                      setRemarks(row.remarks || "");
                      setQuantityName(row.quantity_name || row.quantityName || "Bags");
                      setQuantityCount(String(row.quantity_kgs ?? row.quantityKgs ?? ""));
                      setEmptyKgs(String(row.empty_kgs ?? row.emptyKgs ?? ""));
                      setDivideKgs(String(row.divide_kgs ?? row.divideKgs ?? "50"));
                      setRateType(row.rate_type || row.rateType || "per_kg");
                      setPurchaseRate(String(row.purchase_rate ?? row.purchaseRate ?? ""));
                      setPurchaseCurrency(row.purchase_currency || row.purchaseCurrency || "USD");
                      setExchangeRateToAed(String(row.exchange_rate ?? row.exchangeRate ?? "1"));
                      setApplyTax(row.apply_tax || row.applyTax || "No");
                      setTaxType(row.tax_type || row.taxType || "VAT");
                      setTaxPercentage(String(row.tax_percentage ?? row.taxPercentage ?? "0"));
                      if (row.country_branch_id || row.countryBranchId) setSelectedBranchId(row.country_branch_id || row.countryBranchId);
                      if (row.city_branch_id || row.cityBranchId) setSelectedCityBranchId(row.city_branch_id || row.cityBranchId);
                    }}
                    className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> {th("Edit")}
                  </Button>
                )}
                <Button
                  onClick={() => printDomFragmentViaModal("printable-modal-voucher", "Voucher")}
                  className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" /> {th("Print")}
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedRowForVoucher(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                >
                  {th("Close")}
                </button>
              </div>
            </div>

            <div id="printable-modal-voucher" className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 font-sans text-xs">

              {/* UAE-specific invoice format */}
              {(() => {
                const rowCountry = selectedRowForVoucher.countryName || selectedRowForVoucher.country_name || activeBranch?.countryName || activeBranch?.country_name || "";
                const isUAE = isUaeCountryName(rowCountry);
                const rowFinalCost = Number(selectedRowForVoucher.finalCost || selectedRowForVoucher.final_cost || 0);
                const rowTaxAmt = Number(selectedRowForVoucher.taxAmount || selectedRowForVoucher.tax_amount || 0);
                const rowSubtotal = Math.max(rowFinalCost - rowTaxAmt, 0);
                const rowGrossWt = Number(selectedRowForVoucher.grossWeight || selectedRowForVoucher.gross_weight || selectedRowForVoucher.quantityKgs || selectedRowForVoucher.quantity_kgs || 0);
                const rowNetWt = Number(selectedRowForVoucher.netWeight || selectedRowForVoucher.net_weight || 0);
                const rowQty = Number(selectedRowForVoucher.quantityKgs || selectedRowForVoucher.quantity_kgs || 0);
                const rowDate = new Date(selectedRowForVoucher.createdAt || selectedRowForVoucher.created_at || Date.now()).toLocaleDateString("en-GB");
                const rowCurrency = selectedRowForVoucher.localCurrency || selectedRowForVoucher.local_currency || "AED";
                const rowVatPercent = Number(selectedRowForVoucher.taxPercentage || selectedRowForVoucher.tax_percentage || 5);
                const rowFreight = Number(selectedRowForVoucher.freightCharges || selectedRowForVoucher.freight_charges || selectedRowForVoucher.loadingCharges || selectedRowForVoucher.loading_charges || 0);
                const rowRoundOff = Number(selectedRowForVoucher.roundOff || selectedRowForVoucher.round_off || 0);
                const rowGrandTotal = rowFinalCost + rowFreight + rowRoundOff;
                const rowUnit = selectedRowForVoucher.quantityName || selectedRowForVoucher.quantity_name || "Bags";
                const rowUnitPrice = Number(selectedRowForVoucher.purchaseRate || selectedRowForVoucher.purchase_rate || 0);
                const voucherRef = selectedRowForVoucher.invoiceNo || selectedRowForVoucher.invoice_no || selectedRowForVoucher.journal_serial_no || selectedRowForVoucher.serial_no || selectedRowForVoucher.serialNo || `LP-${selectedRowForVoucher.id?.slice(0,5).toUpperCase()}`;
                const companyName = selectedRowForVoucher.companyName || selectedRowForVoucher.company_name || activeBranch?.companyName || activeBranch?.company_name || activeBranch?.branding_company_name || "";
                const branchName = selectedRowForVoucher.branchName || selectedRowForVoucher.branch_name || activeBranch?.name || "";
                const officeAddress = selectedRowForVoucher.officeAddress || selectedRowForVoucher.office_address || activeBranch?.fullAddress || activeBranch?.full_address || activeBranch?.address || "";
                const officePhone = activeBranch?.phone || activeBranch?.phoneNumber || activeBranch?.phone_number || activeBranch?.mobile || activeBranch?.mobileNumber || activeBranch?.mobile_number || "—";
                const officeEmail = activeBranch?.email || activeBranch?.emailAddress || activeBranch?.email_address || "—";
                const trnNumber = activeBranch?.trnNumber || activeBranch?.trn_number || activeBranch?.vatNumber || activeBranch?.vat_number || "—";
                const supplierName = selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "—";
                const supplierCountryName = selectedRowForVoucher.originCountryName || selectedRowForVoucher.origin_country_name || activeBranch?.countryName || "";
                const paymentMethod = selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "—";
                const shippingMode = selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "—";
                const goodsName = selectedRowForVoucher.goodsName || selectedRowForVoucher.goods_name || "—";
                const hsCode = selectedRowForVoucher.hsCode || selectedRowForVoucher.hs_code || selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || "-";
                const brandName = selectedRowForVoucher.brand || "-";
                const sizeName = selectedRowForVoucher.size || selectedRowForVoucher.sizeName || selectedRowForVoucher.size_name || "-";
                if (isUAE) {
                  return (
                    // The A4-format invoice below is a fixed 794px (A4 @96dpi) layout by
                    // design — Phase 13 forbids reflowing it for phones, since that would
                    // no longer match the official printed document. On a narrow screen
                    // this wrapper lets the user pan across it instead of the content
                    // clipping or forcing the whole modal to scroll sideways; print output
                    // is unaffected (printDomFragmentViaModal clones into its own print
                    // document, and print:max-w-none below already governs paper output).
                    <div className="overflow-x-auto print:overflow-visible">
                    <div className="mx-auto max-w-[794px] space-y-4 bg-white text-[10px] text-slate-800 print:max-w-none print:text-[9px]">
                      <div className="overflow-hidden rounded-2xl border border-slate-300">
                        <div className="grid grid-cols-[88px_1fr_210px] gap-4 bg-slate-950 p-5 text-white">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">{th("LOGO")}</div>
                          <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-[0.18em]">{t(lang, "lp.tax_invoice", "Tax Invoice")}</h2>
                            <p className="text-sm font-extrabold uppercase tracking-wide">{companyName}</p>
                            <p className="text-[10px] text-slate-300">{branchName}</p>
                            <p className="max-w-lg text-[10px] leading-4 text-slate-300">{officeAddress}</p>
                          </div>
                          <div className="space-y-1 text-right text-[10px]">
                            <p>{t(lang, "lp.f_invoice_no", "Invoice No:")} <span className="font-mono font-black text-white">{voucherRef}</span></p>
                            <p>{t(lang, "lp.f_invoice_date", "Invoice Date:")} <span className="font-mono font-bold">{rowDate}</span></p>
                            <p>{t(lang, "lp.f_payment_method", "Payment Method:")} <span className="font-bold">{paymentMethod}</span></p>
                            <p>{t(lang, "lp.f_phone", "Phone:")} <span className="font-bold">{officePhone}</span></p>
                            <p>{t(lang, "lp.f_email", "Email:")} <span className="font-bold">{officeEmail}</span></p>
                            <p className="rounded-lg bg-white/10 px-2 py-1 font-bold text-blue-100">TRN / VAT: {trnNumber}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50 p-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t(lang, "lp.hdr_supplier_details", "Supplier Details")}</p>
                            <p className="text-sm font-black text-slate-900">{supplierName}</p>
                            <p className="mt-1 text-slate-500">{t(lang, "lp.f_country", "Country:")} {supplierCountryName || ""}</p>
                            <p className="text-slate-500">{t(lang, "lp.f_invoice_currency", "Invoice Currency:")} <span className="font-bold text-slate-800">{rowCurrency}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t(lang, "lp.delivery_warehouse", "Delivery / Warehouse")}</p>
                            <p>{t(lang, "lp.f_transaction_type", "Transaction Type:")} <span className="font-bold">{shippingMode}</span></p>
                            <p>{t(lang, "lp.f_warehouse", "Warehouse:")} <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></p>
                            <p>{t(lang, "lp.f_truck_no", "Truck No:")} <span className="font-mono font-bold text-indigo-700">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t(lang, "lp.invoice_control", "Invoice Control")}</p>
                            <p>{t(lang, "lp.f_branch", "Branch:")} <span className="font-bold">{branchName}</span></p>
                            <p>{t(lang, "lp.f_document_ref", "Document Ref:")} <span className="font-mono font-bold">{voucherRef}</span></p>
                            <p>{t(lang, "lp.f_status", "Status:")} <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">{t(lang, "lp.col_posted", "Posted")}</span></p>
                          </div>
                        </div>

                        <div className="p-4">
                          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 text-[9px]">
                            <thead className="bg-slate-900 text-white">
                              <tr>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_sr", "Sr.")}</Th>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_goods_name", "Goods Name")}</Th>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_hs_code", "HS Code")}</Th>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_brand", "Brand")}</Th>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_size", "Size")}</Th>
                                <Th className="border border-slate-800 p-2 text-right">{t(lang, "lp.col_quantity", "Quantity")}</Th>
                                <Th className="border border-slate-800 p-2 text-left">{t(lang, "lp.col_unit", "Unit")}</Th>
                                <Th className="border border-slate-800 p-2 text-right">{t(lang, "lp.col_unit_price", "Unit Price")}</Th>
                                <Th className="border border-slate-800 p-2 text-right">{t(lang, "lp.taxable_amount", "Taxable Amount")}</Th>
                                <Th className="border border-slate-800 p-2 text-right">VAT %</Th>
                                <Th className="border border-slate-800 p-2 text-right">{t(lang, "lp.vat_amount", "VAT Amount")}</Th>
                                <Th className="border border-slate-800 p-2 text-right">{t(lang, "lp.total_amount", "Total Amount")}</Th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="align-top">
                                <td className="border border-slate-200 p-2">1</td>
                                <td className="border border-slate-200 p-2 font-bold text-slate-900">
                                  {goodsName}
                                  <div className="mt-1 text-[8px] font-semibold text-slate-500">Gross WT: {rowGrossWt.toLocaleString()} kg | Net WT: {rowNetWt.toLocaleString()} kg</div>
                                </td>
                                <td className="border border-slate-200 p-2 font-mono">{hsCode}</td>
                                <td className="border border-slate-200 p-2">{brandName}</td>
                                <td className="border border-slate-200 p-2">{sizeName}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowQty.toLocaleString()}</td>
                                <td className="border border-slate-200 p-2">{rowUnit}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono">{rowVatPercent}%</td>
                                <td className="border border-slate-200 p-2 text-right font-mono text-red-600">{rowTaxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="border border-slate-200 p-2 text-right font-mono font-black text-emerald-700">{rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            </tbody>
                          </table>

                          <div className="mt-4 grid grid-cols-[1fr_310px] gap-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t(lang, "lp.amount_in_words", "Amount In Words")}</p>
                              <p className="text-sm font-black capitalize text-slate-900">{amountToWordsEn(rowGrandTotal, rowCurrency)}</p>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-[9px]">
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">{t(lang, "lp.qr_code", "QR Code")}</p>
                                  <p className="mt-2 text-slate-400">{t(lang, "lp.qr_placeholder_note", "QR placeholder for e-invoice reference.")}</p>
                                </div>
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">{t(lang, "lp.company_stamp", "Company Stamp")}</p>
                                  <p className="mt-2 text-slate-400">{t(lang, "lp.stamp_area", "Stamp area")}</p>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-300 text-[10px]">
                              <div className="bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">{t(lang, "lp.summary_word", "Summary")}</div>
                              <div className="space-y-2 p-3">
                                <div className="flex justify-between"><span>{t(lang, "lp.sub_total", "Sub Total")}</span><span className="font-mono font-bold">{rowCurrency} {rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-red-600"><span>{t(lang, "lp.vat_total", "VAT Total")}</span><span className="font-mono font-bold">{rowCurrency} {rowTaxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span>{t(lang, "lp.freight_loading", "Freight / Loading")}</span><span className="font-mono font-bold">{rowCurrency} {rowFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span>{t(lang, "lp.round_off", "Round Off")}</span><span className="font-mono font-bold">{rowCurrency} {rowRoundOff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-emerald-700"><span>{t(lang, "lp.grand_total", "Grand Total")}</span><span className="font-mono">{rowCurrency} {rowGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 bg-slate-50 p-4 text-[9px]">
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-blue-800">{t(lang, "lp.bank_details", "Bank Details")}</p>
                            <p>{t(lang, "lp.f_bank_name", "Bank Name:")} <span className="font-bold">{activeBranch?.bankName || activeBranch?.bank_name || "-"}</span></p>
                            <p>{t(lang, "lp.f_account_name", "Account Name:")} <span className="font-bold">{activeBranch?.bankAccountName || activeBranch?.bank_account_name || companyName}</span></p>
                            <p>IBAN: <span className="font-mono font-bold">{activeBranch?.iban || activeBranch?.bankIban || "-"}</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-slate-700">{t(lang, "lp.terms_conditions", "Terms & Conditions")}</p>
                            <p>1. {t(lang, "lp.term_goods_condition", "Goods received in good condition are subject to company purchase policy.")}</p>
                            <p>2. {t(lang, "lp.term_vat_calc", "VAT and taxable amounts are calculated according to the applicable tax-invoice requirements.")}</p>
                            <p>3. {t(lang, "lp.term_invoice_from_erp", "This invoice is generated from the ERP local purchase module.")}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 p-5 text-center text-[9px] font-bold text-slate-600">
                          <div className="border-t border-slate-700 pt-2">{t(lang, "lp.prepared_by", "Prepared By")}</div>
                          <div className="border-t border-slate-700 pt-2">{t(lang, "lp.checked_by", "Checked By")}</div>
                          <div className="border-t border-slate-700 pt-2">{t(lang, "lp.authorized_signature", "Authorized Signature")}</div>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                }

                // Non-UAE: standard voucher
                return (
                  <div className="space-y-4">
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">{th("LOCAL PURCHASE BILL VOUCHER")}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    {selectedRowForVoucher.branchName || t(lang, "lp.global_system_branch", "Global System Branch")}
                  </p>
                </div>
                <div className="text-right text-xs font-mono">
                  <span className="font-black text-blue-600 block text-sm">LP-{selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}</span>
                  <span className="text-[9px] text-slate-500 block">{t(lang, "lp.f_date", "Date:")} {new Date(selectedRowForVoucher.createdAt || selectedRowForVoucher.created_at).toLocaleDateString("en-GB")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">{t(lang, "lp.f_supplier_vendor", "Supplier / Vendor:")}</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "-"}</span>
                  <span className="text-[9px] text-emerald-600 block font-bold mt-1 uppercase">
                    {t(lang, "lp.f_payment_mode", "Payment Mode:")} {selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "Cash"}
                  </span>
                </div>
                <div className="text-right text-[10px] space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">{t(lang, "lp.f_shipping_logistics", "Shipping & Logistics:")}</span>
                  <div className="font-semibold text-slate-700">{t(lang, "lp.f_mode", "Mode:")} <span className="font-bold">{selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "Loading"}</span></div>
                  <div className="font-semibold text-slate-700">{t(lang, "lp.f_warehouse", "Warehouse:")} <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></div>
                  <div className="font-semibold text-slate-700">{t(lang, "lp.f_truck_no", "Truck No:")} <span className="font-bold font-mono text-indigo-600">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-[9px] font-bold uppercase">
                    <tr>
                      <Th className="p-2 border-b">{t(lang, "lp.col_goods_item", "Goods Item")}</Th>
                      <Th className="p-2 border-b">{t(lang, "lp.col_brand_origin", "Brand/Origin")}</Th>
                      <Th className="p-2 border-b text-right">{t(lang, "lp.col_qty", "Qty")}</Th>
                      <Th className="p-2 border-b text-right">{t(lang, "lp.net_weight", "Net Weight")}</Th>
                      <Th className="p-2 border-b text-right">{t(lang, "lp.col_rate", "Rate")}</Th>
                      <Th className="p-2 border-b text-right">{t(lang, "lp.col_final_amount", "Final Amount")}</Th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px]">
                    <tr className="border-b">
                      <td className="p-2 font-bold text-slate-800">
                        {selectedRowForVoucher.goodsName || selectedRowForVoucher.goods_name}
                        {(selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || selectedRowForVoucher.lotNo || selectedRowForVoucher.lot_no) && (
                          <div className="text-[8px] text-slate-500 font-bold uppercase mt-0.5 font-mono">
                            Chs: {selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || "-"} | Lot: {selectedRowForVoucher.lotNo || selectedRowForVoucher.lot_no || "-"}
                          </div>
                        )}
                        {(selectedRowForVoucher.apply_tax === "Yes" || selectedRowForVoucher.applyTax === "Yes") && (
                          <div className="text-[8px] text-indigo-650 font-bold uppercase mt-0.5 font-sans">
                            Tax: {selectedRowForVoucher.tax_type || selectedRowForVoucher.taxType} ({selectedRowForVoucher.tax_percentage || selectedRowForVoucher.taxPercentage}%) - ${Number(selectedRowForVoucher.tax_amount || selectedRowForVoucher.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-slate-500">
                        {selectedRowForVoucher.brand || "-"} / {selectedRowForVoucher.originCountryName || selectedRowForVoucher.origin_country_name || "Local"}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {Number(selectedRowForVoucher.quantityKgs || selectedRowForVoucher.quantity_kgs || 0).toLocaleString()} {selectedRowForVoucher.quantityName || selectedRowForVoucher.quantity_name || "Bags"}
                      </td>
                      <td className="p-2 text-right font-mono text-blue-600 font-bold">
                        {Number(selectedRowForVoucher.netWeight || selectedRowForVoucher.net_weight || 0).toLocaleString()} kg
                      </td>
                      <td className="p-2 text-right font-mono">
                        ${Number(selectedRowForVoucher.purchaseRate || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-emerald-600">
                        {selectedRowForVoucher.localCurrency || selectedRowForVoucher.local_currency} {Number(selectedRowForVoucher.finalCost || selectedRowForVoucher.final_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 text-white rounded-lg p-3 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300 uppercase">{t(lang, "lp.total_bill_amount", "Total Bill Amount:")}</span>
                <span className="font-mono text-base font-black text-emerald-700">
                  {selectedRowForVoucher.localCurrency || selectedRowForVoucher.local_currency} {Number(selectedRowForVoucher.finalCost || selectedRowForVoucher.final_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {handoverModalOpen && handoverTargetRow ? (
        <TaskHandoverModal
          open={handoverModalOpen}
          onClose={() => {
            setHandoverModalOpen(false);
            setHandoverTargetRow(null);
          }}
          orderReference={handoverTargetRow.manual_bill_no || handoverTargetRow.entry_serial || handoverTargetRow.journal_serial_no || handoverTargetRow.id}
          sourceTable="local_purchases"
          sourceId={handoverTargetRow.id}
          targetUrl={`/dashboard/purchase/local-purchase?id=${handoverTargetRow.id}`}
          defaultTask={t(lang, "lp.handover_default_task", "Please continue this local purchase bill to the next step.")}
          sourceCountryId={handoverTargetRow.country_id || handoverTargetRow.countryId || null}
          sourceCountryBranchId={handoverTargetRow.country_branch_id || handoverTargetRow.countryBranchId || null}
          sourceCityBranchId={handoverTargetRow.city_branch_id || handoverTargetRow.cityBranchId || null}
          domain="business"
          customerPartyName={handoverTargetRow.supplierName || handoverTargetRow.supplier_name || null}
          onSuccess={() => {
            setHandoverModalOpen(false);
            setHandoverTargetRow(null);
          }}
          lang={lang}
        />
      ) : null}
    </div>
  );
}



















