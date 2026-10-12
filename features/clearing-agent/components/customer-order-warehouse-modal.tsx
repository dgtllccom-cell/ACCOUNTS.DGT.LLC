"use client";

import React, { useState, useMemo } from "react";
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
  ChevronRight
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

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
    remarks?: string;
  };
  onApply: (data: WarehouseSelectionData) => void;
  warehousesList: Array<{
    id: string;
    name?: string;
    warehouse_name?: string;
    city_name?: string;
    country_name?: string;
    full_address?: string;
    code?: string;
  }>;
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

  // Company warehouse state
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompanyWhId, setSelectedCompanyWhId] = useState(initialValues.warehouseId || "");

  // Customer warehouse state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustAccountId, setSelectedCustAccountId] = useState(
    initialValues.warehouseAccountId || selectedAccount?.id || ""
  );
  const [custWhName, setCustWhName] = useState(
    initialValues.warehouseName ||
      (selectedCustomer ? `${selectedCustomer.customer_name} Warehouse` : "")
  );
  const [custWhAddress, setCustWhAddress] = useState(
    initialValues.warehouseAddressText || selectedCustomer?.address || ""
  );

  // Other warehouse state
  const [otherWhName, setOtherWhName] = useState(
    initialType === "other" ? initialValues.warehouseName || "" : ""
  );
  const [otherWhAddress, setOtherWhAddress] = useState(
    initialType === "other" ? initialValues.warehouseAddressText || "" : ""
  );
  const [otherContactPerson, setOtherContactPerson] = useState("");
  const [otherContactPhone, setOtherContactPhone] = useState("");
  const [otherRemarks, setOtherRemarks] = useState(initialValues.remarks || "");

  // Filtered company warehouses
  const filteredCompanyWarehouses = useMemo(() => {
    const q = companySearch.toLowerCase().trim();
    if (!q) return warehousesList;
    return warehousesList.filter((w) => {
      const name = (w.warehouse_name || w.name || "").toLowerCase();
      const city = (w.city_name || "").toLowerCase();
      const country = (w.country_name || "").toLowerCase();
      const addr = (w.full_address || "").toLowerCase();
      return name.includes(q) || city.includes(q) || country.includes(q) || addr.includes(q);
    });
  }, [warehousesList, companySearch]);

  // Filtered accounts for customer warehouse search
  const filteredAccounts = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return accounts.slice(0, 15);
    return accounts.filter((a) => {
      const num = String(a.account_number || a.code || "").toLowerCase();
      const name = (a.name || a.account_name || "").toLowerCase();
      const custName = (a.customer_name || "").toLowerCase();
      return num.includes(q) || name.includes(q) || custName.includes(q);
    }).slice(0, 20);
  }, [accounts, customerSearch]);

  if (!open) return null;

  const handleSelectCustomerAccount = (acc: any) => {
    setSelectedCustAccountId(acc.id);
    const relatedCustomer = customers.find(
      (c) => c.id === acc.customer_id || c.account_id === acc.id
    );
    const resolvedName = acc.name || acc.account_name || relatedCustomer?.customer_name || "Customer";
    setCustWhName(`${resolvedName} Warehouse`);
    setCustWhAddress(relatedCustomer?.address || acc.address || "Client Yard / Premises");
  };

  const handleApply = () => {
    if (activeTab === "company_warehouse") {
      const wh = warehousesList.find((w) => w.id === selectedCompanyWhId) || warehousesList[0];
      const addr = [wh?.full_address, wh?.city_name, wh?.country_name].filter(Boolean).join(", ");
      onApply({
        warehouseSourceType: "company_warehouse",
        warehouseId: wh?.id || "",
        warehouseName: wh?.warehouse_name || wh?.name || tt("own_warehouse_title", "Own Warehouse"),
        warehouseAddressText: addr || "Central Warehouse",
      });
    } else if (activeTab === "customer_warehouse") {
      onApply({
        warehouseSourceType: "customer_warehouse",
        warehouseId: "",
        warehouseAccountId: selectedCustAccountId,
        warehouseName: custWhName.trim() || tt("customer_warehouse_title", "Customer Warehouse"),
        warehouseAddressText: custWhAddress.trim() || "Customer Premises / Yard",
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
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={tt("search_company_wh_ph", "Search company warehouse by name, city, address...")}
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto">
                {filteredCompanyWarehouses.length === 0 ? (
                  <div className="col-span-2 p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl dark:bg-slate-800/40">
                    {tt("no_company_warehouses", "No company warehouses found.")}
                  </div>
                ) : (
                  filteredCompanyWarehouses.map((w) => {
                    const isSelected = selectedCompanyWhId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedCompanyWhId(w.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition text-left flex flex-col justify-between ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500 dark:bg-blue-950/40"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {w.warehouse_name || w.name || "Company Warehouse"}
                          </span>
                          {isSelected ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px]">✓</span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">{w.city_name || "Central"}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {w.full_address || `${w.city_name || ""}, ${w.country_name || ""}`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMER WAREHOUSE */}
          {activeTab === "customer_warehouse" && (
            <div className="space-y-3">
              {/* Quick autofill from selected order customer if available */}
              {selectedCustomer && (
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      {tt("use_current_customer", "Order Customer")}: {selectedCustomer.customer_name}
                    </span>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate max-w-[340px]">
                      {selectedCustomer.address || tt("customer_registered_address", "Customer Registered Address")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustWhName(`${selectedCustomer.customer_name} Warehouse`);
                      setCustWhAddress(selectedCustomer.address || "Client Registered Address");
                      if (selectedAccount?.id) setSelectedCustAccountId(selectedAccount.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition shrink-0"
                  >
                    {tt("use_this_customer", "Use This Customer")}
                  </button>
                </div>
              )}

              {/* Search Customer Account Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {tt("search_customer_account_num", "Search Customer Account # / Name")} *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={tt("search_customer_account_ph", "Type Account # (e.g. 101, CUST-01) or customer name...")}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Account search quick picks */}
                <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                  {filteredAccounts.map((acc) => {
                    const isSelected = selectedCustAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectCustomerAccount(acc)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition text-left flex items-center gap-1.5 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-400">#{acc.account_number || acc.code || acc.id.slice(0, 5)}</span>
                        <span>{acc.name || acc.account_name}</span>
                        {isSelected && <Check className="h-3 w-3 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Warehouse Facility Name & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("customer_warehouse_name_label", "Customer Facility / Yard Name")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("customer_wh_name_ph", "e.g. Client Yard #1 (Industrial Area)")}
                    value={custWhName}
                    onChange={(e) => setCustWhName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {tt("customer_registered_address_label", "Delivery / Facility Address")} *
                  </label>
                  <input
                    type="text"
                    placeholder={tt("customer_address_ph", "Full Address / Plot / Gate #")}
                    value={custWhAddress}
                    onChange={(e) => setCustWhAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OTHER / THIRD-PARTY WAREHOUSE */}
          {activeTab === "other" && (
            <div className="space-y-2.5">
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
            {activeTab === "company_warehouse" && (
              <span>
                {tt("source", "Source")}: <strong className="text-blue-600 dark:text-blue-400">{tt("own_company_warehouse", "Company Warehouse")}</strong>
              </span>
            )}
            {activeTab === "customer_warehouse" && (
              <span>
                {tt("source", "Source")}: <strong className="text-emerald-600 dark:text-emerald-400">{custWhName || tt("customer_warehouse_label", "Customer Warehouse")}</strong>
              </span>
            )}
            {activeTab === "other" && (
              <span>
                {tt("source", "Source")}: <strong className="text-amber-600 dark:text-amber-400">{otherWhName || tt("other_warehouse_label", "Other / 3rd-Party")}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
            >
              {tt("cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-600/25 active:scale-95 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{tt("apply_warehouse_location", "Apply Warehouse Location")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
