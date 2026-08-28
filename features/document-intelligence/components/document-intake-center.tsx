"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, UploadCloud, RefreshCw, FileText, ShieldAlert, CheckCircle2, X, ChevronLeft, Play, Ban, Link2, AlertTriangle, Package, Receipt,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;

const STATUS_TONE: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ocr: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  classifying: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  extracting: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  matching: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  review: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  qvc: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  draft_ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  linked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  error: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  rejected: "bg-slate-200 text-slate-600 dark:bg-slate-800",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};
const FIELD_TONE: Record<string, string> = {
  green: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
  amber: "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
  red: "border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/20",
};
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs dark:border-slate-700";

export function DocumentIntakeCenter({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (domainFilter) qs.set("domain", domainFilter);
      if (search) qs.set("search", search);
      const [q, k] = await Promise.all([
        apiGet<{ rows: Row[] }>(`/api/erp/document-intelligence?${qs.toString()}`),
        apiGet<{ kpis: Record<string, number> }>("/api/erp/document-intelligence?view=kpis"),
      ]);
      setRows(q.rows ?? []);
      setKpis(k.kpis ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, domainFilter, search]);

  useEffect(() => { void load(); }, [load]);

  if (openId) {
    return <ReviewPanel s={s} jobId={openId} onBack={() => { setOpenId(null); void load(); }} />;
  }

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("title", "AI Document Intake Center")}</h1>
            <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
              {s.t("blurb", "Upload a document → local OCR → classification → field extraction → scope-constrained matching → your review → QVC if required → a reviewed draft in the source module. The AI never posts to accounting or stock and never links a document without an authorized in-scope match.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
            <button type="button" onClick={() => setShowUpload(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <UploadCloud className="h-3.5 w-3.5" />{s.t("upload", "Upload Document")}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi label={s.t("k_total", "Total")} value={kpis.total ?? 0} />
          <Kpi label={s.t("k_review", "In Review")} value={kpis.in_review ?? 0} tone="text-amber-600" icon={FileText} />
          <Kpi label={s.t("k_qvc", "In QVC")} value={kpis.in_qvc ?? 0} tone="text-rose-600" icon={ShieldAlert} />
          <Kpi label={s.t("k_draft", "Draft Ready")} value={kpis.draft_ready ?? 0} tone="text-emerald-600" icon={CheckCircle2} />
          <Kpi label={s.t("k_linked", "Linked")} value={kpis.linked ?? 0} tone="text-emerald-600" icon={Link2} />
          <Kpi label={s.t("k_oos", "Out of Scope")} value={kpis.out_of_scope ?? 0} tone="text-rose-600" icon={AlertTriangle} />
          <Kpi label={s.t("k_failed", "Failed")} value={kpis.failed ?? 0} tone="text-rose-600" icon={Ban} />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search", "Search job no, filename, contract, BL…")} className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none" />
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <option value="">{s.t("all_domains", "All Domains")}</option>
            <option value="business">{s.t("domain_business", "Business ERP")}</option>
            <option value="shipping">{s.t("domain_shipping", "Shipping / Clearing")}</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <option value="">{s.t("all_status", "All Statuses")}</option>
            {["uploaded", "review", "qvc", "draft_ready", "linked", "error", "cancelled"].map((k) => (
              <option key={k} value={k}>{s.t(`st_${k}`, k)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("c_job", "Job No")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_domain", "Domain")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_file", "Document")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_type", "Type")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_scope", "Country / Branch / Agent")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_match", "Match")}</Th>
                <Th className="px-3 py-2.5">{s.t("c_status", "Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("empty", "No documents in the intake queue.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.job_no}</td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`domain_${r.operational_domain}`, r.operational_domain)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.original_filename}<div className="text-[10px] text-slate-400">{(r.file_size / 1024).toFixed(0)} KB · {r.page_count || "?"} pg</div></td>
                    <td className="px-3 py-2 text-slate-500">{r.doc_type_code ? `${s.t(`dt_${r.doc_type_code}`, r.doc_type_code)} (${Math.round((r.doc_type_confidence || 0) * 100)}%)` : "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{[r.country_name, r.city_branch_name || r.country_branch_name, r.clearing_agent_name].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold ${r.match_status === "out_of_scope" ? "text-rose-600" : r.match_status === "auto" ? "text-emerald-600" : "text-slate-500"}`}>
                        {s.t(`ms_${r.match_status}`, r.match_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.uploaded}`}>{s.t(`st_${r.status}`, r.status)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload ? <UploadDrawer s={s} onClose={() => setShowUpload(false)} onDone={(id) => { setShowUpload(false); void load(); setOpenId(id); }} /> : null}
    </section>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: string; icon?: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-slate-400"}`} /> : null}
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-50">{value}</div>
    </div>
  );
}

function UploadDrawer({ s, onClose, onDone }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onDone: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [domain, setDomain] = useState<"business" | "shipping">("business");
  const [contractRef, setContractRef] = useState("");
  const [blRef, setBlRef] = useState("");
  const [containerRef, setContainerRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoProcess, setAutoProcess] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) { setErr(s.t("pick_file", "Choose a document first.")); return; }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("operationalDomain", domain);
      if (contractRef) fd.append("contractReference", contractRef);
      if (blRef) fd.append("blReference", blRef);
      if (containerRef) fd.append("containerReference", containerRef);
      fd.append("idempotencyKey", `${file.name}:${file.size}:${file.lastModified}:${domain}`);
      const res = await fetch("/api/erp/document-intelligence/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error?.message || json?.error || `Upload failed (${res.status})`);
      const jobId = json.data?.job?.id ?? json.job?.id;
      if (autoProcess && jobId) {
        await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "process" });
      }
      onDone(jobId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("upload", "Upload Document")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 hover:border-emerald-400 dark:border-slate-700"
          >
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            {file ? <span className="font-bold text-slate-700 dark:text-slate-200">{file.name}</span> : s.t("drop", "Click to choose a PDF / JPG / PNG (max 25 MB, 60 pages)")}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <L label={s.t("domain", "Operational Domain")}>
            <select value={domain} onChange={(e) => setDomain(e.target.value as never)} className={INP}>
              <option value="business">{s.t("domain_business", "Business ERP")}</option>
              <option value="shipping">{s.t("domain_shipping", "Shipping / Clearing")}</option>
            </select>
          </L>
          <L label={s.t("contract_ref", "Contract Reference (optional hint)")}><input value={contractRef} onChange={(e) => setContractRef(e.target.value)} className={INP} /></L>
          {domain === "shipping" ? (
            <>
              <L label={s.t("bl_ref", "B/L Reference (optional)")}><input value={blRef} onChange={(e) => setBlRef(e.target.value)} className={INP} /></L>
              <L label={s.t("container_ref", "Container(s) (optional)")}><input value={containerRef} onChange={(e) => setContainerRef(e.target.value)} className={INP} /></L>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={autoProcess} onChange={(e) => setAutoProcess(e.target.checked)} />
            {s.t("auto_process", "Run OCR + extraction now")}
          </label>
          <p className="text-[10px] text-slate-400">{s.t("privacy_note", "The file is stored on this server only. It is never sent to any external service and never gets a public URL.")}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("upload_btn", "Upload & Process")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel({ s, jobId, onBack }: { s: ReturnType<typeof useErpScreen>; jobId: string; onBack: () => void }) {
  const [data, setData] = useState<{ job: Row; fields: Row[]; lineItems: Row[]; matches: Row[]; events: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ job: Row; fields: Row[]; lineItems: Row[]; matches: Row[]; events: Row[] }>(`/api/erp/document-intelligence/${jobId}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, reason?: string) => {
    setBusy(true);
    setError(null);
    try { await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action, reason }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const saveField = async (fieldKey: string, correctedValue: string, verified: boolean) => {
    try { await apiPatch(`/api/erp/document-intelligence/${jobId}/fields`, { fieldKey, correctedValue, verified }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const pickMatch = async (matchId: string) => {
    try { await apiPost(`/api/erp/document-intelligence/${jobId}/match`, { matchId }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const prepareDraft = async (linkMode?: "new_record" | "append_existing") => {
    setBusy(true);
    setError(null);
    try { await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const [batchInfo, setBatchInfo] = useState<Row | null>(null);
  const proposeBatch = async () => {
    setBusy(true);
    setError(null);
    setBatchInfo(null);
    try {
      const r = await apiPost<Row>("/api/erp/purchases/loading-batches", { jobId });
      setBatchInfo(r);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const [rozPreview, setRozPreview] = useState<Row | null>(null);
  const loadRozPreview = async () => {
    setBusy(true);
    setError(null);
    try { setRozPreview(await apiGet<Row>(`/api/erp/document-intelligence/${jobId}/roznamcha-preview`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const job = data?.job;
  const isImage = (job?.mime_type || "").startsWith("image/");

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <ChevronLeft className="h-3.5 w-3.5" />{s.t("back", "Intake Queue")}
        </button>

        {loading || !job ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className={s.textStart}>
                <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{job.job_no}
                  <span className="ms-2 text-sm font-normal text-slate-400">{job.original_filename}</span>
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[job.status] || STATUS_TONE.uploaded}`}>{s.t(`st_${job.status}`, job.status)}</span>
                  <span className="text-slate-500">{s.t(`domain_${job.operational_domain}`, job.operational_domain)}</span>
                  {job.doc_type_code ? <span className="text-slate-500">· {s.t(`dt_${job.doc_type_code}`, job.doc_type_code)} ({Math.round((job.doc_type_confidence || 0) * 100)}%)</span> : null}
                  {job.ocr_engine ? <span className="text-[10px] text-slate-400">· {job.ocr_engine} {job.ocr_ms ? `${job.ocr_ms}ms` : ""}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["uploaded", "error"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void act("process")} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Play className="h-3.5 w-3.5" />{s.t("process", "Run OCR + Extract")}</button>
                ) : null}
                {["review", "qvc"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void act("process")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><RefreshCw className="h-3.5 w-3.5" />{s.t("reprocess", "Re-run")}</button>
                ) : null}
                {job.status === "review" && job.target_module ? (
                  <button type="button" disabled={busy} onClick={() => void prepareDraft()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />{s.t("prepare_draft", "Prepare Reviewed Draft")}</button>
                ) : null}
                {["auto", "user"].includes(job.match_status) && job.matched_source_module === "purchase_orders" && !["linked", "cancelled"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void proposeBatch()} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"><Package className="h-3.5 w-3.5" />{s.t("propose_batch", "Propose Loading Batch")}</button>
                ) : null}
                {job.target_module === "roznamcha_entries" && !["linked", "cancelled"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void loadRozPreview()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><Receipt className="h-3.5 w-3.5" />{s.t("roz_preview", "Cash / Bank Pre-Post Preview")}</button>
                ) : null}
                {job.status === "review" ? (
                  <button type="button" disabled={busy} onClick={() => { const r = window.prompt(s.t("qvc_reason", "QVC reason:")); if (r) void act("qvc", r); }} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900"><ShieldAlert className="h-3.5 w-3.5" />{s.t("send_qvc", "Send to QVC")}</button>
                ) : null}
                {!["linked", "cancelled"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(s.t("cancel_confirm", "Cancel this job?"))) void act("cancel"); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700"><Ban className="h-3.5 w-3.5" /></button>
                ) : null}
              </div>
            </header>

            {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
            {job.qvc_reason ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />{job.qvc_reason}</p> : null}
            {rozPreview?.preview ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("roz_preview_title", "Before Posting — Cash / Bank Roznamcha")}</p>
                {rozPreview.checks?.duplicateOf ? (
                  <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{s.t("roz_dup", "A matching Roznamcha entry already exists")}: {rozPreview.checks.duplicateOf.voucherNo || rozPreview.checks.duplicateOf.entrySerial}
                  </p>
                ) : null}
                {!rozPreview.checks?.balanced ? (
                  <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{rozPreview.checks?.balancedMessage || s.t("roz_unbalanced", "Debit and Credit are not balanced yet.")}</p>
                ) : null}
                <table className="w-full">
                  <tbody className="[&>tr>td]:py-1 [&>tr>td:first-child]:pe-3 [&>tr>td:first-child]:font-bold [&>tr>td:first-child]:text-slate-500">
                    {[
                      ["roz_f_method", "Payment Method", s.t(`pm_${rozPreview.preview.paymentMethod}`, rozPreview.preview.paymentMethod)],
                      ["roz_f_cheque_status", "Cheque Status", rozPreview.preview.chequeStatus ? s.t(`cs_${rozPreview.preview.chequeStatus}`, rozPreview.preview.chequeStatus) : "—"],
                      ["roz_f_sa_serial", "Super Admin Serial", rozPreview.preview.superAdminSerialScheme],
                      ["roz_f_country_serial", "Country Serial", rozPreview.preview.countrySerialScheme],
                      ["roz_f_branch_serial", "Branch Serial", rozPreview.preview.branchSerialScheme],
                      ["roz_f_entry_serial", "Entry Serial", rozPreview.preview.entrySerialScheme],
                      ["roz_f_bill", "Bill Number", rozPreview.preview.billNumber || "—"],
                      ["roz_f_manual_bill", "Manual Bill Number", rozPreview.preview.manualBillNumber || "—"],
                      ["roz_f_debit", "Debit Account", rozPreview.preview.debitAccount],
                      ["roz_f_credit", "Credit Account", rozPreview.preview.creditAccount],
                      ["roz_f_currency", "Original Currency", rozPreview.preview.originalCurrency || "—"],
                      ["roz_f_rate", "Exchange Rate", String(rozPreview.preview.exchangeRate ?? "—")],
                      ["roz_f_final", "Final Amount", rozPreview.preview.finalAmount != null ? String(rozPreview.preview.finalAmount) : "—"],
                      ["roz_f_base", "Base Amount", rozPreview.preview.baseAmount != null ? String(rozPreview.preview.baseAmount) : "—"],
                      ["roz_f_source_module", "Source Module", rozPreview.preview.sourceModule || "—"],
                      ["roz_f_source_ref", "Contract / Purchase / Sales Reference", rozPreview.preview.sourceReference || "—"],
                      ["roz_f_date", "Entry Date", rozPreview.preview.entryDate || "—"],
                    ].map(([k, fb, v]) => (
                      <tr key={k as string}><td>{s.t(k as string, fb as string)}</td><td className="tabular-nums text-slate-700 dark:text-slate-200">{v as string}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] text-slate-400">{s.t("roz_note", "Serial numbers are allocated only when you post from the Cash / Bank Roznamcha screen. The AI does not post.")}</p>
              </div>
            ) : null}
            {batchInfo?.batchNo ? (
              <div className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <Package className="mr-1 inline h-3.5 w-3.5" />
                <span className="font-bold">{s.t("batch_proposed", "Loading batch proposed")} — {batchInfo.batchNo}</span>
                <span className="ms-1">
                  {(batchInfo.containers ?? []).length} {s.t("batch_containers", "container(s)")}: {(batchInfo.containers ?? []).join(", ")}
                  {batchInfo.planned ? ` · ${s.t("batch_planned", "planned")}: ${batchInfo.planned}` : ""}
                </span>
                <span className="ms-1">{s.t("batch_next", "Confirm it in Purchase Loading and create the loading records there — no second Purchase Booking, no duplicate containers.")}</span>
                {batchInfo.batch?.id ? (
                  <a href={`/dashboard/purchase/loading-form?batchId=${batchInfo.batch.id}`} className="ms-1 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700">
                    {s.t("batch_open", "Open in Purchase Loading")}
                  </a>
                ) : null}
              </div>
            ) : null}
            {job.status === "draft_ready" && job.draft_reference ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                <span className="font-bold">{s.t("draft_ready_banner", "Reviewed draft prepared")} — {job.draft_reference}</span>
                <span className="ms-1">{s.t("draft_open_hint", "Open the target module's New Entry screen and choose “Continue Saved Draft” to complete and post it. The AI has not created or posted anything.")}</span>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* original document */}
              <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("original", "Original Document")}</p>
                {isImage ? (
                  <img src={`/api/erp/document-intelligence/${jobId}/file`} alt={job.original_filename} className="max-h-[70vh] w-full rounded-lg object-contain" />
                ) : (
                  <iframe src={`/api/erp/document-intelligence/${jobId}/file`} title={job.original_filename} className="h-[70vh] w-full rounded-lg border-0" />
                )}
              </div>

              {/* extracted fields */}
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("extracted", "Extracted Fields")} ({data?.fields.length ?? 0})</p>
                  <div className="space-y-2">
                    {(data?.fields ?? []).map((f) => <FieldRow key={f.id} s={s} f={f} editable={["review", "qvc"].includes(job.status)} onSave={saveField} />)}
                    {(data?.fields ?? []).length === 0 ? <p className="text-xs text-slate-400">{s.t("no_fields", "No fields extracted yet — run OCR + Extract.")}</p> : null}
                  </div>
                </div>

                {(data?.lineItems ?? []).length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("goods", "Goods Lines")} ({data!.lineItems.length})</p>
                    <table className="w-full text-[11px]">
                      <thead className="text-left text-slate-400"><tr><Th className="py-1">#</Th><Th className="py-1">{s.t("li_desc", "Description")}</Th><Th className="py-1 text-right">{s.t("li_qty", "Qty")}</Th><Th className="py-1 text-right">{s.t("li_price", "Price")}</Th><Th className="py-1 text-right">{s.t("li_amount", "Amount")}</Th></tr></thead>
                      <tbody>{data!.lineItems.map((li) => <tr key={li.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1">{li.line_no}</td><td className="py-1">{li.description}{li.hs_code ? ` · HS ${li.hs_code}` : ""}</td><td className="py-1 text-right tabular-nums">{li.quantity} {li.unit || ""}</td><td className="py-1 text-right tabular-nums">{li.unit_price}</td><td className="py-1 text-right tabular-nums">{li.amount}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("matching", "Source Record Match")} — <span className={job.match_status === "out_of_scope" ? "text-rose-600" : "text-slate-500"}>{s.t(`ms_${job.match_status}`, job.match_status)}</span></p>
                  {job.match_status === "out_of_scope" ? (
                    <p className="text-xs font-semibold text-rose-600">{s.t("no_match", "No authorized matching record was found in your country/branch scope.")}</p>
                  ) : null}
                  {(data?.matches ?? []).filter((m) => m.match_kind === "source_record").map((m) => (
                    <div key={m.id} className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{m.label}</span>
                        <div className="text-[10px] text-slate-400">{m.reason} · {Math.round((m.score || 0) * 100)}%{m.scope_ok ? "" : ` · ${s.t("out_of_scope", "out of scope")}`}</div>
                      </div>
                      {m.scope_ok && !m.is_selected && ["review", "qvc", "ambiguous"].includes(job.match_status === "ambiguous" ? "ambiguous" : job.status) ? (
                        <button type="button" onClick={() => void pickMatch(m.id)} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">{s.t("select", "Select")}</button>
                      ) : m.is_selected ? <span className="text-[10px] font-bold text-emerald-600">{s.t("selected", "Selected")}</span> : null}
                    </div>
                  ))}
                  {(data?.matches ?? []).length === 0 && job.match_status !== "out_of_scope" ? <p className="text-xs text-slate-400">{s.t("no_candidates", "No candidate records — the document will be reviewed and can be linked manually from its source module.")}</p> : null}
                </div>
              </div>
            </div>

            {data?.events?.length ? (
              <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-400">{s.t("audit", "Audit Trail")}</p>
                <ul className="space-y-1">
                  {data.events.map((e) => (
                    <li key={e.id} className="text-[10px] text-slate-500">{new Date(e.created_at).toLocaleString()} — <span className="font-bold">{s.t(`ev_${e.action}`, e.action)}</span>{e.actor_name ? ` · ${e.actor_name}` : ""}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function FieldRow({ s, f, editable, onSave }: { s: ReturnType<typeof useErpScreen>; f: Row; editable: boolean; onSave: (k: string, v: string, verified: boolean) => void }) {
  const [val, setVal] = useState<string>(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? "");
  useEffect(() => { setVal(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? ""); }, [f.corrected_value, f.normalized_value, f.raw_value]);
  return (
    <div className={`rounded-lg border p-2 ${FIELD_TONE[f.validation_status] || FIELD_TONE.amber}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.t(`f_${f.field_key}`, f.field_label)}</span>
        <span className="text-[10px] text-slate-400">{Math.round((f.confidence || 0) * 100)}%{f.page_number ? ` · p${f.page_number}` : ""}{f.verified ? " · ✓" : ""}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={!editable}
          className="flex-1 rounded border border-slate-200 bg-white/70 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800/70"
        />
        {editable ? (
          <button type="button" onClick={() => onSave(f.field_key, val, true)} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">{s.t("verify", "Verify")}</button>
        ) : null}
      </div>
      {f.validation_message ? <p className="mt-0.5 text-[10px] text-slate-400">{f.validation_message}</p> : null}
      {f.raw_value && f.raw_value !== val ? <p className="mt-0.5 text-[10px] text-slate-400">{s.t("ocr_raw", "OCR read")}: “{f.raw_value}”</p> : null}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
