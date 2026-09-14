"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, RefreshCw, Search, Send, Truck, Warehouse, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Stage = "warehouse_transfer" | "loading" | "export";

interface LocalPurchaseRecord {
  id: string;
  goods_name?: string;
  goodsName?: string;
  supplier_name?: string;
  supplierName?: string;
  final_cost?: number;
  finalCost?: number;
  local_currency?: string;
  localCurrency?: string;
  status?: string;
  shipping_mode?: string;
  shippingMode?: string;
  journal_serial_no?: string;
  warehouse_name?: string;
  warehouseName?: string;
  warehouse_plot_no?: string;
  transfer_date?: string;
  truck_no?: string;
  truckNo?: string;
  driver_name?: string;
  driverName?: string;
  warehouse_transfer_status?: string | null;
  loading_status?: string | null;
  export_status?: string | null;
}

const STAGE_CONFIG: Record<
  Stage,
  {
    shippingMode: string;
    statusField: "warehouse_transfer_status" | "loading_status" | "export_status";
    icon: React.ComponentType<{ className?: string }>;
    // Tailwind needs full, static class strings to detect at build time — never
    // interpolate a color name into a class (e.g. `bg-${accent}-50` is invisible
    // to the JIT scanner and silently renders unstyled).
    iconWrapClass: string;
  }
> = {
  warehouse_transfer: {
    shippingMode: "Transfer Layout",
    statusField: "warehouse_transfer_status",
    icon: Warehouse,
    iconWrapClass: "bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/40 dark:border-purple-900",
  },
  loading: {
    shippingMode: "Loading",
    statusField: "loading_status",
    icon: Truck,
    iconWrapClass: "bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-900",
  },
  export: {
    shippingMode: "Export",
    statusField: "export_status",
    icon: Flag,
    iconWrapClass: "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/40 dark:border-amber-900",
  },
};

export function LocalPurchaseDestinationQueueView({ stage, session }: { stage: Stage; session?: any }) {
  const s = useErpScreen("lpdest");
  const [purchases, setPurchases] = useState<LocalPurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/purchases/local-purchase");
      const payload = await res.json();
      if (payload.ok && payload.data?.purchases) {
        const raw = payload.data.purchases as LocalPurchaseRecord[];
        const filtered = raw.filter((p) => {
          if (p.status !== "posted") return false;
          const mode = p.shipping_mode || p.shippingMode || "";
          return mode === config.shippingMode;
        });
        setPurchases(filtered);
      }
    } catch (err) {
      console.error("Failed to load destination queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const filteredPurchases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) => {
      const goods = (p.goods_name || p.goodsName || "").toLowerCase();
      const supplier = (p.supplier_name || p.supplierName || "").toLowerCase();
      const serial = (p.journal_serial_no || "").toLowerCase();
      return goods.includes(q) || supplier.includes(q) || serial.includes(q);
    });
  }, [purchases, searchQuery]);

  const pendingCount = filteredPurchases.filter((p) => (p as any)[config.statusField] !== "completed").length;

  async function markComplete(purchaseId: string) {
    const confirmKey =
      stage === "warehouse_transfer" ? "confirm_warehouse" : stage === "loading" ? "confirm_loading" : "confirm_export";
    const confirmFallback =
      stage === "warehouse_transfer"
        ? "Confirm this bill's stock has been physically transferred to the warehouse?"
        : stage === "loading"
        ? "Confirm this bill has been loaded onto the truck?"
        : "Confirm this bill has been handed over to the Export/Shipping module?";
    if (!confirm(s.t(confirmKey, confirmFallback))) return;

    setActingId(purchaseId);
    try {
      const res = await fetch("/api/erp/purchases/local-purchase/destination-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, stage }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || "Action failed.");
      await load();
    } catch (err: any) {
      alert(err?.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  }

  const titleKey =
    stage === "warehouse_transfer" ? "title_warehouse_transfer" : stage === "loading" ? "title_loading" : "title_export";
  const titleFallback =
    stage === "warehouse_transfer" ? "Warehouse Transfer Queue" : stage === "loading" ? "Loading Queue" : "Export Handover Queue";
  const actionKey =
    stage === "warehouse_transfer" ? "action_mark_warehouse" : stage === "loading" ? "action_mark_loading" : "action_mark_export";
  const actionFallback =
    stage === "warehouse_transfer" ? "Mark Transfer Completed" : stage === "loading" ? "Mark Loaded" : "Confirm Export Handover";

  return (
    <div className="w-full px-3 sm:px-6 py-4 space-y-4" dir={s.dir}>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-xl p-2 ${config.iconWrapClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-slate-100">{s.t(titleKey, titleFallback)}</h1>
            <p className="text-[10.5px] font-medium text-slate-400">
              {s.t("subtitle", "Posted Local Purchase bills routed to this destination")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={s.t("search_placeholder", "Search goods, supplier, serial...")}
              className="h-8 w-full rounded-xl border border-slate-200 ps-8 pe-3 text-[11px] outline-none bg-slate-50 focus:bg-white focus:border-blue-500 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
            className="h-8 gap-1.5 rounded-xl border-slate-200 text-[11px] font-bold dark:border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            {s.t("refresh", "Refresh")}
          </Button>
        </div>
      </section>

      <Card className="rounded-2xl border-slate-200 shadow-xs dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 p-4 dark:border-slate-800">
          <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
            <Icon className="h-4 w-4" />
            {s.t(titleKey, titleFallback)}
            <span className="ms-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {pendingCount}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className={`p-2.5 ${s.textStart}`}>{s.t("col_bill", "Bill / Goods")}</th>
                <th className={`p-2.5 ${s.textStart}`}>{s.t("col_supplier", "Supplier")}</th>
                <th className={`p-2.5 ${s.textStart}`}>{s.t("col_details", "Details")}</th>
                <th className="p-2.5 text-end">{s.t("col_amount", "Amount")}</th>
                <th className="p-2.5 text-center">{s.t("col_status", "Status")}</th>
                <th className="p-2.5 text-center">{s.t("col_action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {s.t("loading", "Loading...")}
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {s.t("empty", "No bills currently in this queue.")}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((row) => {
                  const completed = (row as any)[config.statusField] === "completed";
                  const amount = Number(row.final_cost ?? row.finalCost ?? 0);
                  const currency = row.local_currency || row.localCurrency || "PKR";
                  return (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{row.goods_name || row.goodsName || "-"}</div>
                        <div className="font-mono text-[10px] text-slate-400">{row.journal_serial_no || "-"}</div>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.supplier_name || row.supplierName || "-"}</td>
                      <td className="p-2.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                        {stage === "warehouse_transfer" && (
                          <span>
                            {s.t("warehouse_label", "Warehouse:")} {row.warehouse_name || row.warehouseName || "-"}
                          </span>
                        )}
                        {stage === "loading" && (
                          <span>
                            {s.t("truck_label", "Truck:")} {row.truck_no || row.truckNo || "-"} · {row.driver_name || row.driverName || "-"}
                          </span>
                        )}
                        {stage === "export" && <span>{row.warehouse_plot_no || "-"}</span>}
                      </td>
                      <td className="p-2.5 text-end font-mono font-black text-emerald-600">
                        {currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-center">
                        {completed ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {s.t("status_completed", "Completed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Clock className="h-2.5 w-2.5" /> {s.t("status_pending", "Pending")}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {!completed && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={actingId === row.id}
                            onClick={() => void markComplete(row.id)}
                            className="h-7 gap-1 rounded-lg bg-slate-800 px-2.5 text-[10px] font-bold text-white hover:bg-slate-900"
                          >
                            <Send className="h-3 w-3" />
                            {s.t(actionKey, actionFallback)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
