"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, UploadCloud, RefreshCw, FileText, ShieldAlert, CheckCircle2, X, ChevronLeft, Play, Ban, Link2, AlertTriangle, Package, Receipt, Camera, ExternalLink, FileClock, Globe, Building2, MapPin, Compass, ArrowRight, Download
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { isNativeApp, captureDocumentPhoto } from "@/lib/mobile/native-bridge";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { DRAFT_PREFILL_KEY } from "@/features/document-intelligence/components/entry-method-selector";
import { CrossLanguageReviewer } from "@/components/cross-language-reviewer";

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
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <UploadCloud className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {s.t("empty_title", "No documents in the intake queue")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                          {s.t("empty_desc", "No documents are currently available for processing. Upload a document to trigger automated OCR, classification, and field extraction.")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpload(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition-all mt-2"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {s.t("upload_now", "Upload Document Now")}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.job_no}</td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`domain_${r.operational_domain}`, r.operational_domain)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {r.original_filename}
                      <div className="text-[10px] text-slate-400">{(r.file_size / 1024).toFixed(0)} KB · {r.page_count || "?"} pg</div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.doc_type_code ? `${s.t(`dt_${r.doc_type_code}`, r.doc_type_code)} (${Math.round((r.doc_type_confidence || 0) * 100)}%)` : "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{[r.country_name, r.city_branch_name || r.country_branch_name, r.clearing_agent_name].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold ${r.match_status === "out_of_scope" ? "text-rose-600" : r.match_status === "auto" ? "text-emerald-600" : "text-slate-500"}`}>
                        {s.t(`ms_${r.match_status}`, r.match_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.uploaded}`}>
                          {s.t(`st_${r.status}`, r.status)}
                        </span>
                        {r.status === "draft_ready" ? (
                          <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {r.draft_reference || "DID"}
                          </span>
                        ) : null}
                      </div>
                    </td>
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
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
  }, []);
  const takePhoto = async () => {
    const captured = await captureDocumentPhoto({ source: "PROMPT" });
    if (captured) setFile(captured);
  };
  const [domain, setDomain] = useState<"business" | "shipping">("business");
  const [contractRef, setContractRef] = useState("");
  const [blRef, setBlRef] = useState("");
  const [containerRef, setContainerRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoProcess, setAutoProcess] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Scope state
  const [sessionData, setSessionData] = useState<any>(null);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [countryId, setCountryId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  useEffect(() => {
    async function initScope() {
      try {
        const [sess, cList] = await Promise.all([
          apiGet<any>("/api/erp/auth/session").catch(() => null),
          apiGet<{ countries: Array<{ id: string; name: string }> }>("/api/branch-management/countries").catch(() => ({ countries: [] })),
        ]);
        setSessionData(sess);
        const cl = cList?.countries ?? [];
        setCountries(cl);

        const isSuper = sess?.scopes?.isSuperAdmin || sess?.roles?.includes("super_admin") || sess?.scopes?.summary?.level === "global";
        const assignedCountryId = sess?.scopes?.summary?.countryId || (sess?.scopes?.countryIds && sess.scopes.countryIds[0]);
        const assignedBranchId = sess?.scopes?.summary?.countryBranchId || sess?.scopes?.summary?.cityBranchId || (sess?.scopes?.countryBranchIds && sess.scopes.countryBranchIds[0]);

        const initCid = assignedCountryId || (isSuper && cl[0]?.id) || "";
        if (initCid) {
          setCountryId(initCid);
          const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${initCid}`).catch(() => ({ countryBranches: [] }));
          setBranches(brRes?.countryBranches ?? []);
        }
        if (assignedBranchId) {
          setBranchId(assignedBranchId);
        }
      } catch (e) {
        console.warn("UploadDrawer initScope err:", e);
      }
    }
    void initScope();
  }, []);

  const handleCountryChange = async (cid: string) => {
    setCountryId(cid);
    setBranchId("");
    if (!cid) {
      setBranches([]);
      return;
    }
    try {
      const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${cid}`).catch(() => ({ countryBranches: [] }));
      setBranches(brRes?.countryBranches ?? []);
    } catch {
      setBranches([]);
    }
  };

  const isSuperAdmin = sessionData?.scopes?.isSuperAdmin || sessionData?.roles?.includes("super_admin") || sessionData?.scopes?.summary?.level === "global";
  const isCountryAdmin = sessionData?.roles?.includes("country_admin") || sessionData?.scopes?.summary?.level === "country";
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  const submit = async () => {
    if (!file) { setErr(s.t("pick_file", "Choose a document first.")); return; }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("operationalDomain", domain);
      if (countryId) fd.append("countryId", countryId);
      if (branchId) fd.append("countryBranchId", branchId);
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("upload", "Upload Document")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3.5">
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 hover:border-emerald-400 dark:border-slate-700 transition-colors"
          >
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            {file ? <span className="font-bold text-emerald-700 dark:text-emerald-400">{file.name}</span> : s.t("drop", "Click to choose a PDF / JPG / PNG (max 25 MB, 60 pages)")}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {native ? (
            <button
              type="button"
              onClick={takePhoto}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              <Camera className="h-4 w-4" />
              {s.t("take_photo", "Take / choose a photo")}
            </button>
          ) : null}

          {/* Operational Domain */}
          <L label={s.t("domain", "Operational Domain")}>
            <select value={domain} onChange={(e) => setDomain(e.target.value as never)} className={INP}>
              <option value="business">{s.t("domain_business", "Business ERP")}</option>
              <option value="shipping">{s.t("domain_shipping", "Shipping / Clearing")}</option>
            </select>
          </L>

          {/* Role-aware Country & Branch Scope */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-950/50 dark:bg-blue-950/20 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              {s.t("scope_step_title", "Routing & Location Scope")}
            </p>

            <L label={s.t("scope_country_label", "Country / Entity")}>
              {isSuperAdmin ? (
                <select value={countryId} onChange={(e) => void handleCountryChange(e.target.value)} className={INP}>
                  <option value="">{s.t("scope_country_choose", "— Select Country —")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  {sessionData?.scopes?.summary?.countryName || "Assigned Country"}
                </div>
              )}
            </L>

            <L label={s.t("scope_branch_label", "Branch / Office")}>
              {(isSuperAdmin || isCountryAdmin) ? (
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!countryId && isSuperAdmin} className={INP}>
                  <option value="">{s.t("scope_all_branches", "All Branches / Main Office")}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  {sessionData?.scopes?.summary?.branchDisplayName || sessionData?.scopes?.summary?.countryBranchName || "Assigned Branch"}
                </div>
              )}
            </L>
          </div>

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

// "What is this document for?" — the AI never decides silently; the user routes
// the reviewed draft to one of the existing ERP module workflows. target keys
// must match lib/document-intelligence/draft-mapping.ts DRAFTABLE_MODULES.
const DOC_PURPOSES: Array<{ target: string; labelKey: string; fallback: string; group: string }> = [
  { target: "account_master", labelKey: "purpose_account_master", fallback: "Chart of Accounts / New Account Entry", group: "Masters" },
  { target: "purchase_orders", labelKey: "purpose_purchase", fallback: "Purchase (New / Existing)", group: "Trade" },
  { target: "sales_orders", labelKey: "purpose_sales", fallback: "Sales (New / Existing)", group: "Trade" },
  { target: "purchase_loading_records", labelKey: "purpose_loading", fallback: "Purchase Loading / Receiving", group: "Trade" },
  { target: "roznamcha_entries", labelKey: "purpose_payment", fallback: "Payment / Cash / Bank Roznamcha", group: "Finance" },
  { target: "expenses", labelKey: "purpose_expense", fallback: "Expense Bill", group: "Finance" },
  { target: "bill_expense_line", labelKey: "purpose_bill_expense_line", fallback: "Bill Expense Line (Freight / Customs / Clearing)", group: "Finance" },
  { target: "shipping_bl_records", labelKey: "purpose_shipping", fallback: "Shipping / Bill of Lading", group: "Logistics" },
  { target: "clearing_agent_custom_entries", labelKey: "purpose_clearing", fallback: "Clearing / Customs Entry", group: "Logistics" },
  { target: "companies", labelKey: "purpose_company", fallback: "Company / Entity", group: "Masters" },
  { target: "customers", labelKey: "purpose_customer", fallback: "Customer / Person KYC", group: "Masters" },
  { target: "employees", labelKey: "purpose_employee", fallback: "Employee / HR Record", group: "Masters" },
  { target: "banks", labelKey: "purpose_bank", fallback: "Bank Account", group: "Masters" },
  // A contract/agreement between the entity and a supplier → Purchase workflow.
  { target: "purchase_orders", labelKey: "purpose_contract_purchase", fallback: "Contract / Agreement (Purchase side)", group: "Masters" },
  { target: "sales_orders", labelKey: "purpose_contract_sales", fallback: "Contract / Agreement (Sales side)", group: "Masters" },
];

export function getDestinationInfo(targetModule?: string | null, s?: ReturnType<typeof useErpScreen>) {
  switch (targetModule) {
    case "account_master":
    case "accounts":
      return {
        moduleName: s ? s.t("purpose_account_master", "Chart of Accounts / New Account Entry") : "Chart of Accounts / New Account Entry",
        menuPath: "Sidebar → New Entry → Accounts → New Account Setup",
        routeUrl: "/dashboard/accounts/setup",
        category: "Masters & Setup",
      };
    case "purchase_orders":
      return {
        moduleName: s ? s.t("purpose_purchase", "Purchase (New / Existing)") : "Purchase Booking Order",
        menuPath: "Sidebar → Trade → New Purchase Booking Order",
        routeUrl: "/dashboard/purchase/new-purchase-booking-order",
        category: "Trade",
      };
    case "sales_orders":
      return {
        moduleName: s ? s.t("purpose_sales", "Sales (New / Existing)") : "Sale Order Booking",
        menuPath: "Sidebar → Trade → New Sale Order Booking",
        routeUrl: "/dashboard/sales/new-sale-order-booking",
        category: "Trade",
      };
    case "purchase_loading_records":
      return {
        moduleName: s ? s.t("purpose_loading", "Purchase Loading / Receiving") : "Purchase Loading Records",
        menuPath: "Sidebar → Trade → Purchase Loading",
        routeUrl: "/dashboard/purchase-loading-records",
        category: "Trade",
      };
    case "roznamcha_entries":
      return {
        moduleName: s ? s.t("purpose_payment", "Payment / Cash / Bank Roznamcha") : "Cash / Bank Roznamcha",
        menuPath: "Sidebar → Finance → Roznamcha Cash Entry",
        routeUrl: "/dashboard/roznamcha/cash-entry",
        category: "Finance",
      };
    case "expenses":
    case "bill_expense_line":
      return {
        moduleName: s ? s.t("purpose_expense", "Expense Bill") : "Expense Bill Entry",
        menuPath: "Sidebar → Finance → Expenses",
        routeUrl: "/dashboard/expenses",
        category: "Finance",
      };
    case "shipping_bl_records":
      return {
        moduleName: s ? s.t("purpose_shipping", "Shipping / Bill of Lading") : "Shipping Line / Bill of Lading",
        menuPath: "Sidebar → Logistics → Shipping Line",
        routeUrl: "/dashboard/shipping-line",
        category: "Logistics",
      };
    case "clearing_agent_custom_entries":
      return {
        moduleName: s ? s.t("purpose_clearing", "Clearing / Customs Entry") : "Clearing Agent / Customs Entry",
        menuPath: "Sidebar → Logistics → Clearing Agent",
        routeUrl: "/dashboard/clearing-agent",
        category: "Logistics",
      };
    case "companies":
      return {
        moduleName: s ? s.t("purpose_company", "Company / Entity") : "Company / Entity Setup",
        menuPath: "Sidebar → Masters → Companies",
        routeUrl: "/dashboard/companies/new",
        category: "Masters",
      };
    case "customers":
      return {
        moduleName: s ? s.t("purpose_customer", "Customer / Person KYC") : "Customer / Person KYC Setup",
        menuPath: "Sidebar → Masters → Customers",
        routeUrl: "/dashboard/crm/customers/new",
        category: "Masters",
      };
    case "employees":
      return {
        moduleName: s ? s.t("purpose_employee", "Employee / HR Record") : "Employee / HR Record",
        menuPath: "Sidebar → HR & Payroll → Employees",
        routeUrl: "/dashboard/employees",
        category: "HR & Payroll",
      };
    case "banks":
      return {
        moduleName: s ? s.t("purpose_bank", "Bank Account") : "Bank Account Setup",
        menuPath: "Sidebar → Masters → Chart of Accounts",
        routeUrl: "/dashboard/accounts/setup",
        category: "Masters",
      };
    default:
      return {
        moduleName: targetModule || "Target Module",
        menuPath: "Sidebar → Masters → Chart of Accounts",
        routeUrl: "/dashboard/accounts/setup",
        category: "General",
      };
  }
}

function ReviewPanel({ s, jobId, onBack }: { s: ReturnType<typeof useErpScreen>; jobId: string; onBack: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<{ job: Row; fields: Row[]; lineItems: Row[]; matches: Row[]; events: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>("");
  const [toast, setToast] = useState<{ show: boolean; draftNo: string; targetModule: string } | null>(null);

  // Scopes and routing state
  const [sessionData, setSessionData] = useState<any>(null);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [countryId, setCountryId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  useEffect(() => {
    if (!toast?.show) return;
    const timer = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, show: false } : null));
    }, 12000);
    return () => clearTimeout(timer);
  }, [toast?.show]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, sess, cList] = await Promise.all([
        apiGet<{ job: Row; fields: Row[]; lineItems: Row[]; matches: Row[]; events: Row[] }>(`/api/erp/document-intelligence/${jobId}`),
        apiGet<any>("/api/erp/auth/session").catch(() => null),
        apiGet<{ countries: Array<{ id: string; name: string }> }>("/api/branch-management/countries").catch(() => ({ countries: [] })),
      ]);
      setData(d);
      setSessionData(sess);
      const cl = cList?.countries ?? [];
      setCountries(cl);

      const jobCid = d?.job?.country_id || sess?.scopes?.summary?.countryId || (cl[0]?.id ?? "");
      const jobBid = d?.job?.country_branch_id || d?.job?.city_branch_id || sess?.scopes?.summary?.countryBranchId || sess?.scopes?.summary?.cityBranchId || "";

      setCountryId(jobCid);
      setBranchId(jobBid);

      if (jobCid) {
        const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${jobCid}`).catch(() => ({ countryBranches: [] }));
        setBranches(brRes?.countryBranches ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const tm = data?.job?.target_module;
    if (tm && !purpose) setPurpose(tm);
  }, [data?.job?.target_module, purpose]);

  const isSuperAdmin = sessionData?.scopes?.isSuperAdmin || sessionData?.roles?.includes("super_admin") || sessionData?.scopes?.summary?.level === "global";
  const isCountryAdmin = sessionData?.roles?.includes("country_admin") || sessionData?.scopes?.summary?.level === "country";
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  const onCountryChange = async (newCid: string) => {
    setCountryId(newCid);
    setBranchId("");
    if (!newCid) {
      setBranches([]);
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "update_scope", countryId: null, countryBranchId: null }).catch(() => {});
      return;
    }
    try {
      const brRes = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${newCid}`).catch(() => ({ countryBranches: [] }));
      setBranches(brRes?.countryBranches ?? []);
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "update_scope", countryId: newCid, countryBranchId: null }).catch(() => {});
    } catch (e) {
      console.warn("Error updating country scope:", e);
    }
  };

  const onBranchChange = async (newBid: string) => {
    setBranchId(newBid);
    try {
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "update_scope", countryId, countryBranchId: newBid || null }).catch(() => {});
    } catch (e) {
      console.warn("Error updating branch scope:", e);
    }
  };

  const openDraftInForm = async (targetMod?: string) => {
    const mod = targetMod || purpose || data?.job?.target_module || "account_master";
    try {
      const draftsRes = await apiGet<{ rows: any[] }>(`/api/erp/document-intelligence/drafts?jobId=${jobId}`);
      const d = draftsRes?.rows?.[0];
      if (d) {
        sessionStorage.setItem(
          DRAFT_PREFILL_KEY,
          JSON.stringify({
            targetModule: d.target_module || mod,
            draftId: d.id,
            draftNo: d.draft_no,
            payload: {
              ...d.draft_payload,
              countryId: countryId || d.country_id,
              countryBranchId: branchId || d.country_branch_id,
              cityBranchId: d.city_branch_id,
              branchId: branchId || d.country_branch_id || d.city_branch_id,
            },
            goodsEntries: d.line_items,
            linkMode: d.link_mode,
            linkedSourceId: d.linked_source_id,
          })
        );
      }
    } catch (err) {
      console.warn("Failed to stash draft for form:", err);
    }
    const dest = getDestinationInfo(mod, s);
    router.push(dest.routeUrl as any);
  };

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
    const targetModule = purpose || data?.job?.target_module || undefined;
    try {
      const res = await apiPatch<Row>(`/api/erp/document-intelligence/${jobId}`, {
        action: "confirm",
        linkMode,
        targetModule,
        countryId: countryId || null,
        countryBranchId: branchId || null,
      });
      const draftNo = res?.result?.draftNo || res?.draftNo || data?.job?.draft_reference || "DID";
      const mod = targetModule || "account_master";

      try {
        const draftsRes = await apiGet<{ rows: any[] }>(`/api/erp/document-intelligence/drafts?jobId=${jobId}`);
        const d = draftsRes?.rows?.[0];
        if (d) {
          sessionStorage.setItem(
            DRAFT_PREFILL_KEY,
            JSON.stringify({
              targetModule: d.target_module || mod,
              draftId: d.id,
              draftNo: d.draft_no,
              payload: {
                ...d.draft_payload,
                countryId: countryId || d.country_id,
                countryBranchId: branchId || d.country_branch_id,
                cityBranchId: d.city_branch_id,
                branchId: branchId || d.country_branch_id || d.city_branch_id,
              },
              goodsEntries: d.line_items,
              linkMode: d.link_mode,
              linkedSourceId: d.linked_source_id,
            })
          );
        }
      } catch {
        /* ignore */
      }

      setToast({
        show: true,
        draftNo: draftNo,
        targetModule: mod,
      });
      await load();
    }
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

  const [acctPreview, setAcctPreview] = useState<Row | null>(null);
  const [drAcct, setDrAcct] = useState("");
  const [crAcct, setCrAcct] = useState("");
  const loadAcctPreview = async (dr = drAcct, cr = crAcct) => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (dr) qs.set("debitAccountId", dr);
      if (cr) qs.set("creditAccountId", cr);
      setAcctPreview(await apiGet<Row>(`/api/erp/document-intelligence/${jobId}/accounting-preview${qs.toString() ? `?${qs}` : ""}`));
    }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const job = data?.job;
  const isImage = (job?.mime_type || "").startsWith("image/");
  const activeTargetMod = purpose || job?.target_module || "account_master";
  const destInfo = getDestinationInfo(activeTargetMod, s);

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1920px] space-y-4">
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
                {["review", "qvc", "draft_ready"].includes(job.status) ? (
                  <button type="button" disabled={busy || !(purpose || job.target_module)} onClick={() => void prepareDraft()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all hover:scale-[1.02]">
                    <CheckCircle2 className="h-4 w-4" />{s.t("prepare_draft", "Prepare Reviewed Draft")}
                  </button>
                ) : null}
                {["auto", "user"].includes(job.match_status) && job.matched_source_module === "purchase_orders" && !["linked", "cancelled"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void proposeBatch()} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"><Package className="h-3.5 w-3.5" />{s.t("propose_batch", "Propose Loading Batch")}</button>
                ) : null}
                {["purchase_orders", "sales_orders"].includes(purpose || job.target_module || "") && !["linked", "cancelled"].includes(job.status) ? (
                  <button type="button" disabled={busy} onClick={() => void loadAcctPreview()} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"><Receipt className="h-3.5 w-3.5" />{s.t("acct_preview_btn", "Accounting Preview")}</button>
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

            {job.transcript ? (
              <CrossLanguageReviewer
                originalText={job.transcript as string}
                originalLanguage={(job.original_language as string) || null}
                domain={job.operational_domain === "clearing" ? "clearing" : job.operational_domain === "shipping" ? "shipping" : "general"}
              />
            ) : null}

            {/* STEP 1, 2, 3: Routing & Location Scope Box */}
            {["review", "qvc", "draft_ready", "uploaded"].includes(job.status) ? (
              <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 p-4 shadow-xs dark:border-blue-900/50 dark:from-blue-950/20 dark:via-slate-900/40 dark:to-blue-950/20">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                        {s.t("scope_step_title", "Routing & Location Scope")}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {s.t("scope_step_desc", "Choose the target workflow and specify which Country and Branch this document belongs to. The prepared draft will be pre-filled with these selections.")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* STEP 1: Form / Target Workflow */}
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {s.t("purpose_title", "What is this document for?")}
                    </label>
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">{s.t("purpose_choose", "— Select document purpose —")}</option>
                      {["Trade", "Finance", "Logistics", "Masters"].map((grp) => (
                        <optgroup key={grp} label={grp}>
                          {DOC_PURPOSES.filter((p) => p.group === grp).map((p) => (
                            <option key={p.labelKey} value={p.target}>{s.t(p.labelKey, p.fallback)}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {job.doc_type_code ? (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {s.t("purpose_ai_suggest", "AI suggested")}: <span className="font-bold">{s.t(`dt_${job.doc_type_code}`, job.doc_type_code)}</span> ({Math.round((job.doc_type_confidence || 0) * 100)}%)
                      </p>
                    ) : null}
                  </div>

                  {/* STEP 2: Country Selection (Super Admin can change; others locked) */}
                  <div>
                    <label className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3 text-slate-400" />{s.t("scope_country_label", "Country / Entity")}</span>
                      {!isSuperAdmin ? <span className="text-[9px] text-amber-600 font-bold">{s.t("scope_assigned_fixed", "Fixed by your role")}</span> : null}
                    </label>
                    {isSuperAdmin ? (
                      <select
                        value={countryId}
                        onChange={(e) => void onCountryChange(e.target.value)}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">{s.t("scope_country_choose", "— Select Country —")}</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
                        <span>{job.country_name || sessionData?.scopes?.summary?.countryName || "Assigned Country"}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-mono dark:bg-slate-700">LOCKED</span>
                      </div>
                    )}
                    <p className="mt-1 text-[10px] font-mono text-slate-400 truncate">
                      {destInfo.menuPath}
                    </p>
                  </div>

                  {/* STEP 3: Branch Selection (Super Admin & Country Admin can select; Branch user locked) */}
                  <div>
                    <label className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-slate-400" />{s.t("scope_branch_label", "Branch / Office")}</span>
                      {isBranchUser ? <span className="text-[9px] text-amber-600 font-bold">{s.t("scope_assigned_fixed", "Fixed by your role")}</span> : null}
                    </label>
                    {(isSuperAdmin || isCountryAdmin) ? (
                      <select
                        value={branchId}
                        onChange={(e) => void onBranchChange(e.target.value)}
                        disabled={!countryId && isSuperAdmin}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">{s.t("scope_all_branches", "All Branches / Main Office")}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
                        <span>{job.city_branch_name || job.country_branch_name || sessionData?.scopes?.summary?.branchDisplayName || "Assigned Branch"}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-mono dark:bg-slate-700">LOCKED</span>
                      </div>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400 truncate">
                      {[job.country_name, job.city_branch_name || job.country_branch_name].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {acctPreview?.preview ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/20">
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  {s.t("acct_preview_title", "Accounting Preview — Before Posting")} ({acctPreview.side === "sales" ? s.t("purpose_sales", "Sales") : s.t("purpose_purchase", "Purchase")})
                </p>
                {acctPreview.checks?.duplicateOf ? (
                  <p className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{s.t("acct_dup", "A record with this contract already exists")}: {acctPreview.checks.duplicateOf.ref} ({acctPreview.checks.duplicateOf.status})
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {[
                    ["ap_business", "Business", acctPreview.preview.business || "—"],
                    ["ap_country", "Country", acctPreview.preview.country || "—"],
                    ["ap_branch", "Branch", acctPreview.preview.branch || "—"],
                    ["ap_dr", "Debit Account", `${acctPreview.preview.debitAccount?.name || "—"}${acctPreview.preview.debitAccount?.suggested ? " ★" : ""}`],
                    ["ap_cr", "Credit Account", `${acctPreview.preview.creditAccount?.name || "—"}${acctPreview.preview.creditAccount?.suggested ? " ★" : ""}`],
                    ["ap_src", "Source Document", acctPreview.preview.sourceDocument || "—"],
                    ["ap_orig_ccy", "Original Currency", acctPreview.preview.originalCurrency || "—"],
                    ["ap_orig_amt", "Original Amount", acctPreview.preview.originalAmount != null ? Number(acctPreview.preview.originalAmount).toLocaleString() : "—"],
                    ["ap_rate", "Exchange Rate", `${acctPreview.preview.exchangeRate} (${s.t(`ap_rs_${acctPreview.preview.rateSource}`, acctPreview.preview.rateSource)})`],
                    ["ap_func_ccy", "Functional Currency", acctPreview.preview.functionalCurrency || "—"],
                    ["ap_final_amt", "Final / Base Amount", acctPreview.preview.finalAmount != null ? Number(acctPreview.preview.finalAmount).toLocaleString() : "—"],
                    ["ap_contract", "Contract No.", acctPreview.preview.contractNo || "—"],
                  ].map(([k, fb, v]: any) => (
                    <div key={k} className="rounded-lg bg-white px-2 py-1.5 dark:bg-slate-900">
                      <span className="block text-[9px] font-bold uppercase text-slate-400">{s.t(k, fb)}</span>
                      <span className="block font-semibold text-slate-800 dark:text-slate-100">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-amber-200 pt-2 text-[11px] font-bold dark:border-amber-800">
                  <span className={acctPreview.preview.finalAmount ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}>
                    {s.t("ap_dr_total", "Total DR")}: {acctPreview.preview.functionalCurrency} {Number(acctPreview.preview.drTotal || 0).toLocaleString()}
                  </span>
                  <span className={acctPreview.preview.finalAmount ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}>
                    {s.t("ap_cr_total", "Total CR")}: {acctPreview.preview.functionalCurrency} {Number(acctPreview.preview.crTotal || 0).toLocaleString()}
                  </span>
                  <span className={acctPreview.checks?.balanced ? "rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "rounded bg-rose-100 px-1.5 py-0.5 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}>
                    {acctPreview.checks?.balanced ? s.t("ap_balanced", "DR = CR ✓") : s.t("ap_unbalanced", "DR ≠ CR")}
                  </span>
                </div>
                {[acctPreview.checks?.balancedMessage, acctPreview.checks?.rateMessage, acctPreview.checks?.accountsMessage].filter(Boolean).map((m: string, i: number) => (
                  <p key={i} className="mt-1.5 rounded-lg bg-amber-100/70 px-2 py-1 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{m}</p>
                ))}
                <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {s.t("ap_post_note", "The AI does not post. Prepare the reviewed draft, then open the Purchase / Sales wizard (Continue Saved Draft) — you confirm the accounts and rate there and post via the verified accounting engine.")}
                </p>
                {(acctPreview.preview.debitAccount?.options?.length || acctPreview.preview.creditAccount?.options?.length) ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-[10px] font-bold text-slate-500">
                      {s.t("ap_pick_dr", "Debit account")}
                      <select value={drAcct} onChange={(e) => { setDrAcct(e.target.value); void loadAcctPreview(e.target.value, crAcct); }} className="mt-0.5 h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                        <option value="">{s.t("ap_ai_suggested", "AI suggested")}: {acctPreview.preview.debitAccount?.name}</option>
                        {(acctPreview.preview.debitAccount?.options || []).map((o: any) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-bold text-slate-500">
                      {s.t("ap_pick_cr", "Credit account")}
                      <select value={crAcct} onChange={(e) => { setCrAcct(e.target.value); void loadAcctPreview(drAcct, e.target.value); }} className="mt-0.5 h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                        <option value="">{s.t("ap_ai_suggested", "AI suggested")}: {acctPreview.preview.creditAccount?.name}</option>
                        {(acctPreview.preview.creditAccount?.options || []).map((o: any) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

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

            {/* PROMINENT DRAFT DESTINATION CARD */}
            {job.status === "draft_ready" && job.draft_reference ? (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-emerald-50/90 p-5 shadow-sm dark:border-emerald-500/30 dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-emerald-950/40">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 rounded-2xl bg-emerald-600 p-2.5 text-white shadow-md shadow-emerald-600/20">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-black text-emerald-950 dark:text-emerald-100">
                          {job.draft_reference}
                        </span>
                        <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                          {s.t("draft_ready_banner", "Reviewed draft prepared")}
                        </span>
                        <span className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300">
                          {destInfo.moduleName}
                        </span>
                      </div>

                      <div className="rounded-xl border border-emerald-200/80 bg-white/90 p-3 text-xs shadow-xs dark:border-emerald-900/50 dark:bg-slate-900/90 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Compass className="h-4 w-4 text-emerald-600" />
                            <span>{s.t("dest_menu_path", "Sidebar Menu Location")}:</span>
                            <code className="rounded-md bg-emerald-100/70 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                              {destInfo.menuPath}
                            </code>
                          </div>
                          {(job.country_name || job.country_branch_name || job.city_branch_name) ? (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{[job.country_name, job.country_branch_name || job.city_branch_name].filter(Boolean).join(" → ")}</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-[11.5px] text-slate-600 dark:text-slate-300 space-y-1">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {s.t("dest_instructions_title", "Where did this draft go & how to continue?")}
                          </p>
                          <ul className="list-none space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <li>{s.t("dest_step_1", "1. Click the button below to jump directly into the target form, or open it from the sidebar path shown above.")}</li>
                            <li>{s.t("dest_step_2", "2. The form will load with 'Continue Saved Draft' already selected, pre-filling the OCR data into your selected Country and Branch.")}</li>
                            <li>{s.t("dest_step_3", "3. Verify the final details and post/save within the module. The AI never posts directly.")}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => void openDraftInForm(job.target_module)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all hover:scale-[1.02]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>{s.t("draft_open_btn", "Open in New Entry Form")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = destInfo.routeUrl;
                        router.push(url as any);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
                    >
                      <FileClock className="h-3.5 w-3.5" />
                      <span>{s.t("draft_view_drafts", "View Saved Drafts")}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* SIDE-BY-SIDE BALANCED SPLIT LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT: ORIGINAL DOCUMENT PREVIEW (Wide, Sticky, Full Height) */}
              <div className="lg:col-span-6 xl:col-span-7 sticky top-4 self-start rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b pb-2.5 mb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="truncate text-xs font-black text-slate-800 dark:text-slate-200" title={job.original_filename}>
                      {job.original_filename}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({(job.file_size / 1024).toFixed(0)} KB {job.page_count ? `· ${job.page_count} pg` : ""})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`/api/erp/document-intelligence/${jobId}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      title={s.t("btn_open_external", "Open Original in New Tab")}
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{s.t("btn_open_external", "Open Original in New Tab")}</span>
                    </a>
                    <a
                      href={`/api/erp/document-intelligence/${jobId}/file?download=1`}
                      download={job.original_filename}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      title={s.t("btn_download_file", "Download File")}
                    >
                      <Download className="h-3 w-3" />
                      <span>{s.t("btn_download_file", "Download File")}</span>
                    </a>
                  </div>
                </div>

                <div className="relative w-full h-[82vh] min-h-[640px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner">
                  {isImage ? (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-slate-950">
                      <img
                        src={`/api/erp/document-intelligence/${jobId}/file`}
                        alt={job.original_filename}
                        className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={`/api/erp/document-intelligence/${jobId}/file#toolbar=1&navpanes=1`}
                      title={job.original_filename}
                      className="w-full h-full border-0 rounded-xl"
                    />
                  )}
                </div>
              </div>

              {/* RIGHT: EXTRACTED FIELDS, GOODS LINES, MATCHING & AUDIT */}
              <div className="lg:col-span-6 xl:col-span-5 space-y-4">
                {/* Extracted Fields */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {s.t("extracted", "Extracted Fields")} ({data?.fields.length ?? 0})
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {["review", "qvc"].includes(job.status) ? "Editable & Verifiable" : "Read-only"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(data?.fields ?? []).map((f) => (
                      <FieldRow key={f.id} s={s} f={f} editable={["review", "qvc"].includes(job.status)} onSave={saveField} />
                    ))}
                    {(data?.fields ?? []).length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        {s.t("no_fields", "No fields extracted yet — run OCR + Extract.")}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Goods Lines */}
                {(data?.lineItems ?? []).length ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {s.t("goods", "Goods Lines")} ({data!.lineItems.length})
                    </p>
                    <table className="w-full text-[11px]">
                      <thead className="text-left text-slate-400 border-b dark:border-slate-800">
                        <tr>
                          <Th className="py-1.5">#</Th>
                          <Th className="py-1.5">{s.t("li_desc", "Description")}</Th>
                          <Th className="py-1.5 text-right">{s.t("li_qty", "Qty")}</Th>
                          <Th className="py-1.5 text-right">{s.t("li_price", "Price")}</Th>
                          <Th className="py-1.5 text-right">{s.t("li_amount", "Amount")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.lineItems.map((li) => (
                          <tr key={li.id} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="py-1.5 font-mono text-slate-400">{li.line_no}</td>
                            <td className="py-1.5 font-medium text-slate-700 dark:text-slate-200">{li.description}{li.hs_code ? ` · HS ${li.hs_code}` : ""}</td>
                            <td className="py-1.5 text-right tabular-nums">{li.quantity} {li.unit || ""}</td>
                            <td className="py-1.5 text-right tabular-nums">{li.unit_price}</td>
                            <td className="py-1.5 text-right tabular-nums font-bold">{li.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {/* Source Record Match */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {s.t("matching", "Source Record Match")} —{" "}
                    <span className={job.match_status === "out_of_scope" ? "text-rose-600" : "text-slate-500"}>
                      {s.t(`ms_${job.match_status}`, job.match_status)}
                    </span>
                  </p>
                  {job.match_status === "out_of_scope" ? (
                    <p className="text-xs font-semibold text-rose-600">{s.t("no_match", "No authorized matching record was found in your country/branch scope.")}</p>
                  ) : null}
                  {(data?.matches ?? []).filter((m) => m.match_kind === "source_record").map((m) => (
                    <div key={m.id} className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{m.label}</span>
                        <div className="text-[10px] text-slate-400">{m.reason} · {Math.round((m.score || 0) * 100)}%{m.scope_ok ? "" : ` · ${s.t("out_of_scope", "out of scope")}`}</div>
                      </div>
                      {m.scope_ok && !m.is_selected && ["review", "qvc", "ambiguous"].includes(job.match_status === "ambiguous" ? "ambiguous" : job.status) ? (
                        <button type="button" onClick={() => void pickMatch(m.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">{s.t("select", "Select")}</button>
                      ) : m.is_selected ? <span className="text-[10px] font-bold text-emerald-600">{s.t("selected", "Selected")}</span> : null}
                    </div>
                  ))}
                  {(data?.matches ?? []).length === 0 && job.match_status !== "out_of_scope" ? (
                    <p className="text-xs text-slate-400">{s.t("no_candidates", "No candidate records — the document will be reviewed and can be linked manually from its source module.")}</p>
                  ) : null}
                </div>

                {/* Audit Trail */}
                {data?.events?.length ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{s.t("audit", "Audit Trail")}</p>
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {data.events.map((e) => (
                        <li key={e.id} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>— <span className="font-bold text-slate-700 dark:text-slate-300">{s.t(`ev_${e.action}`, e.action)}</span>{e.actor_name ? ` · ${e.actor_name}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prominent Multilingual Side Toast Notification */}
      {toast?.show ? (
        <div
          dir={s.dir}
          role="status"
          aria-live="polite"
          className="fixed bottom-6 end-6 z-50 w-full max-w-sm sm:max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto shadow-2xl"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-white/95 p-4 backdrop-blur-xl shadow-2xl dark:border-emerald-500/40 dark:bg-slate-900/95 dark:text-slate-100">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 animate-pulse" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {s.t("draft_saved_toast_title", "Reviewed Draft Saved")}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="font-mono">{toast.draftNo}</span>
                    <span>·</span>
                    <span>{getDestinationInfo(toast.targetModule, s).moduleName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 rounded-xl bg-emerald-50/90 p-2.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Compass className="h-3.5 w-3.5 text-emerald-600" />
                <span>{s.t("dest_menu_path", "Sidebar Menu Location")}:</span>
              </div>
              <code className="block rounded bg-white/80 p-1 font-mono text-[10.5px] font-black text-emerald-950 dark:bg-slate-900/90 dark:text-emerald-300">
                {getDestinationInfo(toast.targetModule, s).menuPath}
              </code>
            </div>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openDraftInForm(toast.targetModule)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {s.t("draft_open_btn", "Open in New Entry Form")} →
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = getDestinationInfo(toast.targetModule, s).routeUrl;
                  router.push(url as any);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileClock className="h-3.5 w-3.5" />
                {s.t("draft_view_drafts", "View Saved Drafts")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FieldRow({ s, f, editable, onSave }: { s: ReturnType<typeof useErpScreen>; f: Row; editable: boolean; onSave: (k: string, v: string, verified: boolean) => void }) {
  const [val, setVal] = useState<string>(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? "");
  useEffect(() => { setVal(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? ""); }, [f.corrected_value, f.normalized_value, f.raw_value]);
  return (
    <div className={`rounded-xl border p-2.5 ${FIELD_TONE[f.validation_status] || FIELD_TONE.amber}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{s.t(`f_${f.field_key}`, f.field_label)}</span>
        <span className="text-[10px] text-slate-400">{Math.round((f.confidence || 0) * 100)}%{f.page_number ? ` · p${f.page_number}` : ""}{f.verified ? " · ✓" : ""}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={!editable}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
        />
        {editable ? (
          <button type="button" onClick={() => onSave(f.field_key, val, true)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition-colors">
            {s.t("verify", "Verify")}
          </button>
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
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}
