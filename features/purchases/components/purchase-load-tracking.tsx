"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { Th } from "@/components/ui/translated-th";

/** Shows the original authorized lane records inside Tracking without duplicating them as Shipping orders. */
export function PurchaseLoadTracking({ laneId, lang }: { laneId?: string; lang?: string }) {
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
  return <section dir={s.dir} className="mb-5 overflow-hidden rounded-xl border bg-white dark:bg-slate-900" data-testid="purchase-load-tracking">
    <h2 className="border-b px-4 py-3 text-base font-bold">{s.tGlobal("purchase.lgr_label_loading", "Loading")} · {s.tGlobal("log.seg_tracking", "Tracking")}</h2>
    {error ? <p className="p-4 text-sm text-rose-600" role="alert">{error}</p> : loading ? <p className="p-4 text-sm">{s.tGlobal("common.loading", "Loading…")}</p> : rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{s.t("empty", "No loads in the register for your scope. A load enters the register when its loading is saved.")}</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-start text-sm"><thead><tr className="border-b bg-amber-50 dark:bg-slate-800">
        {[s.t("col_bill_no", "Bill No. / Ref"),s.tGlobal("rdue.col_loading_no", "Loading No."),s.tGlobal("purchase.loading_date_label", "Loading Date"),s.t("col_container", "Container"),s.t("col_bl", "BL no."),s.t("col_qty", "Loaded Qty"),s.t("col_status", "Transfer Status"),s.tGlobal("common.actions", "Actions")].map((label,i) => <Th key={i} className="px-3 py-2 text-start">{label}</Th>)}
      </tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-b"><td className="px-3 py-3 font-mono">{r.purchase_ref_no}</td><td className="px-3 py-3 font-mono">{r.loading_record_no || "—"}</td><td className="px-3 py-3">{String(r.loaded_at || r.created_at || "").slice(0,10)}</td><td className="px-3 py-3 font-mono">{r.container_number || "—"}</td><td className="px-3 py-3 font-mono">{r.bl_number || "—"}</td><td className="px-3 py-3">{Number(r.loaded_quantity || 0).toLocaleString()} {r.unit}</td><td className="px-3 py-3">{s.t(`st_${r.lane_status}`,r.lane_status)}</td><td className="px-3 py-3"><Link className="text-blue-700 underline dark:text-blue-300" href={`/dashboard/purchase/purchase-transit-lane?focus=${encodeURIComponent(r.id)}`}>{s.t("act_details", "Details")}</Link></td></tr>)}</tbody></table></div>}
  </section>;
}
