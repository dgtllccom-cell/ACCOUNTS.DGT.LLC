"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search, ChevronDown, ChevronUp, X, Check, FileText
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface CustomerOrderOption {
  id: string;
  order_no: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_account_id?: string | null;
  customer_account_number?: string | null;
  transport_mode?: string | null;
  movement_type?: string | null;
  loading_port_name?: string | null;
  destination_port_name?: string | null;
  truck_number?: string | null;
  bl_number?: string | null;
  container_number?: string | null;
  cargo_details?: string | null;
  currency_code?: string | null;
}

export interface CustomerOrderMultiSelectProps {
  orders: CustomerOrderOption[];
  selectedOrderIds: string[];
  onChange: (selectedIds: string[], selectedOrders: CustomerOrderOption[]) => void;
  lang?: SupportedLanguage;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function CustomerOrderMultiSelect({
  orders = [],
  selectedOrderIds = [],
  onChange,
  lang: langProp,
  disabled = false,
  required = true,
  className = ""
}: CustomerOrderMultiSelectProps) {
  const activeLang = useActiveLanguage();
  const lang = langProp || activeLang || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Translation helper
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Selected orders lookup map
  const selectedIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);

  const selectedOrders = useMemo(() => {
    return orders.filter((ord) => selectedIdSet.has(ord.id));
  }, [orders, selectedIdSet]);

  // Filtered orders list based on search term
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((ord) => {
      const orderNo = (ord.order_no || "").toLowerCase();
      const custName = (ord.customer_name || "").toLowerCase();
      const blNo = (ord.bl_number || "").toLowerCase();
      const contNo = (ord.container_number || "").toLowerCase();
      const route = `${ord.loading_port_name || ""} ${ord.destination_port_name || ""}`.toLowerCase();
      return (
        orderNo.includes(term) ||
        custName.includes(term) ||
        blNo.includes(term) ||
        contNo.includes(term) ||
        route.includes(term)
      );
    });
  }, [orders, searchTerm]);

  // Toggle single order selection
  const handleToggleOrder = (orderId: string) => {
    if (disabled) return;
    const nextSet = new Set(selectedIdSet);
    if (nextSet.has(orderId)) {
      nextSet.delete(orderId);
    } else {
      nextSet.add(orderId);
    }
    const nextIds = Array.from(nextSet);
    const nextOrders = orders.filter((o) => nextSet.has(o.id));
    onChange(nextIds, nextOrders);
  };

  // Remove specific order chip
  const handleRemoveChip = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (disabled) return;
    const nextIds = selectedOrderIds.filter((id) => id !== orderId);
    const nextOrders = orders.filter((o) => nextIds.includes(o.id));
    onChange(nextIds, nextOrders);
  };

  // Select all orders
  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    const allIds = orders.map((o) => o.id);
    onChange(allIds, orders);
  };

  // Clear all selections
  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    onChange([], []);
  };

  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen((prev) => {
        if (prev) setSearchTerm("");
        return !prev;
      });
    }
  };

  return (
    <div
      ref={containerRef}
      dir={isRtl ? "rtl" : "ltr"}
      className={`space-y-1.5 relative ${className}`}
    >
      {/* Header: label + Select All checkbox — matches "Select Bill Transfer Types" reference */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
          <span>{tt("cbill.select_orders", "Select Customer Orders")}</span>
          {required && <span className="text-blue-600 font-bold">*</span>}
        </label>

        {orders.length > 0 && !disabled && (
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={(e) => {
                if (e.target.checked) handleSelectAll();
                else handleClearAll();
              }}
              className="h-3.5 w-3.5 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span>{tt("cbill.select_all", "Select All")}</span>
          </label>
        )}
      </div>

      {/* Sub-label */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {tt("cbill.select_orders_sub", "Choose one or more customer orders to include in this bill.")}
      </p>

      {/* Main trigger: chip container + chevron — identical structure to "Select Expense Types" */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        id="customer-order-multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={tt("cbill.select_orders", "Select Customer Orders")}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            toggleOpen();
          }
          if (e.key === "Escape" && isOpen) {
            setIsOpen(false);
            setSearchTerm("");
          }
        }}
        className={[
          "w-full min-h-[44px] rounded-xl border transition-all flex items-center justify-between p-2 gap-2 outline-none",
          disabled
            ? "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 shadow-sm cursor-pointer"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer",
        ].join(" ")}
      >
        {/* Chip area */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedOrders.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 px-1 font-medium select-none">
              {tt("cbill.search_orders_ph", "Search customer orders...")}
            </span>
          ) : (
            selectedOrders.map((ord) => (
              <span
                key={ord.id}
                title={`${ord.order_no}${ord.customer_name ? ` — ${ord.customer_name}` : ""}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 shadow-2xs transition hover:bg-blue-100 dark:hover:bg-blue-900/60 select-none"
              >
                <span className="font-mono">{ord.order_no}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${ord.order_no}`}
                    onClick={(e) => handleRemoveChip(e, ord.id)}
                    className="p-0.5 rounded-full hover:bg-blue-200/80 dark:hover:bg-blue-800/80 text-blue-500 dark:text-blue-300 hover:text-rose-600 dark:hover:text-rose-400 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {/* Chevron */}
        <div className="shrink-0 text-slate-400 dark:text-slate-500 ps-1">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Dropdown panel */}
      {isOpen && !disabled && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={tt("cbill.select_orders", "Select Customer Orders")}
          className="absolute start-0 end-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Search field */}
          <div className="relative border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tt("cbill.search_orders_ph", "Search customer orders...")}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 ps-8 pe-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Count + quick actions ribbon */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-medium">
            <span className="text-slate-500 dark:text-slate-400">
              {selectedOrderIds.length} / {orders.length}{" "}
              {tt("cbill.status_submitted", "Selected")}
            </span>
            <div className="flex items-center gap-3">
              {selectedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-bold transition"
                >
                  {tt("cbill.clear_all", "Clear All")}
                </button>
              )}
              {selectedOrderIds.length < orders.length && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold transition"
                >
                  {tt("cbill.select_all", "Select All")}
                </button>
              )}
            </div>
          </div>

          {/* Order rows */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <FileText className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{tt("cbill.no_orders_found", "No customer orders found.")}</p>
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedIdSet.has(ord.id);
                return (
                  <div
                    key={ord.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleToggleOrder(ord.id)}
                    className={[
                      "p-2.5 flex items-center gap-3 cursor-pointer transition select-none",
                      isSelected
                        ? "bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    ].join(" ")}
                  >
                    {/* Custom checkbox box */}
                    <div
                      className={[
                        "h-4 w-4 rounded shrink-0 flex items-center justify-center border transition",
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800",
                      ].join(" ")}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                          {ord.order_no}
                        </span>
                        {ord.transport_mode && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {ord.transport_mode.replace("_", " ")}
                          </span>
                        )}
                        {ord.movement_type && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                            {ord.movement_type}
                          </span>
                        )}
                      </div>

                      {ord.customer_name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium mt-0.5">
                          {ord.customer_name}
                        </div>
                      )}

                      {(ord.loading_port_name || ord.destination_port_name) && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {[ord.loading_port_name, ord.destination_port_name]
                            .filter(Boolean)
                            .join(isRtl ? " ← " : " → ")}
                        </div>
                      )}
                    </div>

                    {/* Right badge */}
                    {ord.bl_number && (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                        {ord.bl_number}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export interface CustomerOrderOption {
  id: string;
  order_no: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_account_id?: string | null;
  customer_account_number?: string | null;
  transport_mode?: string | null;
  movement_type?: string | null;
  loading_port_name?: string | null;
  destination_port_name?: string | null;
  truck_number?: string | null;
  bl_number?: string | null;
  container_number?: string | null;
  cargo_details?: string | null;
  currency_code?: string | null;
}

export interface CustomerOrderMultiSelectProps {
  orders: CustomerOrderOption[];
  selectedOrderIds: string[];
  onChange: (selectedIds: string[], selectedOrders: CustomerOrderOption[]) => void;
  lang?: SupportedLanguage;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function CustomerOrderMultiSelect({
  orders = [],
  selectedOrderIds = [],
  onChange,
  lang: langProp,
  disabled = false,
  required = true,
  className = ""
}: CustomerOrderMultiSelectProps) {
  const activeLang = useActiveLanguage();
  const lang = langProp || activeLang || "en";
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Translation helper
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Selected orders lookup map
  const selectedIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);

  const selectedOrders = useMemo(() => {
    return orders.filter((ord) => selectedIdSet.has(ord.id));
  }, [orders, selectedIdSet]);

  // Filtered orders list based on search term
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((ord) => {
      const orderNo = (ord.order_no || "").toLowerCase();
      const custName = (ord.customer_name || "").toLowerCase();
      const blNo = (ord.bl_number || "").toLowerCase();
      const contNo = (ord.container_number || "").toLowerCase();
      const route = `${ord.loading_port_name || ""} ${ord.destination_port_name || ""}`.toLowerCase();
      return (
        orderNo.includes(term) ||
        custName.includes(term) ||
        blNo.includes(term) ||
        contNo.includes(term) ||
        route.includes(term)
      );
    });
  }, [orders, searchTerm]);

  // Toggle single order selection
  const handleToggleOrder = (orderId: string) => {
    if (disabled) return;
    const nextSet = new Set(selectedIdSet);
    if (nextSet.has(orderId)) {
      nextSet.delete(orderId);
    } else {
      nextSet.add(orderId);
    }
    const nextIds = Array.from(nextSet);
    const nextOrders = orders.filter((o) => nextSet.has(o.id));
    onChange(nextIds, nextOrders);
  };

  // Remove specific order chip
  const handleRemoveChip = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (disabled) return;
    const nextIds = selectedOrderIds.filter((id) => id !== orderId);
    const nextOrders = orders.filter((o) => nextIds.includes(o.id));
    onChange(nextIds, nextOrders);
  };

  // Select all orders
  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    const allIds = orders.map((o) => o.id);
    onChange(allIds, orders);
  };

  // Clear all selections
  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    onChange([], []);
  };

  const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  return (
    <div
      ref={containerRef}
      dir={isRtl ? "rtl" : "ltr"}
      className={`space-y-1.5 relative ${className}`}
    >
      {/* Header with Label and Select All checkbox */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <span>{tt("cbill.select_orders", "Select Customer Orders")}</span>
            {required && <span className="text-blue-600 font-bold">*</span>}
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {tt("cbill.select_orders_sub", "Choose one or more customer orders to include in this bill.")}
          </p>
        </div>

        {orders.length > 0 && !disabled && (
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleSelectAll();
                  } else {
                    handleClearAll();
                  }
                }}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 rounded-sm cursor-pointer"
              />
              <span>{tt("cbill.select_all", "Select All")}</span>
            </label>
          </div>
        )}
      </div>

      {/* Main Multi-Select Input Field Container */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full min-h-[44px] rounded-xl border transition-all flex items-center justify-between p-2 cursor-pointer select-none ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900 shadow-sm"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
        }`}
      >
        {/* Selected Order Chips Area */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 pe-2">
          {selectedOrders.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 px-1 font-medium">
              {tt("cbill.search_orders_ph", "Search customer orders...")}
            </span>
          ) : (
            selectedOrders.map((ord) => (
              <span
                key={ord.id}
                title={`${ord.order_no} — ${ord.customer_name || "Customer"}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 shadow-2xs transition hover:bg-blue-100 dark:hover:bg-blue-900/60"
              >
                <span className="font-mono">{ord.order_no}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${ord.order_no}`}
                    onClick={(e) => handleRemoveChip(e, ord.id)}
                    className="p-0.5 rounded-full hover:bg-blue-200/80 dark:hover:bg-blue-800/80 text-blue-600 dark:text-blue-300 hover:text-rose-600 dark:hover:text-rose-400 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {/* Dropdown Toggle Icon */}
        <div className="shrink-0 text-slate-400 dark:text-slate-500 ps-1">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Floating Dropdown List Panel */}
      {isOpen && !disabled && (
        <div
          className="absolute start-0 end-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Search Box Header */}
          <div className="relative border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tt("cbill.search_orders_ph", "Search customer orders...")}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 ps-8 pe-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Quick Action Ribbon inside dropdown */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-medium">
            <span>
              {selectedOrderIds.length} / {orders.length} {tt("cbill.status_submitted", "Selected")}
            </span>
            <div className="flex items-center gap-3">
              {selectedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-700 dark:text-rose-400 font-bold transition"
                >
                  {tt("cbill.clear_all", "Clear All")}
                </button>
              )}
              {selectedOrderIds.length < orders.length && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold transition"
                >
                  {tt("cbill.select_all", "Select All")}
                </button>
              )}
            </div>
          </div>

          {/* Orders Scrollable List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                <FileText className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{tt("cbill.no_orders_found", "No customer orders found.")}</p>
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedIdSet.has(ord.id);
                return (
                  <div
                    key={ord.id}
                    onClick={() => handleToggleOrder(ord.id)}
                    className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {/* Checkbox and Order Identification */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {ord.order_no}
                          </span>
                          {ord.transport_mode && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {ord.transport_mode.replace("_", " ")}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium">
                          {ord.customer_name || "Customer"}
                        </div>

                        {(ord.loading_port_name || ord.destination_port_name) && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {[ord.loading_port_name, ord.destination_port_name].filter(Boolean).join(" → ")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side metadata badge */}
                    {ord.movement_type && (
                      <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">
                        {ord.movement_type}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
