"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, RefreshCw, FileText, CheckCircle2, DollarSign, Receipt, CreditCard, Filter, ArrowUpRight } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { ReportActions } from "@/components/ui/report-actions";
import { Th } from "@/components/ui/translated-th";
import { DashboardFrame } from "@/components/layout/dashboard-frame";

type PaymentBillRow = {
  id: string;
  bill_no: string;
  order_no: string | null;
  bl_number: string | null;
  gd_number: string | null;
  agent_name: string;
  port_name: string;
  customs_duty: number;
  port_charges: number;
  demurrage_charges: number;
  clearance_fee: number;
  freight_charges: number;
  other_charges: number;
  total_amount: number;
  currency_code: string;
  payment_status: "paid" | "pending" | "partial";
  payment_method: string;
  remarks: string | null;
  created_at: string;
};

const EMPTY_BILL: any = {
  id: "",
  bill_no: "",
  order_no: "",
  bl_number: "",
  gd_number: "",
  agent_name: "",
  port_name: "Karachi Port",
  customs_duty: 0,
  port_charges: 0,
  demurrage_charges: 0,
  clearance_fee: 0,
  freight_charges: 0,
  other_charges: 0,
  total_amount: 0,
  currency_code: "USD",
  payment_status: "pending",
  payment_method: "bank_transfer",
  remarks: "",
};

export function PaymentBillManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [rows, setRows] = useState<PaymentBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<any>(EMPTY_BILL);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-calculated total bill amount
  const calculatedTotal = useMemo(() => {
    return (
      Number(form.customs_duty || 0) +
      Number(form.port_charges || 0) +
      Number(form.demurrage_charges || 0) +
      Number(form.clearance_fee || 0) +
      Number(form.freight_charges || 0) +
      Number(form.other_charges || 0)
    );
  }, [form.customs_duty, form.port_charges, form.demurrage_charges, form.clearance_fee, form.freight_charges, form.other_charges]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/clearing-agent/payment-bill");
      const json = await res.json();
      if (json.success) {
        setRows(json.data || []);
      } else {
        throw new Error(json.error || "Failed to load payment bills");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchSearch =
        !q ||
        (r.bill_no && r.bill_no.toLowerCase().includes(q)) ||
        (r.order_no && r.order_no.toLowerCase().includes(q)) ||
        (r.bl_number && r.bl_number.toLowerCase().includes(q)) ||
        (r.gd_number && r.gd_number.toLowerCase().includes(q)) ||
        (r.agent_name && r.agent_name.toLowerCase().includes(q)) ||
        (r.port_name && r.port_name.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || r.payment_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    const totalBills = rows.length;
    const paidCount = rows.filter((r) => r.payment_status === "paid").length;
    const pendingCount = rows.filter((r) => r.payment_status === "pending").length;
    const grandTotal = rows.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
    return { totalBills, paidCount, pendingCount, grandTotal };
  }, [rows]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      ...form,
      total_amount: calculatedTotal,
    };

    try {
      const res = await fetch("/api/erp/clearing-agent/payment-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save bill");

      setSuccessMessage(`Payment Bill ${json.data.bill_no || "saved"} successfully!`);
      setForm(EMPTY_BILL);
      setIsEditing(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(row: PaymentBillRow) {
    setForm(row);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <DashboardFrame title="Clearing Agent Payment Bill Entry" subtitle="Customs Duty, Clearance Charges & Payment Voucher Register">
      <div dir={dir} className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/50 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-indigo-500/30">
                  Clearing Agent Module
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-emerald-500/30">
                  5-Language Translation Sync
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Payment Bill Entry Management</h1>
              <p className="text-slate-400 text-sm">
                Record customs duties, port handling, clearance fees, freight charges and generate settlement bills.
              </p>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors border border-slate-700 text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Bills
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Total Payment Bills</span>
              <Receipt className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalBills}</div>
            <div className="text-xs text-slate-500">Registered clearing vouchers</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Paid Settlement Bills</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.paidCount}</div>
            <div className="text-xs text-slate-500">Fully settled payments</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Pending / Unpaid Bills</span>
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.pendingCount}</div>
            <div className="text-xs text-slate-500">Awaiting payment voucher</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Grand Total Amount</span>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400 font-mono">
              ${stats.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500">Combined charges & duties</div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Bill Entry Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              {isEditing ? "Edit Payment Bill Entry" : "Create New Payment Bill Entry"}
            </h2>
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY_BILL);
                  setIsEditing(false);
                }}
                className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1 rounded-lg"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Bill Reference No</label>
              <input
                type="text"
                placeholder="Auto-generated (or custom)"
                value={form.bill_no}
                onChange={(e) => setForm({ ...form, bill_no: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Order No / B/L Ref</label>
              <input
                type="text"
                placeholder="e.g. CL-ORD-2026-0001"
                value={form.order_no}
                onChange={(e) => setForm({ ...form, order_no: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Bill of Lading (B/L) No</label>
              <input
                type="text"
                placeholder="e.g. BL-984712"
                value={form.bl_number}
                onChange={(e) => setForm({ ...form, bl_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Customs GD Number</label>
              <input
                type="text"
                placeholder="e.g. KADP-HC-10492"
                value={form.gd_number}
                onChange={(e) => setForm({ ...form, gd_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Clearing Agent / Company Name *</label>
              <input
                type="text"
                placeholder="e.g. DGT Clearing Services"
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Port / Border Station</label>
              <input
                type="text"
                placeholder="e.g. Karachi Port / Torkham Border"
                value={form.port_name}
                onChange={(e) => setForm({ ...form, port_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Charge Breakdown Grid */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Charges & Duty Breakdown</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Customs Duty</label>
                <input
                  type="number"
                  step="any"
                  value={form.customs_duty}
                  onChange={(e) => setForm({ ...form, customs_duty: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Port Charges</label>
                <input
                  type="number"
                  step="any"
                  value={form.port_charges}
                  onChange={(e) => setForm({ ...form, port_charges: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Demurrage</label>
                <input
                  type="number"
                  step="any"
                  value={form.demurrage_charges}
                  onChange={(e) => setForm({ ...form, demurrage_charges: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Clearance Fee</label>
                <input
                  type="number"
                  step="any"
                  value={form.clearance_fee}
                  onChange={(e) => setForm({ ...form, clearance_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Freight Charges</label>
                <input
                  type="number"
                  step="any"
                  value={form.freight_charges}
                  onChange={(e) => setForm({ ...form, freight_charges: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Other Expenses</label>
                <input
                  type="number"
                  step="any"
                  value={form.other_charges}
                  onChange={(e) => setForm({ ...form, other_charges: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency</label>
                  <select
                    value={form.currency_code}
                    onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="PKR">PKR (Rs)</option>
                    <option value="AED">AED (Dh)</option>
                    <option value="AFN">AFN (؋)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash Voucher</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Status</label>
                  <select
                    value={form.payment_status}
                    onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-medium">Calculated Bill Total</span>
                <span className="text-xl font-bold text-indigo-300 font-mono">
                  {form.currency_code} {calculatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Remarks / Notes</label>
            <textarea
              rows={2}
              placeholder="Additional billing details, agent notes or reference details..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isEditing ? "Update Payment Bill Entry" : "Save Payment Bill Entry"}
            </button>
          </div>
        </form>

        {/* Payment Bill Register Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Payment Bill Register ({filteredRows.length})</h2>
              <p className="text-xs text-slate-400">All registered clearing bills, duties and expenses</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search bill no, B/L, GD, agent..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 w-64 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading payment bills...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">No payment bills found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-800 dark:text-slate-300">
                <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <Th className="px-4 py-3">Bill No</Th>
                    <Th className="px-4 py-3">Agent / Port</Th>
                    <Th className="px-4 py-3">Ref B/L / GD</Th>
                    <Th className="px-4 py-3">Duty & Port</Th>
                    <Th className="px-4 py-3">Clearance Fee</Th>
                    <Th className="px-4 py-3">Total Bill</Th>
                    <Th className="px-4 py-3">Status</Th>
                    <Th className="px-4 py-3 text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-indigo-400">
                        {r.bill_no}
                        {r.order_no && <span className="block text-[11px] text-slate-500">{r.order_no}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{r.agent_name}</div>
                        <div className="text-xs text-slate-400">{r.port_name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300">
                        {r.bl_number || "-"}
                        {r.gd_number && <span className="block text-slate-500">GD: {r.gd_number}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        Duty: ${(r.customs_duty || 0).toLocaleString()}
                        <span className="block text-slate-500">Port: ${(r.port_charges || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300">
                        ${(r.clearance_fee || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {r.currency_code} {(r.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
                            r.payment_status === "paid"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : r.payment_status === "partial"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardFrame>
  );
}
