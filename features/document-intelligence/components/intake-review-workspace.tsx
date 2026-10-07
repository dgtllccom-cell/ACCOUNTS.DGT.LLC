"use client";

/**
 * Document Intake — the review workspace for ONE document inside the module the user chose.
 *
 * Original document on one side, the module's own editable fields on the other. Everything shown comes from
 * the extracted data / saved draft — no sample data. Only fields the chosen module supports are shown; the
 * module (not the document title) decides which account pickers apply. Saving updates the SAME draft in place;
 * nothing here ever posts, pays or creates a bank / account / ledger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Loader2, Lock, Plus, Save, Trash2, ArrowRight, Info, XCircle,
} from "lucide-react";
import type { ErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch } from "@/lib/api/client";
import { DRAFT_PREFILL_KEY } from "@/features/document-intelligence/components/entry-method-selector";
import { VerificationChecksPanel } from "@/features/document-intelligence/components/verification-checks-panel";
import { IntakeDocumentViewer } from "@/features/document-intelligence/components/intake-document-viewer";
import {
  INTAKE_MODULES, INTAKE_MODULE_GROUPS, accountFitsRole, getIntakeModule, pruneAccountsForModule, resolveModule,
  type AccountRole, type IntakeModule,
} from "@/lib/document-intelligence/intake-modules";
import {
  handoffBlockers, recomputeExchange, type ReviewForm, type ReviewItem, type ReviewState,
} from "@/lib/document-intelligence/review-state";
import { fieldMap, initialReview, missingFields, type JobBundle } from "@/lib/document-intelligence/review-init";
import { lineAmount, type RateDirection } from "@/lib/document-intelligence/party-match";
import type { ReviewContext, AccountOption } from "@/lib/services/document-intake-review-service";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
type Bundle = JobBundle & { matches: Row[]; events: Row[]; draft?: Row | null };
type TabId = "basic" | "items" | "payment" | "notes" | "fields" | "checks";
const PROCESSING = ["ocr", "classifying", "extracting", "matching"];

const CURRENCIES = ["USD", "AED", "PKR", "AFN", "EUR", "GBP", "CNY", "INR", "SAR", "QAR", "KWD", "OMR", "BHD", "IRR", "TRY", "JPY"];

const ROLE_LABEL: Record<AccountRole, [string, string]> = {
  supplier: ["role_supplier", "Supplier account"],
  purchase: ["role_purchase", "Purchase account (optional)"],
  customer: ["role_customer", "Customer account"],
  sales: ["role_sales", "Sales account (optional)"],
  debit: ["role_debit", "Debit account"],
  credit: ["role_credit", "Credit account"],
  bank: ["role_bank", "Bank account"],
};

const ROLE_STATE_KEY: Record<AccountRole, keyof ReviewState["accounts"]> = {
  supplier: "supplierAccountId", purchase: "purchaseAccountId", customer: "customerAccountId", sales: "salesAccountId",
  debit: "debitAccountId", credit: "creditAccountId", bank: "bankAccountId",
};

const inputCls = (bad = false) =>
  `w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100 dark:bg-slate-800 ${
    bad ? "border-amber-400 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/20" : "border-slate-300 bg-white dark:border-slate-700"
  }`;

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export type ReviewWorkspaceProps = {
  s: ErpScreen;
  jobId: string;
  /** module the user picked in setup (null = derive from the job) */
  moduleId: string | null;
  scope: { countryId: string; countryBranchId: string; cityBranchId: string };
  onBack: () => void;
  onChanged?: () => void;
};

export function IntakeReviewWorkspace({ s, jobId, moduleId, scope, onBack, onChanged }: ReviewWorkspaceProps) {
  const router = useRouter();
  const T = useCallback((k: string, fb: string) => s.t("x_" + k, fb), [s]);

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [mod, setMod] = useState<IntakeModule | null>(null);
  const [tab, setTab] = useState<TabId>("basic");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const loadSeq = useRef(0);

  const fetchContext = useCallback(async (modId: string, partyId?: string | null, baseCurrency?: string | null) => {
    const qs = new URLSearchParams({ moduleId: modId });
    if (partyId) qs.set("partyId", partyId);
    if (baseCurrency) qs.set("baseCurrency", baseCurrency);
    return apiGet<ReviewContext>(`/api/erp/document-intelligence/${jobId}/context?${qs.toString()}`).catch(() => null);
  }, [jobId]);

  // ── load (also used for "Refresh" and after every save) ─────────────────────────────────────────
  const load = useCallback(async (forceModuleId?: string | null) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await apiGet<Bundle>(`/api/erp/document-intelligence/${jobId}`);
      if (!d) throw new Error(T("job_load_failed", "Could not load this document — it may be outside your scope or no longer exist."));
      const m = resolveModule(forceModuleId ?? moduleId ?? d.job.source_module_hint, d.job.target_module) ?? getIntakeModule("purchase_booking")!;
      // a saved draft remembers its own module — it wins over a stale hint when reopening
      const savedModuleId = (d.draft?.draft_payload as any)?._review?.moduleId as string | undefined;
      const finalMod = (!forceModuleId && !moduleId && savedModuleId ? getIntakeModule(savedModuleId) : null) ?? m;
      const savedParty = (d.draft?.draft_payload as any)?._review?.party?.id as string | undefined;
      const c = await fetchContext(finalMod.id, savedParty);
      if (seq !== loadSeq.current) return;
      setBundle(d);
      setMod(finalMod);
      setCtx(c);
      setState(initialReview(d as JobBundle, finalMod, c));
      setDirty(false);
    } catch (e) {
      if (seq === loadSeq.current) { const m = e instanceof Error ? e.message : String(e); setError(/not found|scope/i.test(m) ? T("job_load_failed", "Could not load this document — it may be outside your scope or no longer exist.") : m); }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [jobId, moduleId, fetchContext, T]);

  useEffect(() => { void load(); }, [load]);

  // while OCR / extraction is running the job moves ocr -> classifying -> extracting -> review; follow it
  useEffect(() => {
    const st = bundle?.job?.status;
    if (!st || !PROCESSING.includes(st) || bundle?.job?.stalled) return;
    const t = setTimeout(() => void load(), 3000);
    return () => clearTimeout(t);
  }, [bundle, load]);

  const retryOcr = async () => {
    setBusy(true); setError(null); setNotice(null); setManualMode(false);
    try {
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "process", async: true, force: true });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const reportProblem = async () => {
    setBusy(true); setError(null);
    try {
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "qvc", reason: "Extraction problem reported by the reviewer: OCR/extraction returned no usable fields." });
      setNotice(T("reported", "Reported. The document was sent to the verification queue (QVC)."));
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const posted = bundle?.job?.status === "linked" || bundle?.draft?.status === "consumed";
  const set = useCallback((fn: (prev: ReviewState) => ReviewState) => {
    setState((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  }, []);
  const setForm = (patch: Partial<ReviewForm>) => set((p) => {
    const form = { ...p.form, ...patch };
    let exchange = p.exchange;
    if ("totalAmount" in patch || "currency" in patch) {
      exchange = recomputeExchange({ ...exchange, originalAmount: numOrNull(form.totalAmount), originalCurrency: (form.currency || "").toUpperCase(), confirmed: false });
    }
    return { ...p, form, exchange };
  });

  // ── module change: prune incompatible mappings, revalidate, remember on the job ─────────────────────
  const changeModule = async (id: string) => {
    const next = getIntakeModule(id);
    if (!next || !state || !mod || next.id === mod.id) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/erp/document-intelligence/${jobId}`, { action: "update_module", moduleId: next.id });
      const sameParty = next.party === mod.party;
      const c = await fetchContext(next.id, sameParty ? state.party.id : null, state.exchange.finalCurrency || null);
      setMod(next);
      setCtx(c);
      setState((prev) => prev && {
        ...prev,
        moduleId: next.id,
        accounts: pruneAccountsForModule(sameParty ? prev.accounts : { ...prev.accounts, supplierAccountId: "", customerAccountId: "" }, next),
        party: sameParty ? prev.party : { id: null, kind: null, name: "", documentName: c?.documentPartyName ?? "" },
      });
      // a party with exactly one linked account: pre-select it for the new module's role (never a guess among several)
      const pid = sameParty ? state.party.id : c?.selectedPartyId;
      const linked = (c?.candidates.find((x) => x.id === pid)?.accountIds ?? []).filter((id) => c!.accountOptions.some((o) => o.id === id));
      if (linked.length === 1) {
        setState((prev) => prev && {
          ...prev,
          accounts: {
            ...prev.accounts,
            supplierAccountId: next.roles.includes("supplier") && !prev.accounts.supplierAccountId ? linked[0] : prev.accounts.supplierAccountId,
            customerAccountId: next.roles.includes("customer") && !prev.accounts.customerAccountId ? linked[0] : prev.accounts.customerAccountId,
          },
        });
      }
      if (!sameParty && c?.selectedPartyId) {
        const cand = c.candidates.find((x) => x.id === c.selectedPartyId);
        if (cand) setState((prev) => prev && { ...prev, party: { id: cand.id, kind: cand.kind, name: cand.name, documentName: c.documentPartyName ?? "" } });
      }
      setDirty(true);
      setNotice(T("module_changed", "Module changed — accounts that do not apply were cleared and the form was revalidated."));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickParty = async (id: string) => {
    if (!mod || !state) return;
    if (!id) { set((p) => ({ ...p, party: { ...p.party, id: null, kind: null, name: "" }, accounts: { ...p.accounts, supplierAccountId: "", customerAccountId: "" }, bank: { decision: null, bankId: null } })); return; }
    setBusy(true);
    try {
      const c = await fetchContext(mod.id, id, state.exchange.finalCurrency || null);
      setCtx(c);
      const cand = c?.candidates.find((x) => x.id === id);
      if (cand) {
        const linked = cand.accountIds.filter((a) => c!.accountOptions.some((o) => o.id === a));
        set((p) => ({
          ...p,
          party: { id: cand.id, kind: cand.kind, name: cand.name, documentName: p.party.documentName },
          // keep a selection that is still linked; else a single linked account is safe to pre-select; else the reviewer chooses
          accounts: {
            ...p.accounts,
            supplierAccountId: mod.roles.includes("supplier") ? (linked.includes(p.accounts.supplierAccountId) ? p.accounts.supplierAccountId : linked.length === 1 ? linked[0] : "") : "",
            customerAccountId: mod.roles.includes("customer") ? (linked.includes(p.accounts.customerAccountId) ? p.accounts.customerAccountId : linked.length === 1 ? linked[0] : "") : "",
          },
          bank: { decision: null, bankId: null },
        }));
      }
    } finally {
      setBusy(false);
    }
  };

  const changeFinalCurrency = async (cur: string) => {
    if (!state) return;
    const c = await fetchContext(mod?.id ?? "", state.party.id, cur);
    if (c) setCtx(c);
    set((p) => {
      const ex = { ...p.exchange, finalCurrency: cur, confirmed: false };
      const fromMaster = c && c.rate.rate != null && c.rate.toCurrency === cur && c.rate.fromCurrency === ex.originalCurrency;
      return { ...p, exchange: recomputeExchange(fromMaster ? { ...ex, rate: c!.rate.rate, rateDate: c!.rate.rateDate, rateSource: "master", direction: "multiply" } : { ...ex, rate: cur === ex.originalCurrency ? 1 : null, rateDate: null, rateSource: "none" }) };
    });
  };

  // ── save / hand-off ────────────────────────────────────────────────────────────────────────────────
  const save = async (intent: "draft" | "handoff") => {
    if (!state || !mod) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiPatch<Row>(`/api/erp/document-intelligence/${jobId}`, {
        action: "confirm", linkMode: "new_record", targetModule: mod.target, intent,
        // the job keeps its OWN scope; the setup selection is only a fallback (never an empty overwrite)
        countryId: bundle?.job?.country_id || scope.countryId || null, countryBranchId: bundle?.job?.country_branch_id || scope.countryBranchId || null, cityBranchId: bundle?.job?.city_branch_id || scope.cityBranchId || null,
        review: state,
      });
      const r = res?.result ?? res;
      if (intent === "handoff") {
        try {
          sessionStorage.setItem(DRAFT_PREFILL_KEY, JSON.stringify({ targetModule: mod.target, draftId: r.draftId, draftNo: r.draftNo, payload: r.payload ?? {}, goodsEntries: r.goodsEntries ?? [], linkMode: "new_record" }));
        } catch { /* sessionStorage unavailable — the saved draft can still be continued from the module */ }
        router.push(mod.routeUrl as never);
        return;
      }
      setNotice(`${T("draft_saved", "Draft saved")} · ${r.draftNo}${r.updatedInPlace ? ` · ${T("updated_in_place", "existing draft updated, no duplicate created")}` : ""}`);
      await load(mod.id);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────────────────────────────────
  const blockers = useMemo(() => (mod && state ? handoffBlockers(mod, state) : []), [mod, state]);
  const missing = useMemo(() => (mod && state ? missingFields(mod, state) : []), [mod, state]);
  const fm = useMemo(() => fieldMap((bundle?.fields ?? []) as never), [bundle]);
  const extractedCount = useMemo(() => (bundle?.fields ?? []).filter((f) => String(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? "").trim() !== "").length, [bundle]);
  const pages = useMemo(() => [...new Set((bundle?.fields ?? []).map((f) => Number(f.page_number)).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b), [bundle]);
  const uncertain = useMemo(() => (bundle?.fields ?? []).filter((f) => f.validation_status === "amber" || f.validation_status === "red").map((f) => f.field_label || f.field_key), [bundle]);
  const mime = String(bundle?.job?.mime_type ?? "");
  const jobStatus = String(bundle?.job?.status ?? "");
  const processing = PROCESSING.includes(jobStatus) && !bundle?.job?.stalled;
  const stalled = Boolean(bundle?.job?.stalled);
  const noFields = !processing && (bundle?.fields?.length ?? 0) === 0;
  const extractionProblem = stalled || jobStatus === "error" || noFields;
  const progress = (bundle?.job?.progress ?? null) as { stage?: string; page?: number; pages?: number } | null;

  if (loading && !state) {
    return <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-16 text-slate-400 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!state || !mod || !bundle) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
        {error || T("job_load_failed", "Could not load this document — it may be outside your scope or no longer exist.")}
        <button type="button" onClick={onBack} className="ms-3 underline">{T("back", "Back")}</button>
      </div>
    );
  }

  const readOnly = posted;
  const fields1 = (k: string) => bundle?.fields?.find((x) => x.field_key === k) as { validation_status?: string; validation_message?: string } | undefined;
  const f = state.form;
  const miss = (k: string) => missing.includes(k);
  const notFound = T("not_found", "Not found — enter");
  const moduleLabel = s.t(mod.labelKey, mod.label);
  const partyWord = mod.party === "supplier" ? T("party_supplier", "Supplier") : T("party_customer", "Customer");
  const docRole = mod.party === "supplier" ? T("doc_seller", "Seller on the document") : T("doc_buyer", "Buyer on the document");

  const accountSelect = (role: AccountRole) => {
    const key = ROLE_STATE_KEY[role];
    const value = state.accounts[key];
    const all = ctx?.accountOptions ?? [];
    const pid = state.party.id;
    const linked = all.filter((a) => pid && a.linkedPartyIds.includes(pid));
    const rest = all.filter((a) => !linked.includes(a) && (showAllAccounts || accountFitsRole(role, a, pid)));
    const known = all.some((a) => a.id === value);
    const picked = all.find((a) => a.id === value);
    const linkedOk = Boolean(picked && pid && picked.linkedPartyIds.includes(pid));
    const required = mod.required.includes(role);
    const fmt = (a: AccountOption) => `${a.code} · ${a.name}${a.currency ? ` (${a.currency})` : ""}`;
    return (
      <div key={role}>
        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
          {T(ROLE_LABEL[role][0], ROLE_LABEL[role][1])}{required ? " *" : ""}
        </label>
        <select
          value={value}
          disabled={readOnly}
          onChange={(e) => set((p) => ({ ...p, accounts: { ...p.accounts, [key]: e.target.value } }))}
          className={inputCls(required && !value)}
          data-testid={`acct-${role}`}
        >
          <option value="">{T("select_account", "— Select account —")}</option>
          {value && !known && <option value={value}>{T("account_not_in_list", "(saved account — not in the current list)")} {value.slice(0, 8)}</option>}
          {linked.length > 0 && (
            <optgroup label={T("linked_to_party", "Linked to the selected party")}>
              {linked.map((a) => <option key={a.id} value={a.id}>{fmt(a)}</option>)}
            </optgroup>
          )}
          <optgroup label={T("other_accounts", "Other accounts in your scope")}>
            {rest.map((a) => <option key={a.id} value={a.id}>{fmt(a)}</option>)}
          </optgroup>
        </select>
        {required && !value && <p className="mt-1 text-[10.5px] font-semibold text-amber-700">{T("account_required", "Required before the entry can be opened.")}</p>}
        {picked && (
          <p className={`mt-1 text-[10.5px] font-semibold ${linkedOk || !pid ? "text-slate-500" : "text-amber-700"}`} data-testid={`acct-info-${role}`} dir="auto">
            {picked.code} · {picked.name}{picked.kind ? ` · ${picked.kind}` : ""}{picked.currency ? ` · ${picked.currency}` : ""}
            {pid && (role === "supplier" || role === "customer") ? (linkedOk ? ` — ${T("acct_linked", "linked to the selected party")}` : ` — ${T("acct_not_linked", "NOT linked to the selected party: check this is the party's own account, not a generic ledger")}`) : ""}
          </p>
        )}
      </div>
    );
  };

  const tabBtn = (id: TabId, label: string) => (
    <button
      key={id} type="button" onClick={() => setTab(id)} data-testid={`tab-${id}`}
      className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold transition-colors ${tab === id ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}
    >{label}</button>
  );

  const lbl = (text: string, extra?: React.ReactNode) => <label className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400"><span>{text}</span>{extra}</label>;
  const textField = (k: keyof ReviewForm, label: string, opts: { type?: string; dir?: "ltr"; area?: boolean } = {}) => (
    <div>
      {lbl(label)}
      {opts.area ? (
        <textarea value={f[k]} disabled={readOnly} onChange={(e) => setForm({ [k]: e.target.value } as Partial<ReviewForm>)} rows={3} className={inputCls()} placeholder={notFound} />
      ) : (
        <input type={opts.type ?? "text"} dir={opts.dir} value={f[k]} disabled={readOnly} onChange={(e) => setForm({ [k]: e.target.value } as Partial<ReviewForm>)} className={inputCls(!f[k])} placeholder={notFound} />
      )}
    </div>
  );

  // items
  const setItem = (i: number, patch: Partial<ReviewItem>) => set((p) => ({
    ...p,
    items: p.items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      if (("quantity" in patch || "unitPrice" in patch) && next.quantity != null && next.unitPrice != null) next.amount = lineAmount(next.quantity, next.unitPrice);
      return next;
    }),
  }));
  const itemsTotal = state.items.reduce((sum, it) => sum + (it.amount ?? (it.quantity != null && it.unitPrice != null ? it.quantity * it.unitPrice : 0)), 0);
  const totalNum = numOrNull(f.totalAmount);
  const totalMismatch = mod.financial && totalNum != null && state.items.length > 0 && itemsTotal > 0 && Math.abs(itemsTotal - totalNum) > Math.max(0.5, totalNum * 0.005);

  const ex = state.exchange;
  const needsRate = mod.financial && ex.originalCurrency && ex.finalCurrency && ex.originalCurrency !== ex.finalCurrency;
  const dirText = ex.direction === "multiply"
    ? `1 ${ex.originalCurrency || "—"} = ${ex.rate ?? "?"} ${ex.finalCurrency || "—"}`
    : `1 ${ex.finalCurrency || "—"} = ${ex.rate ?? "?"} ${ex.originalCurrency || "—"}`;

  const bank = ctx?.bank;
  const bankStatusLabel: Record<string, string> = {
    none_extracted: T("bank_none_extracted", "No bank details were found on the document."),
    party_has_no_banks: T("bank_party_none", "The selected party has no linked bank on file. Nothing will be created automatically."),
    matched: T("bank_matched", "Matches a bank already linked to the selected party."),
    changed: T("bank_changed", "Same bank, but details differ from the party's linked bank — review before use."),
    unmatched: T("bank_unmatched", "Does not match any bank linked to the selected party."),
  };

  return (
    <div className="space-y-3" dir={s.dir} data-testid="review-workspace">
      {/* ── heading + actions ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600">
              <ArrowLeft className="h-3 w-3 rtl:rotate-180" />{T("back", "Back")}
            </button>
            <h2 className="text-base font-black text-slate-900 dark:text-white" data-testid="review-heading">
              {T("review_heading", "Review document")} — {moduleLabel}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              <span className="font-mono font-bold text-blue-600" dir="ltr">{bundle.job.job_no}</span> · <span dir="ltr">{bundle.job.original_filename}</span> ·{" "}
              <span className="font-bold" data-testid="job-status">{{ uploaded: T("stl_uploaded", "Uploaded"), ocr: T("stl_ocr", "Reading document (OCR)"), classifying: T("stl_classifying", "Classifying"), extracting: T("stl_extracting", "Extracting fields"), matching: T("stl_matching", "Matching records"), review: T("stl_review", "Extracted — review required"), qvc: T("stl_qvc", "Needs verification"), draft_ready: T("stl_draft_ready", "Reviewed — draft prepared"), linked: T("stl_linked", "Entered in its module"), error: T("stl_error", "Processing failed") }[jobStatus] ?? jobStatus}</span> · <span data-testid="field-count">{extractedCount} {T("fields_extracted", "fields extracted")}</span>
              {missing.length > 0 && <> · <span className="text-amber-700">{missing.length} {T("fields_missing", "to complete")}</span></>}
              {bundle.draft?.draft_no && <> · {T("draft", "Draft")} <span className="font-mono font-bold" dir="ltr">{bundle.draft.draft_no}</span></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mod.id} disabled={busy || readOnly} onChange={(e) => void changeModule(e.target.value)} className={`${inputCls()} !w-auto`} aria-label={T("module_label", "Module")} data-testid="module-switch">
              {INTAKE_MODULE_GROUPS.map((g) => (
                <optgroup key={g.id} label={s.t(g.labelKey, g.label)}>
                  {INTAKE_MODULES.filter((m) => m.group === g.id).map((m) => <option key={m.id} value={m.id}>{s.t(m.labelKey, m.label)}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" disabled={busy || readOnly || processing} onClick={() => void save("draft")} data-testid="save-draft"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{T("save_draft", "Save draft")}
            </button>
            <button type="button" disabled={busy || readOnly || processing || (extractionProblem && !manualMode)} onClick={() => void save("handoff")} data-testid="open-entry"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50">
              <ExternalLink className="h-3.5 w-3.5" />{T("open_entry", "Open entry form")}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500"><Info className="me-1 inline h-3 w-3" />{T("saves_to", "Opens in")}: <b>{moduleLabel}</b> — {T("no_posting", "nothing is posted, paid or transferred from here.")}</p>
      </div>

      {/* ── banners ──────────────────────────────────────────────────────────────────────────── */}
      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30" role="alert" data-testid="review-error"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {notice && <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30" data-testid="review-notice"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}
      {processing && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200" data-testid="processing-banner">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{T("processing", "Reading the document — OCR and field extraction are running. This screen updates by itself.")}{progress?.pages ? ` (${T("page", "page")} ${progress.page ?? 0} / ${progress.pages})` : ""}</span>
        </div>
      )}
      {extractionProblem && !readOnly && (
        <div className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 dark:border-rose-900 dark:bg-rose-950/30" data-testid="extraction-problem">
          <p className="flex items-start gap-2 text-xs font-bold text-rose-800 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{stalled ? T("ep_stalled", "OCR stopped before it finished (the server was restarted or the request timed out). Nothing was extracted.") : jobStatus === "error" ? `${T("ep_error", "OCR failed")}: ${bundle?.job?.error ?? ""}` : T("ep_none", "OCR finished but no fields could be extracted. The form below is EMPTY — it is not an extracted result.")}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void retryOcr()} data-testid="retry-ocr" className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-50">{T("retry_ocr", "Retry OCR")}</button>
            <button type="button" onClick={() => setOcrOpen(true)} data-testid="review-ocr" className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">{T("review_ocr", "Review OCR text")}</button>
            <button type="button" onClick={() => setManualMode(true)} data-testid="manual-entry" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">{T("manual_entry", "Manual data entry")}</button>
            <button type="button" disabled={busy} onClick={() => void reportProblem()} data-testid="report-problem" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{T("report_problem", "Report extraction problem")}</button>
          </div>
          {manualMode && <p className="text-[11px] font-semibold text-slate-600">{T("manual_on", "Manual entry is on: type the values from the original document. Nothing here was extracted.")}</p>}
        </div>
      )}
      {ocrOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" role="dialog" aria-modal="true" onClick={() => setOcrOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-3 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-black">{T("review_ocr", "Review OCR text")}</p><button type="button" onClick={() => setOcrOpen(false)} className="text-xs font-bold text-slate-500">{T("close", "Close")}</button></div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-100" dir="auto" data-testid="ocr-text">{bundle?.job?.ocr_text || T("ocr_empty", "OCR returned no text for this document.")}</pre>
          </div>
        </div>
      )}
      {posted && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" data-testid="posted-banner">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{T("posted_banner", "This document has already been entered into its module. It is read-only here — corrections follow that module's authorised correction flow.")}</span>
        </div>
      )}
      {ctx?.sideWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30" data-testid="side-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{T("side_warning", "The matched counter-party looks like OUR OWN company. Check that the module matches your side of this deal (a supplier's Sales Contract is a Purchase for us).")}</span>
        </div>
      )}
      {(ctx?.duplicates?.length ?? 0) > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30" data-testid="duplicate-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{T("duplicate_warning", "Possible duplicate:")}{" "}
            {ctx!.duplicates.map((d) => `${d.jobNo} (${d.reason === "same_file" ? T("dup_same_file", "same file") : T("dup_same_contract", "same contract no.")}, ${d.status})`).join(" · ")}
          </span>
        </div>
      )}
      {(missing.length > 0 || uncertain.length > 0 || state.items.some((i) => i.quantity != null && i.unitPrice != null && i.amount != null && Math.abs(i.quantity * i.unitPrice - i.amount) > 0.5) || totalMismatch) && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-900" data-testid="attention-list">
          <p className="mb-1 font-black uppercase tracking-wide text-slate-500">{T("needs_attention", "Needs your attention")}</p>
          <ul className="space-y-0.5">
            {missing.map((k) => <li key={k} className="text-amber-700">• {T("missing", "Missing")}: {T("f_" + k, k)}</li>)}
            {uncertain.slice(0, 6).map((u) => <li key={u} className="text-amber-700">• {T("uncertain", "Uncertain")}: {u}</li>)}
            {totalMismatch && <li className="text-rose-700">• {T("conflict_total", "Conflicting: the total differs from the sum of the item lines")} ({itemsTotal.toLocaleString()} ≠ {totalNum?.toLocaleString()})</li>}
          </ul>
        </div>
      )}

      {/* ── document + form ──────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
        {/* original document */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-16 lg:self-start">
          <div className="flex items-center justify-between px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-blue-600" />{T("original_doc", "Original document")}</span>
            {pages.length > 0 && (
              <span className="flex flex-wrap items-center gap-1 text-[10.5px] font-normal">
                <span className="font-bold text-slate-500">{T("source_pages", "Source pages")}:</span>
                {pages.map((p) => <button key={p} type="button" onClick={() => setPage(p)} className={`rounded-full px-2 py-0.5 font-bold ${page === p ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}>{p}</button>)}
              </span>
            )}
          </div>
          <IntakeDocumentViewer jobId={jobId} mime={mime} pageCount={bundle.job.page_count ?? null} page={page} onPageChange={setPage} T={T} />
        </div>

        {/* editable form */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-800">
            {tabBtn("basic", T("tab_basic", "Basic Information"))}
            {tabBtn("items", T("tab_items", "Items"))}
            {tabBtn("payment", mod.financial ? T("tab_payment", "Payment & Delivery") : T("tab_delivery", "Delivery & Transport"))}
            {tabBtn("notes", T("tab_notes", "Notes"))}
            {tabBtn("fields", `${T("tab_fields", "Extracted Fields")} (${bundle.fields.length})`)}
            {tabBtn("checks", T("tab_checks", "Verification Checks"))}
          </div>

          <fieldset disabled={readOnly} className="space-y-3 p-3">
            {tab === "basic" && (
              <div className="space-y-3" data-testid="panel-basic">
                {mod.party && (
                  <div className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                    {lbl(`${partyWord} *`, <span className="font-normal text-slate-400">{docRole}</span>)}
                    <p className="mb-1.5 text-xs font-black text-slate-800 dark:text-slate-100" dir="auto" data-testid="doc-party-name">{ctx?.documentPartyName || <span className="text-amber-700">{notFound}</span>}</p>
                    <select value={state.party.id ?? ""} onChange={(e) => void pickParty(e.target.value)} className={inputCls(!state.party.id)} data-testid="party-select">
                      <option value="">{ctx?.partyStatus === "ambiguous" ? T("party_choose", "— Several possible matches: choose the correct one —") : T("party_none", "— No matching record: select one —")}</option>
                      {(ctx?.candidates ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` [${c.code}]` : ""} · {c.kind === "company" ? T("kind_company", "Company") : T("kind_customer", "Customer")}{c.score ? ` · ${Math.round(c.score * 100)}%` : ""}</option>)}
                    </select>
                    {state.party.id && <p className="mt-1 text-[11px] font-black text-slate-700 dark:text-slate-200" dir="auto" data-testid="party-chosen">{state.party.name}{(ctx?.candidates.find((c) => c.id === state.party.id)?.code) ? ` · ${T("party_code", "Code")} ${ctx?.candidates.find((c) => c.id === state.party.id)?.code}` : ""}</p>}
                    <p className={`mt-1 text-[10.5px] font-semibold ${state.party.id ? "text-emerald-700" : "text-amber-700"}`}>
                      {state.party.id ? T("party_matched", "Matched to an existing authorised record.") : ctx?.partyStatus === "ambiguous" ? T("party_ambiguous", "More than one record could match — please choose.") : T("party_not_found", "No existing authorised record matched. Nothing will be created automatically.")}
                    </p>
                    {ctx?.documentOwnName && <p className="mt-1 text-[10.5px] text-slate-500">{T("our_side", "Other party on the document (our side)")}: <b dir="auto">{ctx.documentOwnName}</b></p>}
                  </div>
                )}

                {mod.roles.length > 0 && (
                  <div className="space-y-2.5 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                    {mod.roles.filter((r) => r !== "bank").map((r) => accountSelect(r))}
                    <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
                      <input type="checkbox" checked={showAllAccounts} onChange={(e) => setShowAllAccounts(e.target.checked)} />
                      {T("show_all_accounts", "Show every account in my scope (not only the usual kind)")}
                    </label>
                  </div>
                )}

                {mod.financial && (
                  <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-2 dark:border-slate-800" data-testid="currency-block">
                    <div>
                      {lbl(T("f_currency", "Purchase currency") + " *")}
                      <select value={f.currency} onChange={(e) => setForm({ currency: e.target.value })} className={inputCls(!f.currency)} data-testid="f-currency">
                        <option value="">{T("currency_pick", "— Select the purchase currency —")}</option>
                        {[...new Set([...(f.currency ? [f.currency] : []), ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {ctx && ctx.rate.fromCurrency && f.currency && ctx.rate.fromCurrency !== f.currency && <p className="mt-1 text-[10.5px] font-semibold text-amber-700">{T("currency_differs", "The document states")} {ctx.rate.fromCurrency}.</p>}
                      {(fields1("currency")?.validation_status === "amber") && <p className="mt-1 text-[10.5px] font-semibold text-amber-700">{fields1("currency")?.validation_message}</p>}
                    </div>
                    <div>
                      {lbl(T("f_totalAmount", "Original purchase amount") + " *", fm.grand_total ? <span className="font-normal text-slate-400">{T("as_extracted", "as extracted")}: {fm.grand_total}</span> : null)}
                      <input dir="ltr" inputMode="decimal" value={f.totalAmount} onChange={(e) => setForm({ totalAmount: e.target.value })} className={inputCls(!f.totalAmount)} placeholder={notFound} data-testid="f-total" />
                      <p className="mt-0.5 text-[10px] text-slate-400">{T("original_kept", "Kept as written on the document. Only the converted amount is used for the final posting, after you confirm it.")}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    {lbl(T("f_contractNo", "Original contract / document no."))}
                    <input dir="ltr" value={f.contractNo} onChange={(e) => setForm({ contractNo: e.target.value })} className={inputCls(!f.contractNo)} placeholder={notFound} data-testid="f-contract" />
                  </div>
                  <div>
                    {lbl(T("erp_reference", "ERP reference"))}
                    <input dir="ltr" value={bundle.draft?.draft_no ?? bundle.job.job_no} readOnly className={`${inputCls()} bg-slate-50 text-slate-500`} />
                    <p className="mt-0.5 text-[10px] text-slate-400">{T("erp_reference_hint", "System reference — kept separate from the contract number.")}</p>
                  </div>
                  <div>
                    {lbl(T("f_documentDate", "Document date"))}
                    <input type="date" value={f.documentDate} onChange={(e) => setForm({ documentDate: e.target.value })} className={inputCls(!f.documentDate)} data-testid="f-date" />
                  </div>
                  {textField("goodsDescription", T("f_goods", "Goods description"))}
                  {textField("hsCode", T("f_hs", "HS code"), { dir: "ltr" })}
                </div>
              </div>
            )}

            {tab === "items" && (
              <div className="space-y-2" data-testid="panel-items">
                {state.items.length === 0 && <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">{T("no_items", "No item lines were found. Add them below.")}</p>}
                {state.items.map((it, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800" data-testid={`item-${i}`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-500">#{i + 1}{it.sourcePage ? ` · ${T("page", "page")} ${it.sourcePage}` : ""}</span>
                      <button type="button" onClick={() => set((p) => ({ ...p, items: p.items.filter((_, x) => x !== i) }))} className="text-rose-500 hover:text-rose-700" aria-label={T("remove", "Remove")}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-3"><input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder={T("f_goods", "Goods description")} className={inputCls(!it.description)} /></div>
                      <input dir="ltr" value={it.hsCode} onChange={(e) => setItem(i, { hsCode: e.target.value })} placeholder={T("f_hs", "HS code")} className={inputCls()} />
                      <input dir="ltr" inputMode="decimal" value={it.quantity ?? ""} onChange={(e) => setItem(i, { quantity: numOrNull(e.target.value) })} placeholder={T("f_qty", "Quantity")} className={inputCls(it.quantity == null)} data-testid={`item-${i}-qty`} />
                      <input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder={T("f_unit", "Unit")} className={inputCls()} />
                      {mod.financial && (
                        <>
                          <input dir="ltr" inputMode="decimal" value={it.unitPrice ?? ""} onChange={(e) => setItem(i, { unitPrice: numOrNull(e.target.value) })} placeholder={T("f_unitPrice", "Unit price")} className={inputCls(it.unitPrice == null)} data-testid={`item-${i}-price`} />
                          <input dir="ltr" inputMode="decimal" value={it.amount ?? ""} onChange={(e) => setItem(i, { amount: numOrNull(e.target.value) })} placeholder={T("f_amount", "Amount")} className={inputCls(it.amount == null)} data-testid={`item-${i}-amount`} />
                        </>
                      )}
                      <input dir="ltr" inputMode="decimal" value={it.grossWeight ?? ""} onChange={(e) => setItem(i, { grossWeight: numOrNull(e.target.value) })} placeholder={T("f_gross", "Gross weight")} className={inputCls()} />
                      <input dir="ltr" inputMode="decimal" value={it.tareWeight ?? ""} onChange={(e) => setItem(i, { tareWeight: numOrNull(e.target.value) })} placeholder={T("f_tare", "Tare weight")} className={inputCls()} />
                      <input dir="ltr" inputMode="decimal" value={it.netWeight ?? ""} onChange={(e) => setItem(i, { netWeight: numOrNull(e.target.value) })} placeholder={T("f_net", "Net weight")} className={inputCls()} />
                    </div>
                    {mod.financial && it.quantity != null && it.unitPrice != null && it.amount != null && Math.abs(it.quantity * it.unitPrice - it.amount) > 0.5 && (
                      <p className="mt-1 text-[10.5px] font-semibold text-rose-700">{T("line_mismatch", "Quantity × unit price does not equal this amount")} ({(it.quantity * it.unitPrice).toLocaleString()}).</p>
                    )}
                    {it.grossWeight != null && it.tareWeight != null && it.netWeight != null && Math.abs(it.grossWeight - it.tareWeight - it.netWeight) > 0.01 && (
                      <p className="mt-1 text-[10.5px] font-semibold text-rose-700">{T("weight_mismatch", "Gross − tare does not equal net weight")} ({(it.grossWeight - it.tareWeight).toLocaleString()}).</p>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => set((p) => ({ ...p, items: [...p.items, { description: "", hsCode: "", quantity: null, unit: "", unitPrice: null, amount: null, grossWeight: null, tareWeight: null, netWeight: null, lotNo: "", variety: "", quality: "", sourcePage: null }] }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600"><Plus className="h-3.5 w-3.5" />{T("add_item", "Add item")}</button>
                {mod.financial && state.items.length > 0 && (
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200" dir="ltr">{T("items_total", "Items total")}: {itemsTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {f.currency}</p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {textField("lotNo", T("f_lot", "Lot no."))}
                  {textField("variety", T("f_variety", "Variety / grade"))}
                  {textField("quality", T("f_quality", "Quality"))}
                </div>
              </div>
            )}

            {tab === "payment" && (
              <div className="space-y-3" data-testid="panel-payment">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {mod.financial && textField("paymentTerms", T("f_payment", "Payment terms"))}
                  {textField("deliveryTerms", T("f_delivery", "Delivery terms"))}
                  {textField("incoterm", T("f_incoterm", "Incoterm"), { dir: "ltr" })}
                  {textField("deliveryPlace", T("f_place", "Delivery place"))}
                  {textField("packing", T("f_packing", "Packing"))}
                </div>

                <div className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800" data-testid="transport-panel">
                  {lbl(T("shipment_mode", "Shipment mode"))}
                  <select value={f.shipmentMode} onChange={(e) => setForm({ shipmentMode: e.target.value as ReviewForm["shipmentMode"] })} className={inputCls()} data-testid="shipment-mode">
                    <option value="">{T("mode_unspecified", "Not stated in this document")}</option>
                    <option value="sea">{T("mode_sea", "By Sea")}</option>
                    <option value="road">{T("mode_road", "By Road")}</option>
                    <option value="air">{T("mode_air", "By Air")}</option>
                    <option value="train">{T("mode_train", "By Train")}</option>
                  </select>
                  {f.shipmentMode === "" && <p className="mt-1.5 text-[11px] font-semibold text-slate-500" data-testid="transport-na">{T("transport_na", "Not applicable / not provided in this document. BL, container, truck, AWB and rail references are not required to save a Purchase Booking.")}</p>}
                  <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {f.shipmentMode === "sea" && (<>
                      {textField("blNo", T("f_bl", "B/L no.") + " (" + T("bl_hint", "only if a Bill of Lading exists") + ")", { dir: "ltr" })}
                      {textField("containerNos", T("f_containers", "Container no(s).") + " (" + T("container_hint", "only if containerized") + ")", { dir: "ltr" })}
                    </>)}
                    {f.shipmentMode === "road" && textField("truckNo", T("f_truck", "Truck / vehicle no."), { dir: "ltr" })}
                    {f.shipmentMode === "air" && textField("awbNo", T("f_awb", "AWB no."), { dir: "ltr" })}
                    {f.shipmentMode === "train" && textField("railRef", T("f_rail", "Rail consignment / wagon ref."), { dir: "ltr" })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">{T("transport_not_bill", "These references are separate from the purchase bill no., the contract no. and the ERP entry no.")}</p>
                </div>

                {mod.financial && (
                  <div className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800" data-testid="exchange-panel">
                    <p className="mb-2 text-xs font-black text-slate-700 dark:text-slate-200">{T("fx_title", "Exchange rate review")}</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        {lbl(T("fx_original", "Original amount"))}
                        <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-800 dark:bg-slate-800 dark:text-slate-100" dir="ltr" data-testid="fx-original">{ex.originalAmount != null ? ex.originalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {ex.originalCurrency}</p>
                      </div>
                      <div>
                        {lbl(T("fx_final_currency", "Final / base currency"))}
                        <select value={ex.finalCurrency} onChange={(e) => void changeFinalCurrency(e.target.value)} className={inputCls(!ex.finalCurrency)} data-testid="fx-final-currency">
                          <option value="">—</option>
                          {[...new Set([...(ex.finalCurrency ? [ex.finalCurrency] : []), ...(ex.originalCurrency ? [ex.originalCurrency] : []), ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {needsRate && (
                        <>
                          <div>
                            {lbl(T("fx_rate", "Exchange rate"))}
                            <input dir="ltr" inputMode="decimal" value={ex.rate ?? ""} data-testid="fx-rate"
                              onChange={(e) => set((p) => ({ ...p, exchange: recomputeExchange({ ...p.exchange, rate: numOrNull(e.target.value), rateSource: "manual", confirmed: false }) }))}
                              className={inputCls(ex.rate == null)} placeholder="0.0000" />
                          </div>
                          <div>
                            {lbl(T("fx_rate_date", "Rate date"))}
                            <input type="date" value={ex.rateDate ?? ""} onChange={(e) => set((p) => ({ ...p, exchange: { ...p.exchange, rateDate: e.target.value || null, confirmed: false } }))} className={inputCls()} />
                          </div>
                          <div className="col-span-2">
                            {lbl(T("fx_direction", "Conversion direction"))}
                            <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                              {(["multiply", "divide"] as RateDirection[]).map((d) => (
                                <label key={d} className="inline-flex items-center gap-1.5">
                                  <input type="radio" name="fxdir" checked={ex.direction === d} onChange={() => set((p) => ({ ...p, exchange: recomputeExchange({ ...p.exchange, direction: d, confirmed: false }) }))} />
                                  <span dir="ltr">{d === "multiply" ? `1 ${ex.originalCurrency} = rate × ${ex.finalCurrency}` : `1 ${ex.finalCurrency} = rate × ${ex.originalCurrency}`}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900 dark:bg-blue-950/30 dark:text-blue-100" dir="ltr" data-testid="fx-result">
                            {dirText} → {ex.originalAmount != null ? ex.originalAmount.toLocaleString() : "—"} {ex.originalCurrency} = <span className="font-black">{ex.finalAmount != null ? ex.finalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {ex.finalCurrency}</span>
                          </div>
                          <p className="col-span-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300" dir="ltr" data-testid="fx-formula">
                            {T("fx_formula", "Calculation")}: {ex.originalAmount != null ? ex.originalAmount.toLocaleString() : "—"} {ex.direction === "multiply" ? "×" : "÷"} {ex.rate ?? "?"} = {ex.finalAmount != null ? ex.finalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} {ex.finalCurrency}
                          </p>
                          {ex.rateSource !== "master" && (
                            <p className="col-span-2 flex items-start gap-1 text-[10.5px] font-semibold text-amber-700" data-testid="fx-unverified">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{ex.rate == null ? T("fx_no_rate", "No verified rate was found in the Exchange Rates master for this pair. Enter the rate you want to use.") : T("fx_manual", "This rate was typed in manually — it is not from the Exchange Rates master.")}
                            </p>
                          )}
                          <label className="col-span-2 flex items-start gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                            <input type="checkbox" checked={ex.confirmed} disabled={ex.rate == null} onChange={(e) => set((p) => ({ ...p, exchange: { ...p.exchange, confirmed: e.target.checked } }))} data-testid="fx-confirm" />
                            <span>{T("fx_confirm", "I confirm this rate and conversion. The original amount is kept and converted once; nothing is posted or paid.")}</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {(mod.financial || mod.side === "purchase" || mod.side === "sales") && (
                  <div className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-800" data-testid="bank-panel">
                    <p className="mb-1.5 text-xs font-black text-slate-700 dark:text-slate-200">{T("bank_title", "Bank details on the document")}</p>
                    {bank ? (
                      <>
                        <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2">
                          {([["bank_beneficiary", "Beneficiary", bank.extracted.beneficiary], ["bank_name", "Bank", bank.extracted.bankName], ["bank_account", "Account no.", bank.extracted.accountNo], ["bank_iban", "IBAN", bank.extracted.iban], ["bank_swift", "SWIFT / BIC", bank.extracted.swift]] as const).map(([k, fb, v]) => (
                            <div key={k}><dt className="text-[10px] font-bold uppercase text-slate-400">{T(k, fb)}</dt><dd className="font-semibold text-slate-800 dark:text-slate-100" dir="ltr">{v || <span className="text-amber-700">{T("not_found_short", "Not found")}</span>}</dd></div>
                          ))}
                        </dl>
                        <p className={`mt-2 text-[11px] font-bold ${bank.status === "matched" ? "text-emerald-700" : bank.status === "none_extracted" ? "text-slate-500" : "text-amber-700"}`} data-testid="bank-status">{bankStatusLabel[bank.status]}</p>
                        {bank.status === "changed" && bank.differences.length > 0 && (
                          <ul className="mt-1 list-disc ps-4 text-[10.5px] text-amber-800">{bank.differences.map((d) => <li key={d.field} dir="ltr">{d.field}: {d.extracted} ≠ {d.existing}</li>)}</ul>
                        )}
                        {bank.status !== "none_extracted" && (
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold">
                            {(["use_matched", "keep_extracted", "ignore"] as const).map((d) => (
                              <label key={d} className={`inline-flex items-center gap-1.5 ${d === "use_matched" && !bank.bankId ? "opacity-40" : ""}`}>
                                <input type="radio" name="bankdec" disabled={d === "use_matched" && !bank.bankId} checked={state.bank.decision === d} onChange={() => set((p) => ({ ...p, bank: { decision: d, bankId: d === "use_matched" ? bank.bankId : null } }))} />
                                {d === "use_matched" ? T("bank_use_matched", "Use the linked bank") : d === "keep_extracted" ? T("bank_keep", "Keep as a note for review") : T("bank_ignore", "Ignore")}
                              </label>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-[10px] text-slate-400">{T("bank_no_create", "No bank, account or ledger is ever created from this screen.")}</p>
                      </>
                    ) : <p className="text-[11px] text-slate-400">{T("ctx_unavailable", "Matching details are not available right now.")}</p>}
                  </div>
                )}
              </div>
            )}

            {tab === "notes" && (
              <div className="space-y-3" data-testid="panel-notes">
                {textField("notes", T("f_notes", "Notes"), { area: true })}
                <button type="button" onClick={() => setOcrOpen(true)} className="text-[11px] font-bold text-blue-600 underline" data-testid="open-ocr">{T("review_ocr", "Review OCR text")}</button>
              </div>
            )}

            {tab === "fields" && (
              <div className="space-y-2" data-testid="panel-fields">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{T("extracted_fields", "Extracted fields")} ({bundle.fields.length})</p>
                {bundle.fields.length === 0 ? <p className="rounded-lg border border-dashed border-rose-300 bg-rose-50 p-3 text-center text-xs font-semibold text-rose-700">{T("no_fields", "No fields were extracted from this document.")}</p> : (
                  <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-400 dark:bg-slate-800"><tr><Th className="p-1.5 text-start">{T("col_field", "Field")}</Th><Th className="p-1.5 text-start">{T("col_value", "Value")}</Th><Th className="p-1.5">{T("col_page", "Page")}</Th><Th className="p-1.5">%</Th></tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bundle.fields.map((fld) => (
                          <tr key={fld.field_key}>
                            <td className="p-1.5 font-semibold text-slate-600 dark:text-slate-300">{fld.field_label || fld.field_key}</td>
                            <td className="p-1.5 font-mono text-slate-800 dark:text-slate-100" dir="auto">{fld.corrected_value ?? fld.normalized_value ?? fld.raw_value}</td>
                            <td className="p-1.5 text-center">{fld.page_number ? <button type="button" onClick={() => setPage(Number(fld.page_number))} className="font-bold text-blue-600 underline">{fld.page_number}</button> : "—"}</td>
                            <td className={`p-1.5 text-center font-bold ${fld.validation_status === "green" ? "text-emerald-600" : fld.validation_status === "red" ? "text-rose-600" : "text-amber-600"}`}>{fld.confidence != null ? Math.round(Number(fld.confidence) * 100) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "checks" && (
              <div data-testid="panel-checks"><VerificationChecksPanel jobId={jobId} lang={s.lang} /></div>
            )}
          </fieldset>

          {blockers.length > 0 && !readOnly && (
            <div className="border-t border-slate-100 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:border-slate-800" data-testid="handoff-blockers">
              {T("before_open", "Before the entry form can be opened")}: {blockers.map((b) => b.startsWith("account:") ? T(ROLE_LABEL[b.split(":")[1] as AccountRole][0], ROLE_LABEL[b.split(":")[1] as AccountRole][1]) : b === "party" ? partyWord : b === "currency" ? T("f_currency", "Purchase currency") : b === "amount" ? T("f_totalAmount", "Original purchase amount") : b === "rate" ? T("fx_rate", "Exchange rate") : b === "rate_unconfirmed" ? T("fx_confirm_short", "Confirm the exchange rate") : b).join(" · ")}
            </div>
          )}
        </div>
      </div>
      {dirty && !readOnly && <p className="text-center text-[11px] font-semibold text-slate-500">{T("unsaved", "You have unsaved changes — use Save draft to keep them.")}</p>}
    </div>
  );
}
