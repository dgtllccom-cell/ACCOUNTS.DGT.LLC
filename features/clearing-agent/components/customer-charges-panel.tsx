"use client";

import { useEffect, useState } from "react";
import { Plus, CheckCircle2, Loader2, Receipt } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type ChargeRow = {
  id: string;
  bill_id: string;
  order_id: string | null;
  customer_id: string;
  charge_type: string;
  currency_code: string;
  amount: string | number;
  remarks: string | null;
  posting_status: "unposted" | "posted" | "void";
  roznamcha_entry_id: string | null;
  created_at: string;
};

const CHARGE_TYPES = [
  "customs_duty",
  "port_charges",
  "demurrage",
  "clearance_fee",
  "freight",
  "handling",
  "warehouse",
  "service_fee",
  "other"
] as const;

export function CustomerChargesPanel({
  billId,
  customerId,
  orderId,
  lang
}: {
  billId: string;
  customerId: string | null;
  orderId?: string | null;
  lang: SupportedLanguage;
}) {
  const tt = (key: string, fallback: string) => t(lang, ("clchg." + key) as never, fallback);
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargeType, setChargeType] = useState<string>("customs_duty");
  const [amount, setAmount] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function loadCharges() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/payment-bill/${billId}/customer-charges`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load charges");
      setRows(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (billId) void loadCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  async function handleAddCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError(tt("customer_required", "Select a Customer on the bill above before adding a charge."));
      return;
    }
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError(tt("amount_required", "Enter an amount greater than zero."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/payment-bill/${billId}/customer-charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, orderId: orderId ?? null, chargeType, amount: amt, remarks: remarks || null })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to add charge");
      setAmount("");
      setRemarks("");
      await loadCharges();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(chargeId: string) {
    setPosting(chargeId);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/payment-bill/${billId}/customer-charges/${chargeId}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to post charge");
      await loadCharges();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(null);
    }
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
      <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
        <Receipt className="w-4 h-4" />
        {tt("title", "Customer Charges (Revenue)")}
      </h3>
      <p className="text-[11px] text-slate-500">
        {tt(
          "subtitle",
          "What the customer is charged for this shipment — kept separate from actual expenses. Posting books DR Customer Shipping AR / CR Shipping & Clearing Revenue."
        )}
      </p>

      {error ? <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div> : null}

      <form onSubmit={handleAddCharge} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{tt("charge_type", "Charge Type")}</label>
          <select
            value={chargeType}
            onChange={(e) => setChargeType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs"
          >
            {CHARGE_TYPES.map((c) => (
              <option key={c} value={c}>
                {tt(`type_${c}`, c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{tt("amount", "Amount")}</label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{tt("remarks", "Remarks")}</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {tt("add", "Add Charge")}
        </button>
      </form>

      {loading ? (
        <div className="text-xs text-slate-500 py-3 text-center">{tt("loading", "Loading charges...")}</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-slate-500 py-3 text-center">{tt("empty", "No customer charges added yet.")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-2 py-1.5">{tt("charge_type", "Charge Type")}</th>
                <th className="px-2 py-1.5">{tt("amount", "Amount")}</th>
                <th className="px-2 py-1.5">{tt("remarks", "Remarks")}</th>
                <th className="px-2 py-1.5">{tt("status", "Status")}</th>
                <th className="px-2 py-1.5 text-right">{tt("action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-2 text-slate-300">{tt(`type_${r.charge_type}`, r.charge_type)}</td>
                  <td className="px-2 py-2 font-mono text-slate-200">
                    {r.currency_code} {Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 text-slate-400">{r.remarks || "-"}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        r.posting_status === "posted"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {r.posting_status === "posted" ? tt("posted", "Posted") : tt("unposted", "Unposted")}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {r.posting_status === "unposted" ? (
                      <button
                        onClick={() => handlePost(r.id)}
                        disabled={posting === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-semibold disabled:opacity-50"
                      >
                        {posting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        {tt("post", "Post")}
                      </button>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
