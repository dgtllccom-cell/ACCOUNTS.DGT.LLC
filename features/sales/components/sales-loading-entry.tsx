"use client";

import React, { useState, type FormEvent } from "react";
import { Anchor, ArrowLeft, FileText, Globe2, Package, Plus, Trash2 } from "lucide-react";
import { CONTAINER_TYPES, loadingProgress, type LoadingOrder, type LoadingRecord } from "@/lib/sales/loading-workflow";

export type LoadingText = (key: string, fallback: string) => string;
const input = "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const button = "rounded-md border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:hover:bg-slate-800";
const section = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900";
const blank = (order: LoadingOrder) => ({
  containerNumber: "", containerType: "40 FT" as (typeof CONTAINER_TYPES)[number], loadingDate: "", receivedDate: "",
  loadingCountry: order.loadingCountry, loadingPort: order.loadingPort, receivedCountry: order.receivedCountry,
  receivedPort: order.receivedPort, vessel: order.vessel, bl: order.bl, shippingLine: order.shippingLine,
  voyage: order.voyage, seal: "", vehicle: "", driver: "", driverMobile: "", flight: "", awb: "", rail: "", remarks: "",
  items: [] as { line: number; quantity: string; gross: string; net: string }[],
});
type Draft = ReturnType<typeof blank>;
function label(key: string, name: string): [string, string] { return [key, name]; }
const operationalFields = {
  loadingDate: label("sales_loading.loading_date", "Loading Date"), receivedDate: label("sales_loading.received_date", "Actual Received Date"),
  loadingCountry: label("sales_loading.loading_country", "Loading Country"), loadingPort: label("sales_loading.loading_port", "Loading Port"),
  receivedCountry: label("sales_loading.received_country", "Receiving Country"), receivedPort: label("sales_loading.received_port", "Receiving Port"),
  vessel: label("sales_loading.vessel", "Vessel Name"), bl: label("sales_loading.bl", "B/L Number"),
  shippingLine: label("sales_loading.shipping_line", "Shipping Line"), voyage: label("sales_loading.voyage", "Voyage No."), seal: label("sales_loading.seal", "Seal Number"),
  vehicle: label("sales_loading.vehicle", "Vehicle No."), driver: label("sales_loading.driver", "Driver Name"), driverMobile: label("sales_loading.driver_mobile", "Driver Mobile"),
  flight: label("sales_loading.flight", "Flight Details"), awb: label("sales_loading.awb", "Air Waybill"), rail: label("sales_loading.rail", "Rail Reference"),
} as const;

export function SalesLoadingEntry({ order, records, tt, onBack, onSaved }: {
  order: LoadingOrder; records: LoadingRecord[]; tt: LoadingText; onBack: () => void; onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [containers, setContainers] = useState<Draft[]>([blank(order)]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const progress = loadingProgress(order.goods, records);
  const patch = (index: number, newValues: Partial<Draft>) => setContainers(c => c.map((row, i) => i === index ? { ...row, ...newValues } : row));
  const toggleLine = (index: number, line: number) => {
    const fields = containers[index].items;
    patch(index, { items: fields.some(it => it.line === line) ? fields.filter(it => it.line !== line) : [...fields, { line, quantity: "", gross: "", net: "" }] });
  };
  const patchItem = (index: number, line: number, key: "quantity" | "gross" | "net", value: string) => patch(index, { items: containers[index].items.map(it => it.line === line ? { ...it, [key]: value } : it) });
  async function save(ev: FormEvent) {
    ev.preventDefault();
    setError("");
    if (saving) return;
    if (containers.some(c => c.items.length < 1)) { setError(tt("sales_loading.choose_line", "Select at least one goods line in every container.")); return; }
    setSaving(true);
    try {
      const payload = containers.map(c => ({ ...c, receivedDate: c.receivedDate || null, items: c.items.map(it => ({ ...it, quantity: +it.quantity, gross: +it.gross, net: +it.net })) }));
      const res = await fetch("/api/erp/sales/loading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, containers: payload }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error?.code === "OVERLOAD" ? tt("sales_loading.overload", "The quantity exceeds the remaining balance of a goods line.")
          : data.error?.code === "DUPLICATE_CONTAINER" ? tt("sales_loading.duplicate_container", "This container is already on this booking.")
          : tt("sales_loading.save_error", "Could not save loading. Check the fields and try again.");
        throw new Error(msg);
      }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : tt("sales_loading.save_error", "Could not save loading. Check the fields and try again.")); }
    finally { setSaving(false); }
  }
  const steps = [["plrf.tab_bill_entry", "Bill Entry", FileText], ["plrf.tab_parties", "Parties", Globe2], ["plrf.tab_goods_entry", "Goods Entry", Package], ["plrf.tab_new_loading", "New Loading", Anchor]] as const;
  const field = (caption: string, value: string) => <div key={caption} className="rounded-md bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-xs text-slate-500">{caption}</dt><dd className="font-semibold">{value || "–"}</dd></div>;
  return <div className="space-y-4" data-testid="sales-loading-entry">
    <div className={`${section} flex flex-wrap items-center gap-3`}>
      <button type="button" onClick={onBack} className={button}><ArrowLeft className="me-1 inline h-4 w-4"/>{tt("plrf.back_to_dashboard", "Dashboard")}</button>
      <h1 className="text-lg font-bold text-blue-800 dark:text-blue-300">{tt("sales_loading.entry_title", "New Sales Loading Entry")} <span className="font-mono">{order.bookingNo}</span></h1>
    </div>
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <div className={section}>
        <nav aria-label={tt("plrf.workflow_title", "Loading Workflow")} className="mb-5 grid grid-cols-2 gap-2 border-b border-slate-200 pb-3 sm:grid-cols-4 dark:border-slate-700">
          {steps.map(([key, fallback, Icon], index) => <button key={key} type="button" aria-current={index === step ? "step" : undefined} className={`${button} text-xs ${index === step ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-slate-800 dark:text-blue-300" : ""}`} onClick={() => setStep(index)}><Icon className="me-1 inline h-4 w-4"/>{tt(key, fallback)}</button>)}
        </nav>
        {step === 0 && <dl className="grid grid-cols-2 gap-3">{[field(tt("plrf.bill_ref_no", "Bill / Ref No"), order.bookingNo), field(tt("plrf.issue_date", "Issue Date"), order.orderDate), field(tt("plrf.shipping_mode", "Shipping Mode"), order.shippingMode), field(tt("sales_loading.branch", "Branch Name"), [order.mainBranch, order.cityBranch].filter(Boolean).join(" / "))]}</dl>}
        {step === 1 && <dl className="grid grid-cols-2 gap-3">{[field(tt("plrf.notify_party", "Notify Party"), order.notify), field(tt("plrf.importer", "Importer / Consignee"), order.customer), field(tt("plrf.exporter", "Exporter / Shipper"), order.shipper || order.supplier), field(tt("sales_loading.purchase_dr", "Purchase DR"), order.purchaseDR.join(" / ")), field(tt("sales_loading.sales_cr", "Sales CR"), order.salesCR.join(" / "))]}</dl>}
        {step === 2 && <div className="overflow-auto"><table className="w-full min-w-[440px] text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr>{[["sales_loading.goods", "Goods Name"], ["sales_loading.lot", "Lot Name"], ["plrf.total_qty", "Total Qty"], ["plrf.loaded", "Loaded"], ["plrf.balance", "Balance"]].map(([key, name]) => <th key={key} className="p-2 text-start">{tt(key, name)}</th>)}</tr></thead><tbody>{order.goods.map(g => <tr key={g.line} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{g.goods}</td><td>{g.lot || "–"}</td><td>{g.quantity} {g.unit}</td><td>{progress.loadedByLine.get(g.line) ?? 0}</td><td>{Math.max(0, g.quantity - (progress.loadedByLine.get(g.line) ?? 0))}</td></tr>)}</tbody></table></div>}
        {step < 3 && <div className="mt-4 flex justify-end"><button type="button" onClick={() => setStep(s => s + 1)} className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white">{tt(steps[step + 1][0], steps[step + 1][1])}</button></div>}
        {step === 3 && <form onSubmit={save} className="space-y-4">
          {containers.map((c, index) => <fieldset key={index} disabled={saving} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 font-bold text-blue-800 dark:text-blue-300">{tt("plrf.col_container", "Container")} {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">{tt("plrf.container_no_req", "Container Number *")}<input autoComplete="off" required maxLength={160} value={c.containerNumber} onChange={e => patch(index, { containerNumber: e.target.value })} className={input}/></label>
              <label className="text-xs font-semibold">{tt("sales_loading.container_type", "Container Type")}<select value={c.containerType} onChange={e => patch(index, { containerType: e.target.value as Draft["containerType"] })} className={input}>{CONTAINER_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
              {(Object.keys(operationalFields) as (keyof typeof operationalFields)[]).filter(k => {
                const mode = order.shippingMode.toLowerCase();
                if (["driver", "vehicle", "driverMobile"].includes(k)) return mode.includes("road") || !mode;
                if (["flight", "awb"].includes(k)) return mode.includes("air") || !mode;
                if (k === "rail") return mode.includes("rail") || !mode;
                if (["shippingLine", "vessel", "bl", "voyage"].includes(k)) return mode.includes("sea") || !mode;
                return true;
              }).map(key => <label key={key} className="text-xs font-semibold">{tt(...operationalFields[key])}<input type={key.endsWith("Date") ? "date" : "text"} required={key === "loadingDate"} value={c[key]} onChange={e => patch(index, { [key]: e.target.value })} className={input}/></label>)}
            </div>
            <div className="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800">
              <p className="font-semibold">{tt("plrf.tab_goods_entry", "Goods Entry")}</p>
              {order.goods.map(g => {
                const balance = Math.max(0, g.quantity - (progress.loadedByLine.get(g.line) ?? 0));
                const item = c.items.find(it => it.line === g.line);
                const lineName = [g.goods, g.lot].filter(Boolean).join(" / ");
                return <div key={g.line} className="border-b border-slate-200 pb-2 dark:border-slate-700"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item)} disabled={balance <= 0} onChange={() => toggleLine(index, g.line)}/>{lineName} <span className="text-slate-500">({balance} {g.unit})</span></label>
                  {item && <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{([["quantity", "plrf.loading_qty_req", "Loading Quantity *"], ["gross", "sales_loading.gross", "Gross Weight (KG)"], ["net", "sales_loading.net", "Net Weight (KG)"]] as const).map(([key, k, name]) => <label key={key} className="text-xs font-semibold">{tt(k, name)}<input required value={item[key]} type="number" inputMode="decimal" step="any" min="0.000001" max={key === "quantity" ? balance : undefined} onChange={e => patchItem(index, g.line, key, e.target.value)} className={input}/></label>)}</div>}
                </div>;
              })}
            </div>
            <label className="block text-xs font-semibold">{tt("plrf.loading_notes", "Loading Notes")}<textarea className={input} rows={2} maxLength={1000} value={c.remarks} onChange={e => patch(index, { remarks: e.target.value })}/></label>
            {containers.length > 1 && <button type="button" className={`${button} text-rose-600`} onClick={() => setContainers(rows => rows.filter((_, i) => i !== index))}><Trash2 className="me-1 inline h-4 w-4"/>{tt("sales_loading.remove_container", "Remove Container")}</button>}
          </fieldset>)}
          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex flex-wrap justify-between gap-3"><button type="button" disabled={saving || containers.length >= 30} className={button} onClick={() => setContainers(c => [...c, blank(order)])}><Plus className="me-1 inline h-4 w-4"/>{tt("sales_loading.add_container", "Add Container")}</button><button disabled={saving || progress.status === "loaded"} className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-45">{saving ? tt("plrf.saving", "Saving…") : tt("plrf.save_loading", "Save Loading")}</button></div>
        </form>}
      </div>
      <aside className={`${section} self-start`}>
        <h2 className="mb-3 flex items-center gap-2 rounded-md bg-blue-800 p-3 text-sm font-bold text-white"><Anchor className="h-4 w-4"/>{tt("plrf.live_bl_report", "LIVE BL REPORT")}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">{[field(tt("plrf.bill_ref_no", "Bill / Ref No"), order.bookingNo), field(tt("sales_loading.vessel", "Vessel Name"), order.vessel), field(tt("sales_loading.loading_port", "Loading Port"), order.loadingPort), field(tt("sales_loading.received_port", "Receiving Port"), order.receivedPort)]}</dl>
        <h3 className="mt-4 border-b pb-2 text-xs font-bold">{tt("plrf.goods_container", "GOODS & CONTAINER REPORT")}</h3>
        {records.length ? records.map(c => <div key={c.id} className="border-b border-slate-100 py-2 text-xs"><strong>{c.container_number}</strong><span className="ms-2">{c.loading_date}</span><p>{c.goods.map(g => `${g.quantity} ${g.unit || ""}`).join(" / ")}</p></div>) : <p className="mt-2 text-xs text-slate-500">{tt("plrf.no_loading_yet", "No Loading Records Yet")}</p>}
      </aside>
    </div>
  </div>;
}
