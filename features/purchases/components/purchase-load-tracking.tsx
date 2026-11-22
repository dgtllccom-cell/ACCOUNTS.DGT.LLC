"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck, Truck } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";
import { cn } from "@/lib/utils";

/**
 * Shows the original authorized lane records inside Tracking without duplicating them as Shipping orders.
 * `embedded` renders it inside another panel (the tracking hero) without its own outer card.
 */
export function PurchaseLoadTracking({ laneId, lang, embedded = false }: { laneId?: string; lang?: string; embedded?: boolean }) {
  const s = useErpScreen("plane", lang);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ lang: s.lang });
    if (laneId) params.set("id", laneId);
    apiGet<{ rows: Record<string, any>[] }>(`/api/erp/purchases/lane/tracking?${params}`)
      .then((data) => { if (active) setRows(data.rows || []); })
      .catch((e) => { if (active) { setRows([]); setError(e.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [laneId, s.lang]);

  return (
    <section
      dir={s.dir}
      data-testid="purchase-load-tracking"
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border",
        embedded
          ? "border-amber-200/70 bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_26px_-18px_rgba(120,53,15,0.45)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
          : "mb-5 border-border bg-card shadow-sm"
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/70 bg-gradient-to-r from-amber-50 via-amber-50/70 to-white px-4 py-3 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_18px_-8px_rgba(234,88,12,0.75)]">
            <Truck className="h-4 w-4" />
          </span>
          <h2 className="truncate text-sm font-black text-foreground sm:text-base">
            {s.tGlobal("purchase.lgr_label_loading", "Loading")} · {s.tGlobal("log.seg_tracking", "Tracking")}
          </h2>
        </div>
        {!loading && !error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-amber-800 dark:text-amber-300" dir="ltr">
            <PackageCheck className="h-3.5 w-3.5" />
            {rows.length}
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="p-4 text-sm text-rose-600" role="alert">{error}</p>
      ) : loading ? (
        <p className="p-4 text-sm text-muted-foreground">{s.tGlobal("common.loading", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:text-amber-300">
            <PackageCheck className="h-6 w-6" />
          </span>
          <p className="max-w-xl text-sm text-muted-foreground">
            {s.t("empty", "No loads in the register for your scope. A load enters the register when its loading is saved.")}
          </p>
        </div>
      ) : (
        <div className={cn("hidden overflow-x-auto md:block", embedded && "max-h-80 overflow-y-auto overscroll-contain")}>
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className={cn(embedded && "sticky top-0 z-10 bg-background")}>
              <tr className="border-b border-border/60 bg-muted/40">
                {[
                  s.t("col_bill_no", "Bill No. / Ref"),
                  s.tGlobal("rdue.col_loading_no", "Loading No."),
                  s.tGlobal("purchase.loading_date_label", "Loading Date"),
                  s.t("col_container", "Container"),
                  s.t("col_bl", "BL no."),
                  s.t("col_qty", "Loaded Qty"),
                  s.t("col_status", "Transfer Status"),
                  s.tGlobal("common.actions", "Actions"),
                ].map((label, i) => (
                  <Th key={i} className="px-3 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-amber-50/60 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-3 font-mono text-xs font-semibold">{r.purchase_ref_no}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {r.loading_batch_no && <div className="text-muted-foreground">{r.loading_batch_no}</div>}
                    {r.loading_record_no || "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs tabular-nums">{String(r.loaded_at || r.created_at || "").slice(0, 10)}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.container_number || "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.bl_number || "—"}</td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{Number(r.loaded_quantity || 0).toLocaleString()} {r.unit}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full border border-amber-300/70 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      {s.t(`st_${r.lane_status}`, r.lane_status)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-300"
                      href={`/dashboard/purchase/purchase-transit-lane?focus=${encodeURIComponent(r.id)}`}
                    >
                      {s.t("act_details", "Details")}
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && rows.length > 0 ? (
        <ul className="max-h-96 divide-y divide-border/40 overflow-y-auto md:hidden" aria-label={s.tGlobal("log.seg_tracking", "Tracking")}>
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-semibold">{r.purchase_ref_no}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {r.loading_batch_no ? `${r.loading_batch_no} · ` : ""}
                    {r.loading_record_no || "—"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-amber-300/70 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  {s.t(`st_${r.lane_status}`, r.lane_status)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.tGlobal("purchase.loading_date_label", "Loading Date")}</dt>
                  <dd className="font-mono tabular-nums">{String(r.loaded_at || r.created_at || "").slice(0, 10)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("col_qty", "Loaded Qty")}</dt>
                  <dd className="font-semibold tabular-nums">{Number(r.loaded_quantity || 0).toLocaleString()} {r.unit}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("col_container", "Container")}</dt>
                  <dd className="truncate font-mono">{r.container_number || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("col_bl", "BL no.")}</dt>
                  <dd className="truncate font-mono">{r.bl_number || "—"}</dd>
                </div>
              </dl>
              <Link
                className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-300"
                href={`/dashboard/purchase/purchase-transit-lane?focus=${encodeURIComponent(r.id)}`}
              >
                {s.t("act_details", "Details")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
