"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox, CheckCircle2, XCircle, RefreshCw, ChevronLeft, Ship, Package } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch } from "@/lib/api/client";

type Row = Record<string, any>;

const TONE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  accepted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800",
};

/**
 * Shipping / Clearing side "Handover Inbox". Shows ONLY the whitelisted
 * operational payload a Business handover shared with this agent — never the
 * purchase price, profit, business ledger, or another agent's data.
 */
export function ShippingHandoverInbox({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("submitted");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ as: "agent" });
      if (status) qs.set("status", status);
      const r = await apiGet<{ rows: Row[] }>(`/api/erp/handovers?${qs.toString()}`);
      setRows(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      const body: Row = { action };
      if (action === "reject") {
        const r = window.prompt(s.t("hi_reject_reason", "Reason for rejecting this handover:"));
        if (!r) { setBusy(false); return; }
        body.reason = r;
      }
      await apiPatch(`/api/erp/handovers/${id}`, body);
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const open = openId ? rows.find((r) => r.id === openId) : null;

  if (open) {
    const sp = open.shared_payload || {};
    return (
      <section dir={s.dir} className="mx-auto max-w-3xl p-4 sm:p-6">
        <button type="button" onClick={() => setOpenId(null)} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" />{s.t("hi_back", "Handover Inbox")}
        </button>
        {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-black text-slate-900 dark:text-slate-50">{open.handover_no}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[open.status] || TONE.draft}`}>{s.t(`hi_st_${open.status}`, open.status)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{s.t(`hi_action_${open.action_type}`, open.action_type)} · {open.clearing_agent_name || "—"}</p>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            {[
              ["hi_contract", "Contract Reference", open.contract_reference],
              ["hi_bl", "B/L Reference", open.bl_reference],
              ["hi_supplier", "Shipper / Supplier", sp.supplierName || sp.shipperName || sp.exporterName],
              ["hi_consignee", "Consignee / Importer", sp.consigneeName || sp.importerName],
              ["hi_pol", "Port of Loading", sp.portOfLoading || sp.loadingPort],
              ["hi_pod", "Port of Discharge", sp.portOfDischarge || sp.receivedPort],
              ["hi_vessel", "Vessel", sp.vesselName],
              ["hi_incoterm", "Delivery Terms", sp.deliveryTerms || sp.incoterms],
            ].filter(([, , v]) => v).map(([k, fb, v]) => (
              <div key={k as string}>
                <dt className="font-bold text-slate-500">{s.t(k as string, fb as string)}</dt>
                <dd className="text-slate-800 dark:text-slate-200">{String(v)}</dd>
              </div>
            ))}
          </dl>

          {(open.container_numbers ?? []).length ? (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.t("hi_containers", "Containers")}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {open.container_numbers.map((c: string) => (
                  <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{c}</span>
                ))}
              </div>
            </div>
          ) : null}

          {Array.isArray(sp.goods) && sp.goods.length ? (
            <div className="mt-3 overflow-x-auto">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.t("hi_goods", "Cargo")}</p>
              <table className="mt-1 w-full text-[11px]">
                <tbody>
                  {sp.goods.map((g: Row, i: number) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1">{g.description || g.goodsName}</td>
                      <td className="py-1 text-slate-500">{g.hsCode ? `HS ${g.hsCode}` : ""}</td>
                      <td className="py-1 text-right tabular-nums">{g.quantity} {g.unit || ""}</td>
                      <td className="py-1 text-right tabular-nums">{g.grossWeight ? `${g.grossWeight} kg` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {open.status === "accepted" && open.shipping_request_id ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {s.t("hi_request_opened", "A clearing customer order was opened from this handover — continue it in the Customer Order / BL workflow.")}
            </p>
          ) : null}

          <p className="mt-3 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-400 dark:bg-slate-800/60">
            {s.t("hi_privacy", "This is the approved operational information only. Business prices, profit and ledgers are never shared with the shipping side.")}
          </p>

          {open.status === "submitted" ? (
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void act(open.id, "approve")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5" />{s.t("hi_accept", "Accept Handover")}
              </button>
              <button type="button" disabled={busy} onClick={() => void act(open.id, "reject")} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900">
                <XCircle className="h-3.5 w-3.5" />{s.t("hi_reject", "Reject")}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="inline-flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-50"><Inbox className="h-5 w-5 text-slate-400" />{s.t("hi_title", "Shipping Handover Inbox")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{s.t("hi_blurb", "Handovers that a business team has authorized to your agency. Accept one to bring it into the shipment / BL workflow.")}</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
          </button>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="flex flex-wrap gap-1.5">
          {["submitted", "accepted", "rejected", ""].map((k) => (
            <button key={k || "all"} type="button" onClick={() => setStatus(k)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${status === k ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
              {s.t(`hi_st_${k || "all"}`, k || "All")}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-start [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-start [&>th]:font-bold [&>th]:text-slate-500">
                <th>{s.t("hi_c_no", "Handover")}</th>
                <th>{s.t("hi_c_action", "Action")}</th>
                <th>{s.t("hi_c_ref", "Contract / B/L")}</th>
                <th>{s.t("hi_c_containers", "Containers")}</th>
                <th>{s.t("hi_c_status", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("hi_empty", "No handovers in this view.")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                  <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.handover_no}</td>
                  <td className="px-3 py-2 text-slate-500">{s.t(`hi_action_${r.action_type}`, r.action_type)}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.contract_reference || r.bl_reference || "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{(r.container_numbers ?? []).length}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[r.status] || TONE.draft}`}>{s.t(`hi_st_${r.status}`, r.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
