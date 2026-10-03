"use client";

/**
 * AI Document Intake / Scan-to-Entry.
 *
 * One compact setup (in this order):  1. Country · Main Branch · City Branch (within the user's permissions)
 *                                     2. "Which module should this document be entered into?"
 *                                     3. Upload a document OR pick one that is already uploaded
 * then the module-aware review workspace (original document beside the module's own editable fields).
 * The module the user picks — never the document's title — decides the form, the accounts and the save
 * destination. Nothing here posts, pays or transfers anything.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, UploadCloud, RefreshCw, FileText, ShieldAlert, CheckCircle2, X, Link2, AlertTriangle, Camera, Globe, Building2, MapPin,
  ArrowRight, Search, Ban, Layers, Sparkles, Trash2, Lock,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { isNativeApp, captureDocumentPhoto } from "@/lib/mobile/native-bridge";
import { apiGet, apiPatch } from "@/lib/api/client";
import { IntakeReviewWorkspace } from "@/features/document-intelligence/components/intake-review-workspace";
import { INTAKE_MODULES, INTAKE_MODULE_GROUPS, getIntakeModule, moduleForTarget, resolveModule, type IntakeModule } from "@/lib/document-intelligence/intake-modules";

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

const COUNTRY_FLAGS: Record<string, string> = {
  ae: "🇦🇪", "united arab emirates": "🇦🇪", af: "🇦🇫", afghanistan: "🇦🇫", pk: "🇵🇰", pakistan: "🇵🇰", ir: "🇮🇷", iran: "🇮🇷",
  qa: "🇶🇦", qatar: "🇶🇦", sa: "🇸🇦", "saudi arabia": "🇸🇦", om: "🇴🇲", oman: "🇴🇲", cn: "🇨🇳", china: "🇨🇳", us: "🇺🇸", usa: "🇺🇸", gb: "🇬🇧", uk: "🇬🇧",
};
const flag = (name?: string | null) => (name ? COUNTRY_FLAGS[name.toLowerCase().trim()] ?? "🌐" : "🌐");

export function DocumentIntakeCenter({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const T = useCallback((k: string, fb: string) => s.t("x_" + k, fb), [s]);

  const [tab, setTab] = useState<"intake" | "queue">("intake");
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [reviewModuleId, setReviewModuleId] = useState<string | null>(null);

  // 1. scope
  const [sessionData, setSessionData] = useState<any>(null);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [countryBranches, setCountryBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [cityBranches, setCityBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");

  // 2. module
  const [moduleId, setModuleId] = useState("");

  // 3. document
  const [docMode, setDocMode] = useState<"upload" | "existing">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<Row[]>([]);
  const [existingId, setExistingId] = useState("");
  const [existingSearch, setExistingSearch] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // queue
  const [queueRows, setQueueRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatusFilter, setQueueStatusFilter] = useState("");

  const isSuperAdmin = Boolean(sessionData?.scopes?.isSuperAdmin || sessionData?.roles?.includes("super_admin") || sessionData?.scopes?.summary?.level === "global");
  const isCountryLevel = Boolean(sessionData?.roles?.includes("country_admin") || sessionData?.roles?.includes("country_user") || sessionData?.scopes?.summary?.level === "country");
  const isBranchAdmin = Boolean(sessionData?.roles?.includes("branch_admin") || sessionData?.roles?.includes("main_branch_admin") || sessionData?.roles?.includes("main_branch_user"));
  const lockCountry = !isSuperAdmin;
  const lockMain = !(isSuperAdmin || isCountryLevel);
  const lockCity = !(isSuperAdmin || isCountryLevel || isBranchAdmin);

  const allowedDomains: string[] | null = useMemo(() => {
    const d = sessionData?.scopes?.operationalDomains;
    return Array.isArray(d) && d.length ? d : null;
  }, [sessionData]);
  const modules = useMemo(() => INTAKE_MODULES.filter((m) => !allowedDomains || allowedDomains.includes(m.domain) || allowedDomains.includes("both")), [allowedDomains]);
  const chosen: IntakeModule | null = getIntakeModule(moduleId);

  // ── scope loading ─────────────────────────────────────────────────────────────────────────────────
  const loadCityBranches = useCallback(async (bid: string) => {
    if (!bid) { setCityBranches([]); return; }
    try {
      const r = await apiGet<{ cityBranches: any[] }>(`/api/branch-management/city-branches?countryBranchId=${bid}`);
      setCityBranches(r?.cityBranches ?? []);
    } catch { setCityBranches([]); }
  }, []);

  const loadCountryBranches = useCallback(async (cid: string) => {
    if (!cid) { setCountryBranches([]); return; }
    try {
      const r = await apiGet<{ countryBranches: any[] }>(`/api/branch-management/country-branches?countryId=${cid}`);
      setCountryBranches(r?.countryBranches ?? []);
    } catch { setCountryBranches([]); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [sess, cList] = await Promise.all([
          apiGet<any>("/api/erp/auth/session").catch(() => null),
          apiGet<{ countries: Array<{ id: string; name: string }> }>("/api/branch-management/countries").catch(() => ({ countries: [] })),
        ]);
        setSessionData(sess);
        setCountries(cList?.countries ?? []);
        const sum = sess?.scopes?.summary ?? {};
        // Super Admin has no home country — leave blank rather than silently pre-selecting one.
        const cid: string = sum.countryId || sum.branchCountryId || sess?.scopes?.countryIds?.[0] || "";
        const mb: string = sum.countryBranchId || sess?.scopes?.countryBranchIds?.[0] || "";
        const cb: string = sum.cityBranchId || sess?.scopes?.cityBranchIds?.[0] || "";
        if (cid) { setCountryId(cid); await loadCountryBranches(cid); }
        if (mb) { setCountryBranchId(mb); await loadCityBranches(mb); }
        if (cb) setCityBranchId(cb);
      } catch (e) { console.warn("Scope init notice:", e); }
    })();
  }, [loadCountryBranches, loadCityBranches]);

  const pickCountry = async (cid: string) => {
    setCountryId(cid); setCountryBranchId(""); setCityBranchId(""); setCityBranches([]);
    await loadCountryBranches(cid);
  };
  const pickMain = async (bid: string) => {
    setCountryBranchId(bid); setCityBranchId("");
    await loadCityBranches(bid);
  };

  // ── existing uploaded documents ───────────────────────────────────────────────────────────────────
  const loadExisting = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (existingSearch) qs.set("search", existingSearch);
      const r = await apiGet<{ rows: Row[] }>(`/api/erp/document-intelligence?${qs.toString()}`);
      setExisting((r.rows ?? []).filter((x) => x.status !== "cancelled"));
    } catch { setExisting([]); }
  }, [existingSearch]);
  useEffect(() => { if (tab === "intake" && docMode === "existing") void loadExisting(); }, [tab, docMode, loadExisting]);

  // ── queue ─────────────────────────────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const qs = new URLSearchParams();
      if (queueStatusFilter) qs.set("status", queueStatusFilter);
      if (queueSearch) qs.set("search", queueSearch);
      const [q, k] = await Promise.all([
        apiGet<{ rows: Row[] }>(`/api/erp/document-intelligence?${qs.toString()}`),
        apiGet<{ kpis: Record<string, number> }>("/api/erp/document-intelligence?view=kpis"),
      ]);
      setQueueRows(q.rows ?? []);
      setKpis(k.kpis ?? {});
    } catch (e) { console.warn("Queue load notice:", e); } finally { setQueueLoading(false); }
  }, [queueStatusFilter, queueSearch]);
  useEffect(() => { if (tab === "queue") void loadQueue(); }, [tab, loadQueue]);

  // deep link (?job=<id>) opens an existing document straight into review
  useEffect(() => {
    if (typeof window === "undefined") return;
    const j = new URLSearchParams(window.location.search).get("job");
    if (j) { setReviewModuleId(null); setReviewJobId(j); setTab("intake"); }
  }, []);

  const openExisting = (row: Row) => {
    setError(null);
    setReviewModuleId(null); // the saved draft / job remembers its own module
    setReviewJobId(row.id);
    setTab("intake");
  };

  // ── upload + extract ──────────────────────────────────────────────────────────────────────────────
  const scopeOk = Boolean(countryId && (countryBranchId || cityBranchId));
  const canExtract = Boolean(chosen && scopeOk && ((docMode === "upload" && file) || (docMode === "existing" && existingId)));

  const run = async () => {
    if (!chosen) return;
    setError(null);
    if (docMode === "existing") {
      const row = existing.find((x) => x.id === existingId);
      if (!row) return;
      setReviewModuleId(chosen.id);
      setReviewJobId(row.id);
      return;
    }
    if (!file) return;
    setBusy(true);
    try {
      setBusyText(T("proc_uploading", "Uploading the document securely…"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("operationalDomain", chosen.domain);
      fd.append("countryId", countryId);
      if (countryBranchId) fd.append("countryBranchId", countryBranchId);
      if (cityBranchId) fd.append("cityBranchId", cityBranchId);
      fd.append("sourceModuleHint", chosen.id);
      fd.append("idempotencyKey", `${file.name}:${file.size}:${file.lastModified}:${chosen.domain}:${countryBranchId || cityBranchId}`);
      const up = await fetch("/api/erp/document-intelligence/upload", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok || upJson?.ok === false) throw new Error(upJson?.error?.message || upJson?.error || T("upload_failed", "Upload failed."));
      const job = upJson.data?.job ?? upJson.job;
      const jobId: string = job?.id;
      if (!jobId) throw new Error(T("upload_failed", "Upload failed."));
      // A file already uploaded earlier is REUSED (its saved review is kept) — only a fresh upload is extracted.
      // OCR runs on the server in the background; the review screen follows the job (ocr -> extracting -> review)
      if (!job.deduped || ["uploaded", "error", "ocr", "classifying", "extracting", "matching"].includes(job.status)) {
        setBusyText(T("proc_extract", "Reading the document and extracting fields…"));
        await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "process", async: true, force: job.status === "error" });
      }
      setReviewModuleId(chosen.id);
      setReviewJobId(jobId);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setBusyText("");
    }
  };

  const backToSetup = () => { setReviewJobId(null); setReviewModuleId(null); void loadQueue(); };

  const countryName = countries.find((c) => c.id === countryId)?.name || sessionData?.scopes?.summary?.countryName || "";
  const mainName = countryBranches.find((b) => b.id === countryBranchId)?.name || sessionData?.scopes?.summary?.countryBranchName || "";
  const cityName = cityBranches.find((b) => b.id === cityBranchId)?.name || sessionData?.scopes?.summary?.cityBranchName || "";

  const selectCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const lockedBox = (txt: string) => (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
      <span className="truncate">{txt || "—"}</span><Lock className="h-3 w-3 shrink-0 text-slate-400" />
    </div>
  );

  const filteredExisting = existing.filter((r) => !existingSearch || `${r.job_no} ${r.original_filename} ${r.contract_reference ?? ""}`.toLowerCase().includes(existingSearch.toLowerCase()));

  return (
    <section dir={s.dir} className="min-h-screen bg-[#f8fafc] pb-16 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white"><Sparkles className="h-4.5 w-4.5" /></div>
            <div>
              <h1 className="text-base font-black tracking-tight">{s.t("title", "AI Document Intake")}</h1>
              <p className="text-[11px] text-slate-500">{T("tagline", "Scan a document into the right ERP form — you review everything before it goes anywhere.")}</p>
            </div>
          </div>
          <div className="flex items-center rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800">
            {([["intake", T("tab_intake", "New / Open Document"), Sparkles], ["queue", s.t("tab_queue", "Queue & History"), Layers]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setTab(id as "intake" | "queue")} data-testid={`main-tab-${id}`}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${tab === id ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                <Icon className="h-3.5 w-3.5" /><span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-[1500px] space-y-3 px-3 sm:px-6">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white" role="alert" data-testid="intake-error">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label={T("dismiss", "Dismiss")}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {tab === "intake" && reviewJobId && (
          <IntakeReviewWorkspace s={s} jobId={reviewJobId} moduleId={reviewModuleId}
            scope={{ countryId, countryBranchId, cityBranchId }} onBack={backToSetup} onChanged={() => void loadQueue()} />
        )}

        {tab === "intake" && !reviewJobId && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900" data-testid="setup-panel">
            {/* 1 · scope */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">1</span>{T("setup_scope", "Where is this document for?")}</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400"><Globe className="h-3 w-3" />{s.t("country_label", "Country / Territory *")}</label>
                  {lockCountry ? lockedBox(`${flag(countryName)} ${countryName}`) : (
                    <select value={countryId} onChange={(e) => void pickCountry(e.target.value)} className={selectCls} data-testid="sel-country">
                      <option value="">{T("sel_country", "— Select country —")}</option>
                      {countries.map((c) => <option key={c.id} value={c.id}>{flag(c.name)} {c.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400"><Building2 className="h-3 w-3" />{s.t("branch_label", "Main Branch *")}</label>
                  {lockMain ? lockedBox(mainName) : (
                    <select value={countryBranchId} onChange={(e) => void pickMain(e.target.value)} className={selectCls} disabled={!countryId} data-testid="sel-main">
                      <option value="">{T("sel_main", "— Select main branch —")}</option>
                      {countryBranches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400"><MapPin className="h-3 w-3" />{s.t("city_branch_label", "City Branch")}</label>
                  {lockCity ? lockedBox(cityName) : (
                    <select value={cityBranchId} onChange={(e) => setCityBranchId(e.target.value)} className={selectCls} disabled={!countryBranchId} data-testid="sel-city">
                      <option value="">{T("sel_city", "— Main branch office —")}</option>
                      {cityBranches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* 2 · module */}
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">2</span>{T("setup_module_q", "Which module should this document be entered into?")}</p>
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={`${selectCls} sm:max-w-md`} data-testid="sel-module">
                <option value="">{T("sel_module", "— Select module —")}</option>
                {INTAKE_MODULE_GROUPS.map((g) => {
                  const list = modules.filter((m) => m.group === g.id);
                  if (!list.length) return null;
                  return <optgroup key={g.id} label={s.t(g.labelKey, g.label)}>{list.map((m) => <option key={m.id} value={m.id}>{s.t(m.labelKey, m.label)}</option>)}</optgroup>;
                })}
              </select>
              {chosen && (
                <p className="mt-1.5 text-[11px] text-slate-500" data-testid="module-hint">
                  {T("saves_to", "Opens in")}: <b>{s.t(chosen.labelKey, chosen.label)}</b>.{" "}
                  {chosen.party === "supplier" ? T("hint_supplier", "The Seller named on the document is treated as our supplier, whatever the document is titled.") : chosen.party === "customer" ? T("hint_customer", "The Buyer named on the document is treated as our customer, whatever the document is titled.") : ""}
                  {!chosen.financial && chosen.side === "shipping" ? ` ${T("hint_no_price", "Cargo form — no price or payment fields.")}` : ""}
                </p>
              )}
            </div>

            {/* 3 · document */}
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">3</span>{T("setup_doc", "Upload a document, or choose one already uploaded")}</p>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold dark:bg-slate-800">
                  {(["upload", "existing"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setDocMode(m)} data-testid={`doc-mode-${m}`} className={`rounded-md px-3 py-1 ${docMode === m ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900" : "text-slate-500"}`}>
                      {m === "upload" ? T("mode_upload", "Upload new") : T("mode_existing", "Select existing")}
                    </button>
                  ))}
                </div>
              </div>

              {docMode === "upload" ? (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,application/pdf,image/*" className="hidden" data-testid="file-input"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                  {file ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                      <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-rose-500" /><div><p className="text-xs font-bold" dir="ltr">{file.name}</p><p className="text-[10.5px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p></div></div>
                      <button type="button" onClick={() => setFile(null)} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600"><Trash2 className="h-3.5 w-3.5" />{T("remove", "Remove")}</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-blue-500 hover:bg-blue-50/30 dark:border-slate-700">
                      <UploadCloud className="h-6 w-6 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.t("drop_title", "Click to browse or drop an invoice, contract, or bill")}</span>
                      <span className="text-[10.5px] text-slate-400">{s.t("drop_sub", "Supports PDF, JPG, PNG, WEBP, TIFF (Max 25 MB, 60 pages)")}</span>
                    </button>
                  )}
                  {isNativeApp() && (
                    <button type="button" onClick={async () => { const c = await captureDocumentPhoto({ source: "PROMPT" }); if (c) setFile(c); }} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"><Camera className="h-3.5 w-3.5" />{s.t("snap_camera", "Capture via Scanner / Camera")}</button>
                  )}
                </>
              ) : (
                <div className="space-y-2" data-testid="existing-panel">
                  <input type="search" value={existingSearch} onChange={(e) => setExistingSearch(e.target.value)} placeholder={T("search_existing", "Search by job no., file name or contract no.")} className={selectCls} />
                  <select value={existingId} onChange={(e) => { setExistingId(e.target.value); const r = existing.find((x) => x.id === e.target.value); const m = resolveModule(r?.source_module_hint, r?.target_module); if (m && !moduleId) setModuleId(m.id); }} className={selectCls} size={Math.min(6, Math.max(2, filteredExisting.length + 1))} data-testid="sel-existing">
                    <option value="">{T("sel_existing", "— Select an uploaded document —")}</option>
                    {filteredExisting.map((r) => <option key={r.id} value={r.id}>{r.job_no} · {r.original_filename} · {r.status}{r.draft_reference ? ` · ${r.draft_reference}` : ""}</option>)}
                  </select>
                  {existingId && <button type="button" onClick={() => { const r = existing.find((x) => x.id === existingId); if (r) openExisting(r); }} className="text-[11px] font-bold text-blue-600 underline" data-testid="open-saved">{T("open_saved", "Open with its saved review")}</button>}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">
                {!scopeOk ? T("need_scope", "Choose a country and branch first.") : !chosen ? T("need_module", "Choose the module.") : docMode === "upload" && !file ? T("need_file", "Add a document.") : docMode === "existing" && !existingId ? T("need_existing", "Choose an uploaded document.") : ""}
              </p>
              <button type="button" disabled={!canExtract || busy} onClick={() => void run()} data-testid="run-extract"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{busy ? busyText : docMode === "upload" ? T("extract_review", "Extract & open review form") : T("open_review", "Open review form")}</span>
                {!busy && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
              </button>
            </div>
          </div>
        )}

        {tab === "queue" && (
          <div className="space-y-3" data-testid="queue-panel">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              <Kpi label={s.t("k_total", "Total")} value={kpis.total ?? queueRows.length} icon={FileText} />
              <Kpi label={s.t("k_review", "In Review")} value={kpis.in_review ?? 0} tone="text-amber-600" icon={FileText} />
              <Kpi label={s.t("k_qvc", "In QVC")} value={kpis.in_qvc ?? 0} tone="text-rose-600" icon={ShieldAlert} />
              <Kpi label={s.t("k_draft", "Draft Ready")} value={kpis.draft_ready ?? 0} tone="text-emerald-600" icon={CheckCircle2} />
              <Kpi label={s.t("k_linked", "Linked")} value={kpis.linked ?? 0} tone="text-blue-600" icon={Link2} />
              <Kpi label={s.t("k_oos", "Out of Scope")} value={kpis.out_of_scope ?? 0} tone="text-rose-600" icon={AlertTriangle} />
              <Kpi label={s.t("k_failed", "Failed")} value={kpis.failed ?? 0} tone="text-rose-600" icon={Ban} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-1 items-center gap-2"><Search className="h-4 w-4 text-slate-400" />
                <input type="text" value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} placeholder={s.t("search_queue", "Search job no, contract, B/L, or document name...")} className="w-full bg-transparent text-xs font-semibold outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <select value={queueStatusFilter} onChange={(e) => setQueueStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
                  <option value="">{s.t("all_statuses", "All Statuses")}</option>
                  <option value="uploaded">{T("st_uploaded", "Uploaded")}</option>
                  <option value="review">{s.t("st_review", "In Review")}</option>
                  <option value="draft_ready">{s.t("st_draft_ready", "Draft Ready")}</option>
                  <option value="qvc">{s.t("st_qvc", "In QVC")}</option>
                  <option value="linked">{s.t("st_linked", "Linked")}</option>
                </select>
                <button type="button" onClick={() => void loadQueue()} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800" title={s.t("refresh_queue", "Refresh Queue")}><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[720px] text-start text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 text-start">{T("q_job", "Job no.")}</th><th className="p-3 text-start">{T("q_file", "Document")}</th><th className="p-3 text-start">{T("q_scope", "Scope / office")}</th>
                    <th className="p-3 text-start">{T("q_module", "Module")}</th><th className="p-3 text-start">{T("q_draft", "Draft")}</th><th className="p-3 text-start">{T("q_fields", "Fields")}</th><th className="p-3 text-start">{T("q_status", "Status")}</th><th className="p-3 text-end">{T("q_actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queueLoading ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                  ) : queueRows.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-400">{s.t("empty_queue", "No intake jobs found matching your scope or criteria.")}</td></tr>
                  ) : queueRows.map((r) => {
                    const m = resolveModule(r.source_module_hint, r.target_module);
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50" data-testid={`queue-row-${r.job_no}`}>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">{r.job_no}</td>
                        <td className="max-w-[200px] truncate p-3 font-medium" dir="ltr">{r.original_filename}</td>
                        <td className="p-3 text-slate-500">{[r.country_name, r.city_branch_name || r.country_branch_name].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="p-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{m ? s.t(m.labelKey, m.label) : r.target_module || "—"}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500" dir="ltr">{r.draft_reference || "—"}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{r.field_count ?? 0}</td>
                        <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.uploaded}`}>{r.status}</span></td>
                        <td className="p-3 text-end">
                          <button type="button" onClick={() => openExisting(r)} data-testid={`open-${r.job_no}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300">
                            <ArrowRight className="h-3 w-3 rtl:rotate-180" /><span>{r.status === "linked" ? T("view", "View") : T("open_edit", "Open / Edit")}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: string; icon?: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">{Icon ? <Icon className={`h-3.5 w-3.5 ${tone || "text-slate-400"}`} /> : null}<span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span></div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

// kept for any consumer that still resolves a destination from a legacy target module
export function getDestinationInfo(targetModule?: string | null) {
  const m = moduleForTarget(targetModule);
  return { moduleName: m?.label ?? targetModule ?? "", routeUrl: m?.routeUrl ?? "/dashboard/document-intelligence", menuPath: m?.routeLabel ?? "", category: m?.group ?? "" };
}
