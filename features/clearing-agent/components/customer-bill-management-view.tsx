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
  Sparkles
} from "lucide-react";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { CustomerBillRow, CustomerBillItemRow } from "@/lib/services/clearing-customer-bill-service";

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

export function CustomerBillManagementView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bill, setBill] = useState<CustomerBillRow | null>(null);
  const [items, setItems] = useState<CustomerBillItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bill Totals State (editable overrides)
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

  // Available Bills / Orders list for switcher
  const [recentBills, setRecentBills] = useState<CustomerBillRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const printRef = useRef<HTMLDivElement>(null);

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

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

  // Load bill by orderId or bill id from query params
  async function loadBillData() {
    setLoading(true);
    setError(null);
    try {
      const orderId = searchParams.get("orderId");
      const billId = searchParams.get("id");

      let endpoint = "";
      if (orderId) {
        endpoint = `/api/erp/clearing-agent/customer-bill?orderId=${encodeURIComponent(orderId)}`;
      } else if (billId) {
        endpoint = `/api/erp/clearing-agent/customer-bill/${encodeURIComponent(billId)}`;
      } else {
        // Load recent bills list
        const res = await fetch("/api/erp/clearing-agent/customer-bill");
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          setRecentBills(json.data);
          // Auto-select first bill if no id given
          endpoint = `/api/erp/clearing-agent/customer-bill/${json.data[0].id}`;
        } else {
          setLoading(false);
          return;
        }
      }

      const res = await fetch(endpoint);
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "Customer bill not found.");
      }

      const b: CustomerBillRow = json.data;
      setBill(b);
      setItems(b.items || []);
      setDueDate(b.due_date ? String(b.due_date).slice(0, 10) : "");
      setDiscountAmount(String(b.discount_amount || 0));
      setOtherCharges(String(b.other_charges || 0));
      setRemarks(b.remarks || "");
    } catch (err: any) {
      setError(err.message || "Failed to load customer bill.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBillData();
  }, [searchParams]);

  // Add line item
  function handleAddLineItem() {
    const qty = Math.max(Number(newQuantity) || 1, 0);
    const rate = Math.max(Number(newRate) || 0, 0);
    const amt = Number((qty * rate).toFixed(2));
    const taxP = Math.max(Number(newTaxPct) || 0, 0);
    const taxAmt = Number(((amt * taxP) / 100).toFixed(2));
    const totalAmt = Number((amt + taxAmt).toFixed(2));

    const selectedCat = CHARGE_CATEGORIES.find((c) => c.value === newChargeType);
    const effectiveName = newChargeName.trim() || tt(selectedCat?.labelKey ?? "", selectedCat?.defaultLabel ?? "Charge");

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

    // Reset line input
    setNewChargeName("");
    setNewDescription("");
    setNewQuantity("1");
    setNewRate("0");
    setNewTaxPct("0");
    setNewRemarks("");
  }

  // Remove line item
  function handleRemoveLineItem(index: number) {
    const next = [...items];
    next.splice(index, 1);
    setItems(next);
  }

  // Save draft bill
  async function handleSaveDraft() {
    if (!bill) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
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

      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save bill.");

      setBill(json.data);
      setItems(json.data.items || []);
      setSuccessMsg("Customer bill draft saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Submit bill
  async function handleSubmit() {
    if (!bill) return;
    setSaving(true);
    setError(null);
    try {
      await handleSaveDraft();
      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}/submit`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to submit bill.");
      setBill(json.data);
      setSuccessMsg("Customer bill submitted for supervisor approval!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Approve bill
  async function handleApprove() {
    if (!bill) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-bill/${bill.id}/approve`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to approve bill.");
      setBill(json.data);
      setSuccessMsg("Customer bill approved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Post bill to general ledger / roznamcha
  async function handlePostToLedger() {
    if (!bill) return;
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
      setSuccessMsg(`Customer Bill successfully posted to General Ledger (Voucher: ${json.data.entryId})!`);
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
    const msg = `*Customer Bill: ${bill.bill_no}*\nOrder: ${bill.order_no ?? "N/A"}\nCustomer: ${bill.customer_name ?? "Customer"}\nTotal Amount: ${bill.currency_code} ${grandTotal.toFixed(2)}\nDue Date: ${dueDate || "Immediate"}\nStatus: ${bill.status.toUpperCase()}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // Status Badge UI
  function renderStatusBadge(status: string) {
    const map: Record<string, { bg: string; label: string }> = {
      draft: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300", label: tt("cbill.status_draft", "Draft") },
      submitted: { bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300", label: tt("cbill.status_submitted", "Submitted") },
      approved: { bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300", label: tt("cbill.status_approved", "Approved") },
      posted: { bg: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300", label: tt("cbill.status_posted", "Posted to Ledger") },
      paid: { bg: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300", label: tt("cbill.status_paid", "Paid") },
      cancelled: { bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300", label: tt("cbill.status_cancelled", "Cancelled") }
    };
    const s = map[status] || map.draft;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.bg}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {s.label}
      </span>
    );
  }

  const isLocked = bill?.status === "posted";

  return (
    <div className={`min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 space-y-6 ${isRtl ? "rtl" : "ltr"}`}>
      {/* 1. Header & Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">Dashboard</Link>
            <span>/</span>
            <Link href="/dashboard/clearing-agent/customer-order" className="hover:text-blue-600 transition">Shipping & Clearing</Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">{tt("cbill.title", "Customer Bill")}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{tt("cbill.title", "Customer Bill")}</span>
                {bill ? renderStatusBadge(bill.status) : null}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("cbill.subtitle", "Create, review and post shipping customer bills linked directly to customer orders.")}
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {bill?.order_id ? (
            <Link
              href={`/dashboard/clearing-agent/customer-order?id=${bill.order_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
              <span>{tt("cbill.view_customer_order", "View Customer Order")}</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
            <span>{tt("cbill.print_bill", "Print Bill")}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition shadow-xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{tt("cbill.share_whatsapp", "WhatsApp")}</span>
          </button>

          {!isLocked && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition shadow-xs"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{tt("cbill.save_draft", "Save Draft")}</span>
              </button>

              {bill?.status === "draft" && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition shadow-xs shadow-amber-600/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{tt("cbill.submit_approval", "Submit for Review")}</span>
                </button>
              )}

              {(bill?.status === "draft" || bill?.status === "submitted") && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs shadow-emerald-600/20"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{tt("cbill.approve_bill", "Approve Bill")}</span>
                </button>
              )}

              {bill?.status === "approved" && (
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
            </>
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

      {/* 2. Top Summary Band (Inherited Metadata from Order) */}
      {bill && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.bill_no", "Bill No")}</span>
            <div className="text-sm font-black text-blue-600 dark:text-blue-400 truncate">{bill.bill_no}</div>
            <div className="text-[10px] text-slate-500">{bill.bill_date ? String(bill.bill_date).slice(0, 10) : "Today"}</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.order_reference", "Order Reference")}</span>
            <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{bill.order_no || "—"}</div>
            <div className="text-[10px] text-slate-500 uppercase">{bill.transport_mode || "Road"} • {bill.movement_type || "Import"}</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.customer_account", "Customer Account")}</span>
            <div className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{bill.customer_name || "Customer"}</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
              {bill.customer_account_number || "AR Account Auto-Linked"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.route_path", "Route / Ports")}</span>
            <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">
              {bill.destination_port_name || bill.loading_port_name || "Direct Route"}
            </div>
            <div className="text-[10px] text-slate-500 truncate">{bill.truck_number ? `Truck: ${bill.truck_number}` : "Vehicle Pending"}</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.grand_total", "Grand Total")}</span>
            <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
              {bill.currency_code} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">{items.length} {tt("comv.goods_items", "line items")}</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">{tt("cbill.balance_due", "Balance Due")}</span>
            <div className={`text-sm font-black ${balanceDue > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {bill.currency_code} {balanceDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500">{dueDate ? `Due: ${dueDate}` : "Due on receipt"}</div>
          </div>
        </div>
      )}

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer Charges & Expenses Entry Panel (Width: 6/12) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Charge Entry Form */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    {tt("cbill.charge_entry", "Customer Charges & Expenses Entry")}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Add bill line items for freight, customs, clearing, and port services.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {items.length} {items.length === 1 ? "Line" : "Lines"}
              </span>
            </div>

            {!isLocked && (
              <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
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
                      {tt("cbill.charge_name", "Charge Name / Description")} *
                    </label>
                    <input
                      type="text"
                      value={newChargeName}
                      onChange={(e) => setNewChargeName(e.target.value)}
                      placeholder="e.g. Sea Freight, Customs Inspection..."
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                      placeholder="Trip, Tons, Bags..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Line Total:{" "}
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      {bill?.currency_code || "USD"}{" "}
                      {(
                        (Number(newQuantity) || 1) * (Number(newRate) || 0) * (1 + (Number(newTaxPct) || 0) / 100)
                      ).toFixed(2)}
                    </span>
                  </span>

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
            )}

            {/* Line Items Table */}
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
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        {tt("cbill.no_items", "No charges added yet. Click + Add Charge Line to enter customer billing items.")}
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{it.charge_name}</div>
                          <div className="text-[10px] text-slate-500 capitalize">{it.charge_type.replace("_", " ")}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                          {Number(it.rate).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {Number(it.tax_pct) > 0 ? `${it.tax_pct}%` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-slate-100">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Adjustment */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>{tt("cbill.subtotal", "Subtotal")}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {bill?.currency_code || "USD"} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>{tt("cbill.tax_total", "Total Tax")}:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {bill?.currency_code || "USD"} {totalTax.toFixed(2)}
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
                  {tt("cbill.grand_total", "Grand Total")}:
                </span>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                  {bill?.currency_code || "USD"} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Customer Bill Report (Width: 6/12 — Card Message Style) */}
        <div className="lg:col-span-6 space-y-4" ref={printRef}>
          {/* Main Statement Card */}
          <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-b from-white to-blue-50/20 dark:from-slate-900 dark:to-slate-950 p-5 md:p-6 shadow-md space-y-5">
            {/* Top Conversational Header */}
            <div className="border-b border-blue-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tracking-wide uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tt("cbill.customer_bill_generated", "Customer Bill Generated")}</span>
                </div>
                {bill && renderStatusBadge(bill.status)}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {bill?.bill_no || "CB-DRAFT"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Order Ref: <span className="font-bold text-slate-700 dark:text-slate-300">{bill?.order_no || "—"}</span>
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {bill?.currency_code || "USD"} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {dueDate ? `Due on: ${dueDate}` : "Due upon presentation"}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1: Customer & Account Overview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{tt("cbill.customer_account", "Customer Account")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Customer Name:</span>{" "}
                  <span className="font-bold text-slate-900 dark:text-slate-100">{bill?.customer_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">AR Account No:</span>{" "}
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {bill?.customer_account_number || "AUTO-LINKED"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Bill Date:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {bill?.bill_date ? String(bill.bill_date).slice(0, 10) : "Today"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Currency / Rate:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {bill?.currency_code || "USD"} (1.000)
                  </span>
                </div>
              </div>

              {/* 4-Level Serials */}
              {(bill?.super_admin_serial || bill?.country_serial || bill?.branch_serial || bill?.entry_serial) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-[10px]">
                  {bill.super_admin_serial && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 font-mono">
                      Global: {bill.super_admin_serial}
                    </span>
                  )}
                  {bill.country_serial && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 font-mono">
                      Country: {bill.country_serial}
                    </span>
                  )}
                  {bill.branch_serial && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 font-mono">
                      Branch: {bill.branch_serial}
                    </span>
                  )}
                  {bill.entry_serial && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 font-mono font-bold">
                      Entry: {bill.entry_serial}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Logistics & Cargo Overview */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-blue-600" />
                <span>{tt("cbill.shipment_details", "Shipment & Logistics")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Mode:</span>{" "}
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                    {bill?.transport_mode ? bill.transport_mode.replace("_", " ") : "By Road"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Movement:</span>{" "}
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-200">
                    {bill?.movement_type || "Import"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Ports / Border:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {bill?.loading_port_name || "—"} → {bill?.destination_port_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Vehicle / Truck:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {bill?.truck_number || "Assigned by Logistics"}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Itemized Financial Breakdown */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-100/80 dark:bg-slate-800/80 px-3.5 py-2 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                Itemized Bill Charges
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Service / Charge</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{it.charge_name}</div>
                        {it.description && <div className="text-[10px] text-slate-400">{it.description}</div>}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {Number(it.rate).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {Number(it.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Box in Report */}
              <div className="bg-slate-50 dark:bg-slate-900/90 p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>{bill?.currency_code || "USD"} {subtotal.toFixed(2)}</span>
                </div>
                {totalTax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tax:</span>
                    <span>{bill?.currency_code || "USD"} {totalTax.toFixed(2)}</span>
                  </div>
                )}
                {Number(otherCharges) > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Other Charges:</span>
                    <span>{bill?.currency_code || "USD"} {Number(otherCharges).toFixed(2)}</span>
                  </div>
                )}
                {Number(discountAmount) > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Discount:</span>
                    <span>-{bill?.currency_code || "USD"} {Number(discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white">
                  <span className="text-sm">Total Due:</span>
                  <span className="text-base text-blue-600 dark:text-blue-400">
                    {bill?.currency_code || "USD"} {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Audit & Roznamcha Status */}
            {bill?.roznamcha_entry_id && (
              <div className="rounded-xl border border-purple-200 bg-purple-50/60 dark:border-purple-900/50 dark:bg-purple-950/30 p-3 text-xs text-purple-800 dark:text-purple-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                  <span>Posted to General Ledger (Roznamcha)</span>
                </div>
                <div className="text-[11px]">
                  Voucher Entry Ref: <span className="font-mono font-bold">{bill.roznamcha_entry_id}</span>
                </div>
                <div className="text-[10px] text-purple-600 dark:text-purple-400">
                  Posted At: {bill.posted_at ? new Date(bill.posted_at).toLocaleString() : "—"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Posting to General Ledger */}
      {confirmPostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("cbill.confirm_post", "Post Bill to General Ledger?")}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {tt(
                "cbill.confirm_post_desc",
                "This will debit Customer Shipping AR and credit Shipping Revenue in Roznamcha. This action cannot be reversed."
              )}
            </p>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Bill:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{bill?.bill_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer AR:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{bill?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-purple-600">
                  {bill?.currency_code} {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPostOpen(false)}
                disabled={posting}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePostToLedger}
                disabled={posting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition shadow-xs"
              >
                {posting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                <span>Confirm & Post to Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
