"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, CheckCircle2, XCircle, Loader2, RefreshCw, Wallet } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";
import { CustomerPicker } from "@/features/customers/components/customer-picker";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

type AllocationType = "business" | "shipping" | "split" | "unallocated";

type ReceiptRow = {
  id: string;
  receipt_no: string | null;
  customer_id: string;
  receipt_date: string;
  currency_code: string;
  amount: string | number;
  payment_method: string;
  allocation_type: AllocationType;
  remarks: string | null;
  status: "draft" | "posted" | "void";
  created_at: string;
};

type LedgerOption = { id: string; name: string; code: string; currency: string };

const EMPTY_FORM = {
  customerId: "",
  amount: "",
  currencyCode: "USD",
  paymentMethod: "cash",
  cashLedgerId: "",
  allocationType: "unallocated" as AllocationType,
  businessAmount: "",
  shippingAmount: "",
  remarks: ""
};

export function CustomerReceiptsManagementView({ lang: langProp }: { lang: SupportedLanguage }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const tt = (key: string, fallback: string) => t(lang, ("shiprcpt." + key) as never, fallback);
  const dir = getLanguageDirection(lang);

  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const ledgerOptions: SearchSelectOption[] = useMemo(
    () => ledgers.map((l) => ({ value: l.id, label: `${l.name} (${l.code})`, secondaryText: l.currency })),
    [ledgers]
  );

  async function loadReceipts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/erp/shipping/customer-receipts");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load receipts");
      setRows(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedgers() {
    try {
      const res = await fetch("/api/erp/ledgers?limit=200");
      const json = await res.json();
      const list = json?.data?.ledgers ?? json?.data ?? json?.ledgers ?? [];
      setLedgers(Array.isArray(list) ? list.map((l: any) => ({ id: l.id, name: l.name, code: l.code, currency: l.currency })) : []);
    } catch {
      /* ledger list is a convenience — a failure here shouldn't block the page */
    }
  }

  useEffect(() => {
    void loadReceipts();
    void loadLedgers();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = Number(form.amount);
    if (!form.customerId) return setError(tt("err_customer_required", "Select a customer."));
    if (!form.cashLedgerId) return setError(tt("err_ledger_required", "Select the cash / bank ledger receiving this payment."));
    if (!(amt > 0)) return setError(tt("err_amount_required", "Enter an amount greater than zero."));

    let allocations: Array<{ domain: "business" | "shipping" | "unallocated"; amount: number }> = [];
    if (form.allocationType === "split") {
      const bAmt = Number(form.businessAmount || 0);
      const sAmt = Number(form.shippingAmount || 0);
      if (Math.abs(bAmt + sAmt - amt) > 0.0001) {
        return setError(tt("err_split_mismatch", "Business + Shipping split amounts must add up to the total amount."));
      }
      allocations = [
        { domain: "business", amount: bAmt },
        { domain: "shipping", amount: sAmt }
      ];
    } else {
      allocations = [{ domain: form.allocationType, amount: amt }];
    }

    setSaving(true);
    try {
      const res = await fetch("/api/erp/shipping/customer-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          amount: amt,
          currencyCode: form.currencyCode,
          paymentMethod: form.paymentMethod,
          cashLedgerId: form.cashLedgerId,
          allocationType: form.allocationType,
          allocations,
          remarks: form.remarks || null
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create receipt");
      setSuccessMessage(tt("created_success", "Receipt created as draft — post it below to record the payment."));
      resetForm();
      await loadReceipts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(id: string) {
    setPosting(id);
    setError(null);
    try {
      const res = await fetch(`/api/erp/shipping/customer-receipts/${id}/post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to post receipt");
      await loadReceipts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(null);
    }
  }

  async function handleVoid(id: string) {
    setPosting(id);
    setError(null);
    try {
      const res = await fetch(`/api/erp/shipping/customer-receipts/${id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to void receipt");
      await loadReceipts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(null);
    }
  }

  return (
    <div dir={dir} className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 border border-slate-700/50 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-teal-500/20 text-teal-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-teal-500/30">
              {tt("module_badge", "Shipping / Clearing Module")}
            </span>
            <h1 className="text-2xl font-bold tracking-tight">{tt("title", "Customer Receipts")}</h1>
            <p className="text-slate-400 text-sm">
              {tt("subtitle", "Collect customer payments and allocate them to Business, Shipping, a Split, or leave Unallocated for later reconciliation.")}
            </p>
          </div>
          <button
            onClick={() => void loadReceipts()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium border border-slate-700 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {tt("refresh", "Refresh")}
          </button>
        </div>
      </div>

      {error ? <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">{error}</div> : null}
      {successMessage ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
          <Wallet className="w-5 h-5 text-teal-400" />
          {tt("new_receipt", "New Customer Receipt")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("customer", "Customer")} *</label>
            <CustomerPicker label="" value={form.customerId} onValueChange={(id: string) => setForm((f) => ({ ...f, customerId: id }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("cash_ledger", "Cash / Bank Ledger")} *</label>
            <SearchSelect
              label=""
              value={form.cashLedgerId}
              options={ledgerOptions}
              onValueChange={(id) => setForm((f) => ({ ...f, cashLedgerId: id }))}
              placeholder={tt("select_ledger_ph", "Select the receiving ledger...")}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("payment_method", "Payment Method")}</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm"
            >
              <option value="cash">{tt("cash", "Cash")}</option>
              <option value="bank_transfer">{tt("bank_transfer", "Bank Transfer")}</option>
              <option value="cheque">{tt("cheque", "Cheque")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("amount", "Amount")} *</label>
            <input
              type="number"
              step="any"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("currency", "Currency")}</label>
            <select
              value={form.currencyCode}
              onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm"
            >
              <option value="USD">USD ($)</option>
              <option value="PKR">PKR (Rs)</option>
              <option value="AED">AED (Dh)</option>
              <option value="AFN">AFN (؋)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("allocation_type", "Allocation")}</label>
            <select
              value={form.allocationType}
              onChange={(e) => setForm((f) => ({ ...f, allocationType: e.target.value as AllocationType }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm font-semibold"
            >
              <option value="unallocated">{tt("alloc_unallocated", "Unallocated")}</option>
              <option value="business">{tt("alloc_business", "Business")}</option>
              <option value="shipping">{tt("alloc_shipping", "Shipping")}</option>
              <option value="split">{tt("alloc_split", "Split (Business + Shipping)")}</option>
            </select>
          </div>
        </div>

        {form.allocationType === "split" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{tt("alloc_business", "Business")} {tt("amount", "Amount")}</label>
              <input
                type="number"
                step="any"
                value={form.businessAmount}
                onChange={(e) => setForm((f) => ({ ...f, businessAmount: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{tt("alloc_shipping", "Shipping")} {tt("amount", "Amount")}</label>
              <input
                type="number"
                step="any"
                value={form.shippingAmount}
                onChange={(e) => setForm((f) => ({ ...f, shippingAmount: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("remarks", "Remarks")}</label>
          <textarea
            rows={2}
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {tt("save_draft", "Save Receipt (Draft)")}
          </button>
        </div>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold text-white border-b border-slate-800 pb-4">{tt("register", "Receipts Register")} ({rows.length})</h2>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {tt("loading", "Loading receipts...")}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">{tt("empty", "No customer receipts found.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/90 text-slate-200 text-xs uppercase font-bold border-b border-slate-700">
                <tr>
                  <Th className="px-4 py-3">{tt("th_date", "Date")}</Th>
                  <Th className="px-4 py-3">{tt("amount", "Amount")}</Th>
                  <Th className="px-4 py-3">{tt("allocation_type", "Allocation")}</Th>
                  <Th className="px-4 py-3">{tt("th_status", "Status")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("th_actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs">{String(r.receipt_date).slice(0, 10)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {r.currency_code} {Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 capitalize">{tt(`alloc_${r.allocation_type}`, r.allocation_type)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          r.status === "posted"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : r.status === "void"
                            ? "bg-slate-600/40 text-slate-400 border border-slate-600/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {r.status === "posted" ? tt("posted", "Posted") : r.status === "void" ? tt("voided", "Voided") : tt("draft", "Draft")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "draft" ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handlePost(r.id)}
                            disabled={posting === r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold disabled:opacity-50"
                          >
                            {posting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            {tt("post", "Post")}
                          </button>
                          <button
                            onClick={() => handleVoid(r.id)}
                            disabled={posting === r.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium border border-slate-700 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {tt("void", "Void")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
