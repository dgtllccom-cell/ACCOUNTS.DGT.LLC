"use client";

import { useIntakeDraft } from "@/lib/document-intelligence/use-intake-draft";
import { IntakeDraftPicker } from "@/features/document-intelligence/components/intake-draft-picker";
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
  CreditCard, Truck, Flag, UserCheck, ChevronDown, ChevronUp, ChevronRight,
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
  if (s.includes("UNITED STATES") || s === "USA" || s === "US") return "🇺🇸";
  if (s.includes("CHINA") || s === "CN") return "🇨🇳";
  if (s.includes("INDIA") || s === "IN") return "🇮🇳";
  if (s.includes("IRAN") || s === "IR") return "🇮🇷";
  if (s.includes("UZBEKISTAN") || s === "UZ") return "🇺🇿";
  if (s.includes("OMAN") || s === "OM") return "🇴🇲";
  return "🌐";
}

function convertToUsd(amount: number, currency: string, exchangeRate?: number): number {
  if (!amount || isNaN(amount)) return 0;
  const curr = String(currency || "").toUpperCase().trim();
  if (curr === "USD" || curr === "$") return amount;
  if (exchangeRate && exchangeRate > 0) {
    return exchangeRate > 1 ? Math.round(amount / exchangeRate) : Math.round(amount * exchangeRate);
  }
  if (curr === "AED") return Math.round(amount / 3.6725);
  if (curr === "PKR") return Math.round(amount / 278);
  if (curr === "AFN") return Math.round(amount / 70);
  if (curr === "IRR") return Math.round(amount / 42000);
  if (curr === "UZS") return Math.round(amount / 12600);
  if (curr === "OMR") return Math.round(amount * 2.6);
  if (curr === "CNY") return Math.round(amount / 7.2);
  if (curr === "INR") return Math.round(amount / 84);
  return Math.round(amount);
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
  const tr = (x: string) => translateHeader(lang, x);
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
  const [showFullCountryMatrix, setShowFullCountryMatrix] = useState(false);
  const [showTableActionsMenu, setShowTableActionsMenu] = useState(false);
  const [expandedCountryKey, setExpandedCountryKey] = useState<string | null>(null);
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);
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
  // Step 3 "+ Add Charge" rows. Informational only: never posted to the ledger and never
  // allocated into landed cost unless the user explicitly ticks "Allocate to landed cost".
  const [extraCharges, setExtraCharges] = useState<{ id: string; label: string; amount: string; allocate: boolean }[]>([]);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  // Synchronous double-submit lock (React state updates are async, so a fast double click
  // could otherwise fire two POSTs before `saving` re-renders the button disabled).
  const submitLockRef = useRef(false);
  const globalScopeInitRef = useRef(false);
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
      setOpenActionRowId(null);
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
      setOpenActionRowId(null);
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
  const isSuperAdminView = viewScopeMode === "super_admin" || (viewScopeMode === "auto" && isSuperAdmin);
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

  // AI Document Intake: a reviewed Local Purchase Bill draft pre-fills (never saves) the form.
  const intake = useIntakeDraft("local_purchases");
  const intakeApplied = useRef(false);
  useEffect(() => {
    if (intakeApplied.current || !intake.draft) return;
    intakeApplied.current = true;
    const p = intake.payload || {};
    if (p.supplierName) setSupplierName(String(p.supplierName));
    if (p.manualBillNo) setContractNo(String(p.manualBillNo));
    if (p.currency && /^[A-Za-z]{3}$/.test(String(p.currency))) setPurchaseCurrency(String(p.currency).toUpperCase());
    if (p.exchangeRate && Number(p.exchangeRate) > 0) setExchangeRateToAed(String(p.exchangeRate));
    const first = (intake.goodsEntries ?? [])[0] as any;
    if (first?.unitPrice && Number(first.unitPrice) > 0) setPurchaseRate(String(first.unitPrice));
    // The supplier account the reviewer picked in Document Intake (its code is what this form resolves),
    // the lot, and the original contract no. — then land on the form, not the register behind it.
    if (p.purchaseAccountNo) setPurchaseAccountNo(String(p.purchaseAccountNo));
    if (p.contractNo && !p.manualBillNo) setContractNo(String(p.contractNo));
    if (p.lotNo) setLotNo(String(p.lotNo));
    setIsFormOpen(true);
  }, [intake.draft, intake.payload, intake.goodsEntries]);
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

  // Closing the form discards the unsaved goods list and charges, so a new bill never
  // starts with the previous bill's lines.
  useEffect(() => {
    if (!isFormOpen) {
      setDraftItems([]);
      setExtraCharges([]);
    }
  }, [isFormOpen]);

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

  // Canonical helper to normalize country keys (prevents duplicate UAE vs United Arab Emirates)
  const normalizeCountryKey = (nameOrCode?: string | null): string => {
    const s = String(nameOrCode || "").toUpperCase().trim();
    if (s.includes("EMIRATES") || s.includes("UAE") || s === "AE" || s.includes("DUBAI")) return "uae";
    if (s.includes("PAKISTAN") || s === "PK" || s.includes("PAK")) return "pakistan";
    if (s.includes("AFGHANISTAN") || s === "AF" || s.includes("AFG")) return "afghanistan";
    if (s.includes("IRAN") || s === "IR") return "iran";
    if (s.includes("UZBEKISTAN") || s === "UZ") return "uzbekistan";
    if (s.includes("INDIA") || s === "IN") return "india";
    if (s.includes("OMAN") || s === "OM") return "oman";
    if (s.includes("CHINA") || s === "CN") return "china";
    if (s.includes("UNITED STATES") || s === "USA" || s === "US") return "usa";
    return s.toLowerCase();
  };

  // Derived Country options from canonical countries table (never branch names)
  // ONLY includes countries that are actually configured with country branches, city branches, or purchases
  const countryOptions = useMemo(() => {
    const options: Array<{ id: string; name: string; code: string; currency: string }> = [];
    const seenKeys = new Set<string>();

    // Sets of configured country identifiers (have branches or recorded transactions)
    const configuredCountryIds = new Set<string>();
    const configuredCountryNames = new Set<string>();

    countryBranches.forEach((b: any) => {
      const cId = b.countryId || b.country_id;
      if (cId) configuredCountryIds.add(String(cId));
      const cName = b.countryName || b.country_name;
      if (cName) configuredCountryNames.add(normalizeCountryKey(cName));
      if (b.name) configuredCountryNames.add(normalizeCountryKey(b.name));
    });

    cityBranches.forEach((cb: any) => {
      const cId = cb.countryId || cb.country_id;
      if (cId) configuredCountryIds.add(String(cId));
      const cName = cb.countryName || cb.country_name;
      if (cName) configuredCountryNames.add(normalizeCountryKey(cName));
    });

    purchases.forEach((p: any) => {
      const cId = p.country_id || p.countryId;
      if (cId) configuredCountryIds.add(String(cId));
      const cName = p.country_name || p.countryName;
      if (cName) configuredCountryNames.add(normalizeCountryKey(cName));
    });

    const isCountryConfigured = (id?: string | null, name?: string | null) => {
      if (id && configuredCountryIds.has(String(id))) return true;
      if (name && configuredCountryNames.has(normalizeCountryKey(name))) return true;
      return false;
    };

    if (countries && countries.length > 0) {
      countries.forEach((c: any) => {
        const key = normalizeCountryKey(c.name || c.iso2 || c.code);
        // Only include if configured with branches or transactions
        if (isCountryConfigured(c.id, c.name) && !seenKeys.has(key)) {
          seenKeys.add(key);
          options.push({
            id: String(c.id),
            name: c.name || key.toUpperCase(),
            code: c.currency_code || c.currency || c.iso2 || c.code || "USD",
            currency: c.currency_code || c.currency || "USD",
          });
        }
      });
    }

    // Also ensure any country represented in countryBranches is present even if omitted in countries table
    countryBranches.forEach((b: any) => {
      const bCountryId = String(b.countryId || b.country_id || "");
      const bCountryName = b.countryName || b.country_name || (b.name ? b.name.replace(/ Main Branch/i, "").trim() : "");
      const key = normalizeCountryKey(bCountryName || bCountryId);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        options.push({
          id: bCountryId || key,
          name: bCountryName || key.toUpperCase(),
          code: b.currency || b.local_currency || "USD",
          currency: b.currency || b.local_currency || "USD",
        });
      }
    });

    // Fallback: If completely empty (e.g. brand new workspace with 0 branches)
    if (options.length === 0 && countries && countries.length > 0) {
      const first = countries[0];
      options.push({
        id: String(first.id),
        name: first.name || "Default Country",
        code: first.currency_code || first.currency || "USD",
        currency: first.currency_code || first.currency || "USD",
      });
    }

    return options;
  }, [countries, countryBranches, cityBranches, purchases]);

  const activeCountryObj = useMemo(() => {
    if (!selectedCountryId) return null;
    return countryOptions.find(c => String(c.id) === String(selectedCountryId)) || null;
  }, [selectedCountryId, countryOptions]);

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

  // Country / city shown on the bill come from the confirmed scope, never from a fixed fallback
  // (a bill booked in Afghanistan must not print "UAE, Dubai").
  const scopeLabels = useMemo(() => {
    const cid = String(selectedCountryId || activeBranch?.countryId || activeBranch?.country_id || "");
    const country = countryOptions.find((c: any) => String(c.id) === cid);
    const city = cityBranches.find((c: any) => String(c.id) === String(selectedCityBranchId));
    return {
      country: String(activeBranch?.countryName || activeBranch?.country_name || country?.name || ""),
      city: String(city?.city_name || city?.cityName || city?.city || city?.name || activeBranch?.cityName || ""),
    };
  }, [selectedCountryId, selectedCityBranchId, activeBranch, countryOptions, cityBranches]);

  // Auto-lock purchase currency to branch / country currency
  useEffect(() => {
    const cName = String(activeBranch?.countryName || activeBranch?.country_name || scopeLabels.country || "").toUpperCase();
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
  }, [activeBranch, selectedCountryId, scopeLabels.country]);

  const activeCityBranches = useMemo(() => {
    if (!selectedBranchId) return [];
    return cityBranches.filter(c => (c.countryBranchId === selectedBranchId || c.country_branch_id === selectedBranchId) && (c.isBusinessBranch ?? c.is_business_branch ?? true) !== false);
  }, [cityBranches, selectedBranchId]);

  // Scope modal-local filtered lists (independent of global selectedCountryId / selectedBranchId)
  const scopeFilteredBranches = useMemo(() => {
    if (!scopeCountryId) return countryBranches;
    const res = countryBranches.filter(b => String(b.countryId || b.country_id) === String(scopeCountryId));
    return res.length > 0 ? res : countryBranches;
  }, [countryBranches, scopeCountryId]);

  const scopeCityBranches = useMemo(() => {
    if (!scopeBranchId) return [];
    // Local Purchase is a business transaction: shipping/clearing/agent branches are never offered.
    return cityBranches.filter(c => String(c.countryBranchId || c.country_branch_id) === String(scopeBranchId) && (c.isBusinessBranch ?? c.is_business_branch ?? true) !== false);
  }, [cityBranches, scopeBranchId]);

  // Default selection based on user scope
  useEffect(() => {
    // Super Admins start on the unfiltered registry so global reports and KPI
    // cards include every authorized country/branch. They can still choose a
    // specific hierarchy node from the shared dropdown when needed.
    if (isGlobalUser) {
      // Only on first load: a later re-run (session / branch list identity change) must not wipe
      // the scope the user just confirmed in the scope dialog, or the bill loses its branch.
      if (!globalScopeInitRef.current) {
        globalScopeInitRef.current = true;
        setSelectedCountryId("");
        setSelectedBranchId("");
        setSelectedCityBranchId("");
      }
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
    const cName = (activeBranch?.countryName || activeBranch?.country_name || scopeLabels.country || "").toUpperCase();
    if (cName.includes("UNITED ARAB") || cName === "UAE") return "AED";
    if (cName.includes("AFGHANISTAN") || cName === "AF") return "AFN";
    if (cName.includes("INDIA") || cName === "IN") return "INR";
    if (cName.includes("IRAN") || cName === "IR") return "IRR";
    if (cName.includes("PAKISTAN") || cName === "PK") return "PKR";
    return activeBranch?.localCurrency || activeBranch?.local_currency || activeBranch?.currency || "PKR";
  }, [activeBranch, scopeLabels.country]);

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
      // For Super Admin in global overview mode, do not restrict the query so summary cards retain all countries
      if (!isGlobalUser || viewScopeMode === "single_country") {
        if (selectedCountryId) params.append("countryId", selectedCountryId);
        if (selectedBranchId) params.append("countryBranchId", selectedBranchId);
        if (selectedCityBranchId) params.append("cityBranchId", selectedCityBranchId);
      }
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
  }, [viewScopeMode, isGlobalUser ? "" : selectedCountryId, selectedBranchId, selectedCityBranchId]);

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
    // The committed goods lines are the single source of truth for every total, table,
    // report and voucher. The live (not yet added) form never leaks into a total.
    return draftItems.reduce((acc, item) => acc + (item.finalCost || 0), 0);
  }, [draftItems]);

  // "+ Add Charge" rows are informational: they are shown on the report and voucher, never
  // posted to the ledger on their own. A charge ticked "allocate" is only DISPLAYED as part
  // of the landed cost (pro-rata by net weight); it never changes the posted bill amount.
  const chargesTotal = extraCharges.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const allocatedChargesTotal = extraCharges.filter(c => c.allocate).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const grandTotalWithCharges = combinedBillCost + chargesTotal;
  const landedLines = useMemo(() => {
    const totalNet = draftItems.reduce((a, i) => a + Number(i.netWeight || 0), 0);
    return draftItems.map(i => {
      const share = totalNet > 0 ? Number(i.netWeight || 0) / totalNet : (draftItems.length ? 1 / draftItems.length : 0);
      const base = Number(i.finalCost || 0);
      const alloc = allocatedChargesTotal * share;
      return { item: i, base, alloc, landed: base + alloc };
    });
  }, [draftItems, allocatedChargesTotal]);
  const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // The "custom product" sentinel is always the lowercase "custom". The goods selector,
  // the validators and the line builder all go through this one helper so a stale
  // "CUSTOM" can never leak into a goods id or name.
  const isCustomGoods = (id: string) => String(id || "").toLowerCase() === "custom";

  // Clears every per-item input so nothing from the previous goods leaks into the next line.
  function resetItemFields() {
    setHsCode("");
    setChassisCode("");
    setLotNo("");
    setBrand("");
    setCustomBrand("");
    setSize("");
    setCustomSize("");
    setVariety("");
    setQualityDetails("");
    setQuantityCount("");
    setWeightPerPkg("");
    setManualGrossWeight("");
    setEmptyKgs("");
    setPurchaseRate("");
    setQualityReportRef("Passed");
    setApplyTax("No");
    setTaxPercentage("0");
  }

  // Loads a saved purchase row (snake_case from the API or camelCase) into the form. The goods
  // lines come from the saved line_items; an older single-row bill gets one synthesized line
  // from its header columns, so a reopened bill always shows the same goods it was saved with.
  function loadRowIntoForm(row: any) {
    if (!row) return;
    const g = (a: string, b: string, d: any = "") => row[a] ?? row[b] ?? d;
    setEditingPurchaseId(row.id || null);
    let lines: any[] = Array.isArray(row.line_items) ? row.line_items : Array.isArray(row.lineItems) ? row.lineItems : [];
    if (lines.length === 0 && (g("goods_name", "goodsName") || Number(g("quantity_kgs", "quantityKgs", 0)) > 0)) {
      const qty = Number(g("numbers", "numbers", 0)) || Number(g("quantity_kgs", "quantityKgs", 0));
      lines = [{
        id: `draft-legacy-${row.id}`,
        goodsId: g("goods_id", "goodsId", null),
        goodsName: g("goods_name", "goodsName"),
        hsCode: g("hs_code", "hsCode"),
        brand: g("brand", "brand", "-") || "-",
        size: g("size", "size", "-") || "-",
        lotNo: g("lot_no", "lotNo"),
        chassisCode: g("chassis_code", "chassisCode"),
        variety: g("variety", "variety", "-") || "-",
        qualityDetails: g("quality_details", "qualityDetails", "-") || "-",
        quantityName: g("quantity_name", "quantityName", "Bags"),
        quantityCount: qty,
        quantityKgs: qty,
        numbers: qty,
        oneQtyKg: Number(g("one_qty_kg", "oneQtyKg", 0)),
        weightPerPkg: Number(g("one_qty_kg", "oneQtyKg", 0)),
        emptyKgs: Number(g("empty_kgs", "emptyKgs", 0)),
        totalGrossWeight: Number(g("total_gross_weight", "totalGrossWeight", 0)),
        netWeight: Number(g("net_weight", "netWeight", 0)),
        divideType: g("divide_type", "divideType", "Divide / Kg"),
        divideKgs: Number(g("divide_kgs", "divideKgs", 1)) || 1,
        priceType: "Price / Kg",
        rateType: g("rate_type", "rateType", "per_kg"),
        purchaseRate: Number(g("purchase_rate", "purchaseRate", 0)),
        currency: g("purchase_currency", "purchaseCurrency", purchaseCurrency),
        exchangeRate: 1,
        amount: Number(g("purchase_cost", "purchaseCost", 0)),
        purchaseCost: Number(g("purchase_cost", "purchaseCost", 0)),
        applyTax: g("apply_tax", "applyTax", "No"),
        taxType: g("tax_type", "taxType", "No Tax"),
        taxPercentage: Number(g("tax_percentage", "taxPercentage", 0)),
        taxAmount: Number(g("tax_amount", "taxAmount", 0)),
        finalCost: Number(g("final_cost", "finalCost", 0)),
        finalAed: Number(g("final_cost", "finalCost", 0)),
        qualityReportRef: g("quality_report_ref", "qualityReportRef", "Passed"),
        origin: "—",
      }];
    }
    setDraftItems(lines);
    const ch = Array.isArray(row.extra_charges) ? row.extra_charges : Array.isArray(row.extraCharges) ? row.extraCharges : [];
    setExtraCharges(ch.map((c: any, i: number) => ({
      id: String(c.id || `chg-${i}`),
      label: String(c.label || ""),
      amount: String(c.amount ?? ""),
      allocate: Boolean(c.allocate),
    })));
    // The goods form itself starts empty: the goods live in the committed list above it.
    setGoodsId("");
    setCustomGoodsName("");
    resetItemFields();
    const ld = (row.loading_details && typeof row.loading_details === "object") ? row.loading_details : (row.loadingDetails || {});
    setSupplierName(g("supplier_name", "supplierName"));
    setSupplierPersonId(g("supplier_person_id", "supplierPersonId"));
    setPurchaseAccountNo(g("purchase_account_no", "purchaseAccountNo"));
    setSalesAccountNo(g("sales_account_no", "salesAccountNo"));
    setBrokerAccountNo(g("broker_account_no", "brokerAccountNo"));
    setContractNo(g("contract_no", "contractNo"));
    setPaymentMode(g("payment_mode", "paymentMode", "Cash"));
    const sm = g("shipping_mode", "shippingMode", ld.shippingMode || "Loading");
    setShippingMode(sm);
    setShipmentType(ld.shipmentType || SHIPPING_MODE_TO_SHIPMENT_TYPE[sm] || "Loading by Truck");
    setOriginCountryId(g("origin_country_id", "originCountryId"));
    setAdvancePercentage(String(g("advance_percentage", "advancePercentage", "20")));
    setWarehouseName(g("warehouse_name", "warehouseName", ld.warehouseName || ""));
    setSelectedWarehouseId(g("warehouse_id", "warehouseId"));
    setWarehouseAccountNo(g("purchase_account_no", "purchaseAccountNo"));
    setWarehousePlotNo(g("warehouse_plot_no", "warehousePlotNo", ld.warehousePlotNo || ""));
    setTransferDate(g("transfer_date", "transferDate", new Date().toISOString().slice(0, 10)));
    setLoadingDate(g("loading_date", "loadingDate", ld.loadingDate || new Date().toISOString().slice(0, 10)));
    setTruckNo(g("truck_no", "truckNo", ld.truckNo || ""));
    setDriverName(g("driver_name", "driverName", ld.driverName || ""));
    setRemarks(row.remarks || "");
    setPurchaseCurrency(g("purchase_currency", "purchaseCurrency", "USD"));
    setExchangeRateToAed(String(g("exchange_rate", "exchangeRate", "1")));
    if (row.country_branch_id || row.countryBranchId) setSelectedBranchId(row.country_branch_id || row.countryBranchId);
    if (row.city_branch_id || row.cityBranchId) setSelectedCityBranchId(row.city_branch_id || row.cityBranchId);
    setIsFormOpen(true);
    setCurrentStep(1);
  }

  function lineKey(item: { goodsId?: string | null; goodsName?: string; brand?: string; size?: string; lotNo?: string }) {
    return [
      item.goodsId || String(item.goodsName || "").trim().toLowerCase(),
      String(item.brand || "-").trim().toLowerCase(),
      String(item.size || "-").trim().toLowerCase(),
      String(item.lotNo || "").trim().toLowerCase(),
    ].join("|");
  }

  // Builds the line from the live form and appends it to the committed list. Returns the
  // NEW committed list (so callers can use it synchronously), or null when the line is
  // incomplete / rejected. A line whose Goods ID + variant (brand/size) + lot already
  // exists is merged into that line when rate and package weight match, else rejected.
  function addLineItem(): any[] | null {
    const custom = isCustomGoods(goodsId);
    const selectedGoodsName = custom
      ? customGoodsName.trim()
      : (selectedGood ? (selectedGood.goodsName || selectedGood.goods_name || "") : "");

    if (!selectedGoodsName) {
      alert(t(lang, "lp.err_select_goods", "Please select or enter a Goods Name."));
      return null;
    }

    const qtyNo = Number(quantityCount || 0);
    if (qtyNo <= 0) {
      alert(t(lang, "lp.err_valid_qty", "Please enter a valid packages count."));
      return null;
    }

    const oneKgVal = Number(weightPerPkg || divideKgs || 0);
    const emptyKgVal = Number(emptyKgs || 0);
    const grossKg = qtyNo * oneKgVal;
    const packagingKg = qtyNo * emptyKgVal;
    const calculatedNet = Math.max(grossKg - packagingKg, 0);
    const netKg = calculatedNet > 0 ? calculatedNet : grossKg;
    const rateVal = Number(purchaseRate || 0);

    const isPerUnit = priceType === "Price / Box" || priceType === "Price / Bag" || priceType === "Price / Unit" || rateType === "Per Bag / Package";
    const calcAmount = isPerUnit ? qtyNo * rateVal : (netKg > 0 ? netKg * rateVal : grossKg * rateVal);

    // Per-entry tax calculation
    const itemHasTax = applyTax === "Yes";
    const itemTaxPct = itemHasTax ? Number(taxPercentage || 0) : 0;
    const itemTaxAmount = itemHasTax ? (calcAmount * itemTaxPct) / 100 : 0;
    const itemFinalAmount = calcAmount + itemTaxAmount;

    const itemObj = {
      id: `draft-${Date.now()}-${Math.random()}`,
      goodsId: custom ? null : (goodsId || null),
      goodsName: selectedGoodsName,
      hsCode: hsCode || (selectedGood?.hs_code || selectedGood?.hsCode || ""),
      allotId: allotId || "ALT-5239",
      brand: brand === "custom" ? customBrand.trim() : (brand || "-"),
      size: size === "custom" ? customSize.trim() : (size || "-"),
      lotNo: lotNo.trim(),
      chassisCode: chassisCode.trim(),
      variety: variety || "-",
      qualityDetails: qualityDetails || "-",
      quantityName: quantityName === "Custom" ? (customQuantityName.trim() || "Box") : (quantityName || "Box"),
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

    const existingIdx = draftItems.findIndex(d => lineKey(d) === lineKey(itemObj));
    let next: any[];
    if (existingIdx >= 0) {
      const ex = draftItems[existingIdx];
      if (Number(ex.purchaseRate) !== rateVal || Number(ex.weightPerPkg) !== oneKgVal || Number(ex.emptyKgs) !== emptyKgVal) {
        alert(t(lang, "lp.err_duplicate_line", "This Goods + Size/Brand + Lot is already in the list with a different rate or package weight. Edit that line or use a different lot number."));
        return null;
      }
      if (!window.confirm(t(lang, "lp.confirm_merge_line", "This Goods + Size/Brand + Lot is already in the list. Merge the quantities into that line?"))) {
        return null;
      }
      const mQty = Number(ex.quantityCount) + qtyNo;
      next = draftItems.map((d, i) => i !== existingIdx ? d : {
        ...d,
        quantityCount: mQty, quantityKgs: mQty, numbers: mQty,
        totalGrossWeight: Number(d.totalGrossWeight) + grossKg,
        netWeight: Number(d.netWeight) + netKg,
        amount: Number(d.amount) + calcAmount,
        purchaseCost: Number(d.purchaseCost) + calcAmount,
        taxAmount: Number(d.taxAmount) + itemTaxAmount,
        finalCost: Number(d.finalCost) + itemFinalAmount,
        finalAed: Number(d.finalAed) + itemFinalAmount,
      });
    } else {
      next = [...draftItems, itemObj];
    }

    setDraftItems(next);
    setGoodsId("");
    setCustomGoodsName("");
    resetItemFields();
    return next;
  }

  function handleAddLineItem() {
    addLineItem();
  }

  // True when the live form holds a started-but-uncommitted line.
  function hasPendingLine(): boolean {
    return Boolean(goodsId) || Boolean(customGoodsName.trim()) || Number(quantityCount || 0) > 0;
  }

  // Returns the committed goods list to save/post. A valid pending line is committed first;
  // an incomplete pending line blocks the save so nothing is silently dropped or half-saved.
  function ensureLineItems(): any[] | null {
    if (hasPendingLine()) return addLineItem();
    if (draftItems.length === 0) {
      alert(t(lang, "lp.validation_goods_item", "Please select or enter at least one Goods Item before continuing."));
      return null;
    }
    return draftItems;
  }

  // Aggregates the committed lines into the header row the existing table stores, and
  // carries the full line list / charges / loading details alongside it.
  function buildPayload(items: any[]) {
    const resolvedShippingMode = shippingMode === "Custom" ? customShippingMode.trim() : shippingMode;
    let resolvedPaymentMode = paymentMode;
    if (paymentMode === "Advance") {
      resolvedPaymentMode = `Advance (${advancePercentage}% Paid: ${advancePaymentDate}, Bal Due: ${remainingDueDate})`;
    } else if (paymentMode === "Cash" || paymentMode === "Bank Transfer" || paymentMode === "Hawala / Transfer") {
      resolvedPaymentMode = `${paymentMode} (${cashPaymentType} on ${cashPaymentDate})`;
    } else if (paymentMode === "Credit") {
      resolvedPaymentMode = `Credit (Due: ${creditDueDate})`;
    }
    const first = items[0];
    const uniq = (xs: string[]) => Array.from(new Set(xs.map(x => String(x || "").trim()).filter(x => x && x !== "-")));
    const sum = (k: string) => items.reduce((acc, i) => acc + (Number(i[k]) || 0), 0);
    const goodsFinal = sum("finalCost");
    const advanceAmt = paymentMode === "Advance"
      ? (manualAdvanceAmount !== "" ? Number(manualAdvanceAmount) : (goodsFinal * Number(advancePercentage || 0)) / 100)
      : 0;
    return {
      // Server resolves the branch legal company; never fall back to an arbitrary company.
      companyId: activeBranch?.companyId || activeBranch?.company_id || null,
      countryId: activeBranch?.countryId || activeBranch?.country_id,
      countryBranchId: selectedBranchId,
      cityBranchId: selectedCityBranchId || null,
      goodsId: first.goodsId || null,
      goodsName: items.map(i => i.goodsName).join(" + "),
      purchaseAccountNo: shipmentType === "Warehouse Transfer" ? (warehouseAccountNo || null) : (purchaseAccountNo || null),
      salesAccountNo: salesAccountNo || null,
      brokerAccountNo: brokerAccountNo || null,
      contractNo: contractNo.trim() || null,
      brand: uniq(items.map(i => i.brand)).join(" / ") || null,
      size: uniq(items.map(i => i.size)).join(" / ") || null,
      chassisCode: (first.chassisCode || "").trim() || null,
      lotNo: uniq(items.map(i => i.lotNo)).join(" / ") || null,
      supplierName: supplierName.trim(),
      supplierPersonId: supplierPersonId || null,
      paymentMode: resolvedPaymentMode,
      shippingMode: resolvedShippingMode,
      originCountryId: originCountryId === "custom" ? null : (originCountryId || null),
      originCountryName: selectedOriginCountryName,
      advancePercentage: paymentMode === "Advance" ? Number(advancePercentage || 0) : 0,
      advanceAmount: advanceAmt,
      remainingBalance: paymentMode === "Advance" ? Math.max(0, goodsFinal - advanceAmt) : 0,
      warehouseName: warehouseName.trim() || null,
      warehouseId: selectedWarehouseId && selectedWarehouseId.toLowerCase() !== "custom" ? selectedWarehouseId : null,
      warehousePlotNo: warehousePlotNo.trim() || null,
      transferDate: transferDate || null,
      loadingDate: loadingDate || null,
      truckNo: truckNo.trim() || null,
      driverName: driverName.trim() || null,
      remarks: remarks.trim() || null,
      quantityName: first.quantityName || (quantityName === "Custom" ? customQuantityName.trim() : quantityName),
      quantityKgs: sum("quantityKgs"),
      totalGrossWeight: sum("totalGrossWeight"),
      emptyKgs: sum("emptyKgs"),
      netWeight: sum("netWeight"),
      divideKgs: first.divideKgs,
      numbers: sum("numbers"),
      rateType: first.rateType,
      purchaseRate: first.purchaseRate,
      purchaseCurrency: purchaseCurrency,
      exchangeRate: Number(exchangeRateToAed) || 1,
      localCurrency: purchaseCurrency,
      purchaseCost: sum("purchaseCost"),
      applyTax: first.applyTax || "No",
      taxType: first.taxType || "VAT",
      taxPercentage: first.taxPercentage || 0,
      taxAmount: sum("taxAmount"),
      finalCost: goodsFinal,
      // Full detail persisted so a reopened record shows exactly what was entered.
      lineItems: items,
      extraCharges: extraCharges
        .filter(c => c.label.trim() || Number(c.amount) > 0)
        .map(c => ({ id: c.id, label: c.label.trim(), amount: Number(c.amount) || 0, allocate: Boolean(c.allocate) })),
      loadingDetails: {
        shipmentType, shippingMode: resolvedShippingMode, truckNo: truckNo.trim(), driverName: driverName.trim(),
        loadingDate, warehouseName: warehouseName.trim(), warehousePlotNo: warehousePlotNo.trim(),
      },
    };
  }

  async function handleSubmit(e: React.SyntheticEvent, options?: { draftOnly?: boolean }) {
    e.preventDefault();
    if (submitLockRef.current) return;
    const items = ensureLineItems();
    if (!items) return;

    submitLockRef.current = true;
    setSaving(true);
    try {
      const payload = buildPayload(items);

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
      if (!isEditingDraft && intake.draft && newPurchase?.id) await intake.consume(String(newPurchase.id)).catch(() => undefined);

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
      
      setExtraCharges([]);
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
      submitLockRef.current = false;
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
    // A started line must be completed (or cleared) before leaving Goods Entry; a complete
    // pending line is committed automatically so it is never lost.
    return ensureLineItems() !== null;
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
    if (submitLockRef.current) return;
    if (!validateBookingStep()) { setCurrentStep(1); return; }
    if (!validatePaymentLoadingStep()) { setCurrentStep(3); return; }
    const items = ensureLineItems();
    if (!items) { setCurrentStep(2); return; }

    submitLockRef.current = true;
    setSaving(true);
    setShowPostConfirm(false);
    try {
      const payload = buildPayload(items);

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
      // From here on every retry updates THIS row; a failed post step can never make the next
      // click create a second purchase record (and a second payment/expense/journal chain).
      if (savedPurchase?.id) setEditingPurchaseId(savedPurchase.id);

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
      setDraftItems([]);
      setExtraCharges([]);
      setCurrentStep(1);
      await loadHistory();
    } catch (err: any) {
      alert(err.message || "Failed to transfer and post to General Ledger.");
    } finally {
      submitLockRef.current = false;
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
        const targetCountry = countryOptions.find(c => String(c.id) === String(selectedCountryId));
        const targetKey = targetCountry ? normalizeCountryKey(targetCountry.name) : normalizeCountryKey(selectedCountryId);

        let matchesCountry = false;
        if (rowCId && (rowCId === String(selectedCountryId) || (targetCountry && rowCId === String(targetCountry.id)))) {
          matchesCountry = true;
        } else {
          const pCName = p.country_name || p.countryName || "";
          if (pCName && normalizeCountryKey(pCName) === targetKey) {
            matchesCountry = true;
          } else {
            const pBranchId = String(p.country_branch_id || p.countryBranchId || "");
            const branch = countryBranches.find(b => String(b.id) === pBranchId);
            if (branch) {
              if (String(branch.country_id || branch.countryId) === String(selectedCountryId)) {
                matchesCountry = true;
              } else if (normalizeCountryKey(branch.country_name || branch.countryName || branch.name) === targetKey) {
                matchesCountry = true;
              }
            }
          }
        }
        if (!matchesCountry) return false;
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

  const superAdminStats = useMemo(() => {
    const totalPurchasesCount = purchases.length;
    let totalUsdAmount = 0;
    let totalUsdTax = 0;
    let totalUsdFinal = 0;
    let posted = 0;
    let draft = 0;
    let pending = 0;

    purchases.forEach((p) => {
      const st = String(p.status || p.bill_status || "").toLowerCase();
      const curr = p.purchase_currency || p.localCurrency || p.local_currency || "AFN";
      const exRate = Number(p.exchange_rate || p.exchangeRate || 1);
      const cost = Number(p.purchase_cost || p.purchaseCost || 0);
      const tax = Number(p.tax_amount || p.taxAmount || 0);
      const finalCost = Number(p.final_cost || p.finalCost || cost + tax || 0);

      totalUsdAmount += convertToUsd(cost, curr, exRate);
      totalUsdTax += convertToUsd(tax, curr, exRate);
      totalUsdFinal += convertToUsd(finalCost, curr, exRate);

      if (["posted", "accepted", "transferred"].includes(st)) {
        posted += 1;
      } else if (st === "draft") {
        draft += 1;
      } else {
        pending += 1;
      }
    });

    return {
      totalPurchasesCount,
      totalUsdAmount,
      totalUsdTax,
      totalUsdFinal,
      posted,
      draft,
      pending,
    };
  }, [purchases]);

  const superAdminCountrySummary = useMemo(() => {
    // Map normalized country key -> country summary object
    const countryMap = new Map<string, any>();

    // 1. Seed from configured countryOptions
    countryOptions.forEach(opt => {
      const key = normalizeCountryKey(opt.name);
      if (!countryMap.has(key)) {
        countryMap.set(key, {
          id: opt.id,
          country: opt.name,
          code: opt.code,
          currency: opt.currency,
          totalPurchases: 0,
          totalAmountLocal: 0,
          totalAmountUsd: 0,
          paidAmount: 0,
          remainingAmount: 0,
          posted: 0,
          draft: 0,
          pending: 0,
          mainBranches: new Map<string, any>(),
          cityBranches: new Map<string, any>(),
          branches: new Map<string, any>(),
        });
      }
    });

    // 2. Associate countryBranches (Country Main Branches)
    countryBranches.forEach(b => {
      const bCountryId = String(b.countryId || b.country_id || "");
      let target: any = null;
      if (bCountryId) {
        target = Array.from(countryMap.values()).find(c => String(c.id) === bCountryId);
      }
      if (!target) {
        const bCName = b.countryName || b.country_name || "";
        if (bCName) target = countryMap.get(normalizeCountryKey(bCName));
      }
      if (!target && b.name) {
        target = countryMap.get(normalizeCountryKey(b.name));
      }

      if (target) {
        const branchObj = {
          id: String(b.id),
          name: b.name || b.code || "Main Branch",
          code: b.code || "—",
          isMain: b.is_main ?? true,
          status: b.status || "active",
          billsCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
        };
        target.mainBranches.set(String(b.id), branchObj);
        target.branches.set(String(b.id), branchObj);
      }
    });

    // 3. Associate cityBranches (Business City Branches)
    cityBranches.forEach(cb => {
      const cbCountryId = String(cb.countryId || cb.country_id || "");
      const cbCountryBranchId = String(cb.countryBranchId || cb.country_branch_id || "");
      let target: any = null;
      if (cbCountryId) {
        target = Array.from(countryMap.values()).find(c => String(c.id) === cbCountryId);
      }
      if (!target && cbCountryBranchId) {
        for (const c of countryMap.values()) {
          if (c.mainBranches.has(cbCountryBranchId) || c.branches.has(cbCountryBranchId)) {
            target = c;
            break;
          }
        }
      }
      if (!target) {
        const cbCName = cb.countryName || cb.country_name || "";
        if (cbCName) target = countryMap.get(normalizeCountryKey(cbCName));
      }

      if (target) {
        const cityBranchObj = {
          id: String(cb.id),
          name: cb.name || cb.branchName || cb.branch_name || "City Branch",
          code: cb.code || "—",
          cityName: cb.city_name || cb.cityName || cb.city || "—",
          countryBranchId: cbCountryBranchId,
          isBusinessBranch: cb.is_business_branch ?? true,
          status: cb.status || "active",
          billsCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
        };
        target.cityBranches.set(String(cb.id), cityBranchObj);
        target.branches.set(String(cb.id), cityBranchObj);
      }
    });

    // 4. Accumulate purchases
    purchases.forEach((p) => {
      const pCountryId = String(p.country_id || p.countryId || "");
      const pCountryName = String(p.country_name || p.countryName || "");
      const pBranchId = String(p.country_branch_id || p.countryBranchId || "");
      const pCityBranchId = String(p.city_branch_id || p.cityBranchId || "");
      const st = String(p.status || p.bill_status || "").toLowerCase();
      const curr = p.purchase_currency || p.localCurrency || p.local_currency || "AFN";
      const exRate = Number(p.exchange_rate || p.exchangeRate || 1);
      const cost = Number(p.final_cost || p.finalCost || p.purchase_cost || 0);
      const costUsd = convertToUsd(cost, curr, exRate);

      let targetCountry: any = null;
      if (pCountryId) {
        targetCountry = Array.from(countryMap.values()).find(c => String(c.id) === pCountryId);
      }
      if (!targetCountry && pCountryName) {
        targetCountry = countryMap.get(normalizeCountryKey(pCountryName));
      }
      if (!targetCountry && pBranchId) {
        for (const c of countryMap.values()) {
          if (c.branches.has(pBranchId) || c.mainBranches.has(pBranchId)) {
            targetCountry = c;
            break;
          }
        }
      }
      if (!targetCountry && pCityBranchId) {
        for (const c of countryMap.values()) {
          if (c.cityBranches.has(pCityBranchId)) {
            targetCountry = c;
            break;
          }
        }
      }

      if (targetCountry) {
        targetCountry.totalPurchases += 1;
        targetCountry.totalAmountLocal += cost;
        targetCountry.totalAmountUsd += costUsd;

        if (["posted", "accepted", "transferred"].includes(st)) {
          targetCountry.posted += 1;
          targetCountry.paidAmount += cost;
        } else if (st === "draft") {
          targetCountry.draft += 1;
          targetCountry.remainingAmount += cost;
        } else {
          targetCountry.pending += 1;
          targetCountry.remainingAmount += cost;
        }

        // Accumulate to Main Branch
        if (pBranchId && targetCountry.mainBranches.has(pBranchId)) {
          const mbr = targetCountry.mainBranches.get(pBranchId);
          mbr.billsCount += 1;
          mbr.totalAmount += cost;
          if (["posted", "accepted", "transferred"].includes(st)) {
            mbr.paidAmount += cost;
          } else {
            mbr.remainingAmount += cost;
          }
        }

        // Accumulate to City Branch
        if (pCityBranchId && targetCountry.cityBranches.has(pCityBranchId)) {
          const cbr = targetCountry.cityBranches.get(pCityBranchId);
          cbr.billsCount += 1;
          cbr.totalAmount += cost;
          if (["posted", "accepted", "transferred"].includes(st)) {
            cbr.paidAmount += cost;
          } else {
            cbr.remainingAmount += cost;
          }
        }
      }
    });

    return Array.from(countryMap.values()).map(c => ({
      ...c,
      mainBranchList: Array.from(c.mainBranches.values()),
      cityBranchList: Array.from(c.cityBranches.values()),
      branchList: Array.from(c.branches.values()),
    }));
  }, [countryOptions, countryBranches, cityBranches, purchases]);

  const activeCountrySummary = useMemo(() => {
    if (!activeCountryObj) return null;
    const targetKey = normalizeCountryKey(activeCountryObj.name);
    return superAdminCountrySummary.find(c => normalizeCountryKey(c.country) === targetKey) || null;
  }, [activeCountryObj, superAdminCountrySummary]);

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
                  {activeBranch?.companyName || "Damaan Business Group"} &mdash; {activeBranch?.name || "—"} ({[scopeLabels.country, scopeLabels.city].filter(Boolean).join(", ") || "—"})
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
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-semibold px-1">
            <span>{t(lang, "nav.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span>{t(lang, "nav.purchase", "Purchase")}</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">{t(lang, "lp.title", "Local Purchase Registry")}</span>
          </div>

          {/* 2. Top Banner Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 py-1">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn(
                "h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shadow-xs shrink-0 border transition-colors",
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
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {t(lang, "lp.title", "Local Purchase Registry")}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                    {t(lang, "lp.reg_badge", "Local Purchase")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {t(lang, "lp.subtitle", "Record market purchases with custom empty weights and automated ledger postings.")}
                </p>
              </div>
            </div>

            {/* Right: View Switcher pills & Search/Filters/New Purchase */}
            <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
              {/* Dual View Toggle Pills */}
              <div className="flex w-full items-stretch p-1 sm:w-auto sm:inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
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
                    "flex-1 sm:flex-none justify-center text-center min-h-8 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                    !isSuperAdminView
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{t(lang, "lp.reg_view_branch", "1. Country / Branch View")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewScopeMode("super_admin");
                    setSelectedCountryId("");
                  }}
                  className={cn(
                    "flex-1 sm:flex-none justify-center text-center min-h-8 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                    isSuperAdminView
                      ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs border border-slate-200/80 dark:border-slate-700 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Globe className="h-3.5 w-3.5 text-amber-500" />
                  <span>{t(lang, "lp.reg_view_super", "2. Super Admin View (USD)")}</span>
                </button>
              </div>

              {/* + New Purchase Split Button */}
              <div className="relative flex w-full items-center shadow-md shadow-blue-500/20 rounded-xl overflow-hidden shrink-0 sm:inline-flex sm:w-auto">
                <Button
                  type="button"
                  onClick={() => {
                    setScopeCountryId(selectedCountryId || countryOptions[0]?.id || "");
                    setScopeBranchId(selectedBranchId || filteredCountryBranches[0]?.id || "");
                    setScopeCityBranchId(selectedCityBranchId || activeCityBranches[0]?.id || "");
                    setIsScopeModalOpen(true);
                  }}
                  className="h-10 sm:h-9 flex-1 sm:flex-none justify-center rounded-none bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3.5 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
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
                  className="h-10 sm:h-9 px-3 sm:px-2 bg-blue-700 hover:bg-blue-800 text-white border-s border-blue-500/40 flex items-center justify-center transition cursor-pointer"
                  title={t(lang, "lp.booking_posting_bill", "New Purchase Options")}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Smart Filter Bar Matching Reference Design */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-wrap lg:items-end">
              {/* Country Searchable Dropdown */}
              <div className="flex flex-col gap-1 min-w-0 lg:min-w-[150px]">
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
                  className="h-10 sm:h-9 w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
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
              <div className="flex flex-col gap-1 min-w-0 lg:min-w-[170px]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "lp.branch_name", "Branch / City")}
                </span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setSelectedCityBranchId("");
                  }}
                  className="h-10 sm:h-9 w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
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
              <div className="col-span-2 flex flex-col gap-1 min-w-0 lg:col-span-1 lg:flex-1 lg:min-w-[220px]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "common.search", "Search")}
                </span>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t(lang, "lp.search_placeholder", "Search by bill no, supplier, goods, voucher...")}
                    className="h-10 sm:h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 ps-9 pe-3 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Registry Filter Dropdown */}
              <div className="col-span-2 flex flex-col gap-1 min-w-0 lg:col-span-1 lg:min-w-[150px]">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {t(lang, "lp.title", "Registry")}
                </span>
                <select
                  value={registryFilter}
                  onChange={(e) => setRegistryFilter(e.target.value)}
                  className="h-10 sm:h-9 w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
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
                    "h-10 sm:h-9 w-full lg:w-auto justify-center px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition",
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
                  className="h-10 w-full sm:h-9 lg:w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 transition"
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
                    {t(lang, "common.currency", "Currency")}
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
                    {t(lang, "lp.reg_payment_mode", "Payment Mode")}
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
                    <span className="text-slate-400 font-medium">{t(lang, "lp.branch_code", "Branch Code")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {activeBranch?.code || "AFG-MAIN-001"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_country_city", "Country / City")} :</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                      {[scopeLabels.country, scopeLabels.city].filter(Boolean).join(", ") || "—"}
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
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_access", "Access")} :</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{t(lang, "lp.reg_all_countries", "All Countries")}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "dash.total_branches", "Total Branches")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {countryBranches.length > 0 ? countryBranches.length : 4}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-medium">{t(lang, "dash.total_users", "Total Users")} :</span>
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
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                {activeCountryObj ? `${activeCountryObj.name} · ${t(lang, "lp.reg_fin_summary", "Financial Summary")}` : t(lang, "lp.financial_summary", "PURCHASE SUMMARY")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {!isSuperAdminView ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_purchases", "Total Purchases")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localPurchaseDashboard.totalBills}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_amount", "Total Amount")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localCurrency} {localPurchaseDashboard.totalPurchase.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_tax", "Total Tax")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {localCurrency} {localPurchaseDashboard.totalTax.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : activeCountrySummary ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_purchases", "Total Purchases")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {activeCountrySummary.totalPurchases}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_amount", "Total Amount")} ({activeCountrySummary.currency}) :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {activeCountrySummary.currency} {activeCountrySummary.totalAmountLocal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_amount_usd", "Total Amount (USD)")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      $ {activeCountrySummary.totalAmountUsd.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_purchases", "Total Purchases")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {superAdminStats.totalPurchasesCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_amount_usd", "Total Amount (USD)")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      $ {superAdminStats.totalUsdAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t(lang, "lp.reg_total_tax_usd", "Total Tax (USD)")} :</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      $ {superAdminStats.totalUsdTax.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">{t(lang, "lp.total_final_amount", "Total Final Amount")} :</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                {!isSuperAdminView
                  ? `${localCurrency} ${localPurchaseDashboard.totalFinal.toLocaleString()}`
                  : activeCountrySummary
                    ? `${activeCountrySummary.currency} ${activeCountrySummary.totalAmountLocal.toLocaleString()}`
                    : `$ ${superAdminStats.totalUsdFinal.toLocaleString()}`}
              </span>
            </div>
          </div>

          {/* Card 3: Bill Entry Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="h-7 w-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                {activeCountryObj ? `${activeCountryObj.name} · ${t(lang, "lp.reg_entry_summary", "Entry Summary")}` : t(lang, "lp.bill_entry_summary", "BILL ENTRY SUMMARY")}
              </p>
            </div>
            <div className="py-2 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.total_bills", "Total Bills")} :</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {!isSuperAdminView
                    ? localPurchaseDashboard.totalBills
                    : activeCountrySummary
                      ? activeCountrySummary.totalPurchases
                      : superAdminStats.totalPurchasesCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.posted_accepted", "Posted / Accepted")} :</span>
                <span className="font-mono font-bold text-emerald-600">
                  {!isSuperAdminView
                    ? localPurchaseDashboard.postedBills
                    : activeCountrySummary
                      ? activeCountrySummary.posted
                      : superAdminStats.posted}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">{t(lang, "lp.draft_bills", "Draft Bills")} :</span>
                <span className="font-mono font-bold text-amber-600">
                  {!isSuperAdminView
                    ? localPurchaseDashboard.draftBills
                    : activeCountrySummary
                      ? activeCountrySummary.draft
                      : superAdminStats.draft}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">{t(lang, "lp.pending_bills", "Pending Bills")} :</span>
              <span className="font-mono font-black text-rose-600">
                {!isSuperAdminView
                  ? localPurchaseDashboard.pendingBills
                  : activeCountrySummary
                    ? activeCountrySummary.pending
                    : superAdminStats.pending}
              </span>
            </div>
          </div>

          {/* Card 4: Country / Branch Report */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between h-full min-h-[175px] hover:shadow-xs transition">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {!isSuperAdminView ? t(lang, "lp.reg_branch_breakdown", "Branch Breakdown") : t(lang, "lp.all_countries_report", "ALL COUNTRIES REPORT")}
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-medium">
                    {selectedCountryId ? t(lang, "lp.reg_hint_filtered", "1 Country Filtered (Click to reset)") : t(lang, "lp.reg_hint_click", "Click a country to view bills")}
                  </p>
                </div>
              </div>
              {selectedCountryId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountryId("");
                    setSelectedBranchId("");
                  }}
                  className="px-2 py-0.5 text-[9.5px] font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 transition cursor-pointer"
                  title={tr("Show all countries")}
                >
                  ✕ {t(lang, "lp.reg_show_all", "Show All")}
                </button>
              )}
            </div>

            <div className="py-1 space-y-1 text-xs max-h-[120px] overflow-y-auto">
              {!isSuperAdminView ? (
                filteredCountryBranches.slice(0, 5).map((b) => {
                  const bPurchases = purchases.filter(p => String(p.country_branch_id || p.countryBranchId) === String(b.id));
                  const isSelected = selectedBranchId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBranchId(prev => prev === b.id ? "" : b.id)}
                      className={cn(
                        "w-full flex justify-between items-center py-1 px-1.5 rounded-lg border transition text-start cursor-pointer",
                        isSelected
                          ? "bg-blue-50 border-blue-300 dark:bg-blue-950/60 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-bold"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium"
                      )}
                    >
                      <span className="truncate max-w-[140px] text-[11px]">{b.name || b.code}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">{bPurchases.length}</span>
                    </button>
                  );
                })
              ) : (
                <>
                  {/* All Countries Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountryId("");
                      setSelectedBranchId("");
                    }}
                    className={cn(
                      "w-full flex justify-between items-center py-1 px-2 rounded-lg border transition text-start cursor-pointer",
                      !selectedCountryId
                        ? "bg-blue-600 border-blue-600 text-white font-bold shadow-2xs"
                        : "border-transparent hover:bg-blue-50/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-medium"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span>🌐</span>
                      <span>{tr("All Countries")}</span>
                    </span>
                    <span className={cn(
                      "font-mono font-bold text-[10.5px] px-1.5 py-0.5 rounded",
                      !selectedCountryId ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}>
                      {superAdminStats.totalPurchasesCount}
                    </span>
                  </button>

                  {/* Individual Countries */}
                  {superAdminCountrySummary.map((c) => {
                    const isSelected = selectedCountryId === c.id || (activeCountryObj && normalizeCountryKey(activeCountryObj.name) === normalizeCountryKey(c.country));
                    return (
                      <button
                        key={c.country}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCountryId("");
                            setSelectedBranchId("");
                          } else {
                            setSelectedCountryId(c.id);
                            setSelectedBranchId("");
                          }
                        }}
                        className={cn(
                          "w-full flex justify-between items-center py-1 px-2 rounded-lg border transition text-start cursor-pointer",
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white font-bold shadow-2xs"
                            : "border-transparent hover:bg-blue-50/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-medium"
                        )}
                        title={t(lang, "lp.reg_click_show_bills", "Click to show {country} bills below").replace("{country}", c.country)}
                      >
                        <span className="flex items-center gap-1.5 text-[11px] truncate">
                          <span>{getCountryFlag(c.country)}</span>
                          <span className="truncate">{c.country}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            "font-mono font-bold text-[10.5px] px-1.5 py-0.5 rounded",
                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}>
                            {c.totalPurchases}
                          </span>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
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

                  <div className="flex justify-end">
                    <IntakeDraftPicker targetModule="local_purchases" lang={lang} onPicked={() => window.location.reload()} />
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
                        onChange={e => {
                          // A new goods choice always starts a clean line (no brand/size/lot/rate carry-over).
                          setGoodsId(e.target.value);
                          setCustomGoodsName("");
                          resetItemFields();
                        }}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                      >
                        <option value="">{t(lang, "lp.select_goods", "Select Goods Master...")}</option>
                        {goodsOptions.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                        <option value="custom">{t(lang, "lp.custom_entry", "+ Custom Product Entry")}</option>
                      </select>
                      {isCustomGoods(goodsId) && (
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

                  {/* + Add Charge — informational rows, never posted silently */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2 bg-slate-50/60 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {t(lang, "lp.charges_title", "Additional Charges")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExtraCharges(prev => [...prev, { id: `chg-${Date.now()}-${prev.length}`, label: "", amount: "", allocate: false }])}
                        className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black"
                      >
                        + {t(lang, "lp.add_charge", "Add Charge")}
                      </button>
                    </div>
                    {extraCharges.length === 0 && (
                      <p className="text-[9.5px] text-slate-400">{t(lang, "lp.charges_empty", "No additional charges. Add freight, unloading or any other cost for this bill.")}</p>
                    )}
                    {extraCharges.map((c) => (
                      <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_96px_32px] items-center gap-1.5">
                        <input
                          value={c.label}
                          onChange={e => setExtraCharges(prev => prev.map(x => x.id === c.id ? { ...x, label: e.target.value } : x))}
                          placeholder={t(lang, "lp.charge_label_ph", "Charge name (e.g. Freight)")}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none min-w-0"
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={c.amount}
                          onChange={e => setExtraCharges(prev => prev.map(x => x.id === c.id ? { ...x, amount: e.target.value } : x))}
                          placeholder="0.00"
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono outline-none text-end min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => setExtraCharges(prev => prev.filter(x => x.id !== c.id))}
                          aria-label={t(lang, "common.remove", "Remove")}
                          className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 text-sm font-black"
                        >
                          &times;
                        </button>
                        <label className="col-span-3 flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            className="shrink-0 accent-blue-600"
                            style={{ width: 18, height: 18, minWidth: 18, minHeight: 18 }}
                            checked={c.allocate}
                            onChange={e => setExtraCharges(prev => prev.map(x => x.id === c.id ? { ...x, allocate: e.target.checked } : x))}
                          />
                          {t(lang, "lp.charge_allocate", "Add to landed cost")}
                        </label>
                      </div>
                    ))}
                    {extraCharges.length > 0 && (
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        {t(lang, "lp.charges_info_note", "Charges are recorded on the bill for reference. They are not posted to the ledger and do not change the supplier payable.")}
                      </p>
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
                          {`CA-${(scopeLabels.country || "LOC").slice(0, 3).toUpperCase()}-2026-${String(purchases.filter(p => p.country_id === activeBranch?.countryId).length + 1).padStart(5, "0")}`}
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
                    onClick={() => setShowPostConfirm(true)}
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
                      onClick={() => printDomFragmentViaModal("printable-lp-voucher", t(lang, "lp.print_voucher", "Print Voucher"))}
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
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{activeBranch?.name || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.branch_code", "Branch Code")}</span>
                    <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-100">{activeBranch?.code || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.country", "Country")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{scopeLabels.country || "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-400">{t(lang, "lp.city", "City")}</span>
                    <span className="font-bold text-right truncate text-slate-800 dark:text-slate-100">{scopeLabels.city || "—"}</span>
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
                      {draftItems.length} {t(lang, "lp.items_confirmed", "Items Confirmed")}
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
                          <tr>
                            <td colSpan={14} className="p-3 text-center text-[10px] text-slate-400">
                              {t(lang, "lp.no_goods_lines", "No goods lines added yet.")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {extraCharges.length > 0 && (
                    <div className="border-t border-slate-100 px-3 py-2 space-y-1">
                      {extraCharges.map(c => (
                        <div key={c.id} className="flex justify-between text-[10px]">
                          <span className="text-slate-600">{c.label || t(lang, "lp.charge_unnamed", "Charge")}{c.allocate ? ` · ${t(lang, "lp.charge_allocate", "Add to landed cost")}` : ""}</span>
                          <span className="font-mono font-bold text-slate-700">{purchaseCurrency} {fmtMoney(Number(c.amount) || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-slate-200 bg-emerald-50/60 px-3 py-2 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wide text-emerald-800">{t(lang, "lp.grand_total", "Grand Total")}</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">{purchaseCurrency} {fmtMoney(grandTotalWithCharges)}</span>
                  </div>

                  {/* 4-stat totals grid */}
                  <div className="border-t border-slate-100 bg-slate-50/60">
                    <div className="grid grid-cols-5 divide-x divide-slate-100">
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.total_goods_lines", "Goods Items")}</span>
                        <strong className="block text-[11px] font-black text-slate-800 truncate">{draftItems.length}</strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.col_packages", "Total Qty")}</span>
                        <strong className="block text-[11px] font-black text-slate-800 truncate">
                          {draftItems.reduce((a,i)=>a+i.quantityKgs, 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.net_weight", "Net Weight")}</span>
                        <strong className="block text-[11px] font-black text-blue-700 truncate">
                          {(draftItems.reduce((a,i)=>a+i.netWeight, 0)).toLocaleString()} kg
                        </strong>
                      </div>
                      <div className="px-3 py-2 min-w-0">
                        <span className="block text-[7.5px] text-slate-400 uppercase font-bold tracking-wide">{t(lang, "lp.col_tax_amt", "Total Tax")}</span>
                        <strong className="block text-[11px] font-black text-amber-700 truncate">
                          {purchaseCurrency} {(draftItems.reduce((a,i)=>a+(i.taxAmount || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">{draftItems.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.col_packages", "Total Quantity")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">
                          {draftItems.reduce((a,i)=>a+i.quantityKgs, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.total_gross_wt", "Total Gross Wt")}</span>
                        <span className="font-bold text-right text-slate-800 dark:text-slate-100">
                          {(draftItems.reduce((a,i)=>a+i.totalGrossWeight, 0)).toLocaleString()} kg
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-slate-400">{t(lang, "lp.net_weight", "Total Net Wt")}</span>
                        <span className="font-bold text-right text-blue-700">
                          {(draftItems.reduce((a,i)=>a+i.netWeight, 0)).toLocaleString()} kg
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
                <div id="printable-lp-voucher" className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5 text-slate-800 dark:text-slate-100">
                  {/* Voucher Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 dark:border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        LP
                      </div>
                      <div>
                        <h2 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">
                          {activeBranch?.companyName || activeBranch?.name || "—"}
                        </h2>
                        <p className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                          {activeBranch?.name || "—"} &bull; {[scopeLabels.city, scopeLabels.country].filter(Boolean).join(", ") || "—"}
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
                          {`CA-${(scopeLabels.country || "LOC").slice(0, 3).toUpperCase()}-2026-${String(purchases.filter(p => p.country_id === activeBranch?.countryId).length + 1).padStart(5, "0")}`}
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
                      <span>{draftItems.length} Line(s)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px] whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[8.5px] font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <Th className="p-2 text-center">#</Th>
                            <Th className="p-2">Goods Item</Th>
                            <Th className="p-2">Size</Th>
                            <Th className="p-2">Brand</Th>
                            <Th className="p-2">Origin</Th>
                            <Th className="p-2 text-right">Packages</Th>
                            <Th className="p-2 text-right">Gross Wt</Th>
                            <Th className="p-2 text-right">Net Wt</Th>
                            <Th className="p-2 text-right">Rate</Th>
                            <Th className="p-2 text-right">Amount ({purchaseCurrency})</Th>
                            <Th className="p-2 text-center">Tax</Th>
                            <Th className="p-2 text-right">Total ({purchaseCurrency})</Th>
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
                              <td colSpan={14} className="p-3 text-center text-[10px] text-slate-400">
                                {t(lang, "lp.no_goods_lines", "No goods lines added yet.")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black border-t-2 border-slate-300 dark:border-slate-700">
                          <tr>
                            <td colSpan={5} className="p-2 uppercase text-slate-600 dark:text-slate-300">Total Goods Manifest</td>
                            <td className="p-2 text-right font-mono">
                              {(draftItems.reduce((a,i)=>a+i.quantityKgs, 0)).toLocaleString()}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {(draftItems.reduce((a,i)=>a+i.totalGrossWeight, 0)).toLocaleString()} kg
                            </td>
                            <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-400">
                              {(draftItems.reduce((a,i)=>a+i.netWeight, 0)).toLocaleString()} kg
                            </td>
                            <td className="p-2 text-right">—</td>
                            <td className="p-2 text-right font-mono">
                              {purchaseCurrency} {(draftItems.reduce((a,i)=>a+(i.purchaseCost||0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center font-mono">
                              {purchaseCurrency} {(draftItems.reduce((a,i)=>a+(i.taxAmount||0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                              {purchaseCurrency} {combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Additional charges + landed-cost allocation (display only; posting is unchanged) */}
                  {(extraCharges.length > 0 || landedLines.length > 0) && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        {t(lang, "lp.landed_title", "Charges & Landed Cost")}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-[8.5px] font-extrabold uppercase text-slate-600 border-b border-slate-200">
                            <tr>
                              <Th className="p-2 text-start">{t(lang, "lp.col_goods_item", "Goods Item")}</Th>
                              <Th className="p-2 text-end">{t(lang, "lp.landed_base", "Bill Amount")}</Th>
                              <Th className="p-2 text-end">{t(lang, "lp.landed_alloc", "Allocated Charges")}</Th>
                              <Th className="p-2 text-end">{t(lang, "lp.landed_cost", "Landed Cost")}</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {landedLines.map(l => (
                              <tr key={l.item.id}>
                                <td className="p-2 font-semibold">{l.item.goodsName}</td>
                                <td className="p-2 text-end font-mono">{fmtMoney(l.base)}</td>
                                <td className="p-2 text-end font-mono">{fmtMoney(l.alloc)}</td>
                                <td className="p-2 text-end font-mono font-black text-emerald-700">{fmtMoney(l.landed)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200">
                            {extraCharges.map(c => (
                              <tr key={c.id}>
                                <td colSpan={3} className="p-2 font-semibold text-slate-600">{c.label || t(lang, "lp.charge_unnamed", "Charge")}{c.allocate ? ` · ${t(lang, "lp.charge_allocate", "Add to landed cost")}` : ""}</td>
                                <td className="p-2 text-end font-mono">{fmtMoney(Number(c.amount) || 0)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={3} className="p-2 uppercase text-slate-700">{t(lang, "lp.grand_total", "Grand Total")}</td>
                              <td className="p-2 text-end font-mono text-emerald-700">{purchaseCurrency} {fmtMoney(grandTotalWithCharges)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <p className="px-3 py-2 text-[9px] text-slate-400">
                        {t(lang, "lp.landed_note", "Landed cost is a costing view only. The posted journal below uses the goods bill amount.")}
                      </p>
                    </div>
                  )}

                  {/* Double-Entry Ledger Posting Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex justify-between">
                      <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-blue-600" /> Accounting Double-Entry Journal Breakdown</span>
                      <span className="text-emerald-600">Balanced (DR = CR)</span>
                    </div>
                    <table className="w-full text-left text-[10px] whitespace-nowrap">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[8.5px] font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <Th className="p-2">Account Code</Th>
                          <Th className="p-2">Account Title</Th>
                          <Th className="p-2">Posting Type</Th>
                          <Th className="p-2 text-right">Debit (DR) {purchaseCurrency}</Th>
                          <Th className="p-2 text-right">Credit (CR) {purchaseCurrency}</Th>
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
            <div className="space-y-6">
              <div className="space-y-4">
              {/* TOP COUNTRY SELECTOR & ARCHITECTURE BAR */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-blue-600" />
                    <span>{t(lang, "lp.reg_select_country", "Select Country:")}</span>
                  </span>

                  {/* All Countries Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountryId("");
                      setSelectedBranchId("");
                      setSelectedCityBranchId("");
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border shadow-2xs",
                      !selectedCountryId
                        ? "bg-blue-600 text-white border-blue-600 font-extrabold shadow-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span>🌐</span>
                    <span>{tr("All Countries")}</span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded text-[10px] font-mono",
                      !selectedCountryId ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}>
                      {t(lang, "lp.reg_n_bills", "{n} bills").replace("{n}", String(superAdminStats.totalPurchasesCount))} &middot; ${superAdminStats.totalUsdAmount.toLocaleString()}
                    </span>
                  </button>

                  {/* Individual Configured Countries */}
                  {superAdminCountrySummary.map((c) => {
                    const isSelected = selectedCountryId === c.id || (activeCountryObj && normalizeCountryKey(activeCountryObj.name) === normalizeCountryKey(c.country));

                    return (
                      <button
                        key={c.country}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCountryId("");
                            setSelectedBranchId("");
                            setSelectedCityBranchId("");
                          } else {
                            setSelectedCountryId(c.id);
                            setSelectedBranchId("");
                            setSelectedCityBranchId("");
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border shadow-2xs",
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 font-extrabold shadow-blue-500/20"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50/60 dark:hover:bg-slate-800/80"
                        )}
                        title={t(lang, "lp.reg_click_view_arch", "Click to view {country} branch architecture and purchases").replace("{country}", c.country)}
                      >
                        <span>{getCountryFlag(c.country)}</span>
                        <span>{c.country}</span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-mono",
                          isSelected ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
                        )}>
                          {t(lang, "lp.reg_n_bills", "{n} bills").replace("{n}", String(c.totalPurchases))} {c.totalPurchases > 0 ? `(${c.currency} ${c.totalAmountLocal.toLocaleString()})` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Toggle Full Country Summary Table if needed */}
                <button
                  type="button"
                  onClick={() => setShowFullCountryMatrix(prev => !prev)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border shadow-2xs ms-auto",
                    showFullCountryMatrix
                      ? "bg-amber-500 text-white border-amber-500 font-black"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900"
                  )}
                  title={tr("Toggle overall country USD summary table")}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{showFullCountryMatrix ? t(lang, "lp.reg_hide_matrix", "Hide Summary Matrix") : t(lang, "lp.reg_country_matrix", "Country Summary Matrix")}</span>
                </button>
              </div>

              {/* CONDITIONAL TABLE 1: COUNTRY WISE PURCHASE SUMMARY (USD) */}
              {showFullCountryMatrix && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden animate-in fade-in">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                          {th("COUNTRY WISE PURCHASE SUMMARY (USD)")}
                        </h3>
                        <p className="text-[10.5px] text-slate-400 font-medium">
                          {t(lang, "lp.reg_matrix_sub", "Configured business countries & operational branches summary")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFullCountryMatrix(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 transition cursor-pointer"
                    >
                      ✕ {t(lang, "lp.reg_close_matrix", "Close Matrix")}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs whitespace-nowrap border-collapse">
                      <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <Th className="px-3 py-2.5 text-center w-10">#</Th>
                          <Th className="px-3 py-2.5">{t(lang, "common.country", "COUNTRY")}</Th>
                          <Th className="px-3 py-2.5 text-center">{t(lang, "common.code", "CODE")}</Th>
                          <Th className="px-3 py-2.5 text-center">{th("TOTAL PURCHASES")}</Th>
                          <Th className="px-3 py-2.5 text-end">{th("TOTAL AMOUNT (LOCAL)")}</Th>
                          <Th className="px-3 py-2.5 text-end">{th("TOTAL AMOUNT (USD)")}</Th>
                          <Th className="px-3 py-2.5 text-center">{th("POSTED")}</Th>
                          <Th className="px-3 py-2.5 text-center">{th("DRAFT")}</Th>
                          <Th className="px-3 py-2.5 text-center text-red-600">{th("PENDING")}</Th>
                          <Th className="px-3 py-2.5 text-center w-16">{t(lang, "common.actions", "ACTIONS")}</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {superAdminCountrySummary.map((c, idx) => {
                          const isExpanded = expandedCountryKey === c.country;
                          const isSelected = selectedCountryId === c.id || (activeCountryObj && normalizeCountryKey(activeCountryObj.name) === normalizeCountryKey(c.country));
                          return (
                            <React.Fragment key={c.country}>
                              <tr
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedCountryId("");
                                    setSelectedBranchId("");
                                    setSelectedCityBranchId("");
                                  } else {
                                    setSelectedCountryId(c.id);
                                    setSelectedBranchId("");
                                    setSelectedCityBranchId("");
                                  }
                                }}
                                className={cn(
                                  "hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer",
                                  isExpanded && "bg-blue-50/30 dark:bg-blue-950/20 font-semibold",
                                  isSelected && "bg-blue-50/80 dark:bg-blue-950/40 border-s-4 border-s-blue-600 font-bold"
                                )}
                                title={t(lang, "lp.reg_click_filter_for", "Click to filter bills list below for {country}").replace("{country}", c.country)}
                              >
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                                  <div className="flex items-center justify-center gap-1">
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                    )}
                                    <span>{idx + 1}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{getCountryFlag(c.country)}</span>
                                    <span>{c.country}</span>
                                    {isSelected && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-600 text-white">
                                        {t(lang, "lp.reg_active_filter", "Active Filter")}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{c.code}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{c.totalPurchases}</td>
                                <td className="px-3 py-2.5 text-end font-mono text-slate-700 dark:text-slate-300">
                                  {c.currency} {c.totalAmountLocal.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                                  $ {c.totalAmountUsd.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-600">{c.posted}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-600">{c.draft}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-red-600">{c.pending}</td>
                                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedCountryKey(prev => prev === c.country ? null : c.country)}
                                      className="h-6 px-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                      title={`Expand ${c.country} details`}
                                    >
                                      {isExpanded ? t(lang, "lp.reg_collapse", "Collapse") : t(lang, "lp.reg_details", "Details")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedCountryId("");
                                          setSelectedBranchId("");
                                          setSelectedCityBranchId("");
                                        } else {
                                          setSelectedCountryId(c.id);
                                          setSelectedBranchId("");
                                          setSelectedCityBranchId("");
                                        }
                                      }}
                                      className={cn(
                                        "h-6 px-2 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border shadow-2xs",
                                        isSelected
                                          ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                                          : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/60 dark:border-blue-800"
                                      )}
                                      title={t(lang, "lp.reg_filter_bills_for", "Filter bills below for {country}").replace("{country}", c.country)}
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>{isSelected ? t(lang, "lp.reg_showing_word", "Showing") : t(lang, "lp.reg_bills", "Bills")}</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* EXPANDABLE DRILLDOWN SUB-ROW: MAIN BRANCH & CITY BRANCHES */}
                              {isExpanded && (
                                <tr className="bg-slate-50/90 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                                  <td colSpan={10} className="p-3.5">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-xs space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                          <span className="text-base">{getCountryFlag(c.country)}</span>
                                          <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                            {c.country} &mdash; {t(lang, "lp.reg_arch_title", "Branch Architecture & Purchases")}
                                          </span>
                                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                            {t(lang, "lp.reg_main_city_count", "{main} Main • {city} City Branches").replace("{main}", String(c.mainBranchList.length)).replace("{city}", String(c.cityBranchList.length))}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs">
                                          <div className="text-slate-600 dark:text-slate-400">
                                            {t(lang, "lp.reg_total_purchases", "Total Purchases")}: <strong className="font-mono text-slate-900 dark:text-slate-100">{c.currency} {c.totalAmountLocal.toLocaleString()}</strong>
                                          </div>
                                          <div className="text-emerald-700 dark:text-emerald-400">
                                            {t(lang, "lp.reg_paid", "Paid")}: <strong className="font-mono">{c.currency} {c.paidAmount.toLocaleString()}</strong>
                                          </div>
                                          <div className="text-amber-700 dark:text-amber-400">
                                            {t(lang, "lp.reg_remaining", "Remaining")}: <strong className="font-mono">{c.currency} {c.remainingAmount.toLocaleString()}</strong>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Main Branch & City Branches Subtable */}
                                      <div className="space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                          {t(lang, "lp.reg_sec_main", "1. Country Main Branch")}
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-start text-xs whitespace-nowrap">
                                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                              <tr>
                                                <Th className="px-3 py-2">{t(lang, "lp.reg_th_branch_name", "Branch Name")}</Th>
                                                <Th className="px-3 py-2 text-center">{t(lang, "common.code", "Code")}</Th>
                                                <Th className="px-3 py-2 text-center">{t(lang, "lp.reg_th_type", "Type")}</Th>
                                                <Th className="px-3 py-2 text-center">{t(lang, "lp.total_bills", "Total Bills")}</Th>
                                                <Th className="px-3 py-2 text-end">{t(lang, "lp.reg_th_total_purchase", "Total Purchase")} ({c.currency})</Th>
                                                <Th className="px-3 py-2 text-center">{t(lang, "common.actions", "Action")}</Th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                                              {c.mainBranchList.map((mb: any) => (
                                                <tr key={mb.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{mb.name}</td>
                                                  <td className="px-3 py-2 text-center font-mono text-slate-500">{mb.code}</td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-100 text-blue-700">
                                                      {t(lang, "lp.reg_main_branch", "Main Branch")}
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-center font-mono font-bold">{mb.billsCount}</td>
                                                  <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    {mb.totalAmount.toLocaleString()}
                                                  </td>
                                                  <td className="px-3 py-2 text-center">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedCountryId(c.id);
                                                        setSelectedBranchId(mb.id);
                                                        setSelectedCityBranchId("");
                                                      }}
                                                      className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold transition cursor-pointer"
                                                    >
                                                      {t(lang, "lp.reg_filter_branch", "Filter Branch")}
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>

                                        {c.cityBranchList.length > 0 && (
                                          <>
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 pt-2">
                                              {t(lang, "lp.reg_sec_city", "2. Business City Branches")}
                                            </div>
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-start text-xs whitespace-nowrap">
                                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                                  <tr>
                                                    <Th className="px-3 py-2">{t(lang, "lp.reg_th_city_branch_name", "City Branch Name")}</Th>
                                                    <Th className="px-3 py-2">{t(lang, "lp.reg_th_city", "City")}</Th>
                                                    <Th className="px-3 py-2 text-center">{t(lang, "common.code", "Code")}</Th>
                                                    <Th className="px-3 py-2 text-center">{t(lang, "lp.reg_th_category", "Category")}</Th>
                                                    <Th className="px-3 py-2 text-center">{t(lang, "lp.total_bills", "Total Bills")}</Th>
                                                    <Th className="px-3 py-2 text-end">{t(lang, "lp.reg_th_total_purchase", "Total Purchase")} ({c.currency})</Th>
                                                    <Th className="px-3 py-2 text-center">{t(lang, "common.actions", "Action")}</Th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                                                  {c.cityBranchList.map((cb: any) => (
                                                    <tr key={cb.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                                                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{cb.name}</td>
                                                      <td className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">{cb.cityName}</td>
                                                      <td className="px-3 py-2 text-center font-mono text-slate-500">{cb.code}</td>
                                                      <td className="px-3 py-2 text-center">
                                                        {cb.isBusinessBranch ? (
                                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                                                            {t(lang, "lp.reg_biz_city_branch", "Business City Branch")}
                                                          </span>
                                                        ) : (
                                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-700">
                                                            {t(lang, "lp.reg_shipping_clearing", "Shipping & Clearing")}
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-2 text-center font-mono font-bold">{cb.billsCount}</td>
                                                      <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        {cb.totalAmount.toLocaleString()}
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setSelectedCountryId(c.id);
                                                            setSelectedCityBranchId(cb.id);
                                                          }}
                                                          className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition cursor-pointer"
                                                        >
                                                          {t(lang, "lp.reg_filter_city_branch", "Filter City Branch")}
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}

                        {/* AUTHENTIC DYNAMIC TOTAL ROW */}
                        <tr className="bg-amber-100/70 dark:bg-amber-950/40 font-black text-[11px] border-t-2 border-amber-300 dark:border-amber-700">
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                          <td className="px-3 py-2.5 font-black text-slate-900 dark:text-slate-100">TOTAL</td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                          <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900 dark:text-slate-100">
                            {superAdminStats.totalPurchasesCount}
                          </td>
                          <td className="px-3 py-2.5 text-end font-mono text-slate-500">-</td>
                          <td className="px-3 py-2.5 text-end font-mono font-black text-slate-900 dark:text-slate-100">
                            $ {superAdminStats.totalUsdAmount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700 dark:text-emerald-400">
                            {superAdminStats.posted}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-black text-amber-700 dark:text-amber-400">
                            {superAdminStats.draft}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-black text-red-600">
                            {superAdminStats.pending}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-500">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DEDICATED COUNTRY & BRANCH ARCHITECTURE BREAKDOWN PANEL (When a Country is Selected) */}
              {activeCountrySummary && (
                <div className="bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900 dark:to-slate-800/60 rounded-2xl border border-blue-200/90 dark:border-blue-900/60 p-4 shadow-xs space-y-4 animate-in fade-in duration-200">
                  {/* Top Header of Country Breakdown */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-blue-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-xs">
                        {getCountryFlag(activeCountrySummary.country)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            {activeCountrySummary.country}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {activeCountrySummary.currency}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {t(lang, "lp.reg_main_branch_n", "{main} Main Branch • {city} City Branches").replace("{main}", String(activeCountrySummary.mainBranchList.length)).replace("{city}", String(activeCountrySummary.cityBranchList.length))}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {t(lang, "lp.reg_arch_sub", "Country & Branch Operational Architecture · Super Admin Breakdown")}
                        </p>
                      </div>
                    </div>

                    {/* Quick Summary Metrics & Close Action */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs font-semibold">
                        <div>
                          <span className="text-slate-400 text-[10px] block font-medium">{t(lang, "lp.reg_purchases_lbl", "Purchases")}:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{activeCountrySummary.totalPurchases}</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <span className="text-slate-400 text-[10px] block font-medium">{t(lang, "lp.reg_total_cur", "Total ({cur})").replace("{cur}", activeCountrySummary.currency)}:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{activeCountrySummary.totalAmountLocal.toLocaleString()}</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <span className="text-slate-400 text-[10px] block font-medium">{t(lang, "lp.reg_usd_value", "USD Value")}:</span>
                          <span className="font-mono font-bold text-emerald-600">${activeCountrySummary.totalAmountUsd.toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCountryId("");
                          setSelectedBranchId("");
                          setSelectedCityBranchId("");
                        }}
                        className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title={tr("Show All Countries")}
                      >
                        <X className="h-3.5 w-3.5 text-slate-500" />
                        <span>{tr("Show All Countries")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Two-part layout: Main Branch on Left/Top, Business City Branches on Right/Bottom */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    {/* 1. Country Main Branch Card */}
                    <div className="md:col-span-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/90 dark:border-slate-700 p-3.5 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Country Main Branch
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Primary / HQ
                        </span>
                      </div>

                      {activeCountrySummary.mainBranchList.map((mbr: any) => {
                        const isMainSelected = selectedBranchId === mbr.id && !selectedCityBranchId;
                        return (
                          <div key={mbr.id} className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/50 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{mbr.name}</h4>
                                <span className="text-[10px] font-mono text-slate-400 font-semibold">{mbr.code}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isMainSelected) {
                                    setSelectedBranchId("");
                                  } else {
                                    setSelectedBranchId(mbr.id);
                                    setSelectedCityBranchId("");
                                  }
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer",
                                  isMainSelected
                                    ? "bg-blue-600 text-white shadow-2xs"
                                    : "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 hover:bg-blue-50"
                                )}
                              >
                                <Eye className="h-3 w-3" />
                                <span>{isMainSelected ? "Active Filter" : "Filter Branch"}</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1 border-t border-slate-200/60 dark:border-slate-800 font-semibold">
                              <div>
                                <span className="text-slate-400 text-[9.5px] block font-medium">Branch Bills:</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">{mbr.billsCount} bills</span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[9.5px] block font-medium">Branch Purchases:</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">{activeCountrySummary.currency} {mbr.totalAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 2. Business City Branches */}
                    <div className="md:col-span-7 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/90 dark:border-slate-700 p-3.5 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                            <Warehouse className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Business City Branches ({activeCountrySummary.cityBranchList.length})
                          </span>
                        </div>
                        {selectedCityBranchId && (
                          <button
                            type="button"
                            onClick={() => setSelectedCityBranchId("")}
                            className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                          >
                            Clear City Filter
                          </button>
                        )}
                      </div>

                      {activeCountrySummary.cityBranchList.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No city branches registered under {activeCountrySummary.country}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeCountrySummary.cityBranchList.map((cb: any) => {
                            const isCitySelected = selectedCityBranchId === cb.id;
                            return (
                              <div
                                key={cb.id}
                                onClick={() => setSelectedCityBranchId(isCitySelected ? "" : cb.id)}
                                className={cn(
                                  "p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2",
                                  isCitySelected
                                    ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-2xs"
                                    : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700/60 hover:bg-blue-50/30"
                                )}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{cb.name}</span>
                                      {cb.isBusinessBranch ? (
                                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                          Business
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                          Shipping
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      City: <strong className="text-slate-600 dark:text-slate-300">{cb.cityName}</strong> &middot; <span className="font-mono">{cb.code}</span>
                                    </span>
                                  </div>
                                  {isCitySelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                  <span>{cb.billsCount} bills</span>
                                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {activeCountrySummary.currency} {cb.totalAmount.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

              {/* TABLE 2: ALL COUNTRIES LOCAL PURCHASE LIST */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="h-7 w-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                        {activeCountryObj
                          ? `${activeCountryObj.name} · ${t(lang, "lp.reg_list_title", "Local Purchase List")}`
                          : t(lang, "lp.reg_all_countries_list", "All Countries Local Purchase List")}
                      </h3>
                      {activeCountryObj && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <span>{getCountryFlag(activeCountryObj.name)}</span>
                          <span>{activeCountryObj.name}</span>
                          <span className="opacity-75 font-mono">({filteredPurchases.length} {filteredPurchases.length === 1 ? t(lang, "lp.reg_bill", "Bill") : t(lang, "lp.reg_bills", "Bills")})</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCountryId("");
                              setSelectedBranchId("");
                            }}
                            className="hover:text-red-600 ms-1 cursor-pointer font-black"
                            title={tr("Clear country filter")}
                          >
                            ✕
                          </button>
                        </span>
                      )}
                    </div>
                  </div>

                  <JournalPrintButton
                    title={activeCountryObj ? `${activeCountryObj.name.toUpperCase()} LOCAL PURCHASE REGISTER` : t(lang, "lp.local_branch_purchase_register", "LOCAL BRANCH PURCHASE REGISTER")}
                    subtitle={t(lang, "lp.a4_print_title", "Official A4 ERP Journal Print Report — Local Purchase Register")}
                    columns={[
                      { key: "voucherNo", label: t(lang, "lp.col_voucher_no", "Voucher No"), align: "left" },
                      { key: "date", label: t(lang, "lp.col_date", "Date"), align: "left" },
                      { key: "supplier", label: t(lang, "lp.col_supplier", "Supplier"), align: "left" },
                      { key: "goods", label: t(lang, "lp.col_goods_name", "Goods Name"), align: "left" },
                      { key: "qty", label: t(lang, "lp.col_quantity", "Quantity"), align: "right" },
                      { key: "finalAmount", label: t(lang, "lp.col_final_amount", "Final Amount"), align: "right" },
                      { key: "status", label: t(lang, "lp.col_status", "Status"), align: "center" }
                    ]}
                    rows={filteredPurchases.map((p) => {
                      const billCurr = p.purchase_currency || p.local_currency || p.localCurrency || "AED";
                      const billAmt = Number(p.final_cost || p.purchase_cost || 0);
                      return {
                        voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                        date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                        supplier: p.supplier_name || "—",
                        goods: p.goods_name || "—",
                        qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                        finalAmount: `${billCurr} ${billAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        status: (p.status || "DRAFT").toUpperCase()
                      };
                    })}
                    variant="outline" size="sm" className="h-8"
                  />
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
                      <span>{t(lang, "lp.reg_table_actions", "Table Actions")}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>

                    {showTableActionsMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute end-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in space-y-1 text-xs font-semibold"
                      >
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                            {t(lang, "lp.reg_page_size", "Page Size")}
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
                            title={activeCountryObj ? `${activeCountryObj.name.toUpperCase()} LOCAL PURCHASE REGISTER` : t(lang, "lp.local_branch_purchase_register", "LOCAL BRANCH PURCHASE REGISTER")}
                            subtitle={t(lang, "lp.a4_print_title", "Official A4 ERP Journal Print Report — Local Purchase Register")}
                            columns={[
                              { key: "voucherNo", label: t(lang, "lp.col_voucher_no", "Voucher No"), align: "left" },
                              { key: "date", label: t(lang, "lp.col_date", "Date"), align: "left" },
                              { key: "supplier", label: t(lang, "lp.col_supplier", "Supplier"), align: "left" },
                              { key: "goods", label: t(lang, "lp.col_goods_name", "Goods Name"), align: "left" },
                              { key: "qty", label: t(lang, "lp.col_quantity", "Quantity"), align: "right" },
                              { key: "finalAmount", label: t(lang, "lp.col_final_amount", "Final Amount"), align: "right" },
                              { key: "status", label: t(lang, "lp.col_status", "Status"), align: "center" }
                            ]}
                            rows={filteredPurchases.map((p) => {
                              const billCurr = p.purchase_currency || p.local_currency || p.localCurrency || "AED";
                              const billAmt = Number(p.final_cost || p.purchase_cost || 0);
                              return {
                                voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                                date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                                supplier: p.supplier_name || "—",
                                goods: p.goods_name || "—",
                                qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                                finalAmount: `${billCurr} ${billAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                status: (p.status || "DRAFT").toUpperCase()
                              };
                            })}
                            variant="ghost"
                            className="w-full justify-start text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 h-8 px-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs whitespace-nowrap border-collapse">
                    <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <Th className="px-2.5 py-2.5 text-center w-8">
                          <input
                            type="checkbox"
                            checked={allCurrentPageSelected}
                            onChange={toggleSelectAll}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer accent-blue-600 transition"
                          />
                        </Th>
                        <Th className="px-2 py-2.5 text-center w-10">#</Th>
                        <Th className="px-3 py-2.5">{t(lang, "common.country", "COUNTRY")}</Th>
                        <Th className="px-3 py-2.5">{t(lang, "common.branch", "BRANCH")}</Th>
                        <Th className="px-3 py-2.5">{t(lang, "lp.col_voucher_no", "VOUCHER NO")}</Th>
                        <Th className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1">
                            {t(lang, "lp.col_date", "DATE")}
                            <span className="text-[10px] text-slate-400">⇅</span>
                          </span>
                        </Th>
                        <Th className="px-3 py-2.5">{t(lang, "lp.col_supplier_name", "SUPPLIER NAME")}</Th>
                        <Th className="px-3 py-2.5">{t(lang, "lp.col_goods_name", "GOODS NAME")}</Th>
                        <Th className="px-2.5 py-2.5 text-end">{t(lang, "lp.col_qty", "QTY")}</Th>
                        <Th className="px-2.5 py-2.5 text-center">{t(lang, "lp.col_unit", "UNIT")}</Th>
                        <Th className="px-3 py-2.5 text-end">{th("FINAL AMOUNT")}</Th>
                        <Th className="px-3 py-2.5 text-center">{t(lang, "lp.col_status", "STATUS")}</Th>
                        <Th className="px-3 py-2.5 text-center w-16">{t(lang, "common.actions", "ACTIONS")}</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {paginatedPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-4 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {t(lang, "lp.reg_no_records", "No local purchase records found")}
                              </p>
                              <p className="text-xs text-slate-400 max-w-sm">
                                {t(lang, "lp.reg_no_records_hint", "No purchases recorded yet.")}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedPurchases.map((p, idx) => {
                          const billCurr = p.purchase_currency || p.local_currency || p.localCurrency || "AED";
                          const billAmt = Number(p.final_cost || p.purchase_cost || 0);
                          const row = {
                            id: p.id,
                            country: p.country_name || p.countryName || "—",
                            branch: p.branch_name || p.branchName || "—",
                            voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                            supplier: p.supplier_name || p.supplierName || "—",
                            goods: p.goods_name || p.goodsName || "—",
                            qty: Number(p.quantity_kgs || p.quantityKgs || 0),
                            unit: p.quantity_name || p.quantityName || "—",
                            amountFormatted: `${billCurr} ${billAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            status: p.status || "—",
                            raw: p,
                          };
                          const isRowSelected = selectedRowIds.has(row.id);
                          const rowNum = (currentPage - 1) * pageSize + idx + 1;
                          return (
                            <tr
                              key={row.id}
                              className={cn(
                                "hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors",
                                isRowSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                              )}
                            >
                              <td className="px-2.5 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isRowSelected}
                                  onChange={() => {
                                    const next = new Set(selectedRowIds);
                                    if (next.has(row.id)) next.delete(row.id);
                                    else next.add(row.id);
                                    setSelectedRowIds(next);
                                  }}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer accent-blue-600 transition"
                                />
                              </td>
                              <td className="px-2 py-2 text-center font-mono font-bold text-slate-400">{rowNum}</td>
                              <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{row.country}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.branch}</td>
                              <td className="px-3 py-2 font-mono font-bold">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRowForVoucher(row.raw)}
                                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  {row.voucherNo}
                                </button>
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{row.date}</td>
                              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{row.supplier}</td>
                              <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">{row.goods}</td>
                              <td className="px-2.5 py-2 text-end font-mono font-bold text-slate-800 dark:text-slate-200">{row.qty}</td>
                              <td className="px-2.5 py-2 text-center text-slate-500 dark:text-slate-400">{row.unit}</td>
                              <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-slate-100">{row.amountFormatted}</td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  const st = (row.status || "").toLowerCase();
                                  if (st === "posted") {
                                    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">{t(lang, "lp.reg_status_posted", "Posted")}</span>;
                                  }
                                  if (st === "draft") {
                                    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">{t(lang, "lp.reg_status_draft", "Draft")}</span>;
                                  }
                                  if (st === "pending") {
                                    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{t(lang, "lp.reg_status_pending", "Pending")}</span>;
                                  }
                                  if (st === "accepted") {
                                    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">{t(lang, "lp.reg_status_accepted", "Accepted")}</span>;
                                  }
                                  return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{row.status}</span>;
                                })()}
                              </td>
                              <td className="px-3 py-2 text-center relative" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block text-left">
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionRowId(prev => prev === row.id ? null : row.id)}
                                    className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs cursor-pointer mx-auto"
                                    title={tr("Actions")}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>

                                  {openActionRowId === row.id && (
                                    <div className="absolute end-0 top-full mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 shadow-xl z-50 animate-in fade-in space-y-0.5 text-xs font-semibold text-left">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionRowId(null);
                                          if (row.raw) setSelectedRowForVoucher(row.raw);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-xs font-medium transition cursor-pointer"
                                      >
                                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                                        <span>{tr("View Voucher")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionRowId(null);
                                          loadRowIntoForm(row.raw);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-sky-600 text-xs font-medium transition cursor-pointer"
                                      >
                                        <Edit3 className="h-3.5 w-3.5 text-sky-500" />
                                        <span>{tr("Edit Bill")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionRowId(null);
                                          if (row.raw) {
                                            setHandoverTargetRow(row.raw);
                                            setHandoverModalOpen(true);
                                          }
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 text-xs font-medium transition cursor-pointer"
                                      >
                                        <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                                        <span>{tr("Handover")}</span>
                                      </button>
                                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setOpenActionRowId(null);
                                          if (!confirm(t(lang, "lp.reg_delete_confirm", "Are you sure you want to delete this purchase entry?"))) return;
                                          if (row.raw?.id) {
                                            try {
                                              const res = await fetch(`/api/erp/purchases/local-purchase?id=${row.raw.id}`, { method: "DELETE" });
                                              const data = await res.json();
                                              if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to delete.");
                                              setPurchases((prev: any[]) => prev.filter((p: any) => p.id !== row.raw.id));
                                            } catch (err: any) {
                                              alert(err.message);
                                            }
                                          }
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-medium transition cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                        <span>{tr("Delete")}</span>
                                      </button>
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

                {/* Table 2 Footer & Rows Per Page Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      {t(lang, "ujr.showing_range", "Showing {from} to {to} of {count} entries")
                        .replace("{from}", String(filteredPurchases.length > 0 ? (currentPage - 1) * pageSize + 1 : 0))
                        .replace("{to}", String(Math.min(currentPage * pageSize, filteredPurchases.length)))
                        .replace("{count}", String(filteredPurchases.length))}
                    </span>
                    <div className="flex items-center gap-1.5 ms-2 ps-3 border-s border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t(lang, "bankroz.rows_per_page", "Rows per page:")}</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {t(lang, "lp.reg_page_of", "Page {page} of {total}").replace("{page}", String(filteredPurchases.length > 0 ? currentPage : 0)).replace("{total}", String(totalPages))}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <ChevronRight className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" /><span>{t(lang, "common.previous", "Previous")}</span>
                      </button>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages || filteredPurchases.length === 0}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <span>{t(lang, "common.next", "Next")}</span><ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </button>
                    </div>
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
                      {t(lang, "lp.reg_list_title", "Local Purchase List")}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      All local purchase bills for {activeBranch?.name || activeBranch?.branch_name || "Afghanistan Main Branch"}
                    </p>
                  </div>
                </div>

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
                          rows={filteredPurchases.map((p) => ({
                            voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                            supplier: p.supplier_name || "—",
                            goods: p.goods_name || "—",
                            brand: p.brand || "—",
                            qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                            finalAmount: Number(p.final_cost || p.purchase_cost || 0),
                            status: (p.status || "DRAFT").toUpperCase()
                          }))}
                          variant="outline" size="sm" className="h-8"
                        />
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
                    <span>{t(lang, "lp.reg_table_actions", "Table Actions")}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>

                  {showTableActionsMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute end-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in space-y-1 text-xs font-semibold"
                    >
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                          {t(lang, "lp.reg_page_size", "Page Size")}
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
                          rows={filteredPurchases.map((p) => ({
                            voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                            date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                            supplier: p.supplier_name || "—",
                            goods: p.goods_name || "—",
                            brand: p.brand || "—",
                            qty: `${Number(p.quantity_kgs || 0).toLocaleString()} ${p.quantity_name || "—"}`,
                            finalAmount: Number(p.final_cost || p.purchase_cost || 0),
                            status: (p.status || "DRAFT").toUpperCase()
                          }))}
                          variant="ghost"
                          className="w-full justify-start text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 h-8 px-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-[10.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <Th className="px-2.5 py-2.5 text-center w-8">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAll}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer accent-blue-600 transition"
                        />
                      </Th>
                      <Th className="px-2 py-2.5 text-center w-10">#</Th>
                      <Th className="px-3 py-2.5">{t(lang, "lp.col_voucher_no", "VOUCHER NO")}</Th>
                      <Th className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {t(lang, "lp.col_date", "DATE")}
                          <span className="text-[10px] text-slate-400">⇅</span>
                        </span>
                      </Th>
                      <Th className="px-3 py-2.5">{t(lang, "lp.col_supplier_name", "SUPPLIER NAME")}</Th>
                      <Th className="px-3 py-2.5">{t(lang, "lp.col_goods_name", "GOODS NAME")}</Th>
                      <Th className="px-3 py-2.5">{t(lang, "lp.col_brand", "BRAND / SIZE")}</Th>
                      <Th className="px-2.5 py-2.5 text-end">{t(lang, "lp.col_qty", "QTY")}</Th>
                      <Th className="px-2.5 py-2.5 text-center">{t(lang, "lp.col_unit", "UNIT")}</Th>
                      <Th className="px-3 py-2.5 text-end">{t(lang, "lp.col_final_amount", "FINAL AMOUNT")}</Th>
                      <Th className="px-3 py-2.5 text-center">{t(lang, "lp.col_status", "STATUS")}</Th>
                      <Th className="px-3 py-2.5 text-center w-16">{t(lang, "common.actions", "ACTIONS")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {paginatedPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {t(lang, "lp.reg_no_records", "No local purchase records found")}
                            </p>
                            <p className="text-xs text-slate-400 max-w-sm">
                              {t(lang, "lp.reg_no_records_hint", "No purchases recorded yet.")}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedPurchases.map((p, idx) => {
                        const row = {
                          id: p.id,
                          voucherNo: p.journal_serial_no || p.serial_no || p.bill_no || "—",
                          date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-GB") : "—",
                          supplier: p.supplier_name || p.supplierName || "—",
                          goods: p.goods_name || p.goodsName || "—",
                          brand: p.brand || "—",
                          qty: Number(p.quantity_kgs || p.quantityKgs || 0),
                          unit: p.quantity_name || p.quantityName || "—",
                          amountFormatted: `${p.purchase_currency || localCurrency || "AFN"} ${Number(p.final_cost || p.finalCost || p.purchase_cost || 0).toLocaleString()}`,
                          status: p.status || "—",
                          raw: p,
                        };
                        const isRowSelected = selectedRowIds.has(row.id);
                        const rowNum = (currentPage - 1) * pageSize + idx + 1;
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors",
                              isRowSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                            )}
                          >
                            <td className="px-2.5 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isRowSelected}
                                onChange={() => {
                                  const next = new Set(selectedRowIds);
                                  if (next.has(row.id)) next.delete(row.id);
                                  else next.add(row.id);
                                  setSelectedRowIds(next);
                                }}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer accent-blue-600 transition"
                              />
                            </td>
                            <td className="px-2 py-2 text-center font-mono font-bold text-slate-400">{rowNum}</td>
                            <td className="px-3 py-2 font-mono font-bold">
                              <button
                                type="button"
                                onClick={() => setSelectedRowForVoucher(row.raw)}
                                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {row.voucherNo}
                              </button>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{row.date}</td>
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{row.supplier}</td>
                            <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">{row.goods}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.brand}</td>
                            <td className="px-2.5 py-2 text-end font-mono font-bold text-slate-800 dark:text-slate-200">{row.qty}</td>
                            <td className="px-2.5 py-2 text-center text-slate-500 dark:text-slate-400">{row.unit}</td>
                            <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-slate-100">{row.amountFormatted}</td>
                            <td className="px-3 py-2 text-center">
                              {(() => {
                                const st = (row.status || "").toLowerCase();
                                if (st === "posted") {
                                  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">{t(lang, "lp.reg_status_posted", "Posted")}</span>;
                                }
                                if (st === "draft") {
                                  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">{t(lang, "lp.reg_status_draft", "Draft")}</span>;
                                }
                                if (st === "pending") {
                                  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{t(lang, "lp.reg_status_pending", "Pending")}</span>;
                                }
                                if (st === "accepted") {
                                  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">{t(lang, "lp.reg_status_accepted", "Accepted")}</span>;
                                }
                                return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{row.status}</span>;
                              })()}
                            </td>
                            <td className="px-3 py-2 text-center relative" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={() => setOpenActionRowId(prev => prev === row.id ? null : row.id)}
                                  className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs cursor-pointer mx-auto"
                                  title={tr("Actions")}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </button>

                                {openActionRowId === row.id && (
                                  <div className="absolute end-0 top-full mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 shadow-xl z-50 animate-in fade-in space-y-0.5 text-xs font-semibold text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionRowId(null);
                                        if (row.raw) setSelectedRowForVoucher(row.raw);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-xs font-medium transition cursor-pointer"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-500" />
                                      <span>{tr("View Voucher")}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionRowId(null);
                                        loadRowIntoForm(row.raw);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-sky-600 text-xs font-medium transition cursor-pointer"
                                    >
                                      <Edit3 className="h-3.5 w-3.5 text-sky-500" />
                                      <span>{tr("Edit Bill")}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionRowId(null);
                                        if (row.raw) {
                                          setHandoverTargetRow(row.raw);
                                          setHandoverModalOpen(true);
                                        }
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 text-xs font-medium transition cursor-pointer"
                                    >
                                      <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                                      <span>{tr("Handover")}</span>
                                    </button>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        setOpenActionRowId(null);
                                        if (!confirm(t(lang, "lp.reg_delete_confirm", "Are you sure you want to delete this purchase entry?"))) return;
                                        if (row.raw?.id) {
                                          try {
                                            const res = await fetch(`/api/erp/purchases/local-purchase?id=${row.raw.id}`, { method: "DELETE" });
                                            const data = await res.json();
                                            if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to delete.");
                                            setPurchases((prev: any[]) => prev.filter((p: any) => p.id !== row.raw.id));
                                          } catch (err: any) {
                                            alert(err.message);
                                          }
                                        }
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-medium transition cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                      <span>{tr("Delete")}</span>
                                    </button>
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

              {/* Single Country Footer & Rows Per Page Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, "ujr.showing_range", "Showing {from} to {to} of {count} entries")
                        .replace("{from}", String(filteredPurchases.length > 0 ? (currentPage - 1) * pageSize + 1 : 0))
                        .replace("{to}", String(Math.min(currentPage * pageSize, filteredPurchases.length)))
                        .replace("{count}", String(filteredPurchases.length))}
                  </span>
                  <div className="flex items-center gap-1.5 ms-2 ps-3 border-s border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t(lang, "bankroz.rows_per_page", "Rows per page:")}</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {t(lang, "lp.reg_page_of", "Page {page} of {total}").replace("{page}", String(filteredPurchases.length > 0 ? currentPage : 0)).replace("{total}", String(totalPages))}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" /><span>{t(lang, "common.previous", "Previous")}</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || filteredPurchases.length === 0}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      className="h-9 sm:h-7 px-3 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <span>{t(lang, "common.next", "Next")}</span><ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </button>
                  </div>
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

      {showPostConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{t(lang, "lp.confirm_post_title", "Post this bill?")}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(lang, "lp.confirm_post_body", "This transfers the bill to Roznamcha and the General Ledger. Check the goods, amounts and accounts first.")}
            </p>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2.5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">{t(lang, "lp.total_goods_lines", "Goods Items")}</span><strong>{draftItems.length}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">{t(lang, "lp.final_amount_auto", "Final Amount")}</span><strong className="font-mono">{purchaseCurrency} {fmtMoney(combinedBillCost)}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowPostConfirm(false)} className="h-9 text-xs font-bold">
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button type="button" disabled={saving} onClick={() => handleSaveAndPostGL()} className="h-9 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white">
                {t(lang, "lp.confirm_post_btn", "Confirm & Post")}
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
                      loadRowIntoForm(row);
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



















