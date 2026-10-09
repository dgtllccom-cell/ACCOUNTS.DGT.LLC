"use client";

/**
 * Local Purchase — full lifecycle report (View / A4 Print / PDF).
 * One read-only page: purchase & supplier, payment condition and ledger activity, lots and quantities,
 * warehouse transfers, loading & transit, local sales, export sales, inter-country trades with their
 * destination purchases, and one merged audit timeline. Five-language / RTL via useErpScreen("gtj").
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Boxes, Loader2, AlertTriangle } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";

type Json = any;
const fmt = (n: unknown, d = 2) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const qty = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : "—");
const dOnly = (v: unknown) => (v ? String(v).slice(0, 10) : "—");

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h2 className="border-b border-slate-100 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 dark:border-slate-800 dark:text-slate-200">{title}</h2>
      <div className="overflow-x-auto p-3 text-xs">{children}</div>
    </section>
  );
}

export function LocalPurchaseLifecycleView({ purchaseId, lang }: { purchaseId: string; lang?: string }) {
  const s = useErpScreen("gtj", lang);
  const router = useRouter();
  const [d, setD] = useState<Json>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/purchases/local-purchase/${purchaseId}/lifecycle?lang=${s.lang}`, { credentials: "same-origin" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) setErr(j?.error?.message || `HTTP ${res.status}`); else { setD(j.data); setErr(""); }
    } catch (e: any) { setErr(e?.message || "Network error"); }
    setLoading(false);
  }, [purchaseId, s.lang]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !d) return <div dir={s.dir} className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}</div>;
  if (err && !d) return <div dir={s.dir} className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="me-2 inline h-4 w-4" />{err}</div>;

  const p = d.purchase;
  const lotRef = (id: string) => d.lots.find((l: Json) => l.id === id)?.lot_ref ?? "";
  const th = `p-2 ${s.textStart} text-[10px] font-bold uppercase text-slate-500`;
  const thEnd = `p-2 ${s.textEnd} text-[10px] font-bold uppercase text-slate-500`;
  const purposeLabel = (x: string) => s.t(`purpose_${x}`, x.replace(/_/g, " "));
  const stateLabel = (x: string) => s.t(`state_${x}`, x.replace("_", " "));

  return (
    <div dir={s.dir} className="mx-auto max-w-6xl space-y-4 p-3 pb-28 sm:p-4 sm:pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print" data-print-exclude>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push("/dashboard/purchase/local-purchase")} aria-label={s.t("back", "Back")} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700">
            <ArrowLeft className={`h-4 w-4 ${s.isRtl ? "rotate-180" : ""}`} />
          </button>
          <h1 className="text-base font-black">{s.t("lc_title", "Local Purchase — Lifecycle Report")}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push(`/dashboard/purchase/local-purchase/${purchaseId}/goods-transfer`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <Boxes className="h-4 w-4" /> {s.t("title", "Goods Transfer Journal")}
          </button>
          <button type="button" onClick={() => printDomFragmentViaModal("printable-lp-lifecycle", s.t("lc_title", "Local Purchase — Lifecycle Report"), { lang: s.lang })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
            <Printer className="h-4 w-4" /> {s.t("lc_print", "Print / PDF (A4)")}
          </button>
        </div>
      </div>

      <div id="printable-lp-lifecycle" className="space-y-4">
        <header className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-lg font-black">{s.t("lc_title", "Local Purchase — Lifecycle Report")}</div>
              <div className="font-mono text-[11px] text-slate-500">{p.journalSerialNo || p.id}</div>
            </div>
            <div className="text-end text-[11px] text-slate-600">
              <div>{p.countryName} · {p.branchName}{p.cityName ? ` · ${p.cityName}` : ""}</div>
              <div>{s.t("status", "Status")}: <b>{s.t(`status_${p.status}`, p.status)}</b></div>
            </div>
          </div>
        </header>

        <Sec title={s.t("lc_purchase", "Purchase and supplier")}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("supplier", "Supplier")}</dt><dd className="font-semibold">{p.supplier || "—"}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("lc_goods", "Goods")}</dt><dd className="font-semibold">{p.goods}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("lc_bill", "Bill / lot no.")}</dt><dd className="font-semibold">{p.manualBillNo || "—"} / {p.lotNo || "—"}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("lc_amount", "Amount")}</dt><dd className="font-semibold">{p.currency} {fmt(p.finalCost)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("lc_posted_at", "Posted")}</dt><dd className="font-semibold">{dt(p.postedAt)}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("lc_charges", "Additional charges")}</dt><dd className="font-semibold">{(d.extraCharges as Json[]).length ? (d.extraCharges as Json[]).map((c) => `${c.label} ${fmt(c.amount)}${c.allocate ? " ✓" : ""}`).join(" · ") : "—"}</dd></div>
          </dl>
        </Sec>

        <Sec title={s.t("lc_payment", "Payment condition, ledger and Roznamcha references")}>
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1">
            <span>{s.t("payment", "Payment condition")}: <b>{p.paymentMode}</b></span>
            <span>{s.t("lc_advance", "Advance")}: <b>{fmt(p.advanceAmount)}</b></span>
            <span>{s.t("remaining", "Remaining")}: <b>{fmt(p.remainingBalance)}</b></span>
            {d.payableLedger ? <span>{s.t("lc_payable_bal", "Payable ledger balance")}: <b>{d.payableLedger.currency} {fmt(d.payableLedger.balance)}</b> ({d.payableLedger.code})</span> : null}
          </div>
          {d.purchaseEntry ? (
            <table className="w-full">
              <thead><tr><th className={th}>{s.t("lc_voucher", "Voucher")}</th><th className={th}>{s.t("lc_ledger", "Ledger")}</th><th className={thEnd}>{s.t("lc_dr", "Debit")}</th><th className={thEnd}>{s.t("lc_cr", "Credit")}</th></tr></thead>
              <tbody>
                {(d.purchaseEntry.lines as Json[] ?? []).map((l, i) => (
                  <tr key={i} className="border-t border-slate-100"><td className="p-2 font-mono">{i === 0 ? d.purchaseEntry.voucher_no : ""}</td><td className="p-2">{l.code} {l.name}</td><td className={`p-2 font-mono ${s.textEnd}`}>{Number(l.debit) ? fmt(l.debit) : ""}</td><td className={`p-2 font-mono ${s.textEnd}`}>{Number(l.credit) ? fmt(l.credit) : ""}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-slate-500">{s.t("lc_not_posted", "Not posted yet.")}</p>}
          {(d.payableActivity as Json[]).length ? (
            <>
              <div className="mt-3 mb-1 text-[10px] font-bold uppercase text-slate-500">{s.t("lc_settlements", "Recent entries on the supplier payable account (payments and settlements)")}</div>
              <table className="w-full">
                <thead><tr><th className={th}>{s.t("lc_date", "Date")}</th><th className={th}>{s.t("lc_voucher", "Voucher")}</th><th className={th}>{s.t("lc_narration", "Narration")}</th><th className={thEnd}>{s.t("lc_dr", "Debit")}</th><th className={thEnd}>{s.t("lc_cr", "Credit")}</th></tr></thead>
                <tbody>
                  {(d.payableActivity as Json[]).map((a) => (
                    <tr key={a.id + a.debit + a.credit} className="border-t border-slate-100"><td className="p-2">{dOnly(a.entry_date)}</td><td className="p-2 font-mono">{a.voucher_no}</td><td className="p-2">{a.narration}</td><td className={`p-2 font-mono ${s.textEnd}`}>{Number(a.debit) ? fmt(a.debit) : ""}</td><td className={`p-2 font-mono ${s.textEnd}`}>{Number(a.credit) ? fmt(a.credit) : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </Sec>

        <Sec title={s.t("lc_lots", "Goods, lots and quantities")}>
          <table className="w-full">
            <thead><tr>
              <th className={th}>{s.t("col_lot", "Lot")}</th><th className={th}>{s.t("lc_goods", "Goods")}</th>
              {["q_purchased", "q_received", "q_reserved", "q_transferred", "q_sold", "q_exported", "q_available"].map((k) => <th key={k} className={thEnd}>{s.t(k, k.slice(2))}</th>)}
              <th className={th}>{s.t("lc_where", "Current location")}</th>
            </tr></thead>
            <tbody>
              {(d.lots as Json[]).map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="p-2 font-mono">{l.lot_ref}</td><td className="p-2">{l.goods_name}</td>
                  {[l.balance.purchased, l.balance.received, l.balance.reserved, l.balance.transferred, l.balance.sold, l.balance.exported, l.balance.available].map((v, i) => <td key={i} className={`p-2 font-mono ${s.textEnd}`}>{qty(v)}</td>)}
                  <td className="p-2">{(l.stock as Json[]).map((r) => <div key={r.id}>{stateLabel(r.state)}: <b>{qty(r.qty)}</b> @ {r.warehouse_name || r.location_label || "—"}{r.rack_bin ? `/${r.rack_bin}` : ""}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">{s.t("lc_cost_line", "Original cost and landed cost per lot")}: {(d.lots as Json[]).map((l) => `${l.lot_ref}: ${l.currency_code} ${fmt(l.original_cost)} / ${fmt(l.landed_cost)}`).join("  ·  ")}</p>
        </Sec>

        <Sec title={s.t("lc_transfers", "Warehouse transfers and decisions")}>
          {(d.transfers as Json[]).length === 0 ? <p className="text-slate-500">{s.t("lc_none", "None yet.")}</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>{s.t("col_no", "Transfer no.")}</th><th className={th}>{s.t("col_purpose", "Purpose")}</th><th className={th}>{s.t("col_lot", "Lot")}</th><th className={thEnd}>{s.t("col_qty", "Quantity")}</th><th className={th}>{s.t("col_destination", "Destination")}</th><th className={th}>{s.t("col_status", "Status")}</th><th className={th}>{s.t("lc_date", "Date")}</th></tr></thead>
              <tbody>
                {(d.transfers as Json[]).map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="p-2 font-mono">{t.transfer_no}</td><td className="p-2">{purposeLabel(t.purpose)}</td><td className="p-2">{lotRef(t.lot_id)}</td>
                    <td className={`p-2 font-mono ${s.textEnd}`}>{qty(t.qty)}</td>
                    <td className="p-2">{t.dest_warehouse_name ? `${t.dest_warehouse_code ?? ""} ${t.dest_warehouse_name}` : t.provider_name ? `${t.provider_name} — ${t.provider_city}` : "—"}</td>
                    <td className="p-2">{s.t(`status_${t.status}`, t.status)}</td><td className="p-2">{dOnly(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sec>

        <Sec title={s.t("lc_loading", "Loading, container / truck, BL and customs")}>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("ship_mode", "Transport mode")}</dt><dd className="font-semibold">{d.loading.shippingMode || "—"}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("truck", "Truck / vehicle")}</dt><dd className="font-semibold">{d.loading.truckNo || d.loading.details?.truckNo || "—"} {d.loading.driverName || d.loading.details?.driverName ? `· ${d.loading.driverName || d.loading.details?.driverName}` : ""}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("loading_date", "Loading date")}</dt><dd className="font-semibold">{dOnly(d.loading.loadingDate)}</dd></div>
          </dl>
          {(d.sales as Json[]).filter((x) => x.shipping && Object.keys(x.shipping).length).map((x) => (
            <div key={x.id} className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800/60">
              <b>{x.sales_order_no}</b> — {Object.entries(x.shipping as Json).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </div>
          ))}
          <p className="mt-2 text-[11px] text-slate-500">{s.t("lc_docs_note", "Customs, Bill of Lading and shipment tracking documents are kept in Shipping / Clearing; the sale's own shipping fields are shown here.")}</p>
        </Sec>

        <Sec title={s.t("lc_sales", "Local sales and export sales")}>
          {(d.sales as Json[]).filter((x) => !x.trade_ref).length === 0 ? <p className="text-slate-500">{s.t("lc_none", "None yet.")}</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>{s.t("lc_sale_no", "Sales order")}</th><th className={th}>{s.t("lc_type", "Type")}</th><th className={th}>{s.t("lc_customer", "Customer")}</th><th className={thEnd}>{s.t("lc_amount", "Amount")}</th><th className={th}>{s.t("col_status", "Status")}</th></tr></thead>
              <tbody>
                {(d.sales as Json[]).filter((x) => !x.trade_ref).map((x) => (
                  <tr key={x.id} className="border-t border-slate-100"><td className="p-2 font-mono">{x.sales_order_no}</td><td className="p-2">{x.sale_mode === "export" ? purposeLabel("export_customer") : purposeLabel("local_sale")}</td><td className="p-2">{x.customer_name}</td><td className={`p-2 font-mono ${s.textEnd}`}>{x.currency_code} {fmt(x.order_total)}</td><td className="p-2">{x.ledger_posting_status} / {x.payment_status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Sec>

        <Sec title={s.t("lc_trades", "Inter-Country Trades and destination purchases")}>
          {(d.trades as Json[]).length === 0 ? <p className="text-slate-500">{s.t("lc_none", "None yet.")}</p> : (
            <table className="w-full">
              <thead><tr><th className={th}>{s.t("lc_trade_ref", "Trade reference")}</th><th className={thEnd}>{s.t("col_qty", "Quantity")}</th><th className={thEnd}>{s.t("lc_sale_src", "Source sale")}</th><th className={thEnd}>{s.t("lc_sale_dest", "Destination amount")}</th><th className={thEnd}>{s.t("lc_rate", "Rate")}</th><th className={th}>{s.t("col_status", "Status")}</th><th className={th}>{s.t("lc_dest_purchase", "Destination purchase / lot")}</th></tr></thead>
              <tbody>
                {(d.trades as Json[]).map((t) => {
                  const dp = (d.destPurchases as Json[]).find((x) => x.trade_ref === t.trade_ref);
                  const dl = (d.destLots as Json[]).find((x) => x.local_purchase_id === dp?.id);
                  return (
                    <tr key={t.id} className="border-t border-slate-100 align-top">
                      <td className="p-2 font-mono">{t.trade_ref}</td><td className={`p-2 font-mono ${s.textEnd}`}>{qty(t.qty)}</td>
                      <td className={`p-2 font-mono ${s.textEnd}`}>{t.source_currency} {fmt(t.sale_amount_source)}</td><td className={`p-2 font-mono ${s.textEnd}`}>{t.dest_currency} {fmt(t.sale_amount_dest)}</td>
                      <td className={`p-2 font-mono ${s.textEnd}`}>{t.approved_exchange_rate}</td><td className="p-2">{s.t(`status_${t.status}`, t.status)}</td>
                      <td className="p-2">{dp ? `${dp.country_name} · ${s.t(`status_${dp.status}`, dp.status)}` : "—"}{dl ? ` · ${dl.lot_ref} (${qty(dl.available)} ${s.t("q_available", "Available")})` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Sec>

        <Sec title={s.t("lc_timeline", "Timeline and audit history")}>
          <ol className="space-y-1">
            {(d.events as Json[]).map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                <span className="font-mono text-slate-500">{dt(e.at)}</span>
                <b>{s.t(`mv_${String(e.kind).replace(/^mv_/, "")}`, s.t(`ev_${e.kind}`, e.text))}</b>
                {e.qty ? <span>{qty(e.qty)}</span> : null}
                {e.ref ? <span className="font-mono text-slate-500">{e.ref}</span> : null}
                {e.by ? <span className="text-slate-500">{e.by}</span> : null}
              </li>
            ))}
          </ol>
        </Sec>
      </div>
    </div>
  );
}
