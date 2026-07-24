"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { fetchWarehouses } from "@/features/warehouses/warehouse-api";
import {
  ShoppingCart, Plus, Search, Scale, Coins,
  TrendingUp, User, CalendarDays, CheckCircle2,
  Trash2, Loader2, ArrowLeftRight, Check, Package,
  Building2, FileText, ArrowDownLeft, ArrowUpRight,
  Pin, X, Layers, Tag, Globe, Pencil, ShieldAlert,
  CreditCard, Truck, Flag, UserCheck, ChevronDown,
  ArrowRight, ArrowLeft, Percent, Warehouse, MapPin, ListPlus,
  Printer, Send, FileSpreadsheet, Eye, MoreVertical, Edit3
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CURRENCIES = ["USD", "AED", "PKR", "AFN", "INR", "IRR"];
const QUANTITY_NAMES = ["Bags", "Cartons", "Boxes", "Crates", "Bales", "Drums", "Pieces", "Custom"];
const PAYMENT_MODES = [
  { value: "Cash", label: "Cash" },
  { value: "Credit", label: "Credit" },
  { value: "Advance", label: "Advance" },
  { value: "Bank Transfer", label: "Bank Transfer" },
];
const SHIPPING_MODES = [
  { value: "Loading", label: "Loading" },
  { value: "Transfer Layout", label: "Transfer Layout" },
  { value: "Export", label: "Export" },
  { value: "Custom", label: "Custom Mode" },
];

const UAE_COUNTRY_MATCHERS = ["UNITED ARAB", "UAE", "EMIRATES", "AE"];

function isUaeCountryName(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  return UAE_COUNTRY_MATCHERS.some(token => normalized.includes(token));
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
  placeholder = "Select..."
}: MasterSelectPopoverProps) {
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
        <span className="truncate">{displayValue || placeholder}</span>
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
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 text-[11px] bg-slate-50 rounded-md border border-slate-200 outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-2 text-[10px] text-slate-400 text-center font-medium">No matches found</div>
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
  const [goodsList, setGoodsList] = useState<any[]>(initialGoodsList);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Stepper state: Step 1 (Items Entry) -> Step 2 (Settlement & Logistics) -> Step 3 (Printable A4 Voucher)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showCountryReport, setShowCountryReport] = useState(false);
  // Tabs for Local Purchase & Payment modules workflow
  const [activeTab, setActiveTab] = useState<"all" | "accepted" | "posted">("all");

  // Warehouse setup list and states
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [warehouseAccountNo, setWarehouseAccountNo] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Truck setup list and states
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const TRUCK_LIST = useMemo(() => [
    { id: "t-1", truckNo: "ABC-123", driverName: "Muhammad Ali", details: "Volvo 10-Wheeler (15 Ton)" },
    { id: "t-2", truckNo: "KBL-987", driverName: "Jan Agha", details: "Hino Rigid (10 Ton)" },
    { id: "t-3", truckNo: "DXB-777", driverName: "Saeed Al-Mansoori", details: "Scania Semi-Trailer (40 Ton)" },
    { id: "t-4", truckNo: "LHR-555", driverName: "Zahid Khan", details: "Mazda Titan (4 Ton)" }
  ], []);

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

  // Scope Selection Modal State
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeCountryId, setScopeCountryId] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState("");
  const [scopeCityBranchId, setScopeCityBranchId] = useState("");

  useEffect(() => {
    const handleClickOutside = () => setActiveActionMenuId(null);
    if (activeActionMenuId) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeActionMenuId]);

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
  const [applyTax, setApplyTax] = useState("No");
  const [taxType, setTaxType] = useState("VAT");
  const [taxPercentage, setTaxPercentage] = useState("0");

  // Sync initialGoodsList
  useEffect(() => {
    setGoodsList(initialGoodsList);
  }, [initialGoodsList]);

  // Auto-open creation form if 'create=true' search query parameter is present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true") {
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
    return countryBranches.filter(b => (b.countryId || b.country_id) === selectedCountryId);
  }, [countryBranches, selectedCountryId]);

  const activeBranch = useMemo(() => {
    return countryBranches.find(b => b.id === selectedBranchId) || filteredCountryBranches[0] || countryBranches[0];
  }, [countryBranches, filteredCountryBranches, selectedBranchId]);

  const activeCityBranches = useMemo(() => {
    if (!selectedBranchId) return [];
    return cityBranches.filter(c => c.countryBranchId === selectedBranchId || c.country_branch_id === selectedBranchId);
  }, [cityBranches, selectedBranchId]);

  // Scope modal-local filtered lists (independent of global selectedCountryId / selectedBranchId)
  const scopeFilteredBranches = useMemo(() => {
    if (!scopeCountryId) return countryBranches;
    return countryBranches.filter(b => String(b.countryId || b.country_id) === String(scopeCountryId));
  }, [countryBranches, scopeCountryId]);

  const scopeCityBranches = useMemo(() => {
    if (!scopeBranchId) return [];
    return cityBranches.filter(c => String(c.countryBranchId || c.country_branch_id) === String(scopeBranchId));
  }, [cityBranches, scopeBranchId]);

  // Default selection based on user scope
  useEffect(() => {
    if (countryBranches.length > 0) {
      const userBranch = session.countryBranchIds?.[0] || session.country_branch_ids?.[0];
      const match = countryBranches.find(b => b.id === userBranch) || countryBranches[0];
      if (match) {
        setSelectedCountryId(match.countryId || match.country_id || "");
        setSelectedBranchId(match.id);
      }
    }
  }, [countryBranches, session]);

  useEffect(() => {
    if (filteredCountryBranches.length > 0 && !filteredCountryBranches.some(b => b.id === selectedBranchId)) {
      setSelectedBranchId(filteredCountryBranches[0].id);
    }
  }, [filteredCountryBranches, selectedBranchId]);

  useEffect(() => {
    if (activeCityBranches.length > 0) {
      const userCityBranch = session.cityBranchIds?.[0] || session.city_branch_ids?.[0];
      if (userCityBranch && activeCityBranches.some(c => c.id === userCityBranch)) {
        setSelectedCityBranchId(userCityBranch);
      } else {
        setSelectedCityBranchId(activeCityBranches[0].id);
      }
    } else {
      setSelectedCityBranchId("");
    }
  }, [activeCityBranches, session]);

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
    if (localCurrency) {
      setPurchaseCurrency(localCurrency);
    }
  }, [localCurrency]);

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

  const [serialNo, setSerialNo] = useState<string>("");

  useEffect(() => {
    setSerialNo(`LP-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

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
    const draftTotal = draftItems.reduce((acc, item) => acc + (item.finalCost || 0), 0);
    return draftTotal + finalCost;
  }, [draftItems, finalCost]);

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
      selectedGoodsName = selectedGood ? (selectedGood.goodsName || selectedGood.goods_name || "") : "";
    }

    if (!selectedGoodsName) {
      alert("Please select or enter a Goods Name.");
      return;
    }

    if (!quantityCount || Number(quantityCount) <= 0) {
      alert("Please enter a valid packages count.");
      return;
    }

    const itemObj = {
      id: `draft-${Date.now()}-${Math.random()}`,
      goodsId: goodsId === "custom" ? null : goodsId,
      goodsName: selectedGoodsName,
      brand: brand === "custom" ? customBrand.trim() : brand,
      size: size === "custom" ? customSize.trim() : size,
      chassisCode: chassisCode.trim(),
      lotNo: lotNo.trim(),
      quantityName: quantityName === "Custom" ? customQuantityName.trim() : quantityName,
      quantityKgs: Number(quantityCount),
      totalGrossWeight,
      emptyKgs: Number(emptyKgs || 0),
      netWeight,
      divideKgs: Number(divideKgs || 0),
      numbers,
      rateType,
      purchaseRate: Number(purchaseRate || 0),
      purchaseCost,
      applyTax,
      taxType,
      taxPercentage: Number(taxPercentage || 0),
      taxAmount,
      finalCost
    };

    setDraftItems(prev => [...prev, itemObj]);

    // Reset item input fields
    setGoodsId("");
    setCustomGoodsName("");
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
    setApplyTax("No");
    setTaxType("VAT");
    setTaxPercentage("0");
  }

  // Final submit handler with ledger posting dates serialization
  async function handleSubmit(e: React.FormEvent) {
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
        brand: primaryBrand || null,
        size: primarySize || null,
        chassisCode: chassisCode.trim() || null,
        lotNo: lotNo.trim() || null,
        supplierName: supplierName.trim() || "Local Market Vendor",
        paymentMode: resolvedPaymentMode,
        shippingMode: resolvedShippingMode,
        originCountryId: originCountryId === "custom" ? null : (originCountryId || null),
        originCountryName: selectedOriginCountryName,
        advancePercentage: paymentMode === "Advance" ? Number(advancePercentage || 0) : 0,
        advanceAmount: paymentMode === "Advance" ? calculatedAdvanceAmount : 0,
        remainingBalance: paymentMode === "Advance" ? remainingBalance : 0,
        warehouseName: warehouseName.trim() || null,
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
        exchangeRate: 1,
        localCurrency: purchaseCurrency,
        purchaseCost: primaryPurchaseCost,
        applyTax: primaryApplyTax || "No",
        taxType: primaryTaxType || "VAT",
        taxPercentage: primaryTaxPercentage || 0,
        taxAmount: primaryTaxAmount || 0,
        finalCost: primaryFinalCost
      };

      const res = await fetch("/api/erp/purchases/local-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to save purchase.");

      const newPurchase = data.data?.purchase || data.purchase;

      // Automatically accept the bill as per workflow (Draft -> Accepted transition)
      let acceptedRecord = newPurchase;
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

      alert("Local Purchase Bill recorded and transitioned to Payment Module successfully!");

      // Reset form
      setIsFormOpen(false);
      setDraftItems([]);
      setCurrentStep(1);
      setGoodsId("");
      setCustomGoodsName("");
      setSupplierName("");
      setPaymentMode("Cash");
      setShippingMode("Loading");
      setCustomShippingMode("");
      setOriginCountryId("");
      setCustomOriginCountryName("");
      setPurchaseAccountNo("");
      setSalesAccountNo("");
      setBrokerAccountNo("");
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
      
      // Reload logs and automatically redirect/open the newly accepted voucher in Payment Module
      await loadHistory();
      setActiveTab("accepted"); // Go to Local Purchase Payment view tab
      setSelectedRowForVoucher(acceptedRecord); // Open the verification view
    } catch (err: any) {
      alert(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  // Filter history
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // 1. Filter by Active Tab
      const rowStatus = p.status || p.bill_status || "draft";
      if (activeTab === "accepted" && rowStatus !== "accepted") return false;
      if (activeTab === "posted" && rowStatus !== "posted" && rowStatus !== "transferred") return false;
      
      // 2. Filter by Search Query
      const q = searchQuery.toLowerCase();
      return p.goodsName?.toLowerCase().includes(q) ||
             p.goods_name?.toLowerCase().includes(q) ||
             p.supplierName?.toLowerCase().includes(q) ||
             p.supplier_name?.toLowerCase().includes(q) ||
             p.paymentMode?.toLowerCase().includes(q) ||
             p.payment_mode?.toLowerCase().includes(q);
    });
  }, [purchases, searchQuery, activeTab]);
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
      const status = String(row.status || row.bill_status || "draft").toLowerCase();
      const purchaseAmount = Number(row.purchaseCost || row.purchase_cost || row.sub_total || row.subTotal || 0);
      const taxAmount = Number(row.taxAmount || row.tax_amount || 0);
      const finalAmount = Number(row.finalCost || row.final_cost || row.final_amount || row.finalAmount || purchaseAmount + taxAmount || 0);
      totalPurchase += purchaseAmount;
      totalTax += taxAmount;
      totalFinal += finalAmount;
      if (["posted", "transferred", "accepted", "paid"].includes(status)) postedBills += 1;
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
      country.postedBills += ["posted", "transferred", "accepted", "paid"].includes(status) ? 1 : 0;
      country.draftBills += status === "draft" ? 1 : 0;

      if (!country.branches.has(branchId)) {
        country.branches.set(branchId, { branchName, bills: 0, totalPurchase: 0, totalTax: 0, totalFinal: 0, postedBills: 0 });
      }
      const branch = country.branches.get(branchId);
      branch.bills += 1;
      branch.totalPurchase += purchaseAmount;
      branch.totalTax += taxAmount;
      branch.totalFinal += finalAmount;
      branch.postedBills += ["posted", "transferred", "accepted", "paid"].includes(status) ? 1 : 0;
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

  return (
    <div className="w-full px-3 sm:px-6 py-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Local Purchase Registry</h1>
            <p className="text-xs text-slate-500 font-medium">Record market purchases with custom empty weights and automated ledger postings.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {countryOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe className="h-3 w-3 text-blue-500" /> Country
              </span>
              <select
                value={selectedCountryId}
                onChange={e => setSelectedCountryId(e.target.value)}
                className="h-9 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold outline-none focus:border-blue-500"
              >
                <option value="">All Countries</option>
                {countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Country Branch</span>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold outline-none focus:border-blue-500"
            >
              {filteredCountryBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {activeCityBranches.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">City Branch</span>
              <select
                value={selectedCityBranchId}
                onChange={e => setSelectedCityBranchId(e.target.value)}
                className="h-9 w-44 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold outline-none focus:border-blue-500"
              >
                {activeCityBranches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Global Search Bar */}
          <div className="flex flex-col gap-1 w-48 sm:w-60">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Search Registry</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search item, vendor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-semibold text-slate-800"
              />
            </div>
          </div>

          {!isFormOpen ? (
            <Button
              onClick={() => {
                setScopeCountryId(selectedCountryId || countryOptions[0]?.id || "");
                setScopeBranchId(selectedBranchId || filteredCountryBranches[0]?.id || "");
                setScopeCityBranchId(selectedCityBranchId || activeCityBranches[0]?.id || "");
                setIsScopeModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 h-9 rounded-xl shadow-md shadow-blue-100 flex items-center gap-1.5 self-end"
            >
              + Create Local Purchase
            </Button>
          ) : (
            <Button
              onClick={() => setIsFormOpen(false)}
              variant="outline"
              className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 h-9 rounded-xl shadow-xs self-end"
            >
              Back to Registry
            </Button>
          )}
        </div>
      </div>

      {/* 5-Card Summary Report Header (Visible while creating/editing a purchase) */}
      {isFormOpen && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 font-bold">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <h4 className="text-[9px] uppercase tracking-wider text-slate-500">Branch Details</h4>
          </div>
          <div className="space-y-1 text-[9px]">
            <div className="border-b border-slate-100 pb-1">
              <span className="font-black text-blue-600 block truncate text-[11px]">{activeBranch?.name || "Global System"}</span>
            </div>
            <div className="flex justify-between"><span className="text-slate-400">Code:</span> <span className="font-bold text-slate-800 font-mono">{activeBranch?.code || "GLOBAL-00"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">User:</span> <span className="font-black text-emerald-600 uppercase truncate">{session.fullName || session.email || "ADMIN"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Country:</span> <span className="font-semibold text-slate-700 truncate">{activeBranch?.countryName || "All"}</span></div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 font-bold">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <h4 className="text-[9px] uppercase tracking-wider text-slate-500">Bill Details</h4>
          </div>
          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between"><span className="text-slate-400">Booking Date:</span> <span suppressHydrationWarning className="font-bold text-slate-800 font-mono">{new Date().toISOString().slice(0, 10)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fiscal Year:</span> <span className="font-bold text-slate-800 font-mono">2025-26</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">Status:</span> <span className="bg-amber-100 text-amber-800 font-bold px-1 py-0.2 rounded text-[7px] uppercase">DRAFT</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Serial:</span> <span suppressHydrationWarning className="font-bold text-slate-800 font-mono">{serialNo}</span></div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 font-bold">
            <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600" />
            <h4 className="text-[9px] uppercase tracking-wider text-slate-500">Purchase Acc (DR)</h4>
          </div>
          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between"><span className="text-slate-400">Code:</span> <span className="font-bold text-slate-800 font-mono truncate">{selectedPurchaseAccount?.code || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Name:</span> <span className="font-bold text-blue-600 truncate">{selectedPurchaseAccount?.name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Currency:</span> <span className="font-bold text-slate-900 font-mono">{selectedPurchaseAccount?.currency || purchaseCurrency}</span></div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 font-bold">
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
            <h4 className="text-[9px] uppercase tracking-wider text-slate-500">Sales Acc (CR)</h4>
          </div>
          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between"><span className="text-slate-400">Code:</span> <span className="font-bold text-slate-800 font-mono truncate">{selectedSalesAccount?.code || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Name:</span> <span className="font-bold text-blue-600 truncate">{selectedSalesAccount?.name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Currency:</span> <span className="font-bold text-slate-900 font-mono">{selectedSalesAccount?.currency || purchaseCurrency}</span></div>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 font-bold">
            <UserCheck className="h-3.5 w-3.5 text-purple-600" />
            <h4 className="text-[9px] uppercase tracking-wider text-slate-500">Broker / Agent Acc</h4>
          </div>
          <div className="space-y-1 text-[9px]">
            <div className="flex justify-between"><span className="text-slate-400">Code:</span> <span className="font-bold text-slate-800 font-mono truncate">{selectedBrokerAccount?.code || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Name:</span> <span className="font-bold text-purple-600 truncate">{selectedBrokerAccount?.name || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Currency:</span> <span className="font-bold text-slate-900 font-mono">{selectedBrokerAccount?.currency || purchaseCurrency}</span></div>
          </div>
        </div>
      </div>





      )}

      {!isFormOpen && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
                  <ShoppingCart className="h-4 w-4" /> Local Purchase Registry Dashboard
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">Country-wise local purchase summary with branch breakdown and live registry below.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCountryReport(prev => !prev)}
                className="h-9 rounded-xl border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"
              >
                {showCountryReport ? "Hide Country Report" : "Show Country Report +"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">1. Branch & User Details</p>
                <div className="mt-3 space-y-2 text-[11px] font-semibold text-slate-600">
                  <div className="flex justify-between gap-3"><span>Country</span><b className="text-right text-slate-900">{activeBranch?.countryName || activeBranch?.country_name || "All"}</b></div>
                  <div className="flex justify-between gap-3"><span>Branch Name</span><b className="text-right text-slate-900">{activeBranch?.name || "All Branches"}</b></div>
                  <div className="flex justify-between gap-3"><span>User Name</span><b className="text-right text-slate-900">{session.fullName || session.email || "Super Admin"}</b></div>
                  <div className="flex justify-between gap-3"><span>Date & Time</span><b suppressHydrationWarning className="text-right text-slate-900">{new Date().toLocaleString()}</b></div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">2. Global Financial Summary</p>
                <div className="mt-3 space-y-2 text-[11px] font-semibold text-slate-600">
                  <div className="flex justify-between"><span>Total Local Purchase Bills</span><b>{localPurchaseDashboard.totalBills}</b></div>
                  <div className="flex justify-between"><span>Total Purchase Amount</span><b>{money(localPurchaseDashboard.totalPurchase, localCurrency)}</b></div>
                  <div className="flex justify-between"><span>Total Tax Amount</span><b>{money(localPurchaseDashboard.totalTax, localCurrency)}</b></div>
                  <div className="flex justify-between"><span>Total Final Amount</span><b className="text-emerald-700">{money(localPurchaseDashboard.totalFinal, localCurrency)}</b></div>
                </div>
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-700">3. Bill Entry Summary</p>
                <div className="mt-3 space-y-2 text-[11px] font-semibold text-slate-600">
                  <div className="flex justify-between"><span>Total Bills</span><b>{localPurchaseDashboard.totalBills}</b></div>
                  <div className="flex justify-between"><span>Posted / Accepted</span><b className="text-emerald-700">{localPurchaseDashboard.postedBills}</b></div>
                  <div className="flex justify-between"><span>Draft Bills</span><b className="text-amber-700">{localPurchaseDashboard.draftBills}</b></div>
                  <div className="flex justify-between"><span>Pending Bills</span><b className="text-rose-700">{localPurchaseDashboard.pendingBills}</b></div>
                </div>
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-700">4. All Countries Report</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-orange-700">{localPurchaseDashboard.countries.length} Countries</span>
                </div>
                <div className="mt-3 space-y-2">
                  {localPurchaseDashboard.countries.slice(0, 3).map((country: any) => (
                    <div key={country.id} className="flex items-center justify-between rounded-lg border border-orange-100 bg-white px-2 py-1.5 text-[11px] font-bold">
                      <span className="truncate text-slate-800">{country.countryName}</span>
                      <span className="text-orange-700">{country.bills} bills</span>
                    </div>
                  ))}
                  {localPurchaseDashboard.countries.length === 0 && <p className="text-xs font-semibold text-slate-400">No country purchase records found.</p>}
                </div>
              </div>
            </div>
          </div>

          {showCountryReport && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {localPurchaseDashboard.countries.map((country: any) => (
                <div key={country.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{country.countryName}</h3>
                      <p className="text-[11px] font-bold text-slate-500">Currency: {country.currency}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{country.branches.length} Branches</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
                    <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Bills</span><b>{country.bills}</b></div>
                    <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Posted</span><b className="text-emerald-700">{country.postedBills}</b></div>
                    <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Purchase</span><b>{money(country.totalPurchase, country.currency)}</b></div>
                    <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Final</span><b className="text-blue-700">{money(country.totalFinal, country.currency)}</b></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {country.branches.map((branch: any) => (
                      <div key={branch.branchName} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px]">
                        <div className="flex justify-between gap-3 font-black text-slate-800"><span className="truncate">{branch.branchName}</span><span>{branch.bills} bills</span></div>
                        <div className="mt-1 flex justify-between gap-3 font-semibold text-slate-500"><span>Final Amount</span><span>{money(branch.totalFinal, country.currency)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Conditional Content: Form Wizard vs Full-Width Registry Log Table */}
      {isFormOpen ? (
        <form onSubmit={handleSubmit} className="w-full space-y-5 animate-in fade-in duration-200">

          {/* Stepper Navigation Badges matching Purchase Booking Order */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                currentStep === 1 ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              1 Booking
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                currentStep === 2 ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              2 Goods
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                currentStep === 3 ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              3 Others
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all ${
                currentStep === 4 ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              4 Review
            </button>
          </div>

          {/* 2-Column Split: Active Step Form (Left) vs Added Goods Table (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-5 items-start">
            {/* Left Column: Form Stepper Card */}
            <Card className="border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-3.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  {currentStep === 1 && <><FileText className="h-4 w-4 text-blue-600" /> STEP 1: BILL & ACCOUNTS INFO</>}
                  {currentStep === 2 && <><Package className="h-4 w-4 text-blue-600" /> STEP 2: GOODS ENTRY</>}
                  {currentStep === 3 && <><Truck className="h-4 w-4 text-blue-600" /> STEP 3: LOGISTICS & OTHERS</>}
                  {currentStep === 4 && <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> STEP 4: REVIEW & ACCEPT</>}
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                  title="Close Form & Return to Registry"
                >
                  <X className="h-4 w-4" />
</button>
              </CardHeader>

            <CardContent className="p-5 space-y-4">
              
              {/* STEP 1: BILL INFORMATION */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-blue-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Bill & Accounts Information</h4>
                  </div>

                  <div className="space-y-3">
                    {/* 1. Sales Account (CR) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sales Account (CR) *</label>
                      <select
                        value={salesAccountNo}
                        onChange={e => setSalesAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                        required
                      >
                        <option value="">Select Credit Account...</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.code}>
                            {acc.code} - {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Purchase Account (DR) */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase Account (DR) *</label>
                      <select
                        value={purchaseAccountNo}
                        onChange={e => setPurchaseAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                        required
                      >
                        <option value="">Select Debit Account...</option>
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
                        <User className="h-3 w-3 text-purple-600" /> Broker / Agent Account
                      </label>
                      <select
                        value={brokerAccountNo}
                        onChange={e => setBrokerAccountNo(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"
                      >
                        <option value="">Select Broker Account...</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.code}>
                            {acc.code} - {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Shipment Type & 5. Payment Condition */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shipment Type *</label>
                        <select
                          value={shipmentType}
                          onChange={e => setShipmentType(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-blue-700"
                        >
                          <option value="Loading by Truck">Loading by Truck</option>
                          <option value="Warehouse Transfer">Warehouse Transfer</option>
                          <option value="Export Shipment">Export Shipment</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Condition *</label>
                        <select
                          value={paymentMode}
                          onChange={e => setPaymentMode(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          {PAYMENT_MODES.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* 6. Origin Country */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <Globe className="h-3 w-3 text-blue-600" /> Origin Country
                      </label>
                      <select
                        value={originCountryId}
                        onChange={e => setOriginCountryId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold"
                      >
                        <option value="">Local (Branch Country)</option>
                        {countries.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 7. Remarks / Terms Notes */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Terms Notes</label>
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Write booking terms, shipment notes, or payment instructions..."
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none font-sans"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 h-9 rounded-xl shadow-md shadow-blue-100 flex items-center gap-1.5"
                    >
                      Next: Goods Entry <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: GOODS ENTRY */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-emerald-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Goods Entry & Pricing Metrics</h4>
                  </div>

                  <div className="space-y-3">
                    {/* 1. Goods Name */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Goods Selection (Goods Name) *</label>
                      <select
                        value={goodsId}
                        onChange={e => setGoodsId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                      >
                        <option value="">Select Goods Master...</option>
                        {goodsOptions.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                        <option value="CUSTOM">+ Custom Product Entry</option>
                      </select>
                      {goodsId === "CUSTOM" && (
                        <input
                          value={customGoodsName}
                          onChange={e => setCustomGoodsName(e.target.value)}
                          placeholder="Enter Custom Goods Name..."
                          className="w-full h-9 mt-2 rounded-lg border border-blue-300 bg-blue-50/50 px-3 text-xs font-bold outline-none"
                        />
                      )}
                    </div>

                    {/* 2. Chassis / Lot Code */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chassis / Lot Code</label>
                        <input
                          value={chassisCode}
                          onChange={e => setChassisCode(e.target.value)}
                          placeholder="Auto / Chassis #"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none text-blue-700 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lot Number / Mark</label>
                        <input
                          value={lotNo}
                          onChange={e => setLotNo(e.target.value)}
                          placeholder="e.g. Lot-100"
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    {/* 3. Brand & 4. Size */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Brand with popover + New Brand */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Brand</label>
                        {brandOptions.length > 0 ? (
                          <MasterSelectPopover
                            label=""
                            value={brand}
                            displayValue={brand || ""}
                            options={brandOptions}
                            onSelect={v => setBrand(v)}
                            onAddNew={() => setIsAddingBrandModal(true)}
                            addNewLabel="+ New Brand"
                            placeholder="Select Brand..."
                          />
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={brand}
                              onChange={e => setBrand(e.target.value)}
                              placeholder="e.g. Brand Name"
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                            />
                            {selectedGood && (
                              <button type="button" onClick={() => setIsAddingBrandModal(true)}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add Brand
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Size with popover + New Size */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Size Specification</label>
                        {sizeOptions.length > 0 ? (
                          <MasterSelectPopover
                            label=""
                            value={size}
                            displayValue={size || ""}
                            options={sizeOptions}
                            onSelect={v => setSize(v)}
                            onAddNew={() => setIsAddingSizeModal(true)}
                            addNewLabel="+ New Size"
                            placeholder="Select Size..."
                          />
                        ) : (
                          <div className="space-y-1">
                            <input
                              value={size}
                              onChange={e => setSize(e.target.value)}
                              placeholder="e.g. Size / Spec"
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                            />
                            {selectedGood && (
                              <button type="button" onClick={() => setIsAddingSizeModal(true)}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Add Size
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 5. Quantity Type & 6. Quantity Number */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantity Type (Packing)</label>
                        <select
                          value={quantityName}
                          onChange={e => setQuantityName(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-semibold"
                        >
                          {QUANTITY_NAMES.map(qn => <option key={qn} value={qn}>{qn}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantity Number (Count) *</label>
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
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Weight per Quantity (KG) *</label>
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
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">1 Empty Tare Weight (KG)</label>
                        <input
                          type="number"
                          step="any"
                          value={emptyKgs}
                          onChange={e => setEmptyKgs(e.target.value)}
                          placeholder="e.g. 1 KG"
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
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Divide Type</label>
                        <select
                          value={divideType}
                          onChange={e => setDivideType(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          <option value="D/KGs">D/KGs (KG/Bag Divide)</option>
                          <option value="D/Ton">D/Ton (Metric Ton Divide)</option>
                          <option value="D/Unit">D/Unit (Direct Unit Divide)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Divide Value (KG)</label>
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
                      <label className="block text-[9px] font-bold text-purple-700 uppercase mb-1">Total Divide Units (Auto Calculate)</label>
                      <input
                        readOnly
                        value={`${numbers.toLocaleString()} Packs/Units`}
                        className="w-full h-9 rounded-lg border border-purple-200 bg-white px-3 text-xs font-mono font-bold text-purple-700 outline-none"
                      />
                    </div>

                    {/* 12. Price Type & 13. Unit Price */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price Type (Rate Basis)</label>
                        <select
                          value={rateType}
                          onChange={e => setRateType(e.target.value as any)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none font-bold text-slate-700"
                        >
                          <option value="Per KG Weight">Per KG Weight</option>
                          <option value="Per Bag / Package">Per Bag / Package</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit Price Rate *</label>
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
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Final Amount (Auto Calculate)</label>
                        <input
                          readOnly
                          value={`${purchaseCurrency} ${finalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono font-bold text-slate-700 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax Type Option</label>
                        <select
                          value={applyTax}
                          onChange={e => setApplyTax(e.target.value)}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none"
                        >
                          <option value="No">No Tax</option>
                          <option value="Yes">Apply Tax / VAT</option>
                        </select>
                      </div>
                    </div>

                    {/* 16. Tax Percentage (Auto Calculate) */}
                    {applyTax === "Yes" && (
                      <div className="grid grid-cols-2 gap-3 p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tax Percentage (%)</label>
                          <input
                            type="number"
                            value={taxPercentage}
                            onChange={e => setTaxPercentage(e.target.value)}
                            className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calculated Tax Amount</label>
                          <input
                            readOnly
                            value={`${purchaseCurrency} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            className="w-full h-9 rounded-lg border-blue-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="w-1/3 h-9 rounded-xl text-xs font-bold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddLineItem}
                      className="w-1/3 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" /> + Add Item to List
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="w-1/3 h-9 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-extrabold flex items-center justify-center gap-1"
                    >
                      Next: Logistics <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT & LOGISTICS */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-purple-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-purple-600" /> 3. Payment & Logistics Details
                    </h4>
                  </div>

                  <div className="space-y-3">

                    {/* ── A. PAYMENT INFORMATION BLOCK ── */}
                    <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-blue-500" /> Payment Condition
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase">Selected Payment Type</label>
                          <span className="font-extrabold text-slate-800 text-[11px] block mt-1">{paymentMode}</span>
                        </div>
                        {paymentMode !== "Advance" && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Payment Date</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Advance Payment Percentage (%)</label>
                              <input
                                type="number"
                                step="any"
                                value={advancePercentage}
                                onChange={e => setAdvancePercentage(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-blue-700 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Advance Payment Amount</label>
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
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Remaining Amount</label>
                              <input
                                readOnly
                                value={`${purchaseCurrency} ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono font-bold text-red-650 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Total Bill Cost</label>
                              <input
                                readOnly
                                value={`${purchaseCurrency} ${combinedBillCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono font-bold text-slate-700 outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Advance Payment Due Date</label>
                              <input
                                type="date"
                                value={advancePaymentDate}
                                onChange={e => setAdvancePaymentDate(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Remaining Payment Due Date</label>
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
                          <Warehouse className="h-3 w-3 text-purple-500" /> Warehouse Transfer Details
                        </p>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Warehouse Master Setup</label>
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
                                <option value="">Select Warehouse...</option>
                                {warehousesList.map(w => (
                                  <option key={w.id} value={w.id}>{w.warehouse_name} ({w.id})</option>
                                ))}
                                <option value="CUSTOM">+ Custom Manual Entry</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Warehouse Code</label>
                              <input
                                value={selectedWarehouseId === "CUSTOM" ? "" : selectedWarehouseId}
                                readOnly={selectedWarehouseId !== "CUSTOM"}
                                onChange={e => selectedWarehouseId === "CUSTOM" && setSelectedWarehouseId(e.target.value)}
                                placeholder="Code"
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-mono outline-none text-slate-600 font-bold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Warehouse Name (Auto)</label>
                              <input
                                value={warehouseName}
                                readOnly={selectedWarehouseId !== "CUSTOM"}
                                onChange={e => setWarehouseName(e.target.value)}
                                placeholder="Auto Loaded Name"
                                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs outline-none text-slate-800 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Warehouse Transfer Date</label>
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
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Link with Warehouse Account *</label>
                            <select
                              value={warehouseAccountNo}
                              onChange={e => setWarehouseAccountNo(e.target.value)}
                              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none text-purple-700 font-bold"
                            >
                              <option value="">Select Warehouse Stock Account...</option>
                              {accountsList.map(acc => (
                                <option key={acc.id} value={acc.code}>
                                  {acc.code} - {acc.name} ({acc.currency})
                                </option>
                              ))}
                            </select>
                            <p className="text-[8px] text-slate-400 mt-1">Stock will be automatically transferred to this Warehouse Account upon posting.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── C. LOADING BY TRUCK BLOCK ── */}
                    {shipmentType === "Loading by Truck" && (
                      <div className="rounded-xl border border-slate-200 p-3 space-y-3 bg-slate-50/50">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          <Truck className="h-3 w-3 text-purple-500" /> Loading by Truck Details
                        </p>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Truck Management Master</label>
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
                                <option value="">Select Registered Truck...</option>
                                {TRUCK_LIST.map(t => (
                                  <option key={t.id} value={t.id}>{t.truckNo} - {t.driverName} ({t.details})</option>
                                ))}
                                <option value="CUSTOM">+ Custom / Non-Setup Entry</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Truck Number *</label>
                              <input
                                value={truckNo}
                                readOnly={selectedTruckId !== "CUSTOM" && selectedTruckId !== ""}
                                onChange={e => setTruckNo(e.target.value)}
                                placeholder="Truck Number"
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono font-bold text-indigo-700 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Driver Name</label>
                              <input
                                value={driverName}
                                readOnly={selectedTruckId !== "CUSTOM" && selectedTruckId !== ""}
                                onChange={e => setDriverName(e.target.value)}
                                placeholder="Driver Name"
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Loading Date</label>
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
                          <Flag className="h-3.5 w-3.5 text-amber-600" /> Export Shipment Workflow
                        </p>
                        <p className="text-[10px] leading-relaxed">
                          This purchase is designated for export. Shipment routes, customs documentation, and container loading tracking must be completed via the Export Loading & Shipping modules after booking.
                        </p>
                      </div>
                    )}

                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}
                      className="w-1/2 h-9 rounded-xl text-xs font-bold">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                    <Button type="button" onClick={() => setCurrentStep(4)}
                      className="w-1/2 h-9 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-extrabold flex items-center justify-center gap-1">
                      Next: Review <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: REVIEW & ACCEPT */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-l-2 border-emerald-600 pl-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 4. Full Bill Review & Final Booking
                    </h4>
                  </div>

                  {/* Review Notice */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-[9px] text-slate-500 font-medium">
                    Please review the payment conditions, weights, and logistics summary in the right-hand panel before finalized acceptance.
                  </div>

                  {/* Payment & Logistics Summary */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5">
                    <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Payment & Logistics</p>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="font-bold text-slate-800">{paymentMode}</span>
                    </div>
                    {paymentMode === "Advance" && (
                      <>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Advance Amount:</span>
                          <span className="font-mono font-bold text-emerald-700">{purchaseCurrency} {calculatedAdvanceAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Remaining Balance:</span>
                          <span className="font-mono font-bold text-red-600">{purchaseCurrency} {remainingBalance.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Advance Date:</span>
                          <span className="font-mono text-slate-700">{advancePaymentDate}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">Remaining Due:</span>
                          <span className="font-mono text-slate-700">{remainingDueDate}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Shipment Type:</span>
                      <span className="font-bold text-slate-800">{shipmentType}</span>
                    </div>
                    {truckNo && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Truck No:</span><span className="font-mono font-bold text-indigo-700">{truckNo}</span></div>}
                    {driverName && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Driver:</span><span className="font-bold text-slate-700">{driverName}</span></div>}
                    {warehouseName && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Warehouse:</span><span className="font-bold text-slate-700">{warehouseName}</span></div>}
                    {remarks && <div className="flex justify-between text-[10px]"><span className="text-slate-500">Remarks:</span><span className="font-semibold text-slate-700 text-right max-w-[60%] truncate">{remarks}</span></div>}
                  </div>

                  {/* Financial Totals */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 shadow-lg">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Total Goods Lines:</span>
                      <span className="font-mono font-black">{draftItems.length > 0 ? draftItems.length : 1} Line(s)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Total Net Weight:</span>
                      <span className="font-mono font-bold text-blue-400">
                        {draftItems.length > 0 ? draftItems.reduce((a,i)=>a+i.netWeight,0).toLocaleString() : netWeight.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Tax Amount:</span>
                      <span className="font-mono font-bold text-amber-400">{purchaseCurrency} {taxAmount.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-black border-t border-slate-800 pt-2 text-emerald-400">
                      <span>Total Bill Amount:</span>
                      <span className="font-mono text-base font-black">
                        {purchaseCurrency} {combinedBillCost?.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}
                        className="w-1/2 h-9 rounded-xl text-xs font-bold border-slate-300">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </Button>
                      <Button type="button" variant="outline"
                        onClick={() => { setIsFormOpen(false); alert("Bill saved to draft."); }}
                        className="w-1/2 h-9 rounded-xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100">
                        Save Draft
                      </Button>
                    </div>

                    <Button type="submit" disabled={saving}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                      {saving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Booking & Posting Bill...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Book & Accept Bill</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Right Column: Live Added Goods Items Table & Bill Summary Card */}
          <div className="space-y-4 sticky top-6">
            <Card className="border-slate-200 bg-white shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-white text-slate-900 p-3.5 flex flex-row items-center justify-between border-b border-slate-200">
                <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600" /> ADDED GOODS ITEMS TABLE
                </CardTitle>
                <span className="text-[10px] font-mono font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  {draftItems.length > 0 ? `${draftItems.length} Item(s)` : "Active Item"}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead className="bg-slate-100 text-slate-700 text-[9px] font-extrabold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 border-b text-center">#</th>
                        <th className="p-2 border-b">Goods Item</th>
                        <th className="p-2 border-b">Brand / Size</th>
                        <th className="p-2 border-b">Chassis / Lot</th>
                        <th className="p-2 border-b text-right">Packages</th>
                        <th className="p-2 border-b text-right">Gross Wt</th>
                        <th className="p-2 border-b text-right">Net Wt</th>
                        <th className="p-2 border-b text-right">Rate</th>
                        <th className="p-2 border-b text-right">Tax Details</th>
                        <th className="p-2 border-b text-right">Amount</th>
                        <th className="p-2 border-b text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[10px]">
                      {draftItems.length > 0 ? (
                        draftItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-slate-500 text-center">{idx + 1}</td>
                            <td className="p-2">
                              <div className="font-bold text-slate-900">{item.goodsName}</div>
                              {item.numbers > 0 && (
                                <div className="text-[8px] text-purple-700 font-extrabold">
                                  Div: {item.numbers.toLocaleString()} ({item.divideType})
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-slate-600">
                              {item.brand || "-"} {item.size ? `/ ${item.size}` : ""}
                            </td>
                            <td className="p-2 font-mono text-[9px] text-slate-500">
                              {item.chassisCode || item.lotNo ? `${item.chassisCode || "-"} / ${item.lotNo || "-"}` : "-"}
                            </td>
                            <td className="p-2 text-right font-mono">
                              <div className="font-bold text-slate-800">{item.quantityKgs} {item.quantityName}</div>
                              {item.weightPerPkg && (
                                <div className="text-[8px] text-slate-500 font-semibold">@ {item.weightPerPkg} kg</div>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">{item.totalGrossWeight?.toLocaleString()} kg</td>
                            <td className="p-2 text-right font-mono">
                              <div className="font-bold text-blue-650">{item.netWeight?.toLocaleString()} kg</div>
                              {item.emptyKgs > 0 && (
                                <div className="text-[8px] text-red-500 font-semibold">Tare: {item.emptyKgs} kg</div>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono">
                              <div>${item.purchaseRate}</div>
                              <div className="text-[8px] text-slate-450 font-bold uppercase">{item.rateType?.replace("_", " ")}</div>
                            </td>
                            <td className="p-2 text-right font-mono text-amber-600">
                              {item.applyTax === "Yes" ? (
                                <div>
                                  <div className="font-bold">{item.taxType} ({item.taxPercentage}%)</div>
                                  <div className="text-[8px] font-black text-amber-700">${item.taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400">No Tax</span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono">
                              <div className="font-black text-emerald-600">${item.finalCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              {item.applyTax === "Yes" && (
                                <div className="text-[8px] text-slate-400">Sub: ${item.purchaseCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setDraftItems(prev => prev.filter(i => i.id !== item.id))}
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="bg-blue-50/20">
                          <td className="p-2 font-mono font-bold text-blue-600 text-center">1</td>
                          <td className="p-2">
                            <div className="font-bold text-slate-900">
                              {selectedGood?.goodsName || customGoodsName || "Select / Enter Goods Name"}
                            </div>
                            {numbers > 0 && (
                              <div className="text-[8px] text-purple-700 font-extrabold">
                                Div: {numbers.toLocaleString()} ({divideType})
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-slate-600">
                            {brand || "-"} {size ? `/ ${size}` : ""}
                          </td>
                          <td className="p-2 font-mono text-[9px] text-slate-500">
                            {chassisCode || lotNo ? `${chassisCode || "-"} / ${lotNo || "-"}` : "-"}
                          </td>
                          <td className="p-2 text-right font-mono">
                            <div className="font-bold text-slate-800">{quantityCount || 0} {quantityName}</div>
                            {weightPerPkg && (
                              <div className="text-[8px] text-slate-500 font-semibold">@ {weightPerPkg} kg</div>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-600">{totalGrossWeight || 0} kg</td>
                          <td className="p-2 text-right font-mono">
                            <div className="font-bold text-blue-650">{netWeight || 0} kg</div>
                            {Number(emptyKgs) > 0 && (
                              <div className="text-[8px] text-red-500 font-semibold">Tare: {emptyKgs} kg</div>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">
                            <div>${purchaseRate || 0}</div>
                            <div className="text-[8px] text-slate-450 font-bold uppercase">{rateType?.replace("_", " ")}</div>
                          </td>
                          <td className="p-2 text-right font-mono text-amber-600">
                            {applyTax === "Yes" ? (
                              <div>
                                <div className="font-bold">{taxType} ({taxPercentage}%)</div>
                                <div className="text-[8px] font-black text-amber-700">${taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">No Tax</span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">
                            <div className="font-black text-emerald-600">${finalCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {applyTax === "Yes" && (
                              <div className="text-[8px] text-slate-400">Sub: ${purchaseCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            )}
                          </td>
                          <td className="p-2 text-center text-slate-400 text-[9px] font-bold">Preview</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bill Live Totals Card */}
                <div className="p-4 bg-white text-slate-900 border-t border-slate-200 space-y-4">
                  
                  {/* Weight Summary Header */}
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-[9px] font-extrabold text-blue-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Scale className="h-3 w-3 text-blue-600" /> Live Weight Summary Report
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Gross Weight</span>
                        <span className="font-mono font-bold text-slate-800">
                          {draftItems.length > 0
                            ? draftItems.reduce((acc, i) => acc + i.totalGrossWeight, 0).toLocaleString()
                            : totalGrossWeight.toLocaleString()
                          } kg
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Empty Tare</span>
                        <span className="font-mono font-bold text-red-600">
                          {draftItems.length > 0
                            ? draftItems.reduce((acc, i) => acc + i.emptyKgs, 0).toLocaleString()
                            : (Number(emptyKgs || 0) * Number(quantityCount || 0)).toLocaleString()
                          } kg
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Net Weight</span>
                        <span className="font-mono font-bold text-blue-700">
                          {draftItems.length > 0
                            ? draftItems.reduce((acc, i) => acc + i.netWeight, 0).toLocaleString()
                            : netWeight.toLocaleString()
                          } kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Condition Summary */}
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-[9px] font-extrabold text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-amber-600" /> Payment Condition Summary
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Payment Mode</span>
                        <span className="font-bold text-slate-800">{paymentMode}</span>
                      </div>
                      {paymentMode === "Advance" ? (
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">Advance Part ({advancePercentage}%)</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {purchaseCurrency} {calculatedAdvanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">Payment Date</span>
                          <span className="font-mono font-bold text-slate-700">{cashPaymentDate || "Today"}</span>
                        </div>
                      )}
                      {paymentMode === "Advance" && (
                        <>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">Remaining Due</span>
                            <span className="font-mono font-bold text-red-600">
                              {purchaseCurrency} {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">Due Date</span>
                            <span className="font-mono font-bold text-slate-700">{remainingDueDate || "-"}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Shipment & Logistics */}
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-[9px] font-extrabold text-purple-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Truck className="h-3 w-3 text-purple-600" /> Transit & Logistics Details
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Shipment Mode</span>
                        <span className="font-bold text-slate-800">{shipmentType}</span>
                      </div>
                      {shipmentType === "Loading by Truck" && truckNo && (
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">Truck & Driver</span>
                          <span className="font-bold text-indigo-700 font-mono text-[9px]">{truckNo} {driverName ? `(${driverName})` : ""}</span>
                        </div>
                      )}
                      {shipmentType === "Warehouse Transfer" && warehouseName && (
                        <div>
                          <span className="text-slate-500 block text-[8px] uppercase">Warehouse Location</span>
                          <span className="font-bold text-slate-800">{warehouseName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="flex justify-between items-center text-sm font-black border-t border-slate-200 pt-2">
                    <span className="text-emerald-700 uppercase text-xs tracking-wider flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5" /> Total Bill Payable
                    </span>
                    <span className="font-mono text-base font-black text-emerald-700">
                      {purchaseCurrency} {combinedBillCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column Direct Submit & Action Buttons */}
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                className="w-full h-9 text-slate-500 hover:text-slate-700 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Close Form
              </Button>
            </div>
          </div>
        </div>
      </form>
    ) : (
        /* Full-Width Draft & In-Progress Bills Table */
        <div className="space-y-4 w-full animate-in fade-in duration-200">
          
          {/* Navigation Tabs (Workflow Modules separation) */}
          <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-2xl gap-1 shadow-xs max-w-2xl">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition ${
                activeTab === "all" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Purchases Registry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("accepted")}
              className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === "accepted" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins className="h-3 w-3" /> Ready to Pay (Accepted)
              {purchases.filter(p => (p.status || p.bill_status || p.billStatus) === "accepted").length > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {purchases.filter(p => (p.status || p.bill_status || p.billStatus) === "accepted").length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("posted")}
              className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition ${
                activeTab === "posted" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Posted Ledger entries
            </button>
          </div>

          <Card className="border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Coins className="h-4 w-4 text-blue-600" /> LOCAL PURCHASE BILLS
              </CardTitle>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                {filteredPurchases.length} Record(s)
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-slate-900 text-white text-[9px] font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="px-2 py-2 border-r border-slate-700 text-center">Super S/N</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-center">Cty S/N</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-center">Br S/N</th>
                      <th className="px-2 py-2 border-r border-slate-700">Voucher No</th>
                      <th className="px-2 py-2 border-r border-slate-700">Date</th>
                      <th className="px-2 py-2 border-r border-slate-700">Purchase Acc (DR)</th>
                      <th className="px-2 py-2 border-r border-slate-700">Sales Acc (CR)</th>
                      <th className="px-2 py-2 border-r border-slate-700">Supplier Name</th>
                      <th className="px-2 py-2 border-r border-slate-700">Goods Name</th>
                      <th className="px-2 py-2 border-r border-slate-700">Brand</th>
                      <th className="px-2 py-2 border-r border-slate-700">Size</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Qty</th>
                      <th className="px-2 py-2 border-r border-slate-700">Unit</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Gross Wt</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Net Wt</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-center">Divide Unit</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Rate</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Sub Total</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right">Tax Amt</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-right font-black">Final Amount</th>
                      <th className="px-2 py-2 border-r border-slate-700 text-center">Status</th>
                      <th className="px-2 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px]">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={22} className="p-8 text-center text-slate-400 font-mono">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                          Loading bills...
                        </td>
                      </tr>
                    ) : filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={22} className="px-5 py-12 text-center text-slate-400 font-sans">
                          <Package className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                          <p className="font-bold text-slate-700">No bills found</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Click &quot;+ Create Local Purchase&quot; to create a new bill.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map((row) => {
                        const rowStatus = row.status || row.bill_status || "draft";
                        const rowCurrency = row.local_currency || row.localCurrency || row.purchase_currency || row.purchaseCurrency || "PKR";
                        const rowFinalCost = Number(row.final_cost || row.finalCost || row.purchase_cost || row.purchaseCost || 0);
                        const rowBaseCost = Number(row.purchase_cost || row.purchaseCost || 0);
                        const rowTaxAmount = Number(row.tax_amount || row.taxAmount || 0);
                        const rowNetWeight = Number(row.net_weight || row.netWeight || 0);
                        const rowGrossWeight = Number(row.total_gross_weight || row.totalGrossWeight || 0);
                        const rowQty = Number(row.quantity_kgs || row.quantityKgs || 0);
                        const rowRate = Number(row.purchase_rate || row.purchaseRate || 0);
                        const rowDivideKgs = row.divide_kgs || row.divideKgs || 50;

                        const superSerial = row.superAdminSerialNo || row.super_admin_serial_no || row.global_serial_no || `GBL-${row.id?.slice(0, 4) || "001"}`;
                        const countrySerial = row.countrySerialNo || row.country_serial_no || row.computedCountrySerial || `CTY-${row.id?.slice(0, 4) || "001"}`;
                        const branchSerial = row.branchSerialNo || row.branch_serial_no || row.computedBranchSerial || `BR-${row.id?.slice(0, 4) || "001"}`;
                        const voucherCode = row.journal_serial_no || row.serial_no || row.serialNo || row.bill_no || row.billNo || `LP-2026-${row.id?.slice(0, 4) || "1001"}`;

                        const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
                          draft: { bg: "bg-amber-100 border-amber-300", text: "text-amber-800", label: "DRAFT" },
                          accepted: { bg: "bg-blue-100 border-blue-300", text: "text-blue-800", label: "ACCEPTED" },
                          transferred: { bg: "bg-purple-100 border-purple-300", text: "text-purple-800", label: "TRANSFERRED" },
                          posted: { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-800", label: "POSTED" },
                        };
                        const badge = statusBadge[rowStatus] || statusBadge.draft;

                        return (
                          <tr key={row.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                            <td className="px-2 py-2 font-mono text-[9px] text-slate-500 font-bold text-center border-r border-slate-150">{superSerial}</td>
                            <td className="px-2 py-2 font-mono text-[9px] text-slate-500 text-center border-r border-slate-150">{countrySerial}</td>
                            <td className="px-2 py-2 font-mono text-[9px] text-slate-500 text-center border-r border-slate-150">{branchSerial}</td>
                            <td className="px-2 py-2 font-mono text-[9px] font-bold text-blue-600 border-r border-slate-150">{voucherCode}</td>
                            <td className="px-2 py-2 font-mono text-[9px] text-slate-500 border-r border-slate-150" suppressHydrationWarning>
                              {new Date(row.created_at || row.createdAt || "").toLocaleDateString("en-GB")}
                            </td>
                            <td className="px-2 py-2 font-mono text-[9px] text-blue-600 font-bold border-r border-slate-150">{row.purchase_account_no || row.purchaseAccountNo || "PK-CHM-AC-0001"}</td>
                            <td className="px-2 py-2 font-mono text-[9px] text-purple-600 font-bold border-r border-slate-150">{row.sales_account_no || row.salesAccountNo || row.broker_account_no || row.brokerAccountNo || "PK-CHM-AC-0002"}</td>
                            <td className="px-2 py-2 font-semibold text-slate-700 border-r border-slate-150">{row.supplier_name || row.supplierName || "Local Vendor"}</td>
                            <td className="px-2 py-2 font-bold text-slate-900 border-r border-slate-150">{row.goods_name || row.goodsName || "-"}</td>
                            <td className="px-2 py-2 text-slate-500 border-r border-slate-150">{row.brand || "-"}</td>
                            <td className="px-2 py-2 text-slate-500 border-r border-slate-150">{row.size || "-"}</td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-150">{rowQty.toLocaleString()}</td>
                            <td className="px-2 py-2 text-slate-600 border-r border-slate-150">{row.quantity_name || row.quantityName || "Bags"}</td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600 border-r border-slate-150">{rowGrossWeight.toLocaleString()} kg</td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-blue-600 border-r border-slate-150">{rowNetWeight.toLocaleString()} kg</td>
                            <td className="px-2 py-2 text-center font-mono text-[9px] text-purple-700 font-bold border-r border-slate-150">{rowDivideKgs} KG</td>
                            <td className="px-2 py-2 text-right font-mono text-slate-700 border-r border-slate-150">${rowRate}</td>
                            <td className="px-2 py-2 text-right font-mono text-slate-800 border-r border-slate-150">${rowBaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-2 py-2 text-right font-mono text-red-500 border-r border-slate-150">${rowTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-2 py-2 text-right font-mono font-black text-emerald-600 border-r border-slate-150">
                              {rowCurrency} {rowFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-2 text-center border-r border-slate-150">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${badge.bg} ${badge.text}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center relative" onClick={(e) => e.stopPropagation()}>
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={() => setActiveActionMenuId(activeActionMenuId === row.id ? null : row.id)}
                                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1 font-bold text-[10px]"
                                  title="Actions"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-blue-600" />
                                </button>

                                {activeActionMenuId === row.id && (
                                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white shadow-xl border border-slate-200 z-30 py-1 space-y-0.5 animate-in fade-in text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRowForVoucher(row);
                                        setActiveActionMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-blue-600" /> View Voucher
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRowForVoucher(row);
                                        setActiveActionMenuId(null);
                                        setTimeout(() => window.print(), 300);
                                      }}
                                      className="w-full px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2 transition"
                                    >
                                      <Printer className="h-3.5 w-3.5 text-purple-600" /> Print / Export PDF
                                    </button>

                                    {rowStatus === "draft" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsFormOpen(true);
                                          setCurrentStep(1);
                                          setGoodsId(row.goods_id || row.goodsId || "");
                                          setSupplierName(row.supplier_name || row.supplierName || "");
                                          setPurchaseAccountNo(row.purchase_account_no || row.purchaseAccountNo || "");
                                          setSalesAccountNo(row.sales_account_no || row.salesAccountNo || "");
                                          setBrokerAccountNo(row.broker_account_no || row.brokerAccountNo || "");
                                          setActiveActionMenuId(null);
                                        }}
                                        className="w-full px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 transition"
                                      >
                                        <Edit3 className="h-3.5 w-3.5 text-emerald-600" /> Edit Draft
                                      </button>
                                    )}

                                    {rowStatus === "draft" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
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
                                        className="w-full px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Accept Bill
                                      </button>
                                    )}

                                    {rowStatus === "accepted" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
                                          if (!confirm("Transfer & Post this bill? Journal, Roznamcha, and Ledger entries will be created.")) return;
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
                                        className="w-full px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition"
                                      >
                                        <Send className="h-3.5 w-3.5 text-emerald-600" /> Transfer & Post
                                      </button>
                                    )}

                                    {rowStatus === "draft" && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setActiveActionMenuId(null);
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
                                        className="w-full px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition border-t border-slate-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-600" /> Delete Draft
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
                  <Building2 className="h-4 w-4 text-blue-600" /> SELECT WORKING LOCATION SCOPE
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Please select the Country, Branch, and City Branch before creating bill.</p>
              </div>
              <button onClick={() => setIsScopeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Country *</label>
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
                  <option value="">Select Country...</option>
                  {countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Country Branch *</label>
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
                  <option value="">Select Branch...</option>
                  {scopeFilteredBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
                {scopeFilteredBranches.length === 0 && scopeCountryId && (
                  <p className="text-[9px] text-red-500 font-bold mt-1">No branches found for this country.</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">City Branch</label>
                <select
                  value={scopeCityBranchId}
                  onChange={e => setScopeCityBranchId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 bg-slate-50"
                >
                  <option value="">Select City Branch...</option>
                  {scopeCityBranches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {scopeCityBranches.length === 0 && scopeBranchId && (
                  <p className="text-[9px] text-slate-400 font-bold mt-1">No city branches for this branch.</p>
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
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (scopeCountryId) setSelectedCountryId(scopeCountryId);
                  if (scopeBranchId) setSelectedBranchId(scopeBranchId);
                  if (scopeCityBranchId) setSelectedCityBranchId(scopeCityBranchId);
                  setIsScopeModalOpen(false);
                  setIsFormOpen(true);
                  setCurrentStep(1);
                }}
                className="w-1/2 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-100"
              >
                Confirm Scope
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
                <Package className="h-4 w-4 text-blue-600" /> CREATE NEW GOODS MASTER
              </h3>
              <button onClick={() => setIsAddingGoodsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoodsMaster} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Goods Item Name *</label>
                <input
                  required
                  autoFocus
                  value={newGoodsNameInput}
                  onChange={e => setNewGoodsNameInput(e.target.value)}
                  placeholder="e.g. CASHEW NUTS"
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chassis / HS Code</label>
                <input
                  value={newChsCodeInput}
                  onChange={e => setNewChsCodeInput(e.target.value)}
                  placeholder="e.g. CHS-9812"
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewGoods}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  Save Goods
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
                <Pencil className="h-4 w-4 text-blue-600" /> EDIT GOODS MASTER
              </h3>
              <button onClick={() => { setIsEditingGoodsModal(false); setEditGoodsTarget(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditGoodsMaster} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Goods Item Name *</label>
                <input
                  required
                  autoFocus
                  value={editGoodsNameInput}
                  onChange={e => setEditGoodsNameInput(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chassis / HS Code</label>
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingEditGoods}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  Update Goods
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
                <Tag className="h-4 w-4 text-blue-600" /> ADD BRAND VARIATION
              </h3>
              <button onClick={() => setIsAddingBrandModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBrandVariation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Brand Name *</label>
                <input
                  required
                  autoFocus
                  value={newBrandInput}
                  onChange={e => setNewBrandInput(e.target.value)}
                  placeholder="e.g. AL-KHAIR"
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewBrand}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  Save Brand
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
                <Layers className="h-4 w-4 text-blue-600" /> ADD SIZE VARIATION
              </h3>
              <button onClick={() => setIsAddingSizeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSizeVariation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Size Name *</label>
                <input
                  required
                  autoFocus
                  value={newSizeInput}
                  onChange={e => setNewSizeInput(e.target.value)}
                  placeholder="e.g. 50KG STANDARD"
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingNewSize}
                  className="w-1/2 h-9 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                  Save Size
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
                    <Send className="h-3.5 w-3.5" /> Transfer & Post to GL
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const printContents = document.getElementById("printable-modal-voucher")?.innerHTML;
                    if (!printContents) return;
                    const originalContents = document.body.innerHTML;
                    document.body.innerHTML = printContents;
                    window.print();
                    document.body.innerHTML = originalContents;
                    window.location.reload(); // Refresh to restore react state
                  }}
                  className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedRowForVoucher(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                >
                  Close
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
                const companyName = selectedRowForVoucher.companyName || selectedRowForVoucher.company_name || activeBranch?.companyName || activeBranch?.company_name || "DAMAAN Trading Company LLC";
                const branchName = selectedRowForVoucher.branchName || selectedRowForVoucher.branch_name || activeBranch?.name || "UAE Branch";
                const officeAddress = selectedRowForVoucher.officeAddress || selectedRowForVoucher.office_address || activeBranch?.fullAddress || activeBranch?.full_address || activeBranch?.address || "United Arab Emirates";
                const officePhone = activeBranch?.phone || activeBranch?.phoneNumber || activeBranch?.phone_number || activeBranch?.mobile || activeBranch?.mobileNumber || activeBranch?.mobile_number || "N/A";
                const officeEmail = activeBranch?.email || activeBranch?.emailAddress || activeBranch?.email_address || "N/A";
                const trnNumber = activeBranch?.trnNumber || activeBranch?.trn_number || activeBranch?.vatNumber || activeBranch?.vat_number || "N/A";
                const supplierName = selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "Local Vendor";
                const paymentMethod = selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "Cash";
                const shippingMode = selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "Local Purchase";
                const goodsName = selectedRowForVoucher.goodsName || selectedRowForVoucher.goods_name || "Local Purchase Goods";
                const hsCode = selectedRowForVoucher.hsCode || selectedRowForVoucher.hs_code || selectedRowForVoucher.chassisCode || selectedRowForVoucher.chassis_code || "-";
                const brandName = selectedRowForVoucher.brand || "-";
                const sizeName = selectedRowForVoucher.size || selectedRowForVoucher.sizeName || selectedRowForVoucher.size_name || "-";
                if (isUAE) {
                  return (
                    <div className="mx-auto max-w-[794px] space-y-4 bg-white text-[10px] text-slate-800 print:max-w-none print:text-[9px]">
                      <div className="overflow-hidden rounded-2xl border border-slate-300">
                        <div className="grid grid-cols-[88px_1fr_210px] gap-4 bg-slate-950 p-5 text-white">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-950">LOGO</div>
                          <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-[0.18em]">Tax Invoice</h2>
                            <p className="text-sm font-extrabold uppercase tracking-wide">{companyName}</p>
                            <p className="text-[10px] text-slate-300">{branchName}</p>
                            <p className="max-w-lg text-[10px] leading-4 text-slate-300">{officeAddress}</p>
                          </div>
                          <div className="space-y-1 text-right text-[10px]">
                            <p>Invoice No: <span className="font-mono font-black text-white">{voucherRef}</span></p>
                            <p>Invoice Date: <span className="font-mono font-bold">{rowDate}</span></p>
                            <p>Payment Method: <span className="font-bold">{paymentMethod}</span></p>
                            <p>Phone: <span className="font-bold">{officePhone}</span></p>
                            <p>Email: <span className="font-bold">{officeEmail}</span></p>
                            <p className="rounded-lg bg-white/10 px-2 py-1 font-bold text-blue-100">TRN / VAT: {trnNumber}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50 p-4">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Supplier Details</p>
                            <p className="text-sm font-black text-slate-900">{supplierName}</p>
                            <p className="mt-1 text-slate-500">Country: United Arab Emirates</p>
                            <p className="text-slate-500">Invoice Currency: <span className="font-bold text-slate-800">{rowCurrency}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Delivery / Warehouse</p>
                            <p>Transaction Type: <span className="font-bold">{shippingMode}</span></p>
                            <p>Warehouse: <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></p>
                            <p>Truck No: <span className="font-mono font-bold text-indigo-700">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Invoice Control</p>
                            <p>Branch: <span className="font-bold">{branchName}</span></p>
                            <p>Document Ref: <span className="font-mono font-bold">{voucherRef}</span></p>
                            <p>Status: <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">Posted</span></p>
                          </div>
                        </div>

                        <div className="p-4">
                          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 text-[9px]">
                            <thead className="bg-slate-900 text-white">
                              <tr>
                                <th className="border border-slate-800 p-2 text-left">Sr.</th>
                                <th className="border border-slate-800 p-2 text-left">Goods Name</th>
                                <th className="border border-slate-800 p-2 text-left">HS Code</th>
                                <th className="border border-slate-800 p-2 text-left">Brand</th>
                                <th className="border border-slate-800 p-2 text-left">Size</th>
                                <th className="border border-slate-800 p-2 text-right">Quantity</th>
                                <th className="border border-slate-800 p-2 text-left">Unit</th>
                                <th className="border border-slate-800 p-2 text-right">Unit Price</th>
                                <th className="border border-slate-800 p-2 text-right">Taxable Amount</th>
                                <th className="border border-slate-800 p-2 text-right">VAT %</th>
                                <th className="border border-slate-800 p-2 text-right">VAT Amount</th>
                                <th className="border border-slate-800 p-2 text-right">Total Amount</th>
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
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Amount In Words</p>
                              <p className="text-sm font-black capitalize text-slate-900">{amountToWordsEn(rowGrandTotal, rowCurrency)}</p>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-[9px]">
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">QR Code</p>
                                  <p className="mt-2 text-slate-400">QR placeholder for UAE e-invoice reference.</p>
                                </div>
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
                                  <p className="font-black uppercase text-slate-500">Company Stamp</p>
                                  <p className="mt-2 text-slate-400">Stamp area</p>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-300 text-[10px]">
                              <div className="bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">Summary</div>
                              <div className="space-y-2 p-3">
                                <div className="flex justify-between"><span>Sub Total</span><span className="font-mono font-bold">{rowCurrency} {rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between text-red-600"><span>VAT Total</span><span className="font-mono font-bold">{rowCurrency} {rowTaxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span>Freight / Loading</span><span className="font-mono font-bold">{rowCurrency} {rowFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between"><span>Round Off</span><span className="font-mono font-bold">{rowCurrency} {rowRoundOff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-emerald-700"><span>Grand Total</span><span className="font-mono">{rowCurrency} {rowGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 bg-slate-50 p-4 text-[9px]">
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-blue-800">Bank Details</p>
                            <p>Bank Name: <span className="font-bold">{activeBranch?.bankName || activeBranch?.bank_name || "-"}</span></p>
                            <p>Account Name: <span className="font-bold">{activeBranch?.bankAccountName || activeBranch?.bank_account_name || companyName}</span></p>
                            <p>IBAN: <span className="font-mono font-bold">{activeBranch?.iban || activeBranch?.bankIban || "-"}</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="font-black uppercase tracking-[0.14em] text-slate-700">Terms & Conditions</p>
                            <p>1. Goods received in good condition are subject to company purchase policy.</p>
                            <p>2. VAT and taxable amounts are calculated according to UAE tax invoice requirements.</p>
                            <p>3. This invoice is generated from the ERP local purchase module.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 p-5 text-center text-[9px] font-bold text-slate-600">
                          <div className="border-t border-slate-700 pt-2">Prepared By</div>
                          <div className="border-t border-slate-700 pt-2">Checked By</div>
                          <div className="border-t border-slate-700 pt-2">Authorized Signature</div>
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
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-tight">LOCAL PURCHASE BILL VOUCHER</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    {selectedRowForVoucher.branchName || "Global System Branch"}
                  </p>
                </div>
                <div className="text-right text-xs font-mono">
                  <span className="font-black text-blue-600 block text-sm">LP-{selectedRowForVoucher.id?.slice(0, 5).toUpperCase()}</span>
                  <span className="text-[9px] text-slate-500 block">Date: {new Date(selectedRowForVoucher.createdAt || selectedRowForVoucher.created_at).toLocaleDateString("en-GB")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Supplier / Vendor:</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedRowForVoucher.supplierName || selectedRowForVoucher.supplier_name || "-"}</span>
                  <span className="text-[9px] text-emerald-600 block font-bold mt-1 uppercase">
                    Payment Mode: {selectedRowForVoucher.paymentMode || selectedRowForVoucher.payment_mode || "Cash"}
                  </span>
                </div>
                <div className="text-right text-[10px] space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Shipping & Logistics:</span>
                  <div className="font-semibold text-slate-700">Mode: <span className="font-bold">{selectedRowForVoucher.shippingMode || selectedRowForVoucher.shipping_mode || "Loading"}</span></div>
                  <div className="font-semibold text-slate-700">Warehouse: <span className="font-bold">{selectedRowForVoucher.warehouseName || selectedRowForVoucher.warehouse_name || "-"}</span></div>
                  <div className="font-semibold text-slate-700">Truck No: <span className="font-bold font-mono text-indigo-600">{selectedRowForVoucher.truckNo || selectedRowForVoucher.truck_no || "-"}</span></div>
                </div>
              </div>

              <div>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-[9px] font-bold uppercase">
                    <tr>
                      <th className="p-2 border-b">Goods Item</th>
                      <th className="p-2 border-b">Brand/Origin</th>
                      <th className="p-2 border-b text-right">Qty</th>
                      <th className="p-2 border-b text-right">Net Weight</th>
                      <th className="p-2 border-b text-right">Rate</th>
                      <th className="p-2 border-b text-right">Final Amount</th>
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
                <span className="font-bold text-slate-300 uppercase">Total Bill Amount:</span>
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


    </div>
  );
}



















