"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, CheckCircle2, XCircle, Send, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

interface JobCostLine {
  id: string;
  expenseType: string;
  grandAmount: number;
  currency: string;
  postingStatus: string;
  countryName: string | null;
  branchName: string | null;
  billNo: string | null;
  claim: { id: string; status: string; amount: number; originCountryName: string | null; destCountryName: string | null; decidedAt: string | null } | null;
}

interface Claim {
  id: string;
  status: string;
  amount: number;
  currencyCode: string;
  originCountryName: string | null;
  originBranchName: string | null;
  destCountryName: string | null;
  destBranchName: string | null;
  category: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface JobCostReport {
  orderId: string;
  orderNo: string | null;
  customerName: string | null;
  customerCharges: { total: number; postedTotal: number; currency: string; count: number };
  jobExpenses: { total: number; postedTotal: number; currency: string; lines: JobCostLine[] };
  interBranchClaims: Claim[];
  profit: { revenue: number; expense: number; net: number; currency: string };
}

export function ShippingJobCostView({ lang: langProp }: { lang: SupportedLanguage }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const tt = (key: string, fallback: string) => t(lang, ("shipjc." + key) as never, fallback);
  const dir = getLanguageDirection(lang);

  const [orders, setOrders] = useState<Array<{ id: string; order_no: string; customer_name: string | null }>>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [report, setReport] = useState<JobCostReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingLineId, setClaimingLineId] = useState<string | null>(null);
  const [decidingClaimId, setDecidingClaimId] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [acceptLedgers, setAcceptLedgers] = useState<Record<string, { debit: string; credit: string }>>({});

  const orderOptions: SearchSelectOption[] = useMemo(
    () => orders.map((o) => ({ value: o.id, label: `${o.order_no} — ${o.customer_name || "-"}` })),
    [orders]
  );
  const ledgerOptions: SearchSelectOption[] = useMemo(
    () => ledgers.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
    [ledgers]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/erp/clearing-agent/customer-order");
        const json = await res.json();
        setOrders((json.data || []).map((o: any) => ({ id: o.id, order_no: o.order_no, customer_name: o.customer_name })));
      } catch {
        /* order list is a convenience picker; a failure here shouldn't block the page */
      }
      try {
        const res = await fetch("/api/erp/ledgers?limit=200");
        const json = await res.json();
        const list = json?.data?.ledgers ?? [];
        setLedgers(Array.isArray(list) ? list.map((l: any) => ({ id: l.id, name: l.name, code: l.code })) : []);
      } catch {
        /* ledger list is a convenience picker */
      }
    })();
  }, []);

  async function loadReport(orderId: string) {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/reports/shipping-job-cost?orderId=${orderId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load job cost report");
      setReport(json.data);
    } catch (err: any) {
      setError(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim(lineId: string) {
    if (!selectedOrderId) return;
    setClaimingLineId(lineId);
    setError(null);
    try {
      const res = await fetch("/api/erp/shipping/transfers/from-expense-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrderId, expenseLineId: lineId })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to create claim");
      await loadReport(selectedOrderId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaimingLineId(null);
    }
  }

  async function handleDecide(claimId: string, action: "accept" | "reject") {
    setDecidingClaimId(claimId);
    setError(null);
    try {
      const body: any = { action };
      if (action === "accept") {
        const pair = acceptLedgers[claimId];
        if (!pair?.debit || !pair?.credit) {
          setError(tt("err_pick_ledgers", "Pick both a debit and credit ledger before accepting."));
          setDecidingClaimId(null);
          return;
        }
        body.debitLedgerId = pair.debit;
        body.creditLedgerId = pair.credit;
      }
      const res = await fetch(`/api/erp/shipping/transfers/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to decide claim");
      await loadReport(selectedOrderId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDecidingClaimId(null);
    }
  }

  return (
    <div dir={dir} className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-purple-950 border border-slate-700/50 rounded-2xl p-6 shadow-xl text-white">
        <span className="bg-purple-500/20 text-purple-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-purple-500/30">
          {tt("module_badge", "Shipping / Clearing Job Costing")}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{tt("title", "Shipping Job Cost & Inter-Branch Claims")}</h1>
        <p className="text-slate-400 text-sm">
          {tt("subtitle", "Customer Charges vs actual Job Expenses for one order, with cross-branch expense claims kept separate and counted once.")}
        </p>
      </div>

      {error ? <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm font-medium">{error}</div> : null}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <label className="block text-xs font-semibold text-slate-300 mb-2">{tt("select_order", "Shipping Order")} *</label>
        <div className="flex gap-3">
          <div className="flex-1">
            <SearchSelect
              label=""
              value={selectedOrderId}
              options={orderOptions}
              onValueChange={(id) => setSelectedOrderId(id)}
              placeholder={tt("select_order_ph", "Search order number or customer...")}
            />
          </div>
          <button
            type="button"
            onClick={() => void loadReport(selectedOrderId)}
            disabled={!selectedOrderId || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {tt("load", "Load")}
          </button>
        </div>
      </div>

      {report ? (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">
              {report.orderNo} — {report.customerName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase"><TrendingUp className="w-4 h-4" />{tt("customer_revenue", "Customer Revenue (posted)")}</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">{report.profit.currency} {report.profit.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase"><TrendingDown className="w-4 h-4" />{tt("job_expense", "Job Expense (posted)")}</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">{report.profit.currency} {report.profit.expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className={`rounded-xl p-4 border ${report.profit.net >= 0 ? "bg-blue-950/40 border-blue-800/50" : "bg-amber-950/40 border-amber-800/50"}`}>
                <div className={`text-xs font-bold uppercase ${report.profit.net >= 0 ? "text-blue-300" : "text-amber-300"}`}>{tt("net_profit", "Net Job Profit / Loss")}</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">{report.profit.currency} {report.profit.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase">{tt("expense_lines", "Job Expense Lines")} ({report.jobExpenses.lines.length})</h3>
            {report.jobExpenses.lines.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">{tt("no_expenses", "No expense lines posted against this order's bills yet.")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-500 uppercase">
                    <tr>
                      <Th className="px-2 py-2">{tt("th_type", "Type")}</Th>
                      <Th className="px-2 py-2">{tt("th_branch", "Country / Branch")}</Th>
                      <Th className="px-2 py-2 text-right">{tt("th_amount", "Amount")}</Th>
                      <Th className="px-2 py-2">{tt("th_claim", "Claim Status")}</Th>
                      <Th className="px-2 py-2 text-right">{tt("th_action", "Action")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {report.jobExpenses.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-2 py-2">{tt(`type_${l.expenseType}`, l.expenseType)}</td>
                        <td className="px-2 py-2">{l.countryName || "-"} / {l.branchName || "-"}</td>
                        <td className="px-2 py-2 text-right font-mono">{l.currency} {l.grandAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-2">
                          {l.claim ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-slate-700/60 text-slate-300">
                              {tt(`claimstatus_${l.claim.status}`, l.claim.status)}
                            </span>
                          ) : (
                            <span className="text-slate-500">{tt("not_claimed", "Not claimed")}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {!l.claim && l.postingStatus === "posted" ? (
                            <button
                              onClick={() => void handleClaim(l.id)}
                              disabled={claimingLineId === l.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-semibold disabled:opacity-50"
                            >
                              {claimingLineId === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              {tt("claim_action", "Submit Claim")}
                            </button>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase">{tt("claims_title", "Inter-Branch Claims")} ({report.interBranchClaims.length})</h3>
            {report.interBranchClaims.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">{tt("no_claims", "No inter-branch claims for this order.")}</div>
            ) : (
              <div className="space-y-3">
                {report.interBranchClaims.map((c) => (
                  <div key={c.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-300">
                        <span className="font-bold text-white">{c.originCountryName || "-"}</span> → <span className="font-bold text-white">{c.destCountryName || "-"}</span>
                        <span className="mx-2 text-slate-600">|</span>
                        <span className="font-mono">{c.currencyCode} {c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        <span className="mx-2 text-slate-600">|</span>
                        {tt(`type_${c.category}`, c.category || "-")}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                          c.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : c.status === "pending"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {tt(`claimstatus_${c.status}`, c.status)}
                      </span>
                    </div>
                    {c.status === "pending" ? (
                      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-800/60">
                        <div className="w-48">
                          <label className="block text-[10px] text-slate-500 mb-1">{tt("debit_ledger", "Debit Ledger")}</label>
                          <SearchSelect
                            label=""
                            value={acceptLedgers[c.id]?.debit || ""}
                            options={ledgerOptions}
                            onValueChange={(id) => setAcceptLedgers((prev) => ({ ...prev, [c.id]: { debit: id, credit: prev[c.id]?.credit || "" } }))}
                            placeholder={tt("select_ledger_ph", "Select ledger...")}
                          />
                        </div>
                        <div className="w-48">
                          <label className="block text-[10px] text-slate-500 mb-1">{tt("credit_ledger", "Credit Ledger")}</label>
                          <SearchSelect
                            label=""
                            value={acceptLedgers[c.id]?.credit || ""}
                            options={ledgerOptions}
                            onValueChange={(id) => setAcceptLedgers((prev) => ({ ...prev, [c.id]: { debit: prev[c.id]?.debit || "", credit: id } }))}
                            placeholder={tt("select_ledger_ph", "Select ledger...")}
                          />
                        </div>
                        <button
                          onClick={() => void handleDecide(c.id, "accept")}
                          disabled={decidingClaimId === c.id}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                          {decidingClaimId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {tt("accept", "Accept")}
                        </button>
                        <button
                          onClick={() => void handleDecide(c.id, "reject")}
                          disabled={decidingClaimId === c.id}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {tt("reject", "Reject")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
