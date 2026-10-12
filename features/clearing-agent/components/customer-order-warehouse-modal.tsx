"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Warehouse,
  Building2,
  User,
  MapPin,
  Search,
  Check,
  X,
  Phone,
  FileText,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Truck,
  ExternalLink,
  Info
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { fetchWarehouses, type WarehouseRecord } from "@/features/warehouses/warehouse-api";

export type WarehouseSelectionData = {
  warehouseSourceType: "company_warehouse" | "customer_warehouse" | "other";
  warehouseId: string;
  warehouseAccountId?: string;
  warehouseName: string;
  warehouseAddressText: string;
  contactPerson?: string;
  contactPhone?: string;
  remarks?: string;
};

interface CustomerOrderWarehouseModalProps {
  open: boolean;
  onClose: () => void;
  lang?: SupportedLanguage;
  initialValues: {
    warehouseSourceType?: "same" | "company_warehouse" | "customer_warehouse" | "other";
    warehouseId?: string;
    warehouseAccountId?: string;
    warehouseName?: string;
    warehouseAddressText?: string;
    contactPerson?: string;
    contactPhone?: string;
    remarks?: string;
  };
  onApply: (data: WarehouseSelectionData) => void;
  warehousesList: Array<any>;
  accounts: Array<any>;
  customers: Array<any>;
  selectedCustomer?: any;
  selectedAccount?: any;
}

export function CustomerOrderWarehouseModal({
  open,
  onClose,
  lang = "en",
  initialValues,
  onApply,
  warehousesList = [],
  accounts = [],
  customers = [],
  selectedCustomer,
  selectedAccount,
}: CustomerOrderWarehouseModalProps) {
  const isRtl = lang === "ar" || lang === "ur" || lang === "fa" || lang === "ps";
  const tt = (key: string, fallback: string) => t(lang as any, key as any, fallback);

  const initialType =
    initialValues.warehouseSourceType === "customer_warehouse"
      ? "customer_warehouse"
      : initialValues.warehouseSourceType === "other"
      ? "other"
      : "company_warehouse";

  const [activeTab, setActiveTab] = useState<"company_warehouse" | "customer_warehouse" | "other">(initialType);

  // Local state of loaded warehouses (seeds with prop or fetches from API)
  const [loadedWarehouses, setLoadedWarehouses] = useState<any[]>(warehousesList || []);
  const [loadingWhs, setLoadingWhs] = useState(false);

  // Sync with prop when parent finishes loading
  useEffect(() => {
    if (warehousesList && warehousesList.length > 0) {
      setLoadedWarehouses(warehousesList);
    }
  }, [warehousesList]);

  // Load from API if still empty
  useEffect(() => {
    if (!loadedWarehouses || loadedWarehouses.length === 0) {
      let cancelled = false;
      setLoadingWhs(true);
      fetchWarehouses(lang)
        .then((data) => {
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setLoadedWarehouses(data);
          }
        })
        .catch(() => null)
        .finally(() => {
          if (!cancelled) setLoadingWhs(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [loadedWarehouses.length, lang]);

  // Company warehouse state
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompanyWhId, setSelectedCompanyWhId] = useState(
    initialValues.warehouseId || (loadedWarehouses[0]?.id ?? "")
  );

  // When warehouses load, default to first if none selected
  useEffect(() => {
    if ((!selectedCompanyWhId || selectedCompanyWhId === "") && loadedWarehouses.length > 0) {
      setSelectedCompanyWhId(loadedWarehouses[0].id);
    }
  }, [loadedWarehouses, selectedCompanyWhId]);

  // Customer warehouse state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustId, setSelectedCustId] = useState<string>(
    selectedCustomer?.id || ""
  );
  const [selectedCustAccountId, setSelectedCustAccountId] = useState(
    initialValues.warehouseAccountId || selectedAccount?.id || ""
  );
  const [custWhName, setCustWhName] = useState(
    initialValues.warehouseName ||
      (selectedCustomer ? `${selectedCustomer.customer_name} Warehouse / Facility` : "")
  );
  const [custWhAddress, setCustWhAddress] = useState(
    initialValues.warehouseAddressText || selectedCustomer?.address || ""
  );
  const [custContactPerson, setCustContactPerson] = useState(
    initialValues.contactPerson || selectedCustomer?.contact_person || ""
  );
  const [custContactPhone, setCustContactPhone] = useState(
    initialValues.contactPhone || selectedCustomer?.mobile || selectedCustomer?.phone || ""
  );

  // Other warehouse state
  const [otherWhName, setOtherWhName] = useState(
    initialType === "other" ? initialValues.warehouseName || "" : ""
  );
  const [otherWhAddress, setOtherWhAddress] = useState(
    initialType === "other" ? initialValues.warehouseAddressText || "" : ""
  );
  const [otherContactPerson, setOtherContactPerson] = useState(
    initialType === "other" ? initialValues.contactPerson || "" : ""
  );
  const [otherContactPhone, setOtherContactPhone] = useState(
    initialType === "other" ? initialValues.contactPhone || "" : ""
  );
  const [otherRemarks, setOtherRemarks] = useState(initialValues.remarks || "");

  // Filtered company warehouses for dropdown & search
  const filteredCompanyWarehouses = useMemo(() => {
    const q = companySearch.toLowerCase().trim();
    if (!q) return loadedWarehouses;
    return loadedWarehouses.filter((w) => {
      const name = (w.warehouse_name || w.name || "").toLowerCase();
      const code = (w.warehouse_code || w.code || "").toLowerCase();
      const city = (w.city_name || "").toLowerCase();
      const country = (w.country_name || "").toLowerCase();
      const addr = (w.full_address || "").toLowerCase();
      return name.includes(q) || code.includes(q) || city.includes(q) || country.includes(q) || addr.includes(q);
    });
  }, [loadedWarehouses, companySearch]);

  // Selected company warehouse record (guaranteed fallback to first available)
  const selectedCompanyRecord = useMemo(() => {
    if (!loadedWarehouses || loadedWarehouses.length === 0) return null;
    return loadedWarehouses.find((w) => w.id === selectedCompanyWhId) || loadedWarehouses[0];
  }, [loadedWarehouses, selectedCompanyWhId]);

  // Filtered customer list for Customer Warehouse (only actual customers)
  const filteredCustomerList = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 20);
    return customers
      .filter((c) => {
        const name = (c.customer_name || "").toLowerCase();
        const code = (c.person_code || "").toLowerCase();
        const company = (c.company_name || "").toLowerCase();
        const addr = (c.address || "").toLowerCase();
        const mob = (c.mobile || "").toLowerCase();
        return name.includes(q) || code.includes(q) || company.includes(q) || addr.includes(q) || mob.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  if (!open) return null;

  const handleSelectCustomer = (c: any) => {
    setSelectedCustId(c.id);
    const relatedAccount = accounts.find(
      (a) => a.customer_id === c.id || a.id === c.account_id
    );
    if (relatedAccount?.id) setSelectedCustAccountId(relatedAccount.id);
    const resolvedName = c.customer_name || "Customer";
    setCustWhName(`${resolvedName} Warehouse / Facility`);
    setCustWhAddress(c.address || (c.city_name ? `${c.city_name}, ${c.country_name || ""}` : "Client Yard / Premises"));
    setCustContactPerson(c.contact_person || c.customer_name || "");
    setCustContactPhone(c.mobile || c.phone || c.whatsapp || "");
  };

  const handleApply = () => {
    if (activeTab === "company_warehouse") {
      const wh = selectedCompanyRecord;
      const addr = [wh?.full_address, wh?.city_name, wh?.country_name].filter(Boolean).join(", ");
      onApply({
        warehouseSourceType: "company_warehouse",
        warehouseId: wh?.id || "",
        warehouseName: wh?.warehouse_name || wh?.name || tt("own_warehouse_title", "Own Warehouse"),
        warehouseAddressText: addr || "Central Warehouse",
        contactPerson: wh?.owner_name || wh?.manager_name || "",
        contactPhone: wh?.contact_number || "",
      });
    } else if (activeTab === "customer_warehouse") {
      onApply({
        warehouseSourceType: "customer_warehouse",
        warehouseId: "",
        warehouseAccountId: selectedCustAccountId,
        warehouseName: custWhName.trim() || tt("customer_warehouse_title", "Customer Warehouse"),
        warehouseAddressText: custWhAddress.trim() || "Customer Premises / Yard",
        contactPerson: custContactPerson.trim(),
        contactPhone: custContactPhone.trim(),
      });
    } else {
      onApply({
        warehouseSourceType: "other",
        warehouseId: "",
        warehouseName: otherWhName.trim() || tt("other_warehouse_title", "Other Warehouse"),
        warehouseAddressText: otherWhAddress.trim() || "Third-Party Facility",
        contactPerson: otherContactPerson.trim(),
        contactPhone: otherContactPhone.trim(),
        remarks: otherRemarks.trim(),
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Warehouse className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("select_warehouse_location", "Select Warehouse Location")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("warehouse_modal_desc", "Configure warehouse facility where cargo is stored or delivered.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label={tt("close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3 Source Choice Tabs */}
        <div className="grid grid-cols-3 gap-2 pt-3 pb-2 shrink-0">
          {/* Tab 1: Company Warehouse */}
          <button
            type="button"
            onClick={() => setActiveTab("company_warehouse")}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              activeTab === "company_warehouse"
                ? "border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 dark:bg-blue-950/50 dark:border-blue-700"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <Building2 className={`h-4 w-4 ${activeTab === "company_warehouse" ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {tt("own_company_warehouse", "Company Warehouse")}
                </span>
              </div>
              {activeTab === "company_warehouse" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">✓</span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {tt("company_wh_desc", "From DGT central or branch warehouse master")}
            </p>
          </button>

          {/* Tab 2: Customer Warehouse */}
          <button
            type="button"
            onClick={() => setActiveTab("customer_warehouse")}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              activeTab === "customer_warehouse"
                ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:border-emerald-700"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <User className={`h-4 w-4 ${activeTab === "customer_warehouse" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`} />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {tt("customer_warehouse_label", "Customer Warehouse")}
                </span>
              </div>
              {activeTab === "customer_warehouse" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold">✓</span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {tt("customer_wh_desc", "Search by Customer Account # & registered address")}
            </p>
          </button>

          {/* Tab 3: Other Warehouse */}
          <button
            type="button"
            onClick={() => setActiveTab("other")}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              activeTab === "other"
                ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 dark:bg-amber-950/50 dark:border-amber-700"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <MapPin className={`h-4 w-4 ${activeTab === "other" ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`} />
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {tt("other_warehouse_label", "Other / 3rd-Party")}
                </span>
              </div>
              {activeTab === "other" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-white text-[9px] font-bold">✓</span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {tt("other_wh_desc", "Custom third-party yard, port terminal or depot")}
            </p>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2">
          {/* TAB 1: COMPANY WAREHOUSE */}
          {activeTab === "company_warehouse" && (
            <div className="space-y-3">
              {/* Dropdown / Select for Company Warehouse */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>{tt("select_company_warehouse_dropdown", "Company Warehouse Account / Facility")} *</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {loadingWhs ? tt("loading", "Loading warehouses...") : `${filteredCompanyWarehouses.length} ${tt("facilities_available", "facilities available")}`}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                  <select
                    value={selectedCompanyWhId}
                    onChange={(e) => setSelectedCompanyWhId(e.target.value)}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2.5 text-xs font-bold text-slate-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {filteredCompanyWarehouses.length === 0 ? (
                      <option value="">{tt("no_warehouses_match", "No warehouses match search")}</option>
                    ) : (
                      filteredCompanyWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_code ? `[${w.warehouse_code}] ` : ""}
                          {w.warehouse_name || w.name} • {w.city_name || "Central"}
                        </option>
                      ))
                    )}
                  </select>

                  {/* Filter search input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={tt("filter_warehouses", "Filter warehouse...")}
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Message-like Rich Detail Box ("Iske neeche uska poora ek message ki tarah uski detail aayega") */}
              {selectedCompanyRecord ? (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 p-3.5 text-slate-800 dark:border-blue-900/60 dark:from-blue-950/40 dark:to-slate-900 dark:text-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-2 mb-2.5 dark:border-blue-800/60">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-blue-950 dark:text-white">
                            {selectedCompanyRecord.warehouse_name || selectedCompanyRecord.name}
                          </span>
                          {selectedCompanyRecord.warehouse_code && (
                            <span className="rounded bg-blue-200/80 px-1.5 py-0.2 text-[10px] font-mono font-bold text-blue-900 dark:bg-blue-900 dark:text-blue-200">
                              {selectedCompanyRecord.warehouse_code}
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-blue-700/80 dark:text-blue-300">
                          {tt("dgt_verified_facility", "DGT Verified Corporate Storage Facility")}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{selectedCompanyRecord.status || tt("active", "Active")}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {tt("warehouse_address", "Facility Full Address")}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {selectedCompanyRecord.full_address || "Central Transit Terminal Road"}
                          </span>
                          {(selectedCompanyRecord.city_name || selectedCompanyRecord.country_name) && (
                            <span className="text-slate-500 block text-[11px]">
                              {[selectedCompanyRecord.city_name, selectedCompanyRecord.country_name].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 bg-white/70 p-2.5 rounded-lg border border-blue-100 dark:bg-slate-900/60 dark:border-blue-900/40">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{tt("facility_type", "Facility Type")}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedCompanyRecord.warehouse_type || "General Cargo"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{tt("responsible_person", "Facility In-Charge")}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedCompanyRecord.owner_name || selectedCompanyRecord.manager_name || "DGT Terminal Superintendent"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{tt("contact_line", "Contact Line")}:</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {selectedCompanyRecord.contact_number || "+971 (Dispatch Office)"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: CUSTOMER WAREHOUSE */}
          {activeTab === "customer_warehouse" && (
            <div className="space-y-3">
              {/* Active order customer quick banner */}
              {selectedCustomer && (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                      <User className="h-4 w-4" />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-emerald-950 dark:text-white flex items-center gap-1.5">
                        <span>{tt("order_active_customer", "Order Customer")}:</span>
                        <span className="font-black">{selectedCustomer.customer_name}</span>
                        {selectedCustomer.company_name && (
                          <span className="text-emerald-700 text-[11px]">({selectedCustomer.company_name})</span>
                        )}
                      </span>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate max-w-[360px]">
                        {selectedCustomer.address || tt("customer_registered_address", "Customer Registered Address")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustId(selectedCustomer.id);
                      setCustWhName(`${selectedCustomer.customer_name} Warehouse / Facility`);
                      setCustWhAddress(selectedCustomer.address || "Client Registered Address");
                      if (selectedAccount?.id) setSelectedCustAccountId(selectedAccount.id);
                      if (selectedCustomer.contact_person) setCustContactPerson(selectedCustomer.contact_person);
                      if (selectedCustomer.mobile || selectedCustomer.phone) {
                        setCustContactPhone(selectedCustomer.mobile || selectedCustomer.phone);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition shrink-0 shadow-2xs"
                  >
                    {tt("apply_customer_address", "Use Registered Address")}
                  </button>
                </div>
              )}

              {/* Customer Selector — strictly customer accounts / registered customers */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>{tt("select_customer_facility_label", "Select Customer / Account Facility")} *</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredCustomerList.length} {tt("customers_available", "registered clients")}
                  </span>
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={tt("search_customer_accounts_ph", "Search customer by name, code, company, city...")}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Customer quick selection cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto p-1 bg-slate-50/60 rounded-xl border border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
                  {filteredCustomerList.length === 0 ? (
                    <div className="col-span-2 p-3 text-center text-xs text-slate-400">
                      {tt("no_customer_accounts_found", "No matching customers found.")}
                    </div>
                  ) : (
                    filteredCustomerList.map((c) => {
                      const isSelected = selectedCustId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className={`p-2 rounded-lg text-xs font-medium border transition text-left flex items-center justify-between ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200 font-bold ring-1 ring-emerald-500"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <span className="font-mono text-[10px] text-slate-400 block">
                              {c.person_code || c.customer_code || `#${c.id.slice(0, 6)}`}
                            </span>
                            <span className="truncate block font-semibold">{c.customer_name}</span>
                            {c.city_name && (
                              <span className="text-[10px] text-slate-400 block truncate">{c.city_name}, {c.country_name}</span>
                            )}
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Editable Facility Name & Delivery Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("customer_facility_name", "Customer Facility / Yard Name")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("customer_wh_name_ph", "e.g. Client Yard #1 (Industrial Area)")}
                    value={custWhName}
                    onChange={(e) => setCustWhName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("delivery_facility_address", "Delivery / Facility Address")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("customer_address_ph", "Full Address / Plot / Gate #")}
                    value={custWhAddress}
                    onChange={(e) => setCustWhAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("contact_person", "Contact Person / Site In-Charge")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("contact_person_ph", "e.g. Tariq Khan")}
                    value={custContactPerson}
                    onChange={(e) => setCustContactPerson(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("contact_mobile", "Contact Mobile / WhatsApp")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("contact_mobile_ph", "+971 50 ... / +92 300 ...")}
                    value={custContactPhone}
                    onChange={(e) => setCustContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Message-like preview card for Customer Warehouse */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-2xs">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <User className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{custWhName.trim() || tt("customer_facility_preview", "Customer Registered Facility")}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                    {tt("verified_client", "Registered Client")}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300">
                  {custWhAddress.trim() || tt("registered_destination_address", "Client destination facility for delivery and unloading.")}
                </p>
                {(custContactPerson || custContactPhone) && (
                  <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400 mt-1">
                    {tt("contact", "Contact")}: {[custContactPerson, custContactPhone].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OTHER / THIRD-PARTY WAREHOUSE */}
          {activeTab === "other" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("other_warehouse_name_label", "Warehouse / Yard Name")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("other_wh_name_ph", "e.g. Al-Falah Logistics Yard, Gate 4")}
                    value={otherWhName}
                    onChange={(e) => setOtherWhName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("other_warehouse_address_label", "Location / Port / Full Address")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("other_wh_address_ph", "Plot No, Street, Port Area, City")}
                    value={otherWhAddress}
                    onChange={(e) => setOtherWhAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("contact_person", "Contact Person / Yard In-Charge")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("contact_person_ph", "e.g. Tariq Khan")}
                    value={otherContactPerson}
                    onChange={(e) => setOtherContactPerson(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("contact_mobile", "Contact Mobile / Phone")}
                  </label>
                  <input
                    type="text"
                    placeholder={tt("contact_mobile_ph", "+971 50 ... / +92 300 ...")}
                    value={otherContactPhone}
                    onChange={(e) => setOtherContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("warehouse_remarks", "Handling Instructions / Gate Entry Notes")}
                </label>
                <input
                  type="text"
                  placeholder={tt("warehouse_remarks_ph", "e.g. Weighbridge required, offloading crane at berth")}
                  value={otherRemarks}
                  onChange={(e) => setOtherRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Message-like preview card for Other Warehouse */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-2xs">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-600" />
                  <span>{otherWhName.trim() || tt("adhoc_yard_preview", "Ad-Hoc / Third-Party External Facility")}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                    {tt("adhoc_saved", "Saved to Order")}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300">
                  {otherWhAddress.trim() || tt("enter_adhoc_address", "Specify external location address and gate handling details above. This information is saved directly to this cargo manifest entry.")}
                </p>
                {(otherContactPerson || otherContactPhone) && (
                  <p className="text-[10.5px] text-amber-700 dark:text-amber-400 mt-1">
                    {tt("contact", "Contact")}: {[otherContactPerson, otherContactPhone].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>{tt("selected_source", "Source")}: </span>
            <span className="font-bold text-slate-900 dark:text-white capitalize">
              {activeTab === "company_warehouse"
                ? tt("own_company_warehouse", "Company Warehouse")
                : activeTab === "customer_warehouse"
                ? tt("customer_warehouse_label", "Customer Warehouse")
                : tt("other_warehouse_label", "Other / 3rd-Party")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              {tt("cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{tt("apply_warehouse_location", "Apply Warehouse Location")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
