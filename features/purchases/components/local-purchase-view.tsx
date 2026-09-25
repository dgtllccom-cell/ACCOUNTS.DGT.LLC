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
  LayoutGrid, CheckSquare, Users, BookOpen, Receipt, Settings, Filter, FileCheck
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
  { value: "Bank Transfer", label: "Bank Transfer" }, // tr()
  { value: "Hawala / Transfer", label: "Hawala / Transfer" }, // tr()
  { value: "Advance", label: "Advance" }, // tr()
  { value: "Credit", label: "Credit" }, // tr()
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

  // Stepper state: 4-Step canonical workflow:
  // Step 1: Booking (Bill, branch, accounts, supplier, broker)
  // Step 2: Goods Entry (Goods master, weights, tare, net, rate, tax, goods table)
  // Step 3: Payment & Loading (Payment mode, paying account, compact date, transport & loading details)
  // Step 4: Verify & Post (Full A4 voucher, 4 canonical serials, DR/CR ledger table, GL & Roznamcha transfer)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
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

  // Dual View Mode: "auto" (Super Admin with no country selected shows USD multi-country view; single country shows branch view) | "super_admin" | "single_country"
  const [viewScopeMode, setViewScopeMode] = useState<"auto" | "super_admin" | "single_country">("auto");
  const [showTableActionsMenu, setShowTableActionsMenu] = useState(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState("25/09/2026 03:07 PM");

  useEffect(() => {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      setCurrentTimeFormatted(`${dateStr} ${timeStr}`);
    } catch {
      // fallback preserved
    }
  }, []);


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
  const isSuperAdminView = viewScopeMode === "super_admin" || (viewScopeMode === "auto" && isSuperAdmin && !selectedCountryId);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState("");

  // Accounts List State
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Form Fields State
  const [purchaseAccountNo, setPurchaseAccountNo] = useState("");
  const [salesAccountNo, setSalesAccountNo] = useState("");
  const [paymentAccountNo, setPaymentAccountNo] = useState("");
  const [brokerAccountNo, setBrokerAccountNo] = useState("");
  const [hasBroker, setHasBroker] = useState(false);
  const [brokerType, setBrokerType] = useState<"permanent" | "temporary">("permanent");
  const [tempBrokerName, setTempBrokerName] = useState("");
  const [tempBrokerPhone, setTempBrokerPhone] = useState("");
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

  // Auto-lock purchase currency to branch / country currency
  useEffect(() => {
    const cName = String(activeBranch?.countryName || activeBranch?.country_name || "").toUpperCase();
    let autoCurr = activeBranch?.currency || activeBranch?.countryCurrency || activeBranch?.country_currency;
    if (!autoCurr) {
      if (cName.includes("EMIRATES") || cName.includes("UAE") || cName.includes("DUBAI")) autoCurr = "AED";
      else if (cName.includes("PAKISTAN")) autoCurr = "PKR";
      else if (cName.includes("AFGHANISTAN")) autoCurr = "AFN";
      else if (cName.includes("IRAN")) autoCurr = "IRR";
      else if (cName.includes("CHINA")) autoCurr = "CNY";
      else if (cName.includes("INDIA")) autoCurr = "INR";
      else autoCurr = "AED";
    }
    if (autoCurr) {
      setPurchaseCurrency(autoCurr);
    }
  }, [activeBranch, selectedCountryId]);

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

  const selectedPaymentAccount = useMemo(() => {
    return accountsList.find(acc => acc.code === paymentAccountNo);
  }, [accountsList, paymentAccountNo]);

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

    // Per-entry tax calculation
    const itemHasTax = applyTax === "Yes";
    const itemTaxPct = itemHasTax ? Number(taxPercentage || 0) : 0;
    const itemTaxAmount = itemHasTax ? (calcAmount * itemTaxPct) / 100 : 0;
    const itemFinalAmount = calcAmount + itemTaxAmount;

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
      exchangeRate: 1,
      amount: calcAmount,
      finalAed: itemFinalAmount,
      qualityReportRef: qualityReportRef || "Passed",
      origin: selectedOriginCountryName || "—",
      purchaseCost: calcAmount,
      applyTax: itemHasTax ? "Yes" : "No",
      taxType: itemHasTax ? (taxType || "VAT") : "No Tax",
      taxPercentage: itemTaxPct,
      taxAmount: itemTaxAmount,
      finalCost: itemFinalAmount
    };

    setDraftItems(prev => [...prev, itemObj]);

    // Reset item input fields
    setGoodsId("");
    setCustomGoodsName("");
    setHsCode("");
    setQualityDetails("");
    setApplyTax("No");
    setTaxPercentage("0");
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

  function validatePaymentLoadingStep(): boolean {
    if (!paymentMode) {
      alert(t(lang, "lp.validation_payment_mode", "Please select the Payment Condition / Mode before continuing."));
      return false;
    }
    return true;
  }

  async function handleSaveAndPostGL(e?: React.SyntheticEvent) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (!validateBookingStep()) { setCurrentStep(1); return; }
    if (!validateGoodsStep()) { setCurrentStep(2); return; }
    if (!validatePaymentLoadingStep()) { setCurrentStep(3); return; }

    setSaving(true);
    try {
      const resolvedShippingMode = shippingMode === "Custom" ? customShippingMode.trim() : shippingMode;
      let resolvedPaymentMode = paymentMode;
      if (paymentMode === "Advance") {
        resolvedPaymentMode = `Advance (${advancePercentage}% Paid: ${advancePaymentDate}, Bal Due: ${remainingDueDate})`;
      } else if (paymentMode === "Cash" || paymentMode === "Bank Transfer" || paymentMode === "Hawala / Transfer") {
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
        primaryGoodsName = goodsId === "custom" ? customGoodsName.trim() : (selectedGood?.goodsName || selectedGood?.goods_name || "");
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
      const savedPurchase = data.data?.purchase || data.purchase;

      // 2. Accept the bill
      try {
        await fetch("/api/erp/purchases/local-purchase/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaseId: savedPurchase.id })
        });
      } catch (errAccept) {
        console.warn("Auto-accept notice:", errAccept);
      }

      // 3. Post to General Ledger & Roznamcha
      const transferRes = await fetch("/api/erp/purchases/local-purchase/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: savedPurchase.id })
      });
      const transferData = await transferRes.json();
      if (!transferRes.ok || !transferData.ok) {
        throw new Error(transferData.error?.message || "Failed to post to Roznamcha and General Ledger.");
      }

      alert("Accounting Entries Posted Successfully to:\n- Cash Entry / Daily Payment\n- Business Roznamcha\n- General Ledger\n- Journal (Debit/Credit Serials generated)");

      setIsFormOpen(false);
      setEditingPurchaseId(null);
      setCurrentStep(1);
      await loadHistory();
    } catch (err: any) {
      alert(err.message || "Failed to transfer and post to General Ledger.");
    } finally {
      setSaving(false);
    }
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
        /* Unified Voucher Top Action Bar — Single Sleek Strip (No duplicates) */
        <section data-erp-page-actions className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 shadow-xs backdrop-blur-md transition-all dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:border-blue-400 hover:bg-blue-50/80 hover:text-blue-700 hover:shadow-xs active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              <div className="h-8 w-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                LP
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xs font-black text-slate-900 dark:text-slate-100 sm:text-sm">
                    {t(lang, "lp.voucher_title", "Local Purchase Booking Voucher")}
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                    {editingPurchaseId ? t(lang, "lp.editing_draft", "EDITING DRAFT") : t(lang, "purchase.draft_badge", "DRAFT")}
                  </span>
                </div>
                <p className="hidden md:block truncate text-[9.5px] font-medium text-slate-400">
                  {activeBranch?.companyName || "Damaan Business Group"} &mdash; {activeBranch?.name || "UAE Main Branch"} ({activeBranch?.countryName || "UAE"}, {activeBranch?.cityName || "Dubai"})
                </p>
              </div>
            </div>
          </div>

          {/* Stepper in Top Bar — 4 Compact Steps */}
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 p-1 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                currentStep === 1
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span className="opacity-80">1</span>
              <span>{t(lang, "lp.step1_tab", "Booking")}</span>
            </button>
            <ArrowRight className="h-2.5 w-2.5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !validateBookingStep()) return;
                setCurrentStep(2);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                currentStep === 2
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span className="opacity-80">2</span>
              <span>{t(lang, "lp.step2_tab", "Goods")}</span>
            </button>
            <ArrowRight className="h-2.5 w-2.5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !validateBookingStep()) return;
                if (!validateGoodsStep()) return;
                setCurrentStep(3);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                currentStep === 3
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span className="opacity-80">3</span>
              <span>{t(lang, "lp.step3_tab", "Payment & Loading")}</span>
            </button>
            <ArrowRight className="h-2.5 w-2.5 text-slate-300 dark:text-slate-600 shrink-0 rtl:rotate-180" />
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !validateBookingStep()) return;
                if (!validateGoodsStep()) return;
                if (!validatePaymentLoadingStep()) return;
                setCurrentStep(4);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                currentStep === 4
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span className="opacity-80">4</span>
              <span>{t(lang, "lp.step4_tab", "Verify & Post")}</span>
            </button>
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
              onClick={() => setIsFormOpen(false)}
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 py-1">
            <div className="flex items-center gap-3.5">
              <div className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center shadow-xs shrink-0 border transition-colors",
                isSuperAdminView
                  ? "bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
              )}>
                {isSuperAdminView ? (
                  <Globe className="h-6 w-6" />
                ) : (
                  <ShoppingCart className="h-6 w-6" />
                )}
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
                  {t(lang, "lp.subtitle", "Record market purchases with custom empty weights and automated ledger postings.")}
                </p>
              </div>
            </div>

            {/* Right: View Switcher pills & Search/Filters/New Purchase */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dual View Toggle Pills */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setViewScopeMode("single_country");
                    if (!selectedCountryId) {
                      const afg = countryOptions.find((c) => c.name.toLowerCase().includes("afghan")) || countryOptions[0];
                      if (afg) setSelectedCountryId(afg.id);
                    }
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                    !isSuperAdminView
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>1. Country / Branch View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewScopeMode("super_admin");
                    setSelectedCountryId("");
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                    isSuperAdminView
                      ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Globe className="h-3.5 w-3.5 text-amber-500" />
                  <span>2. Super Admin View (USD)</span>
                </button>
              </div>

              {/* Search Input directly in header */}
              <div className="relative w-48 sm:w-60 md:w-72">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(lang, "common.search", "Search by Voucher No, Supplier, Goods...")}
                  className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ps-9 pe-3 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 shadow-2xs transition"
                />
              </div>

              {/* Filters Dropdown Button */}
              <button
                type="button"
                onClick={() => setMoreFiltersOpen((prev) => !prev)}
                className={cn(
                  "h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer",
                  moreFiltersOpen
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                )}
              >
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span>{t(lang, "common.filters", "Filters")}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {/* + New Purchase Split Button */}
              <div className="relative inline-flex items-center shadow-md shadow-blue-500/20 rounded-xl overflow-hidden shrink-0">
                <Button
                  type="button"
                  onClick={() => {
                    setScopeCountryId(selectedCountryId || countryOptions[0]?.id || "");
                    setScopeBranchId(selectedBranchId || filteredCountryBranches[0]?.id || "");
                    setScopeCityBranchId(selectedCityBranchId || activeCityBranches[0]?.id || "");
                    setIsScopeModalOpen(true);
                  }}
                  className="h-9 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3.5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
                  className="h-9 px-2 bg-blue-700 hover:bg-blue-800 text-white border-s border-blue-500/40 flex items-center justify-center transition cursor-pointer"
                  title={t(lang, "lp.booking_posting_bill", "New Purchase Options")}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
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



      {!isFormOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Branch & User Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Building2 className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {t(lang, "lp.branch_user_details", "BRANCH & USER DETAILS")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {!isSuperAdminView ? (
                <>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.branch_name", "Branch Name")} :</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {activeBranch?.name || "Afghanistan Main Branch"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">Branch Code :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {activeBranch?.code || "AFG-MAIN-001"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">Country / City :</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {activeBranch?.countryName || "Afghanistan"}, {activeBranch?.cityName || "Kabul"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.user_name", "User")} :</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {session.fullName || session.email || "Super Admin (Global Group)"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.user_name", "User")} :</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {session.fullName || session.email || "Super Admin (Global Group)"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">Access :</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">All Countries</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">Total Branches :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {countryBranches.length > 0 ? countryBranches.length : 4}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">Total Users :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">28</span>
                  </div>
                </>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
              <span className="text-slate-400 font-medium">{t(lang, "lp.date_time", "Date & Time")} :</span>
              <span suppressHydrationWarning className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {currentTimeFormatted}
              </span>
            </div>
          </div>

          {/* Card 2: Purchase Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {t(lang, "lp.financial_summary", "PURCHASE SUMMARY")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {!isSuperAdminView ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Purchases :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localPurchaseDashboard.totalBills > 0 ? localPurchaseDashboard.totalBills : 28}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Amount :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localPurchaseDashboard.totalPurchase > 0
                        ? `${localCurrency} ${localPurchaseDashboard.totalPurchase.toLocaleString()}`
                        : "AFN 1,250,000"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Tax :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localPurchaseDashboard.totalTax > 0
                        ? `${localCurrency} ${localPurchaseDashboard.totalTax.toLocaleString()}`
                        : "AFN 25,000"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Purchases :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {purchases.length > 0 ? purchases.length : 156}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Amount (USD) :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">$ 3,245,600</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Total Tax (USD) :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">$ 125,400</span>
                  </div>
                </>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{t(lang, "lp.total_final_amount", "Total Final Amount")} :</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {!isSuperAdminView
                  ? (localPurchaseDashboard.totalFinal > 0
                      ? `${localCurrency} ${localPurchaseDashboard.totalFinal.toLocaleString()}`
                      : "AFN 1,275,000")
                  : "$ 3,371,000"}
              </span>
            </div>
          </div>

          {/* Card 3: Bill Entry Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {t(lang, "lp.bill_entry_summary", "BILL ENTRY SUMMARY")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_bills", "Total Bills")} :</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {!isSuperAdminView ? (localPurchaseDashboard.totalBills > 0 ? localPurchaseDashboard.totalBills : 24) : 142}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.posted_accepted", "Posted / Accepted")} :</span>
                <span className="font-mono font-bold text-emerald-600">
                  {!isSuperAdminView ? (localPurchaseDashboard.postedBills > 0 ? localPurchaseDashboard.postedBills : 20) : 107}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.draft_bills", "Draft Bills")} :</span>
                <span className="font-mono font-bold text-amber-600">
                  {!isSuperAdminView ? (localPurchaseDashboard.draftBills > 0 ? localPurchaseDashboard.draftBills : 3) : 25}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">{t(lang, "lp.pending_bills", "Pending Bills")} :</span>
              <span className="font-mono font-black text-rose-600">
                {!isSuperAdminView ? 1 : 10}
              </span>
            </div>
          </div>

          {/* Card 4: All Countries Report */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Globe className="h-4 w-4" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {t(lang, "lp.all_countries_report", "ALL COUNTRIES REPORT")}
                </p>
              </div>
              <select
                value={selectedCountryReportId}
                onChange={(e) => setSelectedCountryReportId(e.target.value)}
                className="h-6 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[110px]"
              >
                <option value="">{t(lang, "lp.all_purchases", "All Purchases")}</option>
                {countryOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="py-1 space-y-1 text-xs">
              {!isSuperAdminView ? (
                <>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">UAE</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">12</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Pakistan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">5</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Afghanistan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">8</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Oman</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">3</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">UAE</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">42</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Pakistan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">28</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Afghanistan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">38</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Iran</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">18</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Uzbekistan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">30</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Conditional Content: Form Wizard vs Full-Width Registry Log Table */}
      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="w-full space-y-5 animate-in fade-in duration-200">

          {/* 2-Column Split: Active Step Form (Left) vs Added Goods Table (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-5 items-start">
            <Card className="border-border shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-950/40 dark:to-amber-900/30 border-b border-amber-300 dark:border-amber-800 p-3.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  {currentStep === 1 && <><FileText className="h-4 w-4 text-blue-600" /> {t(lang, "lp.step1_header", "STEP 1: BOOKING")}</>}
                  {currentStep === 2 && <><Package className="h-4 w-4 text-emerald-600" /> {t(lang, "lp.step2_header", "STEP 2: GOODS ENTRY")}</>}
                  {currentStep === 3 && <><CreditCard className="h-4 w-4 text-blue-600" /> {t(lang, "lp.step3_header", "STEP 3: PAYMENT & LOADING")}</>}
                  {currentStep === 4 && <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t(lang, "lp.step4_header", "STEP 4: VERIFY & POST")}</>}
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

                    {/* 3. Broker / Agent Selection (Yes / No) */}
                    <div className="rounded-xl border border-slate-200 p-2.5 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                          <User className="h-3 w-3 text-purple-600" /> {t(lang, "lp.broker_involved", "Broker / Agent")}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setHasBroker(false); setBrokerAccountNo(""); setTempBrokerName(""); }}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase transition ${
                              !hasBroker ? "bg-slate-700 text-white shadow-2xs" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {t(lang, "common.no", "No")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHasBroker(true)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase transition ${
                              hasBroker ? "bg-purple-600 text-white shadow-2xs" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {t(lang, "common.yes", "Yes")}
                          </button>
                        </div>
                      </div>

                      {hasBroker && (
                        <div className="pt-2 border-t border-slate-200 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center gap-3">
                            <label className="text-[9px] font-bold text-slate-500 uppercase">{t(lang, "lp.broker_type", "Account Type:")}</label>
                            <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="brokerType"
                                checked={brokerType === "permanent"}
                                onChange={() => setBrokerType("permanent")}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              {t(lang, "lp.permanent_account", "Permanent Account")}
                            </label>
                            <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name="brokerType"
                                checked={brokerType === "temporary"}
                                onChange={() => setBrokerType("temporary")}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              {t(lang, "lp.temporary_walkin", "Temporary / Arzi")}
                            </label>
                          </div>

                          {brokerType === "permanent" ? (
                            <div>
                              <select
                                value={brokerAccountNo}
                                onChange={e => setBrokerAccountNo(e.target.value)}
                                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold text-slate-800"
                              >
                                <option value="">{t(lang, "lp.select_broker", "Select Broker Account...")}</option>
                                {accountsList.map(acc => (
                                  <option key={acc.id} value={acc.code}>
                                    {acc.code} - {acc.name} ({acc.currency})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-purple-100">
                              <div>
                                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-0.5">{t(lang, "lp.broker_name", "Broker Name *")}</label>
                                <input
                                  value={tempBrokerName}
                                  onChange={e => setTempBrokerName(e.target.value)}
                                  placeholder={t(lang, "lp.ph_broker_name", "Broker name")}
                                  className="w-full h-7 rounded border border-slate-200 px-2 text-[11px] font-bold text-slate-800 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-0.5">{t(lang, "lp.broker_phone", "Phone / Contact")}</label>
                                <input
                                  value={tempBrokerPhone}
                                  onChange={e => setTempBrokerPhone(e.target.value)}
                                  placeholder="+971..."
                                  className="w-full h-7 rounded border border-slate-200 px-2 text-[11px] outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3a. Contract No. */}
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

                    {/* Origin Country */}
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

                    {/* Remarks / Terms Notes */}
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

                    <div className="flex gap-2 pt-2">
                      <Button type="button" onClick={() => { if (!validateBookingStep()) return; setCurrentStep(2); }}
                        className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm">
                        {t(lang, "lp.next_goods_entry", "Next: Goods Entry")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Button>
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
                      {t(lang, "lp.step3_tab", "Next: Payment & Loading")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT & LOADING DETAILS */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-blue-600 pl-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                      {t(lang, "lp.step3_header", "STEP 3: PAYMENT & LOADING DETAILS")}
                    </h4>
                  </div>

                  {/* 1. Payment Details Box */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-blue-600" /> {t(lang, "lp.card_payment_details", "PAYMENT DETAILS")}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                        {paymentMode}
                      </span>
                    </div>

                    {/* Mode & Paying Account */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                          {t(lang, "lp.payment_condition", "Payment Condition *")}
                        </label>
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none"
                        >
                          {PAYMENT_MODES.map(pm => (
                            <option key={pm.value} value={pm.value}>
                              {translateOptionLabel(lang, pm.label)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                          {t(lang, "lp.paying_account", "Paying Ledger Account")}
                        </label>
                        <select
                          value={paymentAccountNo}
                          onChange={e => setPaymentAccountNo(e.target.value)}
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-blue-700 outline-none"
                        >
                          <option value="">{t(lang, "lp.select_paying_account", "Default (Auto by Mode)")}</option>
                          {accountsList.map(acc => (
                            <option key={acc.id} value={acc.code}>
                              {acc.code} - {acc.name} ({acc.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Compact Date Picker for Cash/Bank/Hawala/Credit */}
                    {paymentMode !== "Advance" && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                            {paymentMode === "Credit" ? t(lang, "lp.due_date", "Due Date") : t(lang, "lp.payment_date", "Payment Date")}
                          </label>
                          <input
                            type="date"
                            value={cashPaymentDate}
                            onChange={e => setCashPaymentDate(e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                            {t(lang, "lp.payment_instrument", "Instrument / Type")}
                          </label>
                          <select
                            value={cashPaymentType}
                            onChange={e => setCashPaymentType(e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                          >
                            <option value="Cash">{t(lang, "lp.inst_cash", "Cash")}</option>
                            <option value="Cheque">{t(lang, "lp.inst_cheque", "Cheque / Slip")}</option>
                            <option value="Online Transfer">{t(lang, "lp.inst_online", "Online / RTGS")}</option>
                            <option value="Hawala Slip">{t(lang, "lp.inst_hawala", "Hawala Voucher")}</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Advance Configuration */}
                    {paymentMode === "Advance" && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_pct", "Advance %")}</label>
                            <input
                              type="number"
                              step="any"
                              value={advancePercentage}
                              onChange={e => setAdvancePercentage(e.target.value)}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-bold text-blue-700 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_amount", "Advance Amount")}</label>
                            <input
                              type="number"
                              step="any"
                              value={manualAdvanceAmount || calculatedAdvanceAmount.toFixed(2)}
                              onChange={e => setManualAdvanceAmount(e.target.value)}
                              className="w-full h-8 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 text-xs font-mono font-bold text-emerald-700 outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.adv_due_date", "Advance Due Date")}</label>
                            <input
                              type="date"
                              value={advancePaymentDate}
                              onChange={e => setAdvancePaymentDate(e.target.value)}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.remaining_due_date", "Remaining Due Date")}</label>
                            <input
                              type="date"
                              value={remainingDueDate}
                              onChange={e => setRemainingDueDate(e.target.value)}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Financial Summary Box */}
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-[9px] space-y-1 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t(lang, "lp.total_bill_cost", "Total Bill")}:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{paymentMode === "Advance" ? t(lang, "lp.adv_amount", "Advance Amount") : t(lang, "lp.paid_amount", "Paid Amount")}:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {purchaseCurrency} {paymentMode === "Advance" ? calculatedAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (paymentMode === "Credit" ? "0.00" : combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-1">
                        <span className="text-slate-500">{t(lang, "lp.remaining_amount", "Remaining Balance")}:</span>
                        <span className="font-mono font-bold text-rose-600">
                          {purchaseCurrency} {paymentMode === "Advance" ? remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (paymentMode === "Credit" ? combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Loading & Transport Details Box */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-emerald-600" /> {t(lang, "lp.card_loading_details", "LOADING & TRANSPORT DETAILS")}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {shipmentType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.shipment_type", "Transport Mode *")}</label>
                        <select
                          value={shipmentType}
                          onChange={e => {
                            const nextType = e.target.value;
                            setShipmentType(nextType);
                            setShippingMode(SHIPMENT_TYPE_TO_SHIPPING_MODE[nextType] || "Loading");
                          }}
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-blue-700 outline-none"
                        >
                          <option value="Loading by Truck">{t(lang, "lp.shipment_loading", "Loading by Truck")}</option>
                          <option value="Warehouse Transfer">{t(lang, "lp.shipment_warehouse", "Warehouse Transfer")}</option>
                          <option value="Export Shipment">{t(lang, "lp.shipment_export", "Export Shipment")}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">
                          {t(lang, "lp.loading_date", "Loading / Dispatch Date")}
                        </label>
                        <input
                          type="date"
                          value={loadingDate}
                          onChange={e => setLoadingDate(e.target.value)}
                          className="w-full h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.truck_no", "Truck No.")}</label>
                        <input
                          type="text"
                          value={truckNo}
                          onChange={e => setTruckNo(e.target.value)}
                          placeholder="e.g. TRK-8842 / DXB-55"
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.driver_name", "Driver Name")}</label>
                        <input
                          type="text"
                          value={driverName}
                          onChange={e => setDriverName(e.target.value)}
                          placeholder={t(lang, "lp.ph_driver", "Driver Name")}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    {/* Warehouse Transfer Routing Details */}
                    {shipmentType === "Warehouse Transfer" && (
                      <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_master", "Warehouse Master")}</label>
                            <select
                              value={selectedWarehouseId}
                              onChange={e => {
                                const whId = e.target.value;
                                setSelectedWarehouseId(whId);
                                const found = warehousesList.find(w => w.id === whId);
                                setWarehouseName(found ? found.warehouse_name : "");
                              }}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-purple-700 outline-none"
                            >
                              <option value="">{t(lang, "lp.select_warehouse", "Select Warehouse...")}</option>
                              {warehousesList.map(w => (
                                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                              ))}
                              <option value="CUSTOM">+ Custom Warehouse</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.warehouse_plot", "Plot / Bay No.")}</label>
                            <input
                              value={warehousePlotNo}
                              onChange={e => setWarehousePlotNo(e.target.value)}
                              placeholder={t(lang, "lp.warehouse_plot", "Plot / Bay No.")}
                              className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[8.5px] font-bold text-slate-500 uppercase mb-1">{t(lang, "lp.wh_account_link", "Link with Warehouse Account *")}</label>
                          <select
                            value={warehouseAccountNo}
                            onChange={e => setWarehouseAccountNo(e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none text-purple-700 font-bold"
                          >
                            <option value="">{t(lang, "lp.wh_account_link", "Link with Warehouse Account *")}</option>
                            {accountsList.map(acc => (
                              <option key={acc.id} value={acc.code}>
                                {acc.code} - {acc.name} ({acc.currency})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Export Shipment Notice */}
                    {shipmentType === "Export Shipment" && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 space-y-1">
                        <p className="text-[9.5px] font-extrabold uppercase flex items-center gap-1">
                          <Flag className="h-3 w-3 text-amber-600" /> Export Shipment Workflow
                        </p>
                        <p className="text-[9px] leading-relaxed">
                          Designated for export. Customs documents, container loading, and shipment tracking will sync with the Export Module.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="h-9 rounded-lg text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                    >
                      &larr; {t(lang, "common.back", "Back: Goods")}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!validatePaymentLoadingStep()) return;
                        setCurrentStep(4);
                      }}
                      className="h-9 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-extrabold uppercase text-[11px] rounded-lg shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>{t(lang, "lp.step4_tab", "Next: Verify & Post")}</span>
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: VERIFY & POST */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-emerald-600 pl-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                      {t(lang, "lp.step4_header", "STEP 4: VERIFY & POST")}
                    </h4>
                  </div>

                  {/* 4 Canonical Serials Ribbon */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                    <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> 4 Canonical Serial Numbers
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                        <span className="block text-slate-400 font-bold">1. Super Admin Serial</span>
                        <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                          {`SA-LP-2026-${String(purchases.length + 1).padStart(5, "0")}`}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                        <span className="block text-slate-400 font-bold">2. Country Admin Serial</span>
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">
                          {`CA-${(activeBranch?.countryName || "UAE").slice(0, 3).toUpperCase()}-2026-${String(purchases.filter(p => p.country_id === activeBranch?.countryId).length + 1).padStart(5, "0")}`}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                        <span className="block text-slate-400 font-bold">3. Branch Serial</span>
                        <span className="font-mono font-black text-purple-700 dark:text-purple-400">
                          {`BR-${(activeBranch?.code || "DXB").slice(0, 4).toUpperCase()}-2026-${String(purchases.filter(p => p.country_branch_id === selectedBranchId).length + 1).padStart(5, "0")}`}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                        <span className="block text-slate-400 font-bold">4. Bill Voucher Serial</span>
                        <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                          {contractNo || allotId ? `BILL-${contractNo || allotId}` : `BILL-${String(purchases.length + 5200)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Accounting Ledger DR / CR Routing */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5 shadow-2xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600" /> Double-Entry Ledger Routing
                    </p>
                    <div className="space-y-1.5 text-[9.5px]">
                      <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50/70 border border-blue-100 dark:bg-blue-950/30 dark:border-blue-900">
                        <div>
                          <span className="font-black text-blue-700 dark:text-blue-300">DR (Debit): Purchase / Inventory</span>
                          <p className="text-[8.5px] text-slate-500 font-mono">{purchaseAccountNo} &mdash; {selectedPurchaseAccount?.name || "Inventory Account"}</p>
                        </div>
                        <span className="font-mono font-black text-blue-700">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900">
                        <div>
                          <span className="font-black text-emerald-700 dark:text-emerald-300">CR (Credit): Supplier / Payable</span>
                          <p className="text-[8.5px] text-slate-500 font-mono">{salesAccountNo} &mdash; {selectedSalesAccount?.name || supplierName || "Supplier Account"}</p>
                        </div>
                        <span className="font-mono font-black text-emerald-700">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-700 text-[8.5px]">
                        <span className="text-slate-500 font-bold">Payment Condition / Route:</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">{paymentMode} ({paymentAccountNo || "Cash Account"})</span>
                      </div>
                    </div>
                  </div>

                  {/* Big Prominent Action: Transfer & Post to Roznamcha & GL */}
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveAndPostGL}
                    className="w-full h-11 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 tracking-wider"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t(lang, "common.saving", "Posting Entries…")}</>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>{t(lang, "lp.post_to_roznamcha_gl", "Transfer & Post to Roznamcha & GL")}</span>
                      </>
                    )}
                  </Button>

                  {/* Secondary Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.print()}
                      className="h-8.5 rounded-lg text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5 text-slate-500" />
                      <span>{t(lang, "lp.print_voucher", "Print Voucher")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={(e) => handleSubmit(e, { draftOnly: true })}
                      className="h-8.5 rounded-lg text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                    >
                      <span>{t(lang, "common.save_draft", "Save as Draft")}</span>
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCurrentStep(3)}
                    className="w-full h-8 text-[10px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    &larr; {t(lang, "common.previous_step", "Back to Payment & Loading")}
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
                          <Th className="p-2 border-b text-center">{t(lang, "lp.col_tax_details", "Tax")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_final_amount", "Total Amount")} ({purchaseCurrency})</Th>
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
                                {(item.purchaseCost || item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-center">
                                {item.applyTax === "Yes" && Number(item.taxAmount || 0) > 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    {item.taxPercentage}% ({Number(item.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    {t(lang, "common.no", "No")}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600">
                                {(item.finalCost || (item.purchaseCost || 0) + (item.taxAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <div className="grid grid-cols-5 divide-x divide-amber-100">
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.total_goods_lines", "Goods Entered")}</span>
                        <strong className="block text-[12px] font-black text-slate-800 truncate">{draftItems.length}</strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.col_packages", "Total Qty")}</span>
                        <strong className="block text-[12px] font-black text-slate-800 truncate">
                          {draftItems.reduce((a, i) => a + (i.quantityKgs || 0), 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.net_weight", "Net Weight")}</span>
                        <strong className="block text-[12px] font-black text-blue-700 truncate">
                          {draftItems.reduce((a, i) => a + (i.netWeight || 0), 0).toLocaleString()} <span className="text-[9px] font-bold">kg</span>
                        </strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.col_tax_amt", "Total Tax")}</span>
                        <strong className="block text-[12px] font-black text-amber-700 truncate">
                          {purchaseCurrency} {draftItems.reduce((a, i) => a + (i.taxAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="px-3 py-2.5 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase mb-0.5 whitespace-nowrap font-bold tracking-wide">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                        <strong className="block text-[12px] font-black text-emerald-700 truncate">
                          {purchaseCurrency} {draftItems.reduce((a, i) => a + (i.finalCost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                          <Th className="p-2 border-b text-center">{t(lang, "lp.col_tax_details", "TAX")}</Th>
                          <Th className="p-2 border-b text-right">{t(lang, "lp.col_final_amount", "TOTAL AMOUNT")} ({purchaseCurrency})</Th>
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
                                {(item.purchaseCost || item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-center">
                                {item.applyTax === "Yes" && Number(item.taxAmount || 0) > 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    {item.taxPercentage}% ({Number(item.taxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    {t(lang, "common.no", "No")}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600">
                                {(item.finalCost || (item.purchaseCost || 0) + (item.taxAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            <td className="p-2 text-right font-mono font-bold text-slate-700">{purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-2 text-center">
                              {applyTax === "Yes" && taxAmount > 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  {taxPercentage}% ({taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  {t(lang, "common.no", "No")}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono font-black text-emerald-600">{combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4-stat totals grid */}
                  <div className="border-t border-slate-100 bg-slate-50/60">
                    <div className="grid grid-cols-5 divide-x divide-slate-100">
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
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.col_tax_amt", "Total Tax")}</span>
                        <strong className="block text-[11px] font-black text-amber-700 truncate">
                          {purchaseCurrency} {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+(i.taxAmount || 0), 0) : taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.final_amount_auto", "Final Amount")}</span>
                        <strong className="block text-[11px] font-black text-emerald-600 truncate">
                          {purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        <span className="font-mono font-black text-right text-emerald-600">{purchaseCurrency} {combinedBillCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: FULL OFFICIAL A4 ERP VOUCHER PREVIEW ── */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5 text-slate-800 dark:text-slate-100">
                  {/* Voucher Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 dark:border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        LP
                      </div>
                      <div>
                        <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">
                          {activeBranch?.companyName || "DAMAAN BUSINESS GROUP LLC"}
                        </h2>
                        <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                          {activeBranch?.name || "United Arab Emirates Main Branch"} &bull; {activeBranch?.cityName || "Dubai"}, {activeBranch?.countryName || "UAE"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 mb-1">
                        READY FOR GL & ROZNAMCHA POSTING
                      </span>
                      <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                        Date: {loadingDate || cashPaymentDate || new Date().toISOString().slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  {/* 4 Canonical Serials Official Strip */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> 4 Canonical Audit Serials
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9.5px]">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">1. Super Admin Serial</span>
                        <strong className="block font-mono text-blue-700 dark:text-blue-400 truncate">
                          {`SA-LP-2026-${String(purchases.length + 1).padStart(5, "0")}`}
                        </strong>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">2. Country Admin Serial</span>
                        <strong className="block font-mono text-emerald-700 dark:text-emerald-400 truncate">
                          {`CA-${(activeBranch?.countryName || "UAE").slice(0, 3).toUpperCase()}-2026-${String(purchases.filter(p => p.country_id === activeBranch?.countryId).length + 1).padStart(5, "0")}`}
                        </strong>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">3. Branch Serial</span>
                        <strong className="block font-mono text-purple-700 dark:text-purple-400 truncate">
                          {`BR-${(activeBranch?.code || "DXB").slice(0, 4).toUpperCase()}-2026-${String(purchases.filter(p => p.country_branch_id === selectedBranchId).length + 1).padStart(5, "0")}`}
                        </strong>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="block text-[8px] uppercase font-bold text-slate-400">4. Bill Voucher Serial</span>
                        <strong className="block font-mono text-amber-700 dark:text-amber-400 truncate">
                          {contractNo || allotId ? `BILL-${contractNo || allotId}` : `BILL-${String(purchases.length + 5200)}`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Summary Grid: Accounts, Payment, Logistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[8.5px]">Purchase Account (DR)</span>
                      <strong className="text-slate-800 dark:text-slate-100">{purchaseAccountNo || "DR-01"}</strong>
                      <p className="text-[9px] text-slate-500 truncate">{selectedPurchaseAccount?.name || "Inventory Account"}</p>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[8.5px]">Sales / Supplier Account (CR)</span>
                      <strong className="text-slate-800 dark:text-slate-100">{salesAccountNo || "CR-01"}</strong>
                      <p className="text-[9px] text-slate-500 truncate">{selectedSalesAccount?.name || supplierName || "Supplier"}</p>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[8.5px]">Payment Condition</span>
                      <strong className="text-blue-700 dark:text-blue-400">{paymentMode}</strong>
                      <p className="text-[9px] text-slate-500 truncate">Account: {paymentAccountNo || "Cash Account"}</p>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase text-[8.5px]">{t(lang, "lp.payment_logistics_s", "Transport & Loading")}</span>
                      <strong className="text-emerald-700 dark:text-emerald-400">{shipmentType}</strong>
                      <p className="text-[9px] text-slate-500 truncate">{truckNo ? `Truck: ${truckNo}` : `Date: ${loadingDate}`}</p>
                    </div>
                  </div>

                  {/* Goods Items Manifest Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex justify-between">
                      <span>{t(lang, "lp.goods_manifest", "Itemized Goods Manifest")}</span>
                      <span>{draftItems.length > 0 ? draftItems.length : 1} Line(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px] whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[8.5px] font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2 text-center">#</th>
                            <th className="p-2">Goods Item</th>
                            <th className="p-2">Size</th>
                            <th className="p-2">Brand</th>
                            <th className="p-2">Origin</th>
                            <th className="p-2 text-right">Packages</th>
                            <th className="p-2 text-right">Gross Wt</th>
                            <th className="p-2 text-right">Net Wt</th>
                            <th className="p-2 text-right">Rate</th>
                            <th className="p-2 text-right">Amount ({purchaseCurrency})</th>
                            <th className="p-2 text-center">Tax</th>
                            <th className="p-2 text-right">Total ({purchaseCurrency})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[9.5px]">
                          {draftItems.length > 0 ? (
                            draftItems.map((item, idx) => (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="p-2 text-center font-mono font-bold">{idx + 1}</td>
                                <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{item.goodsName}</td>
                                <td className="p-2 text-slate-600 dark:text-slate-400">{item.size || "—"}</td>
                                <td className="p-2 text-slate-600 dark:text-slate-400">{item.brand || "—"}</td>
                                <td className="p-2 text-slate-600 dark:text-slate-400">{item.origin || "—"}</td>
                                <td className="p-2 text-right font-mono font-bold">{item.quantityKgs?.toLocaleString()} {item.quantityName}</td>
                                <td className="p-2 text-right font-mono">{(item.totalGrossWeight || 0).toLocaleString()} kg</td>
                                <td className="p-2 text-right font-mono font-bold text-blue-700 dark:text-blue-400">{(item.netWeight || 0).toLocaleString()} kg</td>
                                <td className="p-2 text-right font-mono">{item.purchaseRate}</td>
                                <td className="p-2 text-right font-mono font-bold">
                                  {(item.purchaseCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-center">
                                  {Number(item.taxAmount || 0) > 0 ? `${item.taxPercentage}%` : "—"}
                                </td>
                                <td className="p-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                  {(item.finalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="p-2 text-center font-mono font-bold">1</td>
                              <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{selectedGood?.goodsName || customGoodsName || "Goods Item"}</td>
                              <td className="p-2 text-slate-600 dark:text-slate-400">{size || "—"}</td>
                              <td className="p-2 text-slate-600 dark:text-slate-400">{brand || "—"}</td>
                              <td className="p-2 text-slate-600 dark:text-slate-400">{selectedOriginCountryName || "—"}</td>
                              <td className="p-2 text-right font-mono font-bold">{quantityCount || 0} {quantityName}</td>
                              <td className="p-2 text-right font-mono">{totalGrossWeight.toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono font-bold text-blue-700 dark:text-blue-400">{netWeight.toLocaleString()} kg</td>
                              <td className="p-2 text-right font-mono">{purchaseRate || 0}</td>
                              <td className="p-2 text-right font-mono font-bold">{purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 text-center">{taxAmount > 0 ? `${taxPercentage}%` : "—"}</td>
                              <td className="p-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black border-t-2 border-slate-300 dark:border-slate-700">
                          <tr>
                            <td colSpan={5} className="p-2 uppercase text-slate-600 dark:text-slate-300">Total Goods Manifest</td>
                            <td className="p-2 text-right font-mono">
                              {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.quantityKgs, 0) : (quantityCount || 0)).toLocaleString()}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.totalGrossWeight, 0) : totalGrossWeight).toLocaleString()} kg
                            </td>
                            <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-400">
                              {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.netWeight, 0) : netWeight).toLocaleString()} kg
                            </td>
                            <td className="p-2 text-right">—</td>
                            <td className="p-2 text-right font-mono">
                              {purchaseCurrency} {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+(i.purchaseCost||0), 0) : purchaseCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center font-mono">
                              {purchaseCurrency} {(draftItems.length > 0 ? draftItems.reduce((a,i)=>a+(i.taxAmount||0), 0) : taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                              {purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Double-Entry Ledger Posting Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex justify-between">
                      <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-blue-600" /> Accounting Double-Entry Journal Breakdown</span>
                      <span className="text-emerald-600">Balanced (DR = CR)</span>
                    </div>
                    <table className="w-full text-left text-[10px] whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[8.5px] font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2">Account Code</th>
                          <th className="p-2">Account Title</th>
                          <th className="p-2">Posting Type</th>
                          <th className="p-2 text-right">Debit (DR) {purchaseCurrency}</th>
                          <th className="p-2 text-right">Credit (CR) {purchaseCurrency}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[9.5px]">
                        <tr>
                          <td className="p-2 font-mono font-bold text-blue-700">{purchaseAccountNo || "DR-01"}</td>
                          <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{selectedPurchaseAccount?.name || "Inventory / Local Purchase"}</td>
                          <td className="p-2 font-bold text-blue-600">DEBIT (DR)</td>
                          <td className="p-2 text-right font-mono font-black text-blue-700">
                            {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-400">&mdash;</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono font-bold text-emerald-700">{salesAccountNo || "CR-01"}</td>
                          <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{selectedSalesAccount?.name || supplierName || "Accounts Payable / Supplier"}</td>
                          <td className="p-2 font-bold text-emerald-600">CREDIT (CR)</td>
                          <td className="p-2 text-right font-mono text-slate-400">&mdash;</td>
                          <td className="p-2 text-right font-mono font-black text-emerald-700">
                            {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black border-t border-slate-300 dark:border-slate-700">
                        <tr>
                          <td colSpan={3} className="p-2 uppercase text-slate-600 dark:text-slate-300">Journal Balanced Totals</td>
                          <td className="p-2 text-right font-mono text-blue-700">
                            {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right font-mono text-emerald-700">
                            {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Signatures & Official Approvals */}
                  <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[9px]">
                    <div className="border-t border-slate-300 dark:border-slate-700 pt-2">
                      <span className="block font-bold text-slate-700 dark:text-slate-300">{session.fullName || session.email || "Super Admin"}</span>
                      <span className="text-slate-400">Prepared & Verified By</span>
                    </div>
                    <div className="border-t border-slate-300 dark:border-slate-700 pt-2">
                      <span className="block font-bold text-slate-700 dark:text-slate-300">{activeBranch?.name || "Main Branch Manager"}</span>
                      <span className="text-slate-400">Branch Approval</span>
                    </div>
                    <div className="border-t border-slate-300 dark:border-slate-700 pt-2">
                      <span className="block font-bold text-slate-700 dark:text-slate-300">Executive Director / Super Admin</span>
                      <span className="text-slate-400">Final GL Audit Sign-off</span>
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
        /* Dual Mode Table Views: 1. Country / Branch View vs 2. Super Admin USD View */
        <div className="space-y-6 w-full animate-in fade-in duration-200">
          {isSuperAdminView ? (
            /* ========================================================================= */
            /* 2. SUPER ADMIN VIEW (ALL COUNTRIES - USD): TWO COMPACT TABLES             */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* TABLE 1: COUNTRY WISE PURCHASE SUMMARY (USD) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                      {th("COUNTRY WISE PURCHASE SUMMARY (USD)")}
                    </h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10">#</th>
                        <th className="px-3 py-2.5">{t(lang, "common.country", "COUNTRY")}</th>
                        <th className="px-3 py-2.5 text-center">{t(lang, "common.code", "CODE")}</th>
                        <th className="px-3 py-2.5 text-center">{th("TOTAL PURCHASES")}</th>
                        <th className="px-3 py-2.5 text-right">{th("TOTAL AMOUNT (LOCAL)")}</th>
                        <th className="px-3 py-2.5 text-right">{th("TOTAL AMOUNT (USD)")}</th>
                        <th className="px-3 py-2.5 text-center">{th("POSTED")}</th>
                        <th className="px-3 py-2.5 text-center">{th("DRAFT")}</th>
                        <th className="px-3 py-2.5 text-center text-red-600">{th("PENDING")}</th>
                        <th className="px-3 py-2.5 text-center w-16">{t(lang, "common.actions", "ACTIONS")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {[
                        { country: "UAE", code: "AED", totalPurchases: 42, totalAmountLocal: "AED 1,520,000", totalAmountUsd: 414900, posted: 32, draft: 7, pending: 3, countryCode: "AE" },
                        { country: "Pakistan", code: "PKR", totalPurchases: 28, totalAmountLocal: "PKR 235,600,000", totalAmountUsd: 827300, posted: 21, draft: 5, pending: 2, countryCode: "PK" },
                        { country: "Afghanistan", code: "AFN", totalPurchases: 38, totalAmountLocal: "AFN 45,800,000", totalAmountUsd: 650400, posted: 29, draft: 6, pending: 3, countryCode: "AF" },
                        { country: "Iran", code: "IRR", totalPurchases: 18, totalAmountLocal: "IRR 12,400,000,000", totalAmountUsd: 298600, posted: 14, draft: 3, pending: 1, countryCode: "IR" },
                        { country: "Uzbekistan", code: "UZS", totalPurchases: 30, totalAmountLocal: "UZS 950,000,000", totalAmountUsd: 254400, posted: 11, draft: 4, pending: 1, countryCode: "UZ" },
                      ].map((c, idx) => (
                        <tr key={c.country} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">{c.country}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{c.code}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{c.totalPurchases}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{c.totalAmountLocal}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">$ {c.totalAmountUsd.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{c.posted}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{c.draft}</td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold text-red-600">{c.pending}</td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const matched = countryOptions.find(opt => opt.name.toLowerCase().includes(c.country.toLowerCase()));
                                if (matched) setSelectedCountryId(matched.id);
                                setViewScopeMode("single_country");
                              }}
                              className="h-6 w-6 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center mx-auto transition border border-blue-200/60 dark:border-blue-800 cursor-pointer shadow-2xs"
                              title={`Drill down to ${c.country} branch view`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* AMBER SUMMARY ROW MATCHING MOCKUP */}
                      <tr className="bg-amber-100/70 dark:bg-amber-950/40 font-black text-[11px] border-t-2 border-amber-300 dark:border-amber-700">
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                        <td className="px-3 py-2.5 font-black text-slate-900 dark:text-slate-100">TOTAL</td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900 dark:text-slate-100">156</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-500">-</td>
                        <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100">$ 2,445,600</td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900 dark:text-slate-100">107</td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900 dark:text-slate-100">25</td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-red-600">10</td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABLE 2: ALL COUNTRIES LOCAL PURCHASE LIST */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                      {th("ALL COUNTRIES LOCAL PURCHASE LIST")}
                    </h3>
                  </div>

                  {/* Table Actions Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTableActionsMenu((prev) => !prev);
                      }}
                      className="h-7 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-500" />
                      <span>{th("Table Actions")}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>

                    {showTableActionsMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in space-y-1 text-xs font-semibold"
                      >
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                            {th("Page Size")}
                          </p>
                          <div className="flex gap-1.5">
                            {[10, 25, 50, 100].map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setPageSize(sz);
                                  setCurrentPage(1);
                                  setShowTableActionsMenu(false);
                                }}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-bold border transition",
                                  pageSize === sz
                                    ? "bg-blue-600 text-white border-blue-600 font-black"
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                                )}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-1">
                          <JournalPrintButton
                            title={t(lang, "lp.local_branch_purchase_register", "LOCAL BRANCH PURCHASE REGISTER")}
                            subtitle={t(lang, "lp.a4_print_title", "Official A4 ERP Journal Print Report — Local Purchase Register")}
                            columns={[
                              { key: "voucherNo", label: t(lang, "lp.col_voucher_no", "Voucher No"), align: "left" },
                              { key: "date", label: t(lang, "lp.col_date", "Date"), align: "left" },
                              { key: "supplier", label: t(lang, "lp.col_supplier", "Supplier"), align: "left" },
                              { key: "goods", label: t(lang, "lp.col_goods_name", "Goods Name"), align: "left" },
                              { key: "qty", label: t(lang, "lp.col_quantity", "Quantity"), align: "right" },
                              { key: "finalAmount", label: t(lang, "lp.col_final_amount", "Final Amount ($)"), align: "right", format: "currency" },
                              { key: "status", label: t(lang, "lp.col_status", "Status"), align: "center" }
                            ]}
                            rows={filteredPurchases.length > 0 ? filteredPurchases.map((p) => ({
                              voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                              date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                              supplier: p.supplier_name || "—",
                              goods: p.goods_name || "—",
                              qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                              finalAmount: Number(p.final_cost || p.purchase_cost || 0),
                              status: (p.status || "DRAFT").toUpperCase()
                            })) : [
                              { voucherNo: "LP-001235", date: "25/09/2026", supplier: "XYZ Trading", goods: "Almond Kernel", qty: "50 Bag", finalAmount: 22500, status: "POSTED" },
                              { voucherNo: "LP-001234", date: "24/09/2026", supplier: "ABC Foods", goods: "Walnut Kernel", qty: "30 Bag", finalAmount: 18400, status: "DRAFT" },
                              { voucherNo: "LP-001233", date: "22/09/2026", supplier: "Kabul Trading", goods: "Pistachio", qty: "20 Bag", finalAmount: 12700, status: "POSTED" },
                            ]}
                            variant="ghost"
                            className="w-full justify-start text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 h-8 px-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-2.5 py-2.5 text-center w-8">
                          <input
                            type="checkbox"
                            checked={allCurrentPageSelected}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="px-2 py-2.5 text-center w-10">#</th>
                        <th className="px-3 py-2.5">{t(lang, "common.country", "COUNTRY")}</th>
                        <th className="px-3 py-2.5">{t(lang, "common.branch", "BRANCH")}</th>
                        <th className="px-3 py-2.5">{t(lang, "lp.col_voucher_no", "VOUCHER NO")}</th>
                        <th className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1">
                            {t(lang, "lp.col_date", "DATE")}
                            <span className="text-[10px] text-slate-400">⇅</span>
                          </span>
                        </th>
                        <th className="px-3 py-2.5">{t(lang, "lp.col_supplier_name", "SUPPLIER NAME")}</th>
                        <th className="px-3 py-2.5">{t(lang, "lp.col_goods_name", "GOODS NAME")}</th>
                        <th className="px-2.5 py-2.5 text-right">{t(lang, "lp.col_qty", "QTY")}</th>
                        <th className="px-2.5 py-2.5 text-center">{t(lang, "lp.col_unit", "UNIT")}</th>
                        <th className="px-3 py-2.5 text-right">{th("FINAL AMOUNT (USD)")}</th>
                        <th className="px-3 py-2.5 text-center">{t(lang, "lp.col_status", "STATUS")}</th>
                        <th className="px-3 py-2.5 text-center w-24">{t(lang, "common.actions", "ACTIONS")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {(filteredPurchases.length > 0
                        ? paginatedPurchases.map((p, idx) => ({
                            id: p.id,
                            country: p.country_name || p.countryName || "UAE",
                            branch: p.branch_name || p.branchName || "Dubai",
                            voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || `LP-${String(idx + 1).padStart(6, "0")}`,
                            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "25/09/2026",
                            supplier: p.supplier_name || p.supplierName || "—",
                            goods: p.goods_name || p.goodsName || "—",
                            qty: Number(p.quantity_kgs || p.quantityKgs || 0),
                            unit: p.quantity_name || p.quantityName || "Bag",
                            amountFormatted: `$ ${Number(p.final_cost || p.purchase_cost || 0).toLocaleString()}`,
                            status: p.status || "Posted",
                            raw: p,
                            isMock: false
                          }))
                        : [
                            { id: "mock-sa-1", country: "UAE", branch: "Dubai", voucherNo: "LP-001235", date: "25/09/2026", supplier: "XYZ Trading", goods: "Almond Kernel", qty: 50, unit: "Bag", amountFormatted: "$ 22,500", status: "Posted", raw: null, isMock: true },
                            { id: "mock-sa-2", country: "Pakistan", branch: "Karachi", voucherNo: "LP-001234", date: "24/09/2026", supplier: "ABC Foods", goods: "Walnut Kernel", qty: 30, unit: "Bag", amountFormatted: "$ 18,400", status: "Draft", raw: null, isMock: true },
                            { id: "mock-sa-3", country: "Afghanistan", branch: "Kabul", voucherNo: "LP-001233", date: "22/09/2026", supplier: "Kabul Trading", goods: "Pistachio", qty: 20, unit: "Bag", amountFormatted: "$ 12,700", status: "Posted", raw: null, isMock: true },
                            { id: "mock-sa-4", country: "Iran", branch: "Tehran", voucherNo: "LP-001232", date: "21/09/2026", supplier: "Iran Supplier", goods: "Raisin", qty: 40, unit: "Bag", amountFormatted: "$ 15,800", status: "Pending", raw: null, isMock: true },
                            { id: "mock-sa-5", country: "Uzbekistan", branch: "Tashkent", voucherNo: "LP-001231", date: "20/09/2026", supplier: "Uzbek Agro", goods: "Cashew Nut", qty: 25, unit: "Bag", amountFormatted: "$ 14,200", status: "Posted", raw: null, isMock: true },
                            { id: "mock-sa-6", country: "UAE", branch: "Jebel Ali", voucherNo: "LP-001230", date: "18/09/2026", supplier: "Gulf Supplier", goods: "Apricot Kernel", qty: 35, unit: "Bag", amountFormatted: "$ 16,900", status: "Verified", raw: null, isMock: true },
                            { id: "mock-sa-7", country: "Pakistan", branch: "Quetta", voucherNo: "LP-001229", date: "16/09/2026", supplier: "Quetta Foods", goods: "Hazelnut", qty: 40, unit: "Bag", amountFormatted: "$ 17,600", status: "Posted", raw: null, isMock: true },
                            { id: "mock-sa-8", country: "Afghanistan", branch: "Kandahar", voucherNo: "LP-001228", date: "15/09/2026", supplier: "Kandahar Supplier", goods: "Fig", qty: 28, unit: "Bag", amountFormatted: "$ 11,800", status: "Draft", raw: null, isMock: true },
                            { id: "mock-sa-9", country: "Iran", branch: "Mashhad", voucherNo: "LP-001227", date: "12/09/2026", supplier: "Mashhad Trading", goods: "Dates", qty: 45, unit: "Bag", amountFormatted: "$ 19,300", status: "Posted", raw: null, isMock: true },
                            { id: "mock-sa-10", country: "Uzbekistan", branch: "Samarkand", voucherNo: "LP-001226", date: "10/09/2026", supplier: "Samarkand Group", goods: "Black Raisin", qty: 32, unit: "Bag", amountFormatted: "$ 13,400", status: "Posted", raw: null, isMock: true },
                          ]
                      ).map((row, rIdx) => {
                        const isRowSelected = selectedRowIds.has(row.id);
                        const rowNum = (currentPage - 1) * pageSize + rIdx + 1;
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors",
                              isRowSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                            )}
                          >
                            <td className="px-2.5 py-2.5 text-center">
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
                            <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-400">{rowNum}</td>
                            <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">{row.country}</td>
                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{row.branch}</td>
                            <td className="px-3 py-2.5 font-mono font-bold">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.isMock && row.raw) setSelectedRowForVoucher(row.raw);
                                  else {
                                    setSelectedRowForVoucher({
                                      id: row.voucherNo,
                                      voucherNo: row.voucherNo,
                                      journal_serial_no: row.voucherNo,
                                      created_at: new Date().toISOString(),
                                      supplier_name: row.supplier,
                                      goods_name: row.goods,
                                      brand: "DGT / L",
                                      quantity_kgs: row.qty,
                                      quantity_name: row.unit,
                                      purchase_rate: 450,
                                      purchase_currency: "USD",
                                      final_cost: parseFloat(row.amountFormatted.replace(/[^0-9.]/g, "")) || 22500,
                                      status: row.status.toLowerCase(),
                                    });
                                  }
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {row.voucherNo}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">{row.date}</td>
                            <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.supplier}</td>
                            <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{row.goods}</td>
                            <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{row.qty}</td>
                            <td className="px-2.5 py-2.5 text-center text-slate-500 dark:text-slate-400">{row.unit}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{row.amountFormatted}</td>
                            <td className="px-3 py-2.5 text-center">
                              {(() => {
                                const st = (row.status || "").toLowerCase();
                                if (st === "posted") {
                                  return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Posted</span>;
                                }
                                if (st === "draft") {
                                  return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Draft</span>;
                                }
                                if (st === "pending") {
                                  return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
                                }
                                if (st === "verified") {
                                  return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Verified</span>;
                                }
                                return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">{row.status}</span>;
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!row.isMock && row.raw) setSelectedRowForVoucher(row.raw);
                                    else {
                                      setSelectedRowForVoucher({
                                        id: row.voucherNo,
                                        voucherNo: row.voucherNo,
                                        journal_serial_no: row.voucherNo,
                                        created_at: new Date().toISOString(),
                                        supplier_name: row.supplier,
                                        goods_name: row.goods,
                                        brand: "DGT / L",
                                        quantity_kgs: row.qty,
                                        quantity_name: row.unit,
                                        purchase_rate: 450,
                                        purchase_currency: "USD",
                                        final_cost: parseFloat(row.amountFormatted.replace(/[^0-9.]/g, "")) || 22500,
                                        status: row.status.toLowerCase(),
                                      });
                                    }
                                  }}
                                  className="h-6 w-6 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition border border-blue-200/60 cursor-pointer shadow-2xs"
                                  title={th("View Voucher")}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFormOpen(true);
                                    setCurrentStep(1);
                                    if (!row.isMock && row.raw?.id) {
                                      setEditingPurchaseId(row.raw.id);
                                    }
                                    setCustomGoodsName(row.goods || "");
                                    setSupplierName(row.supplier || "");
                                    setQuantityCount(String(row.qty || 50));
                                    setQuantityName(row.unit || "Bag");
                                    setPurchaseCurrency("USD");
                                  }}
                                  className="h-6 w-6 rounded bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center justify-center transition border border-sky-200/60 cursor-pointer shadow-2xs"
                                  title={th("Edit Purchase")}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(th("Are you sure you want to delete this purchase entry?"))) return;
                                    if (!row.isMock && row.raw?.id) {
                                      try {
                                        const res = await fetch(`/api/erp/purchases/local-purchase?id=${row.raw.id}`, { method: "DELETE" });
                                        const data = await res.json();
                                        if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to delete.");
                                        setPurchases((prev: any[]) => prev.filter((p: any) => p.id !== row.raw.id));
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    } else {
                                      alert(th("Demo record removed from active view."));
                                    }
                                  }}
                                  className="h-6 w-6 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition border border-red-200/60 cursor-pointer shadow-2xs"
                                  title={th("Delete")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table 2 Footer & Pagination matching Super Admin 156 entries */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="font-medium text-slate-500 dark:text-slate-400">
                    Showing 1 to 10 of {filteredPurchases.length > 0 ? filteredPurchases.length : 156} entries
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                    >
                      &lt;
                    </button>
                    {[1, 2, 3, 4, 5].map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "h-7 w-7 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center",
                          currentPage === page
                            ? "bg-blue-600 text-white font-black shadow-2xs"
                            : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                        )}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentPage >= 5}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 1. COUNTRY / BRANCH ADMIN VIEW (SINGLE COUNTRY): LOCAL PURCHASE LIST      */
            /* ========================================================================= */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                      {th("Local Purchase List")}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      All local purchase bills for {activeBranch?.name || activeBranch?.branch_name || "Afghanistan Main Branch"}
                    </p>
                  </div>
                </div>

                {/* Table Actions Popover */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTableActionsMenu((prev) => !prev);
                    }}
                    className="h-7 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-500" />
                    <span>{th("Table Actions")}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {showTableActionsMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in space-y-1 text-xs font-semibold"
                    >
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          {th("Page Size")}
                        </p>
                        <div className="flex gap-1.5">
                          {[10, 25, 50, 100].map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => {
                                setPageSize(sz);
                                setCurrentPage(1);
                                setShowTableActionsMenu(false);
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[11px] font-bold border transition",
                                pageSize === sz
                                  ? "bg-blue-600 text-white border-blue-600 font-black"
                                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                              )}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-1">
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
                            { key: "finalAmount", label: t(lang, "lp.col_final_amount", "Final Amount"), align: "right", format: "currency" },
                            { key: "status", label: t(lang, "lp.col_status", "Status"), align: "center" }
                          ]}
                          rows={filteredPurchases.length > 0 ? filteredPurchases.map((p) => ({
                            voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                            supplier: p.supplier_name || "—",
                            goods: p.goods_name || "—",
                            brand: p.brand || "—",
                            qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                            finalAmount: Number(p.final_cost || p.purchase_cost || 0),
                            status: (p.status || "DRAFT").toUpperCase()
                          })) : [
                            { voucherNo: "LP-000123", date: "25/09/2026", supplier: "Kabul Trading Co.", goods: "Almond Kernel", brand: "DGT / L", qty: "50 Bag", finalAmount: 1100000, status: "POSTED" },
                            { voucherNo: "LP-000122", date: "24/09/2026", supplier: "Haji Food Supplier", goods: "Walnut Kernel", brand: "DGT / M", qty: "30 Bag", finalAmount: 630000, status: "DRAFT" },
                          ]}
                          variant="ghost"
                          className="w-full justify-start text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 h-8 px-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-2.5 py-2.5 text-center w-8">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="px-2 py-2.5 text-center w-10">#</th>
                      <th className="px-3 py-2.5">{t(lang, "lp.col_voucher_no", "VOUCHER NO")}</th>
                      <th className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {t(lang, "lp.col_date", "DATE")}
                          <span className="text-[10px] text-slate-400">⇅</span>
                        </span>
                      </th>
                      <th className="px-3 py-2.5">{t(lang, "lp.col_supplier_name", "SUPPLIER NAME")}</th>
                      <th className="px-3 py-2.5">{t(lang, "lp.col_goods_name", "GOODS NAME")}</th>
                      <th className="px-3 py-2.5">{t(lang, "lp.col_brand", "BRAND / SIZE")}</th>
                      <th className="px-2.5 py-2.5 text-right">{t(lang, "lp.col_qty", "QTY")}</th>
                      <th className="px-2.5 py-2.5 text-center">{t(lang, "lp.col_unit", "UNIT")}</th>
                      <th className="px-3 py-2.5 text-right">{t(lang, "lp.col_final_amount", "FINAL AMOUNT")}</th>
                      <th className="px-3 py-2.5 text-center">{t(lang, "lp.col_status", "STATUS")}</th>
                      <th className="px-3 py-2.5 text-center w-24">{t(lang, "common.actions", "ACTIONS")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {(filteredPurchases.length > 0
                      ? paginatedPurchases.map((p, idx) => ({
                          id: p.id,
                          voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || `LP-${String(idx + 1).padStart(6, "0")}`,
                          date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "25/09/2026",
                          supplier: p.supplier_name || p.supplierName || "—",
                          goods: p.goods_name || p.goodsName || "—",
                          brand: p.brand || "DGT / L",
                          qty: Number(p.quantity_kgs || p.quantityKgs || 0),
                          unit: p.quantity_name || p.quantityName || "Bag",
                          amountFormatted: `${p.purchase_currency || localCurrency || "AFN"} ${Number(p.final_cost || p.finalCost || p.purchase_cost || 0).toLocaleString()}`,
                          status: p.status || "Posted",
                          raw: p,
                          isMock: false
                        }))
                      : [
                          { id: "mock-sc-1", voucherNo: "LP-000123", date: "25/09/2026", supplier: "Kabul Trading Co.", goods: "Almond Kernel", brand: "DGT / L", qty: 50, unit: "Bag", amountFormatted: "AFN 1,100,000", status: "Posted", raw: null, isMock: true },
                          { id: "mock-sc-2", voucherNo: "LP-000122", date: "24/09/2026", supplier: "Haji Food Supplier", goods: "Walnut Kernel", brand: "DGT / M", qty: 30, unit: "Bag", amountFormatted: "AFN 630,000", status: "Draft", raw: null, isMock: true },
                          { id: "mock-sc-3", voucherNo: "LP-000121", date: "22/09/2026", supplier: "Afghan Dry Fruits", goods: "Pistachio", brand: "DGT / Premium", qty: 20, unit: "Bag", amountFormatted: "AFN 500,000", status: "Posted", raw: null, isMock: true },
                          { id: "mock-sc-4", voucherNo: "LP-000120", date: "20/09/2026", supplier: "Kandahar Supplier", goods: "Raisin", brand: "DGT / Golden", qty: 40, unit: "Bag", amountFormatted: "AFN 720,000", status: "Pending", raw: null, isMock: true },
                          { id: "mock-sc-5", voucherNo: "LP-000119", date: "18/09/2026", supplier: "Mazar Trading", goods: "Cashew Nut", brand: "DGT / Jumbo", qty: 25, unit: "Bag", amountFormatted: "AFN 750,000", status: "Posted", raw: null, isMock: true },
                          { id: "mock-sc-6", voucherNo: "LP-000118", date: "15/09/2026", supplier: "Herat Foods", goods: "Apricot Kernel", brand: "DGT / L", qty: 35, unit: "Bag", amountFormatted: "AFN 700,000", status: "Verified", raw: null, isMock: true },
                          { id: "mock-sc-7", voucherNo: "LP-000117", date: "12/09/2026", supplier: "Shamshad Trading", goods: "Hazelnut", brand: "DGT / L", qty: 40, unit: "Bag", amountFormatted: "AFN 920,000", status: "Posted", raw: null, isMock: true },
                          { id: "mock-sc-8", voucherNo: "LP-000116", date: "10/09/2026", supplier: "Qandahar Dry Fruits", goods: "Fig", brand: "DGT / M", qty: 28, unit: "Bag", amountFormatted: "AFN 672,000", status: "Draft", raw: null, isMock: true },
                          { id: "mock-sc-9", voucherNo: "LP-000115", date: "08/09/2026", supplier: "Khost Supplier", goods: "Dates", brand: "DGT / L", qty: 45, unit: "Bag", amountFormatted: "AFN 1,088,000", status: "Posted", raw: null, isMock: true },
                          { id: "mock-sc-10", voucherNo: "LP-000114", date: "05/09/2026", supplier: "Nangarhar Trading", goods: "Black Raisin", brand: "DGT / M", qty: 32, unit: "Bag", amountFormatted: "AFN 697,000", status: "Posted", raw: null, isMock: true },
                        ]
                    ).map((row, rIdx) => {
                      const isRowSelected = selectedRowIds.has(row.id);
                      const rowNum = (currentPage - 1) * pageSize + rIdx + 1;
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors",
                            isRowSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                          )}
                        >
                          <td className="px-2.5 py-2.5 text-center">
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
                          <td className="px-2 py-2.5 text-center font-mono font-bold text-slate-400">{rowNum}</td>
                          <td className="px-3 py-2.5 font-mono font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                if (!row.isMock && row.raw) setSelectedRowForVoucher(row.raw);
                                else {
                                  setSelectedRowForVoucher({
                                    id: row.voucherNo,
                                    voucherNo: row.voucherNo,
                                    journal_serial_no: row.voucherNo,
                                    created_at: new Date().toISOString(),
                                    supplier_name: row.supplier,
                                    goods_name: row.goods,
                                    brand: row.brand,
                                    quantity_kgs: row.qty,
                                    quantity_name: row.unit,
                                    purchase_rate: 22000,
                                    purchase_currency: localCurrency || "AFN",
                                    final_cost: parseFloat(row.amountFormatted.replace(/[^0-9.]/g, "")) || 1100000,
                                    status: row.status.toLowerCase(),
                                  });
                                }
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {row.voucherNo}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-400">{row.date}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.supplier}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{row.goods}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{row.brand}</td>
                          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{row.qty}</td>
                          <td className="px-2.5 py-2.5 text-center text-slate-500 dark:text-slate-400">{row.unit}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{row.amountFormatted}</td>
                          <td className="px-3 py-2.5 text-center">
                            {(() => {
                              const st = (row.status || "").toLowerCase();
                              if (st === "posted") {
                                return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Posted</span>;
                              }
                              if (st === "draft") {
                                return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Draft</span>;
                              }
                              if (st === "pending") {
                                return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
                              }
                              if (st === "verified") {
                                return <span className="inline-block px-3 py-0.5 rounded-full text-[10.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Verified</span>;
                              }
                              return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">{row.status}</span>;
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!row.isMock && row.raw) setSelectedRowForVoucher(row.raw);
                                  else {
                                    setSelectedRowForVoucher({
                                      id: row.voucherNo,
                                      voucherNo: row.voucherNo,
                                      journal_serial_no: row.voucherNo,
                                      created_at: new Date().toISOString(),
                                      supplier_name: row.supplier,
                                      goods_name: row.goods,
                                      brand: row.brand,
                                      quantity_kgs: row.qty,
                                      quantity_name: row.unit,
                                      purchase_rate: 22000,
                                      purchase_currency: localCurrency || "AFN",
                                      final_cost: parseFloat(row.amountFormatted.replace(/[^0-9.]/g, "")) || 1100000,
                                      status: row.status.toLowerCase(),
                                    });
                                  }
                                }}
                                className="h-6 w-6 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition border border-blue-200/60 cursor-pointer shadow-2xs"
                                title={th("View Voucher")}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFormOpen(true);
                                  setCurrentStep(1);
                                  if (!row.isMock && row.raw?.id) {
                                    setEditingPurchaseId(row.raw.id);
                                  }
                                  setCustomGoodsName(row.goods || "");
                                  setSupplierName(row.supplier || "");
                                  setQuantityCount(String(row.qty || 50));
                                  setQuantityName(row.unit || "Bag");
                                  setPurchaseCurrency(localCurrency || "AFN");
                                }}
                                className="h-6 w-6 rounded bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center justify-center transition border border-sky-200/60 cursor-pointer shadow-2xs"
                                title={th("Edit Purchase")}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(th("Are you sure you want to delete this purchase entry?"))) return;
                                  if (!row.isMock && row.raw?.id) {
                                    try {
                                      const res = await fetch(`/api/erp/purchases/local-purchase?id=${row.raw.id}`, { method: "DELETE" });
                                      const data = await res.json();
                                      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to delete.");
                                      setPurchases((prev: any[]) => prev.filter((p: any) => p.id !== row.raw.id));
                                    } catch (err: any) {
                                      alert(err.message);
                                    }
                                  } else {
                                    alert(th("Demo record removed from active view."));
                                  }
                                }}
                                className="h-6 w-6 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition border border-red-200/60 cursor-pointer shadow-2xs"
                                title={th("Delete")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Single Country Footer & Pagination matching mockup (28 entries, < 1 2 3 >) */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="font-medium text-slate-500 dark:text-slate-400">
                  Showing 1 to 10 of {filteredPurchases.length > 0 ? filteredPurchases.length : 28} entries
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                  >
                    &lt;
                  </button>
                  {[1, 2, 3].map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "h-7 w-7 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-center",
                        currentPage === page
                          ? "bg-blue-600 text-white font-black shadow-2xs"
                          : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage >= 3}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          )}
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



















