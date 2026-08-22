"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, MapPin } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

function buildTt(lang: string) {
  return (key: string, fb: string) => t((lang || "en") as any, key as any, fb);
}

type TimelineEvent = {
  stage: string;
  actionKey: string;
  actionData: Record<string, string | number | null>;
  userName: string | null;
  at: string | null;
  sourceScope: string | null;
  destScope: string | null;
  quantity: number | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  referenceNo: string | null;
};

const ACTION_TEMPLATES: Record<string, [string, string]> = {
  "ctimeline.action_purchase_created": ["ctimeline.action_purchase_created", "Purchase Order Created"],
  "ctimeline.action_payment_posted": ["ctimeline.action_payment_posted", "{kind} payment posted"],
  "ctimeline.action_roznamcha_posted": ["ctimeline.action_roznamcha_posted", "Roznamcha/Journal posted (Serial: {serial})"],
  "ctimeline.action_transfer_linked": ["ctimeline.action_transfer_linked", "Country Transfer scope linked (source → destination)"],
  "ctimeline.action_transport_arranged": ["ctimeline.action_transport_arranged", "Transportation arranged ({mode})"],
  "ctimeline.action_transport_arranged_with_company": ["ctimeline.action_transport_arranged_with_company", "Transportation arranged ({mode} — {company})"],
  "ctimeline.action_loaded_container": ["ctimeline.action_loaded_container", "Loaded — container {container}"],
  "ctimeline.action_departed": ["ctimeline.action_departed", "Departed — in transit"],
  "ctimeline.action_fully_received": ["ctimeline.action_fully_received", "Fully received"],
  "ctimeline.action_partially_received": ["ctimeline.action_partially_received", "Partially received"],
  "ctimeline.action_stock_in": ["ctimeline.action_stock_in", "Stock IN — {warehouse}"],
  "ctimeline.action_closed": ["ctimeline.action_closed", "Closed — fully paid and fully received"],
  "ctimeline.action_open": ["ctimeline.action_open", "Final balance (open)"]
};

const STATUS_LABEL_KEYS: Record<string, [string, string]> = {
  pending: ["ctimeline.status_pending", "Pending"],
  partial: ["ctimeline.status_partial", "Partial"],
  unpaid: ["ctimeline.status_unpaid", "Unpaid"],
  paid: ["ctimeline.status_paid", "Paid"],
  completed: ["ctimeline.status_completed", "Completed"],
  linked: ["ctimeline.status_linked", "Linked"],
  posted: ["ctimeline.status_posted", "Posted"],
  loaded: ["ctimeline.status_loaded", "Loaded"],
  dispatched: ["ctimeline.status_dispatched", "Dispatched"],
  in_transit: ["ctimeline.status_in_transit", "In Transit"],
  partially_received: ["ctimeline.status_partially_received", "Partially Received"],
  received: ["ctimeline.status_received", "Received"],
  closed: ["ctimeline.status_closed_short", "Closed"],
  open: ["ctimeline.status_open_short", "Open"]
};

const KIND_LABEL_KEYS: Record<string, [string, string]> = {
  advance: ["ctimeline.kind_advance", "Advance"],
  credit: ["ctimeline.kind_credit", "Credit"],
  remaining: ["ctimeline.kind_remaining", "Remaining"],
  payment: ["ctimeline.kind_payment", "Payment"]
};

function renderAction(tt: (key: string, fb: string) => string, actionKey: string, actionData: Record<string, any>) {
  const template = ACTION_TEMPLATES[actionKey];
  if (!template) return actionKey;
  const resolvedData = { ...actionData };
  if (typeof resolvedData.kind === "string") {
    const kindKey = KIND_LABEL_KEYS[resolvedData.kind.trim()];
    if (kindKey) resolvedData.kind = tt(kindKey[0], kindKey[1]);
  }
  let text = tt(template[0], template[1]);
  for (const [param, value] of Object.entries(resolvedData || {})) {
    text = text.replace(`{${param}}`, String(value ?? ""));
  }
  return text;
}

function renderStatus(tt: (key: string, fb: string) => string, status: string | null) {
  const normalized = (status || "").trim().toLowerCase();
  const template = STATUS_LABEL_KEYS[normalized];
  if (template) return tt(template[0], template[1]);
  return (status || "-").replace(/_/g, " ");
}

type TimelineData = {
  purchaseOrderId: string;
  purchaseOrderNo: string;
  referenceNo: string;
  sourceScope: string | null;
  destScope: string | null;
  goodsName: string | null;
  supplierName: string | null;
  orderTotal: number;
  advancePaid: number;
  remainingDue: number;
  currency: string | null;
  purchasedQty: number;
  loadedQty: number;
  receivedQty: number;
  events: TimelineEvent[];
};

const STAGE_LABEL_KEYS: Record<string, [string, string]> = {
  purchase_created: ["ctimeline.stage_purchase", "Purchase Created"],
  advance_credit: ["ctimeline.stage_advance", "Advance / Credit"],
  payment: ["ctimeline.stage_payment", "Payment"],
  roznamcha_journal_ledger: ["ctimeline.stage_roznamcha", "Roznamcha / Journal / Ledger"],
  country_transfer: ["ctimeline.stage_transfer", "Country Transfer"],
  transportation: ["ctimeline.stage_transport", "Transportation"],
  loading: ["ctimeline.stage_loading", "Loading"],
  in_transit: ["ctimeline.stage_transit", "In Transit"],
  receiving: ["ctimeline.stage_receiving", "Receiving"],
  stock_warehouse: ["ctimeline.stage_stock", "Stock / Warehouse"],
  final_balance: ["ctimeline.stage_final", "Final Balance / Closed"]
};

function money(v: number | null, currency?: string | null) {
  if (v === null || v === undefined) return "-";
  return `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? " " + currency : ""}`;
}

export function CountryPurchaseTimelineView({ purchaseOrderId }: { purchaseOrderId: string }) {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang || "en");

  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/erp/purchases/${purchaseOrderId}/country-timeline`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body?.error?.message || "Failed to load timeline.");
        setData(body.data);
      } catch (e: any) {
        setError(e?.message || "Failed to load timeline.");
      } finally {
        setLoading(false);
      }
    })();
  }, [purchaseOrderId]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{tt("common.loading", "Loading...")}</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-rose-600">{error || tt("ctimeline.not_found", "Timeline not found.")}</div>;
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-black text-slate-900 dark:text-white">
          {tt("ctimeline.title", "Country Purchase Timeline")} — {data.purchaseOrderNo}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{data.referenceNo}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-500">{tt("ctimeline.goods", "Goods")}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.goodsName || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-500">{tt("ctimeline.supplier", "Supplier")}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.supplierName || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-500">{tt("ctimeline.qty_progress", "Qty (Purchased / Loaded / Received)")}</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.purchasedQty} / {data.loadedQty} / {data.receivedQty}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-500">{tt("ctimeline.balance", "Remaining Balance")}</div>
            <div className="text-sm font-bold text-amber-600">{money(data.remainingDue, data.currency)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {data.sourceScope || "-"}
          <span className="text-slate-400">→</span>
          <MapPin className="h-3.5 w-3.5 text-emerald-500" /> {data.destScope || "-"}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 text-start">{tt("ctimeline.stage", "Stage")}</th>
              <th className="px-3 py-2 text-start">{tt("ctimeline.action", "Action")}</th>
              <th className="px-3 py-2 text-start">{tt("ctimeline.user", "User")}</th>
              <th className="px-3 py-2 text-start">{tt("ctimeline.datetime", "Date/Time")}</th>
              <th className="px-3 py-2 text-start">{tt("ctimeline.source", "Source")}</th>
              <th className="px-3 py-2 text-start">{tt("ctimeline.destination", "Destination")}</th>
              <th className="px-3 py-2 text-end">{tt("ctimeline.qty", "Quantity")}</th>
              <th className="px-3 py-2 text-end">{tt("ctimeline.amount", "Amount")}</th>
              <th className="px-3 py-2 text-start">{tt("common.status", "Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.events.map((e, i) => {
              const [key, fb] = STAGE_LABEL_KEYS[e.stage] || [null, e.stage];
              const isDone = e.status === "closed" || e.status === "posted" || e.status === "received" || e.status === "linked";
              return (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-3 py-2 font-bold text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 text-slate-300" />}
                      {key ? tt(key, fb) : fb}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{renderAction(tt, e.actionKey, e.actionData)}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.userName || "-"}</td>
                  <td className="px-3 py-2 text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.at ? new Date(e.at).toLocaleString() : "-"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.sourceScope || "-"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{e.destScope || "-"}</td>
                  <td className="px-3 py-2 text-end font-mono">{e.quantity ?? "-"}</td>
                  <td className="px-3 py-2 text-end font-mono">{e.amount !== null ? money(e.amount, e.currency) : "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {renderStatus(tt, e.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
