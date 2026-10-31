"use client";

/**
 * The four Clearing Agent expense bill pages (Customs / Truck / Customer / Other) — ONE component: the bill register, and the
 * existing ExpensesBillEntryForm for a new / opened bill.
 *
 * Opened from Order Transfer or the General Received Bills desk (?orderId=…[&billId=…]) it goes straight to the entry form on that
 * customer order: the order is read through the scope-checked order API (URL values are never trusted for the link), a banner
 * shows the order, and the bill is attached to it (reference = the order number). With billId the order's bill opens.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Calendar, Inbox, Link2, Loader2, MapPin, Truck, User, UserCheck } from "lucide-react";
import { ExpensesBillRegisterView } from "@/features/clearing-agent/components/expenses-bill-register-view";
import { ExpensesBillEntryForm } from "@/features/roznamcha/components/expenses-bill-entry-form";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { GENERAL_RECEIVED_BILLS_HREF, orderBillTypeLabel, type OrderBillType } from "./order-bill-status";

type OrderSummary = {
  id: string;
  order_no: string;
  customer_name?: string | null;
  route_name?: string | null;
  loading_country_name?: string | null;
  receiving_country_name?: string | null;
  goods_name?: string | null;
  truck_number?: string | null;
  truck_driver_name?: string | null;
};

type Props = {
  type: OrderBillType;
  /** the bill category (expenses_bills.bill_title) this page enters and lists */
  billCategory: string;
  backKey: string;
  backFallback: string;
};

export function ExpenseBillPage(props: Props) {
  // useSearchParams needs a Suspense boundary in a client page
  return (
    <Suspense fallback={null}>
      <ExpenseBillPageInner {...props} />
    </Suspense>
  );
}

function ExpenseBillPageInner({ type, billCategory, backKey, backFallback }: Props) {
  const lang = useActiveLanguage();
  const tt = (k: string, fb: string) => t(lang, k as never, fb);
  const sp = useSearchParams();
  const orderId = sp.get("orderId");
  const billId = sp.get("billId");
  const [viewMode, setViewMode] = useState<"register" | "entry">(orderId ? "entry" : "register");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [orderState, setOrderState] = useState<"none" | "loading" | "ok" | "unavailable">(orderId ? "loading" : "none");

  useEffect(() => {
    if (!orderId) { setOrder(null); setOrderState("none"); return; }
    let active = true;
    setOrderState("loading");
    fetch(`/api/erp/clearing-agent/customer-order/${encodeURIComponent(orderId)}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => {
        if (!active) return;
        if (ok && j?.success && j.data?.order_no) {
          setOrder(j.data as OrderSummary);
          setOrderState("ok");
          setViewMode("entry");
        } else {
          setOrder(null);
          setOrderState("unavailable");
        }
      })
      .catch(() => { if (active) setOrderState("unavailable"); });
    return () => { active = false; };
  }, [orderId]);

  const orderContext = orderState === "ok" && order
    ? { orderId: order.id, orderNo: order.order_no, billId, date: sp.get("date") }
    : null;
  const assignedUser = sp.get("assignedUser");
  const transferDate = sp.get("date");
  const route = [order?.loading_country_name, order?.receiving_country_name].filter(Boolean).join(" → ") || order?.route_name || "";
  const truckNo = order?.truck_number || sp.get("truckNo");
  const driver = order?.truck_driver_name || sp.get("driver");

  return (
    <div className="space-y-4">
      {viewMode === "entry" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewMode("register")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              <span>{tt(backKey, backFallback)}</span>
            </button>
          </div>

          {orderState === "loading" && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />{tt("obill.loading_order", "Opening the customer order…")}
            </div>
          )}
          {orderState === "unavailable" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" data-testid="order-context-unavailable">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{tt("obill.order_unavailable", "The customer order could not be opened (not found or outside your scope). This bill is not linked to an order.")}</span>
            </div>
          )}
          {orderContext && order && (
            <div className="rounded-xl border-2 border-blue-300 bg-blue-50/70 px-3 py-2.5 text-xs dark:border-blue-800 dark:bg-blue-950/30" data-testid="order-context-banner">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-black text-blue-900 dark:text-blue-100">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <span>{tt("obill.linked_order", "Linked customer order")}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-blue-700 dark:bg-slate-900 dark:text-blue-300" dir="ltr" data-testid="order-context-no">{order.order_no}</span>
                  <span className="font-semibold text-blue-700/80 dark:text-blue-300/80">· {orderBillTypeLabel(lang, type)}</span>
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  <Link href={`/dashboard/clearing-agent/order-transfer?orderId=${encodeURIComponent(order.id)}` as never} className="text-blue-700 hover:underline dark:text-blue-300">
                    {tt("obill.back_to_transfer", "Order Transfer")}
                  </Link>
                  <Link href={`${GENERAL_RECEIVED_BILLS_HREF}?orderId=${encodeURIComponent(order.id)}` as never} className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300">
                    <Inbox className="h-3.5 w-3.5" />{tt("obill.general_received", "General Received Bills")}
                  </Link>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                {order.customer_name && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-slate-400" />{tt("obill.customer", "Customer")}: <b>{order.customer_name}</b></span>}
                {route && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{route}</span>}
                {(truckNo || driver) && <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-slate-400" /><span dir="ltr">{[truckNo, driver].filter(Boolean).join(" · ")}</span></span>}
                {assignedUser && <span className="inline-flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-slate-400" />{tt("obill.assigned_to", "Assigned to")}: <b>{assignedUser}</b></span>}
                {transferDate && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" />{tt("obill.transfer_date", "Transfer date")}: <span dir="ltr">{transferDate}</span></span>}
              </div>
              <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-200/80">
                {billId
                  ? tt("obill.opening_bill", "Opening this order's bill.")
                  : tt("obill.attached_hint", "The bill is attached to this order: its reference is the order number. Lock the header, add the expense lines and save as usual.")}
              </p>
            </div>
          )}

          {orderState !== "loading" && (
            <ExpensesBillEntryForm lang={lang} initialBillCategory={billCategory} customerOrderContext={orderContext} />
          )}
        </div>
      ) : (
        <ExpensesBillRegisterView category={type} onOpenEntryForm={() => setViewMode("entry")} />
      )}
    </div>
  );
}
