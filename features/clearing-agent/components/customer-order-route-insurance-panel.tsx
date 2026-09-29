/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Live Customer Order Report → "Route, border & insurance" section.
 *  • live route check of the legs being edited (land borders, crossings, gaps, ports)
 *  • per saved leg: countries, mode, border / port, customs, responsible branch / partner,
 *    handover, status, insurance cover and the external partner's bill (billed / paid / remaining)
 *  • insurance policies covering leg ranges, with the policy file on the existing documents system
 *    and the coverage gaps
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck, ShieldAlert, XCircle } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { DocumentAttachmentIcon } from "@/components/documents/document-attachment-icon";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 dark:border-slate-700 dark:bg-slate-800";
const AMT = (v: any) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const EMPTY = { insurerName: "", policyNo: "", coveredCargo: "", insuredValue: "", currency: "USD", coverageFrom: "", coverageTo: "", territory: "", fromLegNo: "1", toLegNo: "1", premiumAmount: "", premiumCurrency: "" };

export function CustomerOrderRouteInsurancePanel({ orderId, legs, lang }: { orderId: string | null; legs: Row[]; lang?: string }) {
  const s = useErpScreen("corin", lang);
  const [issues, setIssues] = useState<Row[] | null>(null);
  const [report, setReport] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState<Row>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const legKey = JSON.stringify((legs ?? []).map((l) => [l.legNo, l.fromCountryId, l.toCountryId, l.transportMode, l.customsPointText, l.portOfLoading, l.portOfDischarge, l.fromLocationText, l.toLocationText, l.flightNumber, l.airwayBillNo, l.status]));
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!legs?.length) { setIssues([]); return; }
    timer.current = setTimeout(() => {
      apiPost<{ issues: Row[] }>("/api/erp/clearing-agent/customer-order/validate-route", { legs })
        .then((r) => setIssues(r.issues ?? []))
        .catch(() => setIssues(null));
    }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey]);

  const load = useCallback(async () => {
    if (!orderId) { setReport(null); return; }
    setLoading(true); setError(null);
    try { setReport(await apiGet<Row>(`/api/erp/clearing-agent/customer-order/${orderId}/route-report`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  const modeLabel = (m: string | null) => (m ? s.t(`mode_${m}`, m.replace(/^by_/, "")) : "—");
  const gapLabel = (g: string) => s.t(`gap_${g}`, g);
  const addPolicy = async () => {
    if (!orderId) return;
    setBusy(true); setError(null);
    try {
      await apiPost(`/api/erp/clearing-agent/customer-order/${orderId}/insurance`, {
        insurerName: f.insurerName, policyNo: f.policyNo, coveredCargo: f.coveredCargo, insuredValue: Number(f.insuredValue), currency: String(f.currency).toUpperCase(),
        coverageFrom: f.coverageFrom, coverageTo: f.coverageTo, territory: f.territory || null, fromLegNo: Number(f.fromLegNo), toLegNo: Number(f.toLegNo),
        premiumAmount: f.premiumAmount === "" ? null : Number(f.premiumAmount), premiumCurrency: f.premiumCurrency || null,
      });
      setShowAdd(false); setF({ ...EMPTY });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const cancelPolicy = async (p: Row) => {
    if (!orderId || !window.confirm(s.t("confirm_cancel", "Cancel this policy on the order? Its legs will show as uncovered."))) return;
    setBusy(true);
    try { await apiPatch(`/api/erp/clearing-agent/customer-order/${orderId}/insurance/${p.id}`, { status: "cancelled" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const errs = (issues ?? []).filter((i) => i.level === "error");
  const warns = (issues ?? []).filter((i) => i.level === "warning");
  const legNos = (report?.legs ?? []).map((l: Row) => l.legNo);

  return (
    <section dir={s.dir} data-testid="corin-panel" className="space-y-3 rounded-xl border border-sky-200/80 bg-white p-3.5 text-xs shadow-2xs dark:border-sky-900/60 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{s.t("title", "Route, border & insurance")}</span>
        {orderId && <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-semibold dark:border-slate-700"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />{s.t("refresh", "Refresh")}</button>}
      </div>

      {/* Route check (live, before save) */}
      <div data-testid="corin-route-check" data-errors={errs.length}>
        {issues === null ? null : issues.length === 0 ? (
          <p className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{legs?.length ? s.t("route_ok", "Route is continuous and every road leg crosses a real land border.") : s.t("no_legs", "No route legs yet.")}</p>
        ) : (
          <ul className="space-y-1">
            {[...errs, ...warns].map((i, n) => (
              <li key={n} data-testid="corin-issue" data-code={i.code} data-level={i.level} className={`flex gap-1.5 ${i.level === "error" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
                {i.level === "error" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{s.t(`issue_${i.code}`, i.message).replace("{leg}", String(i.legNo)).replace("{from}", i.from ?? "").replace("{to}", i.to ?? "")}{i.suggestion?.length ? <b className="ms-1" dir="ltr">({i.suggestion.join(" → ")})</b> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!orderId ? (
        <p className="text-[11px] text-slate-500">{s.t("save_first", "Save the order to see handovers, insurance cover and partner bills per leg.")}</p>
      ) : !report ? (
        loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-sky-600" /> : error ? <p className="text-rose-600">{error}</p> : null
      ) : (
        <>
          <p className="font-semibold text-slate-700 dark:text-slate-200" data-testid="corin-route-line" dir="ltr">{(report.legs as Row[]).map((l) => `${l.from ?? "?"} → ${l.to ?? "?"}`).join("  ·  ") || "—"}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-[11px]" data-testid="corin-legs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>{["#", s.t("from_to", "From → To"), s.t("mode", "Mode"), s.t("border_port", "Border / port"), s.t("customs", "Customs"), s.t("responsible", "Responsible"), s.t("handover", "Handover"), s.t("status", "Status"), s.t("insurance", "Insurance"), s.t("partner_bill", "Partner bill (billed / paid / remaining)")].map((h, i) => <Th key={i} className={`px-2 py-1.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
              </thead>
              <tbody>
                {(report.legs as Row[]).map((l) => (
                  <tr key={l.id} data-testid="corin-leg" data-leg={l.legNo} data-gaps={(l.insurance?.gaps ?? []).join(",")} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="px-2 py-1.5 font-bold tabular-nums">{l.legNo}</td>
                    <td className="px-2 py-1.5">{l.from} → {l.to}{(l.fromLocation || l.toLocation) ? <div className="text-[10px] text-slate-400">{[l.fromLocation, l.toLocation].filter(Boolean).join(" → ")}</div> : null}</td>
                    <td className="px-2 py-1.5">{modeLabel(l.mode)}</td>
                    <td className="px-2 py-1.5">{l.borderOrPort ?? <span className="text-amber-600">{s.t("not_set", "not set")}</span>}</td>
                    <td className="px-2 py-1.5">{l.customs?.status ? s.t(`cs_${l.customs.status}`, l.customs.status) : "—"}{l.customs?.agent ? <div className="text-[10px] text-slate-400">{l.customs.agent}</div> : null}{l.customs?.declaration ? <div className="text-[10px] font-mono text-slate-400">{l.customs.declaration}</div> : null}</td>
                    <td className="px-2 py-1.5">{l.responsible?.kind === "partner" ? <><span className="rounded bg-violet-50 px-1 text-[10px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{s.t("partner", "Partner")}</span> {l.responsible.name}{l.responsible.account ? <div className="font-mono text-[10px] text-slate-400">{l.responsible.account}</div> : null}</> : (l.responsible?.name ?? "—")}</td>
                    <td className="px-2 py-1.5">{l.handover ? s.t(`ho_${l.handover.status}`, l.handover.status) : "—"}</td>
                    <td className="px-2 py-1.5">{l.status ? s.t(`ls_${l.status}`, l.status) : "—"}</td>
                    <td className="px-2 py-1.5">
                      {l.insurance?.policies?.length ? l.insurance.policies.map((p: Row) => <div key={p.id} className="font-mono">{p.policyNo}</div>) : null}
                      {(l.insurance?.gaps ?? []).map((g: string) => <div key={g} className={g === "document_missing" ? "text-amber-600" : "font-bold text-rose-600"}>{gapLabel(g)}</div>)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums" dir="ltr">{l.partnerBills?.length ? l.partnerBills.map((b: Row) => <div key={b.billNo}>{b.billNo}: {b.currency} {AMT(b.total)} / {AMT(b.paid)} / <b className={b.remaining > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>{AMT(b.remaining)}</b></div>) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(report.partnerTotals ?? []).length > 0 && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300" data-testid="corin-partner-totals">{s.t("partner_totals", "Partner bills on this order")}: {(report.partnerTotals as Row[]).map((t) => `${t.currency} ${AMT(t.total)} · ${s.t("paid", "paid")} ${AMT(t.paid)} · ${s.t("remaining", "remaining")} ${AMT(t.remaining)}`).join(" | ")}</p>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 font-bold ${report.insurance?.fullyCovered ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`} data-testid="corin-coverage" data-full={report.insurance?.fullyCovered ? "1" : "0"}>
                {report.insurance?.fullyCovered ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {report.insurance?.fullyCovered ? s.t("fully_covered", "Every leg is insured") : `${s.t("coverage_gaps", "Insurance gaps")}: ${(report.insurance?.gaps ?? []).filter((g: Row) => g.gap !== "document_missing").length}`}
              </span>
              <button type="button" data-testid="corin-add-open" onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white"><Plus className="h-3 w-3" />{s.t("add_policy", "Add insurance policy")}</button>
            </div>
            {showAdd && (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 md:grid-cols-4 dark:bg-slate-800/50" data-testid="corin-add-form">
                {[
                  ["insurerName", s.t("insurer", "Insurer")], ["policyNo", s.t("policy_no", "Policy / certificate no.")], ["coveredCargo", s.t("covered_cargo", "Covered cargo")], ["territory", s.t("territory", "Route / territory")],
                ].map(([k, l]) => <label key={k} className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{l}</span><input data-testid={`corin-f-${k}`} className={INP} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>)}
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("insured_value", "Insured value")}</span><input data-testid="corin-f-insuredValue" type="number" dir="ltr" className={INP} value={f.insuredValue} onChange={(e) => setF({ ...f, insuredValue: e.target.value })} /></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("currency", "Currency")}</span><input data-testid="corin-f-currency" maxLength={3} dir="ltr" className={INP} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("coverage_from", "Cover from")}</span><input data-testid="corin-f-coverageFrom" type="date" className={INP} value={f.coverageFrom} onChange={(e) => setF({ ...f, coverageFrom: e.target.value })} /></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("coverage_to", "Cover to")}</span><input data-testid="corin-f-coverageTo" type="date" className={INP} value={f.coverageTo} onChange={(e) => setF({ ...f, coverageTo: e.target.value })} /></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("from_leg", "From leg")}</span><select data-testid="corin-f-fromLegNo" className={INP} value={f.fromLegNo} onChange={(e) => setF({ ...f, fromLegNo: e.target.value })}>{legNos.map((n: number) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("to_leg", "To leg")}</span><select data-testid="corin-f-toLegNo" className={INP} value={f.toLegNo} onChange={(e) => setF({ ...f, toLegNo: e.target.value })}>{legNos.map((n: number) => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="space-y-0.5"><span className="text-[10px] font-bold text-slate-500">{s.t("premium", "Premium (optional)")}</span><input type="number" dir="ltr" className={INP} value={f.premiumAmount} onChange={(e) => setF({ ...f, premiumAmount: e.target.value })} /></label>
                <div className="flex items-end"><button type="button" data-testid="corin-f-save" disabled={busy || !f.insurerName || !f.policyNo || !f.coveredCargo || !f.insuredValue || !f.coverageFrom || !f.coverageTo} onClick={() => void addPolicy()} className="w-full rounded-lg bg-sky-600 px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : s.t("save", "Save")}</button></div>
              </div>
            )}
            {error && <p className="text-rose-600" data-testid="corin-error">{error}</p>}
            {(report.policies ?? []).length === 0 ? <p className="text-slate-400">{s.t("no_policies", "No insurance recorded for this order.")}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[11px]" data-testid="corin-policies">
                  <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{[s.t("insurer", "Insurer"), s.t("policy_no", "Policy / certificate no."), s.t("covered_cargo", "Covered cargo"), s.t("insured_value", "Insured value"), s.t("cover_period", "Cover period"), s.t("legs", "Legs"), s.t("territory", "Route / territory"), s.t("policy_file", "Policy file"), ""].map((h, i) => <Th key={i} className={`px-2 py-1.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr></thead>
                  <tbody>
                    {(report.policies as Row[]).map((p) => (
                      <tr key={p.id} data-testid="corin-policy" data-status={p.status} className={`border-t border-slate-100 dark:border-slate-800 ${p.status === "cancelled" ? "opacity-50 line-through" : ""}`}>
                        <td className="px-2 py-1.5">{p.insurer_name}</td>
                        <td className="px-2 py-1.5 font-mono">{p.policy_no}</td>
                        <td className="px-2 py-1.5">{p.covered_cargo}</td>
                        <td className="px-2 py-1.5 tabular-nums" dir="ltr">{p.currency} {AMT(p.insured_value)}</td>
                        <td className="px-2 py-1.5 tabular-nums" dir="ltr">{p.coverage_from} → {p.coverage_to}</td>
                        <td className="px-2 py-1.5 tabular-nums">{p.from_leg_no}–{p.to_leg_no}</td>
                        <td className="px-2 py-1.5">{p.territory ?? "—"}</td>
                        <td className="px-2 py-1.5"><DocumentAttachmentIcon entityType="clearing_order_insurance" entityId={p.id} /></td>
                        <td className="px-2 py-1.5">{p.status === "active" && <button type="button" onClick={() => void cancelPolicy(p)} className="rounded border border-rose-200 px-1.5 text-[10px] font-bold text-rose-700 dark:border-rose-900 dark:text-rose-300">{s.t("cancel", "Cancel")}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
