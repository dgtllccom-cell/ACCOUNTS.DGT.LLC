"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  FileText,
  Printer,
  Share2,
  Send,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  DollarSign,
  Truck,
  Ship,
  MapPin,
  Calendar,
  Building2,
  User,
  ShieldCheck,
  ExternalLink,
  Search,
  MessageSquare,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Layers,
  Paperclip,
  Phone,
  Mail,
  HelpCircle
} from "lucide-react";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { apiGet } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { CustomerBillRow, CustomerBillItemRow } from "@/lib/services/clearing-customer-bill-service";
import {
  CustomerOrderMultiSelect,
  type CustomerOrderOption
} from "@/features/clearing-agent/components/customer-order-multi-select";

const CHARGE_CATEGORIES = [
  { value: "freight", labelKey: "cbill.charge_freight", defaultLabel: "Freight Charges" },
  { value: "customs", labelKey: "cbill.charge_customs", defaultLabel: "Customs Duty & Clearance" },
  { value: "port_charges", labelKey: "cbill.charge_port", defaultLabel: "Port & Terminal Handling" },
  { value: "clearing", labelKey: "cbill.charge_clearing", defaultLabel: "Clearing Agent Agency Fee" },
  { value: "loading", labelKey: "cbill.charge_loading", defaultLabel: "Loading & Labor Charges" },
  { value: "unloading", labelKey: "cbill.charge_unloading", defaultLabel: "Unloading Charges" },
  { value: "warehouse", labelKey: "cbill.charge_warehouse", defaultLabel: "Warehouse & Storage" },
  { value: "documentation", labelKey: "cbill.charge_documentation", defaultLabel: "Documentation & Border Fees" },
  { value: "delivery", labelKey: "cbill.charge_delivery", defaultLabel: "Local Delivery & Haulage" },
  { value: "demurrage", labelKey: "cbill.charge_demurrage", defaultLabel: "Demurrage & Detention" },
  { value: "other", labelKey: "cbill.charge_other", defaultLabel: "Other Miscellaneous Charges" }
] as const;

const EXPENSE_TYPES = [
  { id: "customer_expenses", labelKey: "Customer Expenses", defaultLabel: "Customer Expenses" },
  { id: "customs_expenses", labelKey: "Customs Expenses", defaultLabel: "Customs Expenses" },
  { id: "loading_expenses", labelKey: "Loading Expenses", defaultLabel: "Loading Expenses" },
  { id: "truck_expenses", labelKey: "Truck Expenses", defaultLabel: "Truck Expenses" },
  { id: "other_expenses", labelKey: "Other Expenses", defaultLabel: "Other Expenses" }
];

export function CustomerBillManagementView() {
  const activeLang = useActiveLanguage();
  const lang = (activeLang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const searchParams = useSearchParams();
  const router = useRouter();

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  // Core Bill and Items State
  const [bill, setBill] = useState<CustomerBillRow | null>(null);
  const [items, setItems] = useState<CustomerBillItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Available Customer Orders & Multi-Selection
  const [availableOrders, setAvailableOrders] = useState<CustomerOrderOption[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedOrdersList, setSelectedOrdersList] = useState<CustomerOrderOption[]>([]);

  // Selected Transfer Expense Types
  const [selectedExpenseTypes, setSelectedExpenseTypes] = useState<string[]>([
    "customer_expenses",
    "customs_expenses",
    "truck_expenses"
  ]);
  const [expenseTypesDropdownOpen, setExpenseTypesDropdownOpen] = useState(false);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");

  // Workflow User Assignment
  const [assignedUser, setAssignedUser] = useState<string>("Shipping Line User");
  const [availableUsers, setAvailableUsers] = useState<string[]>([
    "Shipping Line User",
    "Clearing Agent User",
    "Accounts Department",
    "Finance Approval Manager"
  ]);

  // Currency Selector
  const [selectedCurrency, setSelectedCurrency] = useState<string>("PKR");

  // Charge Entry Modal/Drawer toggle
  const [isChargeFormOpen, setIsChargeFormOpen] = useState(false);
  const [chargeSearchInput, setChargeSearchInput] = useState("");

  // Live Bill Preview Tabs
  const [previewTab, setPreviewTab] = useState<"charges" | "logistics" | "notes" | "documents">("charges");

  // Bill Totals State
  const [dueDate, setDueDate] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  const [otherCharges, setOtherCharges] = useState<string>("0");
  const [remarks, setRemarks] = useState<string>("");

  // New Line Item State
  const [newChargeType, setNewChargeType] = useState<string>("freight");
  const [newChargeName, setNewChargeName] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newQuantity, setNewQuantity] = useState<string>("1");
  const [newUnit, setNewUnit] = useState<string>("unit");
  const [newRate, setNewRate] = useState<string>("0");
  const [newTaxPct, setNewTaxPct] = useState<string>("0");
  const [newRemarks, setNewRemarks] = useState<string>("");

  // Post confirmation modal
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);

  // Available Bills list for pagination / switcher
  const [recentBills, setRecentBills] = useState<CustomerBillRow[]>([]);
  const [currentBillIndex, setCurrentBillIndex] = useState(0);

  const printRef = useRef<HTMLDivElement>(null);
  const expenseDropdownRef = useRef<HTMLDivElement>(null);

  // Close expense dropdown on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (expenseDropdownRef.current && !expenseDropdownRef.current.contains(e.target as Node)) {
        setExpenseTypesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Calculate live financial totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [items]);

  const totalTax = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.tax_amount) || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    const disc = Math.max(Number(discountAmount) || 0, 0);
    const oth = Math.max(Number(otherCharges) || 0, 0);
    return Number((subtotal + totalTax + oth - disc).toFixed(2));
  }, [subtotal, totalTax, discountAmount, otherCharges]);

  const balanceDue = useMemo(() => {
    const paid = Number(bill?.paid_amount) || 0;
    return Number((grandTotal - paid).toFixed(2));
  }, [grandTotal, bill?.paid_amount]);

  // Load available customer orders from database
  async function loadCustomerOrders() {
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-order");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped: CustomerOrderOption[] = json.data.map((o: any) => ({
          id: o.id,
          order_no: o.order_no || `ORD-${o.id.slice(0, 6)}`,
          customer_id: o.customer_id,
          customer_name: o.customer_name || "Customer",
          customer_account_id: o.customer_account_id,
          customer_account_number: o.customer_account_number,
          transport_mode: o.transport_mode,
          movement_type: o.movement_type,
          loading_port_name: o.loading_port_name,
          destination_port_name: o.destination_port_name,
          truck_number: o.truck_number,
          bl_number: o.bl_number,
          container_number: o.container_number,
          cargo_details: o.cargo_details,
          currency_code: o.currency_code
        }));
        setAvailableOrders(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn("Could not load customer orders:", err);
    }
    return [];
  }

  // Load bill and orders data
  async function loadBillData() {
    setLoading(true);
    setError(null);
    try {
      const orders = await loadCustomerOrders();

      const orderIdParam = searchParams.get("orderId");
      const billIdParam = searchParams.get("id");

      let endpoint = "";
      if (orderIdParam) {
        endpoint = `/api/erp/clearing-agent/customer-bill?orderId=${encodeURIComponent(orderIdParam)}`;
      } else if (billIdParam) {
        endpoint = `/api/erp/clearing-agent/customer-bill/${encodeURIComponent(billIdParam)}`;
      } else {
        const res = await fetch("/api/erp/clearing-agent/customer-bill");
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          setRecentBills(json.data);
          endpoint = `/api/erp/clearing-agent/customer-bill/${json.data[0].id}`;
        }
      }

      if (endpoint) {
        const res = await fetch(endpoint);
        const json = await res.json();
        if (json.success && json.data) {
          const b: CustomerBillRow = json.data;
          setBill(b);
          setItems(b.items || []);
          setDueDate(b.due_date ? String(b.due_date).slice(0, 10) : "");
          setDiscountAmount(String(b.discount_amount || 0));
          setOtherCharges(String(b.other_charges || 0));
          setRemarks(b.remarks || "");
          if (b.currency_code) {
            setSelectedCurrency(b.currency_code);
          }

          // Pre-select order in CustomerOrderMultiSelect
          if (b.order_id) {
            setSelectedOrderIds([b.order_id]);
            const matched = orders.find((o) => o.id === b.order_id);
            if (matched) setSelectedOrdersList([matched]);
          }
        }
      } else if (orderIdParam && orders.length > 0) {
        // Automatically preselect if creating new bill from order
        const matched = orders.find((o) => o.id === orderIdParam);
        if (matched) {
          setSelectedOrderIds([matched.id]);
          setSelectedOrdersList([matched]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load customer bill.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBillData();
  }, [searchParams]);

  // Handle customer orders multi-select change
  function handleCustomerOrdersChange(selectedIds: string[], selectedOrders: CustomerOrderOption[]) {
    setSelectedOrderIds(selectedIds);
    setSelectedOrdersList(selectedOrders);

    // If an order is selected and no bill exists or bill order not locked, reflect the primary order's details
    if (selectedOrders.length > 0) {
      const primary = selectedOrders[0];
      setBill((prev) => {
        if (!prev) {
          return {
            id: "temp_bill",
            order_id: primary.id,
            order_no: primary.order_no,
            customer_id: primary.customer_id || "",
            customer_name: primary.customer_name || "Customer",
            customer_account_id: primary.customer_account_id || null,
            customer_account_number: primary.customer_account_number || "AR-001245",
            bill_no: "CB-2025-0001",
            bill_date: new Date().toISOString(),
            due_date: null,
            currency_code: selectedCurrency,
            exchange_rate: 1,
            transport_mode: primary.transport_mode || "by_sea",
            movement_type: primary.movement_type || "import",
            shipment_type: "Full Container Load",
            loading_port_name: primary.loading_port_name || null,
            destination_port_name: primary.destination_port_name || null,
            truck_number: primary.truck_number || null,
            subtotal: 0,
            tax_amount: 0,
            discount_amount: 0,
            other_charges: 0,
            grand_total: 0,
            paid_amount: 0,
            balance_due: 0,
            status: "draft",
            submitted_by: null,
            submitted_at: null,
            approved_by: null,
            approved_at: null,
            posted_by: null,
            posted_at: null,
            roznamcha_entry_id: null,
            super_admin_serial: "0001245",
            country_serial: "PK-00421",
            branch_serial: "KHI-0123",
            entry_serial: "0001",
            country_id: null,
            country_branch_id: null,
            city_branch_id: null,
            remarks: "",
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        return {
          ...prev,
          order_id: primary.id,
          order_no: selectedOrders.map((o) => o.order_no).join(", "),
          customer_name: primary.customer_name || prev.customer_name,
          customer_account_number: primary.customer_account_number || prev.customer_account_number,
          transport_mode: primary.transport_mode || prev.transport_mode,
          movement_type: primary.movement_type || prev.movement_type,
          loading_port_name: primary.loading_port_name || prev.loading_port_name,
          destination_port_name: primary.destination_port_name || prev.destination_port_name
        };
      });
    }
  }

  // Toggle single expense type chip
  function toggleExpenseType(typeId: string) {
    if (selectedExpenseTypes.includes(typeId)) {
      setSelectedExpenseTypes(selectedExpenseTypes.filter((t) => t !== typeId));
    } else {
      setSelectedExpenseTypes([...selectedExpenseTypes, typeId]);
    }
  }

  // Add line item
  function handleAddLineItem() {
    const qty = Math.max(Number(newQuantity) || 1, 0);
    const rate = Math.max(Number(newRate) || 0, 0);
    const amt = Number((qty * rate).toFixed(2));
    const taxP = Math.max(Number(newTaxPct) || 0, 0);
    const taxAmt = Number(((amt * taxP) / 100).toFixed(2));
    const totalAmt = Number((amt + taxAmt).toFixed(2));

    const selectedCat = CHARGE_CATEGORIES.find((c) => c.value === newChargeType);
    const effectiveName =
      newChargeName.trim() ||
      chargeSearchInput.trim() ||
      tt(selectedCat?.labelKey ?? "", selectedCat?.defaultLabel ?? "Charge");

    const newItem: CustomerBillItemRow = {
      id: "temp_" + Date.now(),
      bill_id: bill?.id || "",
      item_order: items.length + 1,
      charge_type: newChargeType,
      charge_name: effectiveName,
      description: newDescription.trim() || null,
      quantity: qty,
      unit: newUnit.trim() || "unit",
      rate: rate,
      amount: amt,
      tax_pct: taxP,
      tax_amount: taxAmt,
      total_amount: totalAmt,
      remarks: newRemarks.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setItems([...items, newItem]);
    setNewChargeName("");
    setNewDescription("");
    setChargeSearchInput("");
    setIsChargeFormOpen(false);
  }

  // Remove line item
  function handleRemoveLineItem(index: number) {
    const next = [...items];
    next.splice(index, 1);
    setItems(next);
  }

  // Save draft bill
  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const targetOrderId = selectedOrderIds[0] || bill?.order_id;
      if (!targetOrderId && (!bill || bill.id === "temp_bill")) {
        throw new Error(tt("cbill.select_orders", "Please select at least one customer order."));
      }

      let activeBillId = bill?.id;

      // If temp bill, create on backend first
      if (!activeBillId || activeBillId === "temp_bill") {
        const createRes = await fetch("/api/erp/clearing-agent/customer-bill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: targetOrderId })
        });
        const createJson = await createRes.json();
        if (!createJson.success) throw new Error(createJson.error || "Failed to create customer bill.");
        activeBillId = createJson.data.id;
        setBill(createJson.data);
      }

      const payload = {
        dueDate: dueDate || null,
        discountAmount: Number(discountAmount) || 0,
        otherCharges: Number(otherCharges) || 0,
        remarks: remarks || null,
        items: items.map((it, idx) => ({
          item_order: idx + 1,
          charge_type: it.charge_type,
          charge_name: it.charge_name,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "unit",
          rate: Number(it.rate) || 0,
          tax_pct: Number(it.tax_pct) || 0,
          remarks: it.remarks
        }))
      };

      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${activeBillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save bill.");

      setBill(json.data);
      setItems(json.data.items || []);
      setSuccessMsg(tt("cbill.save_draft", "Customer bill draft saved successfully!"));
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Submit bill
  async function handleSubmit() {
    if (!bill || bill.id === "temp_bill") {
      await handleSaveDraft();
    }
    if (!bill) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}/submit`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to submit bill.");
      setBill(json.data);
      setSuccessMsg(tt("cbill.submit_approval", "Customer bill submitted for supervisor review!"));
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Approve bill
  async function handleApprove() {
    if (!bill || bill.id === "temp_bill") return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}/approve`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to approve bill.");
      setBill(json.data);
      setSuccessMsg(tt("cbill.approve_bill", "Customer bill approved successfully!"));
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Post bill to general ledger / roznamcha
  async function handlePostToLedger() {
    if (!bill || bill.id === "temp_bill") return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}/post`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to post bill to ledger.");
      setBill(json.data.bill);
      setConfirmPostOpen(false);
      setSuccessMsg(tt("cbill.posted_to_ledger", `Customer Bill successfully posted to General Ledger (Voucher: ${json.data.entryId})!`));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  // Native Print
  function handlePrint() {
    window.print();
  }

  // Share via WhatsApp
  function handleShareWhatsApp() {
    if (!bill) return;
    const msg = `*Customer Bill: ${bill.bill_no}*\nOrder(s): ${bill.order_no ?? "N/A"}\nCustomer: ${bill.customer_name ?? "Customer"}\nTotal Due: ${selectedCurrency} ${grandTotal.toFixed(2)}\nStatus: ${bill.status.toUpperCase()}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const isLocked = bill?.status === "posted";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 space-y-6"
    >
      {/* 1. Header & Global Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/dashboard/clearing-agent/customer-order" className="hover:text-blue-600 transition">
              Shipping & Clearing
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">
              {tt("cbill.title", "Customer Bill")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{tt("cbill.title", "Customer Bill")}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("cbill.subtitle", "Create, review and post shipping customer bills linked to customer orders and accounting ledgers.")}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Currency Selector */}
          <div className="relative inline-flex items-center">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              🇵🇰
            </span>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="appearance-none ps-8 pe-7 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-2xs outline-none cursor-pointer hover:border-slate-300"
            >
              <option value="PKR">Currency: PKR</option>
              <option value="AED">Currency: AED</option>
              <option value="USD">Currency: USD</option>
              <option value="EUR">Currency: EUR</option>
            </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Print Bill */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
            <span>{tt("cbill.print_bill", "Print Bill")}</span>
          </button>

          {/* Share WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition shadow-2xs"
          >
            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{tt("cbill.share_whatsapp", "Share WhatsApp")}</span>
          </button>

          {/* Save Draft */}
          {!isLocked && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm shadow-blue-600/20 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{tt("cbill.save_draft", "Save Draft")}</span>
            </button>
          )}

          {/* Supervisor Approval & Ledger Posting */}
          {!isLocked && bill && bill.status === "draft" && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition shadow-2xs shadow-amber-600/20"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{tt("cbill.submit_approval", "Submit for Review")}</span>
            </button>
          )}

          {!isLocked && bill && (bill.status === "draft" || bill.status === "submitted") && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xs shadow-emerald-600/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{tt("cbill.approve_bill", "Approve Bill")}</span>
            </button>
          )}

          {!isLocked && bill && bill.status === "approved" && (
            <button
              type="button"
              onClick={() => setConfirmPostOpen(true)}
              disabled={posting || grandTotal <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition shadow-sm shadow-purple-600/25"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{tt("cbill.post_to_ledger", "Post to General Ledger")}</span>
            </button>
          )}

          {isLocked && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{tt("cbill.posted_to_ledger", "Posted to Ledger")}</span>
            </span>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 flex items-center gap-2 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Top Four Info Cards (Matching Reference Layout Exactly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Branch / Office */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {tt("cbill.branch_office", "Branch / Office")}
              </span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {tt("cbill.active_badge", "Active")}
            </span>
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">Karachi Head Office</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">DAMAAR Logistics (Pvt) Ltd.</div>
            <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                <span>Karachi, Pakistan</span>
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                <span>+92 21 111 326 227</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-bold text-slate-400">
            BR Code: <span className="font-mono text-slate-700 dark:text-slate-300">KHI-001</span>
          </div>
        </div>

        {/* Card 2: Bill Generated Report */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {tt("cbill.bill_report", "Bill Generated Report")}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {tt("cbill.bill_no", "Bill Number")}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                {bill?.bill_no || "CB-2025-0001"}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 uppercase">
                {bill?.status || "DRAFT"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 text-[10px] text-center">
            <div>
              <span className="text-slate-400 block text-[9px]">Global</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{bill?.super_admin_serial || "0001245"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Country</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{bill?.country_serial || "PK-00421"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Branch</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{bill?.branch_serial || "KHI-0123"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Entry</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{bill?.entry_serial || "0001"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Transfer / Workflow Route */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <Share2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {tt("cbill.workflow_route", "Transfer / Workflow Route")}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 py-1 text-xs">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
              <div className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                ✓
              </div>
              <span>Customer Bill (Current)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-700"></div>
              <span>Accounts Department</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-700"></div>
              <span>Finance Approval</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <div className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-700"></div>
              <span>Customer Statement</span>
            </div>
          </div>

          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Workflow Status:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">In Progress</span>
          </div>
        </div>

        {/* Card 4: Customer Details */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {tt("cbill.customer_details", "Customer Details")}
              </span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {tt("cbill.active_badge", "Active")}
            </span>
          </div>

          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white truncate">
              {bill?.customer_name || "Al Rehman Trading Co."}
            </div>
            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              A/C No: {bill?.customer_account_number || "AR-001245"}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              <div className="truncate">Contact: Mr. Ahmed Khan</div>
              <div className="truncate">Phone: +92 300 1234567</div>
              <div className="truncate">Email: ahmed@alrehman.com</div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Billing Profile:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">Regular Customer</span>
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer Charges & Expenses Entry (6 of 12) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-6">
            {/* Form Title & Description */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    {tt("cbill.charge_entry", "Customer Charges & Expenses Entry")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select customer orders, assign to a user and add charge details to create the customer bill.
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 1: Select Customer Orders (Clean Multi-Select Dropdown with Chips & Checkboxes) */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  {/* Clean CustomerOrderMultiSelect Dropdown */}
                  <CustomerOrderMultiSelect
                    orders={availableOrders}
                    selectedOrderIds={selectedOrderIds}
                    onChange={handleCustomerOrdersChange}
                    lang={lang}
                    disabled={isLocked}
                    required={true}
                  />
                </div>
              </div>

              {/* Sub-Selector: Select Bill Transfer Types (As shown in Reference Screenshot) */}
              <div className="ps-9 space-y-1.5" ref={expenseDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>{tt("cbill.bill_transfer_types", "Select Bill Transfer Types")}</span>
                    <span className="text-blue-600 font-bold">*</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedExpenseTypes.length === EXPENSE_TYPES.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExpenseTypes(EXPENSE_TYPES.map((t) => t.id));
                        } else {
                          setSelectedExpenseTypes([]);
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 rounded-sm cursor-pointer"
                    />
                    <span>{tt("cbill.select_all", "Select All")}</span>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Choose one or more expense types to include in this bill.
                </p>

                {/* Dropdown Container for Expense Types */}
                <div className="relative">
                  <div
                    onClick={() => setExpenseTypesDropdownOpen(!expenseTypesDropdownOpen)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      {selectedExpenseTypes.length === 0 ? (
                        <span className="text-xs text-slate-400">Select expense types...</span>
                      ) : (
                        selectedExpenseTypes.map((typeId) => {
                          const exp = EXPENSE_TYPES.find((e) => e.id === typeId);
                          return (
                            <span
                              key={typeId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70"
                            >
                              <span>{exp?.defaultLabel || typeId}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpenseType(typeId);
                                }}
                                className="p-0.5 rounded-full hover:bg-blue-200/80 text-blue-600 dark:text-blue-300 transition"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ms-2" />
                  </div>

                  {/* Dropdown Popover */}
                  {expenseTypesDropdownOpen && (
                    <div className="absolute start-0 end-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50">
                        <div className="relative">
                          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={expenseSearchQuery}
                            onChange={(e) => setExpenseSearchQuery(e.target.value)}
                            placeholder="Search expense types..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 ps-8 pe-3 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-48 overflow-y-auto">
                        {EXPENSE_TYPES.filter((exp) =>
                          exp.defaultLabel.toLowerCase().includes(expenseSearchQuery.toLowerCase())
                        ).map((exp) => {
                          const isChecked = selectedExpenseTypes.includes(exp.id);
                          return (
                            <div
                              key={exp.id}
                              onClick={() => toggleExpenseType(exp.id)}
                              className="p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition select-none text-xs"
                            >
                              <div
                                className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                                  isChecked
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : "border-slate-300 dark:border-slate-600"
                                }`}
                              >
                                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {exp.defaultLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 2: Assign To User */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <span>{tt("cbill.step_assign_user", "Assign To User")}</span>
                      <span className="text-blue-600 font-bold">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {tt("cbill.assign_user_sub", "Transfer this bill to a user for processing.")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    {/* User Selection Dropdown */}
                    <div className="relative">
                      <div className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <select
                        value={assignedUser}
                        onChange={(e) => setAssignedUser(e.target.value)}
                        disabled={isLocked}
                        className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 ps-9 pe-8 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 shadow-2xs"
                      >
                        {availableUsers.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>

                    {/* Notification Feedback Badge (As in Reference Screenshot) */}
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="text-[11px] leading-tight">
                        <span>Bill will be transferred to </span>
                        <strong className="font-bold text-emerald-900 dark:text-emerald-100">{assignedUser}</strong>.
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Selected user will be notified.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3: Add Charges */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {tt("cbill.step_add_charges", "Add Charges")}
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Search and select a charge name or enter description to add details.
                    </p>
                  </div>

                  {/* Search Bar + Open Bill Form Button (Reference Style) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={chargeSearchInput}
                        onChange={(e) => setChargeSearchInput(e.target.value)}
                        placeholder="Search or select a charge name / description..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 ps-10 pe-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 shadow-2xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (chargeSearchInput.trim()) {
                          setNewChargeName(chargeSearchInput);
                        }
                        setIsChargeFormOpen(!isChargeFormOpen);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm shadow-blue-600/20 shrink-0"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{tt("cbill.open_bill_form", "Open Bill Form")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Expandable Charge Form */}
                  {isChargeFormOpen && !isLocked && (
                    <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 animate-in fade-in-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {tt("cbill.charge_type", "Charge Category")} *
                          </label>
                          <select
                            value={newChargeType}
                            onChange={(e) => {
                              setNewChargeType(e.target.value);
                              const c = CHARGE_CATEGORIES.find((cat) => cat.value === e.target.value);
                              if (c) setNewChargeName(tt(c.labelKey, c.defaultLabel));
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {CHARGE_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {tt(cat.labelKey, cat.defaultLabel)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {tt("cbill.charge_name", "Charge Description")} *
                          </label>
                          <input
                            type="text"
                            value={newChargeName}
                            onChange={(e) => setNewChargeName(e.target.value)}
                            placeholder="e.g. Customs Clearance, Terminal Handling..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            {tt("cbill.quantity", "Quantity")}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            {tt("cbill.unit", "Unit")}
                          </label>
                          <input
                            type="text"
                            value={newUnit}
                            onChange={(e) => setNewUnit(e.target.value)}
                            placeholder="Unit, Container, Ton..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            {tt("cbill.rate", "Rate / Price")} *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={newRate}
                            onChange={(e) => setNewRate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            {tt("cbill.tax_pct", "Tax %")}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={newTaxPct}
                            onChange={(e) => setNewTaxPct(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Line Total:{" "}
                          <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            {selectedCurrency}{" "}
                            {(
                              (Number(newQuantity) || 1) * (Number(newRate) || 0) * (1 + (Number(newTaxPct) || 0) / 100)
                            ).toFixed(2)}
                          </span>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsChargeFormOpen(false)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddLineItem}
                            className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{tt("cbill.add_charge", "+ Add Charge Line")}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Itemized Table of Added Charges */}
                  {items.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">{tt("cbill.charge_name", "Charge Item")}</th>
                            <th className="py-2.5 px-3 text-center">{tt("cbill.quantity", "Qty")}</th>
                            <th className="py-2.5 px-3 text-right">{tt("cbill.rate", "Rate")}</th>
                            <th className="py-2.5 px-3 text-right">{tt("cbill.tax_pct", "Tax")}</th>
                            <th className="py-2.5 px-3 text-right">{tt("cbill.total_amount", "Total")}</th>
                            {!isLocked && <th className="py-2.5 px-2 text-center w-8"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-slate-100">{it.charge_name}</div>
                                <div className="text-[10px] text-slate-500 capitalize">{it.charge_type.replace("_", " ")}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                                {Number(it.rate).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {Number(it.tax_pct) > 0 ? `${it.tax_pct}%` : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-slate-100 font-mono">
                                {Number(it.total_amount).toFixed(2)}
                              </td>
                              {!isLocked && (
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(idx)}
                                    className="text-slate-400 hover:text-rose-600 transition p-1"
                                    title="Delete Line"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Financial Adjustments Box */}
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>{tt("cbill.subtotal", "Subtotal")}:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {selectedCurrency} {subtotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>{tt("cbill.tax_total", "Total Tax")}:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {selectedCurrency} {totalTax.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {tt("cbill.other_charges", "Other Surcharges")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={otherCharges}
                          onChange={(e) => setOtherCharges(e.target.value)}
                          disabled={isLocked}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                          {tt("cbill.discount", "Discount")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          disabled={isLocked}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {tt("cbill.total_due", "Total Due")}:
                      </span>
                      <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                        {selectedCurrency} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE BILL PREVIEW (6 of 12 — Matching Screenshot Perfectly) */}
        <div className="lg:col-span-6 space-y-4" ref={printRef}>
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            {/* Header with Title and Pagination Switcher */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  👁️ {tt("cbill.live_preview", "LIVE BILL PREVIEW")}
                </span>
              </div>

              {/* Bill Pagination / Navigation */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  disabled={currentBillIndex <= 0}
                  onClick={() => setCurrentBillIndex(Math.max(0, currentBillIndex - 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Bill {currentBillIndex + 1} of {Math.max(1, recentBills.length)}
                </span>
                <button
                  type="button"
                  disabled={currentBillIndex >= recentBills.length - 1}
                  onClick={() => setCurrentBillIndex(Math.min(recentBills.length - 1, currentBillIndex + 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Bill Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {tt("cbill.title", "Customer Bill")}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
                    {bill?.status || "DRAFT"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {tt("cbill.live_preview_sub", "Preview of customer bill. Updates in real-time as you add charges.")}
                </p>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Bill Number</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {bill?.bill_no || "CB-2025-0001"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Customer</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                      {bill?.customer_name || "Al Rehman Trading Co."}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Bill Date</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {bill?.bill_date ? String(bill.bill_date).slice(0, 10) : "20 May 2025"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">A/C No</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {bill?.customer_account_number || "AR-001245"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Due Date</span>
                    <span className="text-slate-700 dark:text-slate-300">{dueDate || "Due upon receipt"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone</span>
                    <span className="text-slate-700 dark:text-slate-300">+92 300 1234567</span>
                  </div>
                </div>
              </div>

              {/* Total Due Highlight Card */}
              <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 text-center sm:text-right shrink-0">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                  {tt("cbill.total_due", "Total Due")}
                </span>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  {selectedCurrency} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Itemized Charges, Shipment & Logistics, Notes, Documents) */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold gap-4 pt-2">
              <button
                type="button"
                onClick={() => setPreviewTab("charges")}
                className={`pb-2 border-b-2 transition ${
                  previewTab === "charges"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tt("cbill.tab_itemized", "Itemized Charges")}
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("logistics")}
                className={`pb-2 border-b-2 transition ${
                  previewTab === "logistics"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tt("cbill.tab_logistics", "Shipment & Logistics")} ({selectedOrdersList.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("notes")}
                className={`pb-2 border-b-2 transition ${
                  previewTab === "notes"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tt("cbill.tab_notes", "Notes")}
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("documents")}
                className={`pb-2 border-b-2 transition ${
                  previewTab === "documents"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tt("cbill.tab_documents", "Documents")}
              </button>
            </div>

            {/* TAB 1: Itemized Charges Table */}
            {previewTab === "charges" && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">DESCRIPTION</th>
                        <th className="py-2.5 px-3 text-center">QTY</th>
                        <th className="py-2.5 px-3 text-right">RATE</th>
                        <th className="py-2.5 px-3 text-right">TAX %</th>
                        <th className="py-2.5 px-3 text-right">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400">
                            <div className="space-y-1">
                              <div className="font-bold text-slate-600 dark:text-slate-300">
                                No charges added yet
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Add bill details using the form on the left to see them here.
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {it.charge_name}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                              {it.quantity}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              {Number(it.rate).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {Number(it.tax_pct) > 0 ? `${it.tax_pct}%` : "0%"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {Number(it.total_amount).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals footer */}
                <div className="space-y-1 text-xs text-end pe-3 font-medium">
                  <div className="flex justify-end gap-6 text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedCurrency} {subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-6 text-slate-500">
                    <span>Total Tax</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedCurrency} {totalTax.toFixed(2)}
                    </span>
                  </div>
                  {Number(otherCharges) > 0 && (
                    <div className="flex justify-end gap-6 text-slate-500">
                      <span>Other Surcharges</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedCurrency} {Number(otherCharges).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {Number(discountAmount) > 0 && (
                    <div className="flex justify-end gap-6 text-rose-600">
                      <span>Discount</span>
                      <span className="font-mono font-bold">
                        -{selectedCurrency} {Number(discountAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-6 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-white">
                    <span>Total Due</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {selectedCurrency} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Shipment & Logistics Details */}
            {previewTab === "logistics" && (
              <div className="space-y-3">
                {selectedOrdersList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Select customer orders in Step 1 to preview shipment details here.
                  </div>
                ) : (
                  selectedOrdersList.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                          {ord.order_no}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {ord.transport_mode || "Sea"} • {ord.movement_type || "Import"}
                        </span>
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-bold">
                        {ord.customer_name || "Customer"}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <div>
                          B/L Number: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{ord.bl_number || "—"}</span>
                        </div>
                        <div>
                          Container: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{ord.container_number || "—"}</span>
                        </div>
                        <div>
                          Route: <span className="font-semibold text-slate-700 dark:text-slate-300">{[ord.loading_port_name, ord.destination_port_name].filter(Boolean).join(" → ") || "Direct"}</span>
                        </div>
                        <div>
                          Vehicle: <span className="font-semibold text-slate-700 dark:text-slate-300">{ord.truck_number || "Assigned"}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: Notes & Instructions */}
            {previewTab === "notes" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Invoice Notes & Payment Terms
                  </label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={isLocked}
                    placeholder="Enter special instructions, bank payment details, or clearance terms..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Documents & Attachments */}
            {previewTab === "documents" && (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <Paperclip className="h-6 w-6 mx-auto text-slate-400" />
                <div className="font-bold text-slate-700 dark:text-slate-300">Attached Shipping Documents</div>
                <p className="text-[11px]">Goods Declaration (GD), Bill of Lading copy, and customs delivery orders are auto-linked.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for General Ledger Posting */}
      {confirmPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <ShieldCheck className="h-6 w-6" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("cbill.post_to_ledger", "Post to General Ledger")}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {tt(
                "cbill.confirm_post_desc",
                "This will generate the official Roznamcha double-entry journal voucher, debiting the customer accounts receivable and crediting clearing agency revenue. This action is final."
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPostOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePostToLedger}
                disabled={posting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700"
              >
                {posting ? "Posting..." : "Confirm & Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
