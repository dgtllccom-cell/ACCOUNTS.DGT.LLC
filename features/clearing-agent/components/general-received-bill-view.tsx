"use client";

/**
 * Clearing Agent — General Received Bills desk. Every customer order this login may see, with the status of its four expense
 * bills (Customs / Truck / Customer / Other): the bills already made (Open bill) or none yet (Create bill → the bill page opens on
 * the order). Opened from Order Transfer with ?orderId=… it shows that order first. Read-only: nothing is posted from here.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightLeft, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { ORDER_BILL_TYPES, OrderBillStatusCell, orderBillTypeLabel, useOrderBillStatus } from "./order-bill-status";

type OrderRow = {
  id: string;
  order_no: string;
  created_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  loading_country_name?: string | null;
  receiving_country_name?: string | null;
  goods_name?: string | null;
  truck_number?: string | null;
  truck_driver_name?: string | null;
  status?: string | null;
  /** saved: the order was received at the Clearing Agent desk, and its latest transfer */
  general_received?: boolean;
  expense_transfer?: { destination: string; date: string; user: string; memo: string | null } | null;
};

export function GeneralReceivedBillView() {
  const lang = useActiveLanguage();
  const tt = (k: string, fb: string) => t(lang, k as never, fb);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const sp = useSearchParams();
  const focusId = sp.get("orderId");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  // "received at the desk" (saved) or every order; starts on the received orders once there are any
  const [deskTab, setDeskTab] = useState<"received" | "all" | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-order", { credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error("load");
      setOrders(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const status = useOrderBillStatus(useMemo(() => orders.map((o) => o.order_no), [orders]));

  const receivedCount = orders.filter((o) => o.general_received).length;
  const tab = deskTab ?? (receivedCount > 0 ? "received" : "all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orders
      // the order opened from Order Transfer is always listed, even before it is received
      .filter((o) => tab === "all" || o.general_received || o.id === focusId)
      .filter((o) => !q || [o.order_no, o.customer_name, o.truck_number, o.goods_name].some((v) => String(v ?? "").toLowerCase().includes(q)))
      .filter((o) => !onlyOpen || ORDER_BILL_TYPES.some((b) => !status.denied.includes(b.key) && !(status.bills[o.order_no]?.[b.key]?.length)));
    // the order opened from Order Transfer first
    return focusId ? [...list.filter((o) => o.id === focusId), ...list.filter((o) => o.id !== focusId)] : list;
  }, [orders, query, onlyOpen, status.bills, status.denied, focusId, tab]);

  const billedOrders = orders.filter((o) => Object.values(status.bills[o.order_no] ?? {}).some((l) => (l?.length ?? 0) > 0)).length;

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"} data-testid="general-received-bills">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Inbox className="h-5 w-5 text-cyan-600" />{tt("grb.title", "General Received Bills — Clearing Agent")}
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500">{tt("grb.subtitle", "Customer orders received at the Clearing Agent desk and the expense bills made for each. Create or open a bill — nothing is posted from here.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tt("grb.orders", "Orders")}: {orders.length}</span>
          <span className="rounded-lg bg-cyan-50 px-2 py-1 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{tt("grb.tab_received", "Received at the desk")}: {receivedCount}</span>
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{tt("grb.with_bills", "With bills")}: {billedOrders}</span>
          <Link href={"/dashboard/clearing-agent/order-transfer" as never} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <ArrowRightLeft className="h-3.5 w-3.5" />{tt("obill.back_to_transfer", "Order Transfer")}
          </Link>
          <button type="button" onClick={() => { void load(); void status.refresh(); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <RefreshCw className={cn("h-3.5 w-3.5", (loading || status.loading) && "animate-spin")} />{tt("grb.refresh", "Refresh")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(["received", "all"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            data-testid={`grb-tab-${k}`}
            onClick={() => setDeskTab(k)}
            className={cn("h-7 rounded-lg border px-2.5 text-[11px] font-black", tab === k ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}
          >
            {k === "received" ? tt("grb.tab_received", "Received at the desk") : tt("grb.tab_all", "All orders")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tt("grb.search_ph", "Search order no., customer, truck, goods…")}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white ps-8 pe-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          {tt("grb.only_missing", "Only orders with a bill still to make")}
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-10 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-4 w-4 animate-spin" />{tt("grb.loading", "Loading customer orders…")}</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 py-6 text-center text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">{tt("grb.load_failed", "Customer orders could not be loaded.")}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900" data-testid="grb-empty">
          {tab === "received" && receivedCount === 0 ? tt("grb.no_received_hint", "No order has been received at the Clearing Agent desk yet. Transfer an order from Order Transfer, or switch to All orders.") : tt("grb.empty", "No customer orders found.")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                <th className="px-3 py-2 text-start">{tt("grb.col_order", "Order")}</th>
                <th className="px-3 py-2 text-start">{tt("obill.customer", "Customer")}</th>
                <th className="px-3 py-2 text-start">{tt("grb.col_route_truck", "Route / Truck")}</th>
                <th className="px-3 py-2 text-start">{tt("grb.col_received", "Received")}</th>
                {ORDER_BILL_TYPES.map((b) => <th key={b.key} className="px-3 py-2 text-start">{orderBillTypeLabel(lang, b.key)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((o) => {
                const link = { orderId: o.id, orderNo: o.order_no, customerId: o.customer_id, truckNo: o.truck_number, driver: o.truck_driver_name };
                return (
                  <tr key={o.id} data-testid="grb-row" data-order-no={o.order_no} className={cn("align-top", o.id === focusId && "bg-cyan-50/70 dark:bg-cyan-950/20")}>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/clearing-agent/order-transfer?orderId=${encodeURIComponent(o.id)}` as never} className="font-mono font-black text-blue-700 hover:underline dark:text-blue-300" dir="ltr">{o.order_no}</Link>
                      {o.created_at && <div className="text-[10px] text-slate-400" dir="ltr">{String(o.created_at).slice(0, 10)}</div>}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{o.customer_name || "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div>{[o.loading_country_name, o.receiving_country_name].filter(Boolean).join(" → ") || "—"}</div>
                      {(o.truck_number || o.truck_driver_name) && <div className="text-slate-400" dir="ltr">{[o.truck_number, o.truck_driver_name].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-3 py-2 text-[11px]" data-testid="grb-received">
                      {o.general_received ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-1.5 py-0.5 font-bold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300"><Inbox className="h-3 w-3" />{tt("grb.col_received", "Received")}</span>
                          {o.expense_transfer?.date && <div className="font-mono text-slate-500" dir="ltr">{o.expense_transfer.date}</div>}
                          {o.expense_transfer?.user && <div className="text-slate-600 dark:text-slate-300">{tt("grb.received_by", "Handler: {name}").replace("{name}", o.expense_transfer.user)}</div>}
                          {o.expense_transfer?.memo && <div className="max-w-[200px] truncate text-slate-400" title={o.expense_transfer.memo}>{o.expense_transfer.memo}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400">{tt("grb.not_received", "Not received yet")}</span>
                      )}
                    </td>
                    {ORDER_BILL_TYPES.map((b) => (
                      <td key={b.key} className="px-3 py-2" data-testid={`grb-${b.key}`}>
                        <OrderBillStatusCell
                          lang={lang}
                          type={b.key}
                          orderBills={status.bills[o.order_no]?.[b.key]}
                          denied={status.denied.includes(b.key)}
                          loading={status.loading}
                          link={link}
                          compact
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
