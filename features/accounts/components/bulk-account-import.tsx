"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, Pencil, Trash2, X, MoreVertical, Eye, Check, SlidersHorizontal, CheckSquare, Square, Building2, Globe, MapPin, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";

type Status = "idle" | "extracting" | "reviewing" | "confirming" | "complete" | "error";
type RowStatus = "valid" | "duplicate" | "invalid";
type Kind = "asset" | "liability" | "equity" | "income" | "expense";

interface Row {
  rowIndex: number;
  account_code: string | null;
  account_name: string | null;
  category: string | null;
  kind: Kind | null;
  branch: string | null;
  company_name: string | null;
  business_name: string | null;
  city: string | null;
  address: string | null;
  mobile: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  status: RowStatus;
  message: string | null;
  uncertainFields: string[];
  _selected: boolean;
}

interface BranchOpt { id: string; name?: string; code?: string; city_name?: string; cityName?: string; branch_name?: string }

export interface BulkAccountImportProps {
  onComplete?: (createdCount: number) => void;
  lang?: SupportedLanguage;
  onBackToTable?: () => void;
  externalScope?: {
    scopeLevel: "super_admin" | "country" | "main_branch" | "city_branch";
    countryId: string;
    branchKind: "main" | "city";
    branchId: string;
  };
  onScopeChange?: (scope: {
    scopeLevel: "super_admin" | "country" | "main_branch" | "city_branch";
    countryId: string;
    branchKind: "main" | "city";
    branchId: string;
  }) => void;
}

export function BulkAccountImport({
  onComplete,
  lang: initialLang,
  onBackToTable,
  externalScope,
  onScopeChange,
}: BulkAccountImportProps) {
  const s = useErpScreen("acctimp", initialLang);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [serverCounts, setServerCounts] = useState<{ total: number; valid: number; duplicate: number; invalid: number } | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  // scope
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [scopeLevel, setScopeLevel] = useState<"super_admin" | "country" | "main_branch" | "city_branch">(
    externalScope?.scopeLevel || "city_branch"
  );
  const [countryId, setCountryId] = useState(externalScope?.countryId || "");
  const [branchKind, setBranchKind] = useState<"main" | "city">(externalScope?.branchKind || "city");
  const [branchId, setBranchId] = useState(externalScope?.branchId || "");
  const [mainBranches, setMainBranches] = useState<BranchOpt[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchOpt[]>([]);

  // Sync with external scope when provided
  useEffect(() => {
    if (externalScope) {
      if (externalScope.scopeLevel && externalScope.scopeLevel !== scopeLevel) setScopeLevel(externalScope.scopeLevel);
      if (externalScope.countryId !== undefined && externalScope.countryId !== countryId) setCountryId(externalScope.countryId);
      if (externalScope.branchKind && externalScope.branchKind !== branchKind) setBranchKind(externalScope.branchKind);
      if (externalScope.branchId !== undefined && externalScope.branchId !== branchId) setBranchId(externalScope.branchId);
    }
  }, [externalScope]);

  const [editing, setEditing] = useState<number | null>(null);
  const [viewingRow, setViewingRow] = useState<Row | null>(null);
  const [openMenuRow, setOpenMenuRow] = useState<number | null>(null);
  const [batchCategory, setBatchCategory] = useState<string>("");

  function toggleRowSelected(idx: number) {
    setRows((prev) => prev.map((r) => r.rowIndex === idx ? { ...r, _selected: !r._selected } : r));
  }

  function handleBatchSetCategory(cat: Kind) {
    if (!cat) return;
    const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
    setRows((prev) => prev.map((r) => {
      if (!r._selected) return r;
      const merged = { ...r, kind: cat, category: catLabel };
      const missing: string[] = [];
      if (!merged.account_name) missing.push("name");
      if (merged.status !== "duplicate") merged.status = missing.length ? "invalid" : "valid";
      merged.message = missing.length ? s.t("needs_review", "Needs review: missing {f}").replace("{f}", missing.join(", ")) : null;
      return merged;
    }));
  }

  function handleAutoValidateAll() {
    setRows((prev) => prev.map((r) => {
      if (r.status === "duplicate") return r;
      const kind = r.kind || "asset";
      const cat = r.category || "Asset";
      const name = r.account_name || (r.account_code ? `Account ${r.account_code}` : `Account #${r.rowIndex}`);
      return {
        ...r,
        account_name: name,
        kind,
        category: cat,
        status: "valid",
        message: null,
        _selected: true
      };
    }));
  }

  useEffect(() => {
    listCountries().then(setCountries).catch(() => setError(s.t("err_countries", "Could not load countries.")));
  }, [s]);

  useEffect(() => {
    if (!countryId) { setMainBranches([]); setCityBranches([]); return; }
    let cancelled = false;
    fetch(`/api/erp/locations/branches/main?countryId=${encodeURIComponent(countryId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          const list = j?.data?.branches || j?.branches || j?.countryBranches || [];
          setMainBranches(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});
    fetch(`/api/erp/locations/branches/city?countryId=${encodeURIComponent(countryId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          const list = j?.data?.cityBranches || j?.data?.branches || j?.cityBranches || [];
          setCityBranches(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [countryId]);

  // Auto-select first branch if none selected
  useEffect(() => {
    const list = branchKind === "main" ? mainBranches : cityBranches;
    if (list.length > 0 && (!branchId || !list.some((b) => b.id === branchId))) {
      const nextId = list[0].id;
      setBranchId(nextId);
      onScopeChange?.({ scopeLevel, countryId, branchKind, branchId: nextId });
    }
  }, [branchKind, mainBranches, cityBranches, branchId, countryId, scopeLevel, onScopeChange]);

  const scopeReady = useMemo(() => {
    if (scopeLevel === "super_admin") return true;
    if (scopeLevel === "country") return !!countryId;
    return !!countryId && !!branchId;
  }, [scopeLevel, countryId, branchId]);

  const counts = useMemo(() => {
    const selected = rows.filter((r) => r._selected && r.status !== "duplicate");
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === "valid").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
      selected: selected.length,
    };
  }, [rows]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setWarnings([]);
    setStatus("extracting");
    setFileName(file.name);

    // Client-side file size check (100MB limit)
    const MAX_MB = 100;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        s.t(
          "err_file_size",
          `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the ${MAX_MB} MB limit. Please upload a smaller file or export as CSV.`
        )
      );
      setStatus("error");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetModule", "account_master");
      if (countryId) fd.append("countryId", countryId);
      if (branchKind === "main" && branchId) fd.append("countryBranchId", branchId);
      if (branchKind === "city" && branchId) fd.append("cityBranchId", branchId);

      const res = await fetch("/api/erp/document-intelligence/extract", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text().catch(() => "");
        if (res.status === 413) {
          throw new Error(s.t("err_413", "The file is too large for the server. Please export as CSV / Excel or use a smaller PDF."));
        }
        if (res.status === 401 || res.status === 403 || text.includes("/auth/login")) {
          throw new Error(s.t("err_auth", "Your session has expired. Please refresh the page and log in again."));
        }
        if (res.status === 504 || res.status === 502) {
          throw new Error(s.t("err_timeout", "Document processing timed out on the server. For large datasets, please export as CSV / Excel."));
        }
        throw new Error(s.t("err_extract", "Server returned an unexpected response. Please try again or use a CSV file."));
      }

      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || json?.error || s.t("err_extract", "Could not extract accounts from the document."));
      }
      const data = json.data ?? json;
      const extracted: Row[] = (data.extracted || []).map((r: any) => ({
        ...r,
        _selected: r.status !== "duplicate",
      }));
      setRows(extracted);
      setServerCounts(data.counts ?? null);
      setWarnings(data.warnings ?? []);
      setStatus("reviewing");
      if (extracted.length === 0) {
        setError(s.t("err_none", "No account rows were found in this document. Check the file is a chart-of-accounts table."));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => {
      if (r.rowIndex !== idx) return r;
      const merged = { ...r, ...patch };
      // re-validate
      const missing: string[] = [];
      if (!merged.account_name) missing.push("name");
      if (!merged.kind && !merged.category) missing.push("category");
      if (merged.status !== "duplicate") merged.status = missing.length ? "invalid" : "valid";
      merged.message = missing.length ? s.t("needs_review", "Needs review: missing {f}").replace("{f}", missing.join(", ")) : null;
      return merged;
    }));
  }

  async function handleConfirm() {
    const toCreate = rows.filter((r) => r._selected && r.status === "valid");
    if (toCreate.length === 0) return;
    setStatus("confirming");
    setError(null);
    try {
      const res = await fetch("/api/erp/accounting/accounts/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          scope: scopeLevel,
          countryId: scopeLevel === "super_admin" ? null : countryId || null,
          countryBranchId: branchKind === "main" && scopeLevel !== "super_admin" && scopeLevel !== "country" ? branchId || null : null,
          cityBranchId: branchKind === "city" && scopeLevel === "city_branch" ? branchId || null : null,
          accounts: toCreate.map((r) => ({
            code: r.account_code || `AUTO-${r.rowIndex}`,
            name: r.account_name,
            kind: r.kind || "asset",
            currency: r.currency || "USD",
          })),
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        throw new Error(s.t("err_create", "Could not create accounts due to unexpected server response."));
      }
      if (!res.ok || json?.error) throw new Error(json?.error?.message || json?.error || s.t("err_create", "Could not create accounts."));
      const data = json.data ?? json;
      setResult({ created: data.createdCount ?? 0, skipped: data.skippedCount ?? 0, failed: data.failedCount ?? 0 });
      setStatus("complete");
      onComplete?.(data.createdCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const dir = s.dir;

  if (status === "complete" && result) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" dir={dir}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                {s.t("done_title", "Import complete")}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-200">
                {s.t("done_created", "{n} account(s) created").replace("{n}", String(result.created))}
                {result.skipped > 0 && ` · ${s.t("done_skipped", "{n} skipped (already existed)").replace("{n}", String(result.skipped))}`}
                {result.failed > 0 && ` · ${s.t("done_failed", "{n} failed").replace("{n}", String(result.failed))}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir={dir}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {s.t("title", "Bulk Account Import — Scan / Upload Document")}
        </CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {s.t("intro", "Upload one PDF, Excel or CSV containing many accounts. The AI extracts every row for your review. Nothing is created until you confirm.")}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step 1 — scope */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
              {s.t("step1", "1. Target Account Scope Destination")}
            </p>
            <span className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400">
              {s.t("sync_header_hint", "Also selectable in the top action bar ↗")}
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold">
              {s.t("scope_level", "Scope")}
              <select
                value={scopeLevel}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setScopeLevel(val);
                  const nextKind = val === "main_branch" ? "main" : "city";
                  setBranchKind(nextKind);
                  setBranchId("");
                  onScopeChange?.({ scopeLevel: val, countryId, branchKind: nextKind, branchId: "" });
                }}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 cursor-pointer shadow-2xs"
              >
                <option value="super_admin">{s.t("scope_super", "Global (Super Admin)")}</option>
                <option value="country">{s.t("scope_country", "Country")}</option>
                <option value="main_branch">{s.t("scope_main", "Main Branch")}</option>
                <option value="city_branch">{s.t("scope_city", "City Branch")}</option>
              </select>
            </label>
            {scopeLevel !== "super_admin" && (
              <label className="text-xs font-semibold">
                {s.t("country", "Country")}
                <select
                  value={countryId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setCountryId(cid);
                    setBranchId("");
                    onScopeChange?.({ scopeLevel, countryId: cid, branchKind, branchId: "" });
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 cursor-pointer shadow-2xs"
                >
                  <option value="">{s.t("choose_country", "— choose country —")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(scopeLevel === "main_branch" || scopeLevel === "city_branch") && (
              <>
                <label className="text-xs font-semibold">
                  {s.t("branch_kind", "Branch Category")}
                  <select
                    value={branchKind}
                    onChange={(e) => {
                      const bk = e.target.value as any;
                      setBranchKind(bk);
                      setBranchId("");
                      onScopeChange?.({ scopeLevel, countryId, branchKind: bk, branchId: "" });
                    }}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 cursor-pointer shadow-2xs"
                  >
                    <option value="business">🏢 {s.t("business_branch", "Business Branch")}</option>
                    <option value="agent">🚢 {s.t("clearing_agent_branch", "Clearing Agent")}</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">
                  {s.t("branch", "Branch")}
                  <select
                    value={branchId}
                    onChange={(e) => {
                      const bid = e.target.value;
                      setBranchId(bid);
                      onScopeChange?.({ scopeLevel, countryId, branchKind, branchId: bid });
                    }}
                    disabled={!countryId || (cityBranches.length === 0 && mainBranches.length === 0)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {!countryId ? (
                      <option value="">{s.t("choose_country_first", "— Choose country first —")}</option>
                    ) : (cityBranches.length === 0 && mainBranches.length === 0) ? (
                      <option value="">{s.t("no_branches", "No branches found")}</option>
                    ) : (
                      <>
                        <option value="">{s.t("choose", "— choose —")}</option>
                        {(cityBranches.length > 0 ? cityBranches : mainBranches).map((b) => {
                          const label = b.name || b.cityName || b.city_name || b.branch_name || b.code || b.id;
                          const codeSuffix = b.code ? ` (${b.code})` : "";
                          return (
                            <option key={b.id} value={b.id}>
                              {label}{codeSuffix}
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Step 2 — upload */}
        <div className={`rounded-lg border-2 border-dashed p-6 text-center ${scopeReady ? "border-slate-300 dark:border-slate-700" : "border-slate-200 opacity-50 dark:border-slate-800"}`}>
          <Upload className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">
            {s.t("step2", "2. Upload the account list (PDF / Excel / CSV)")}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {scopeReady ? s.t("upload_hint", "One file may contain 20, 25 or more accounts.") : s.t("pick_scope_first", "Choose the country / branch above first.")}
          </p>
          <input type="file" accept=".pdf,.xlsx,.xls,.csv,.tsv,.txt,.doc,.docx"
            onChange={handleFile} disabled={!scopeReady || status === "extracting" || status === "confirming"}
            className="mt-3 text-xs" />
          {status === "extracting" && (
            <p className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />{s.t("extracting", "Reading document and extracting accounts…")}
            </p>
          )}
        </div>

        {/* warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            {warnings.map((w, i) => <p key={i}>• {w}</p>)}
          </div>
        )}

        {/* Step 3 — review table */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              <span>{s.t("step3", "3. Review extracted accounts")}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{s.t("c_total", "Total")}: {counts.total}</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{s.t("c_valid", "Valid")}: {counts.valid}</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{s.t("c_dup", "Duplicate")}: {counts.duplicate}</span>
              <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800 dark:bg-rose-950 dark:text-rose-300">{s.t("c_invalid", "Needs review")}: {counts.invalid}</span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{s.t("c_selected", "Selected")}: {counts.selected}</span>
            </div>
            <div className="max-h-80 overflow-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                  <tr className={s.textStart}>
                    <th className="px-2 py-1.5"><input type="checkbox" checked={rows.every((r) => r._selected)} onChange={(e) => setRows((p) => p.map((r) => ({ ...r, _selected: e.target.checked && r.status !== "duplicate" })))} /></th>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">{s.t("h_code", "Code")}</th>
                    <th className="px-2 py-1.5">{s.t("h_name", "Account Name")}</th>
                    <th className="px-2 py-1.5">{s.t("h_cat", "Category")}</th>
                    <th className="px-2 py-1.5">{s.t("h_branch", "Branch")}</th>
                    <th className="px-2 py-1.5">{s.t("h_city", "City")}</th>
                    <th className="px-2 py-1.5">{s.t("h_contact", "Mobile / Email")}</th>
                    <th className="px-2 py-1.5">{s.t("h_status", "Status")}</th>
                    <th className="px-2 py-1.5">{s.t("h_action", "Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowIndex} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-2 py-1.5"><input type="checkbox" disabled={r.status === "duplicate"} checked={r._selected} onChange={(e) => updateRow(r.rowIndex, { _selected: e.target.checked })} /></td>
                      <td className="px-2 py-1.5">{r.rowIndex}</td>
                      <td className="px-2 py-1.5 font-mono">{r.account_code || "—"}</td>
                      <td className="px-2 py-1.5">{r.account_name || <span className="text-rose-500">{s.t("missing", "missing")}</span>}</td>
                      <td className="px-2 py-1.5">{r.category || <span className="text-rose-500">?</span>}</td>
                      <td className="px-2 py-1.5">{r.branch || "—"}</td>
                      <td className="px-2 py-1.5">{r.city || "—"}</td>
                      <td className="px-2 py-1.5">{[r.mobile, r.email].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${r.status === "valid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : r.status === "duplicate" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"}`}>
                          {r.status === "valid" ? s.t("c_valid", "Valid") : r.status === "duplicate" ? s.t("c_dup", "Duplicate") : s.t("c_invalid", "Needs review")}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setEditing(r.rowIndex)} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700" title={s.t("edit", "Edit")}><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setRows((p) => p.filter((x) => x.rowIndex !== r.rowIndex))} className="rounded p-1 hover:bg-rose-100 dark:hover:bg-rose-900" title={s.t("remove", "Remove")}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.some((r) => r.message) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {rows.filter((r) => r.message).slice(0, 6).map((r) => <p key={r.rowIndex}>#{r.rowIndex}: {r.message}</p>)}
              </div>
            )}
          </div>
        )}

        {/* error */}
        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Step 4 — confirm */}
        {status === "reviewing" && rows.length > 0 && (
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <Button variant="outline" onClick={() => { setRows([]); setStatus("idle"); setServerCounts(null); setWarnings([]); }}>
              {s.t("cancel", "Cancel")}
            </Button>
            <Button className="ml-auto" onClick={handleConfirm} disabled={counts.selected === 0 || (status as string) === "confirming"}>
              {(status as string) === "confirming" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {s.t("confirm", "Confirm & Create {n} Account(s)").replace("{n}", String(counts.selected))}
            </Button>
          </div>
        )}
      </CardContent>

      {/* edit modal */}
      {editing != null && (() => {
        const row = rows.find((r) => r.rowIndex === editing);
        if (!row) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={dir}>
            <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">{s.t("edit_row", "Edit account row #{n}").replace("{n}", String(row.rowIndex))}</h3>
                <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["account_code", s.t("h_code", "Code")],
                  ["account_name", s.t("h_name", "Account Name")],
                  ["branch", s.t("h_branch", "Branch")],
                  ["company_name", s.t("f_company", "Company Name")],
                  ["business_name", s.t("f_business", "Business Name")],
                  ["city", s.t("h_city", "City")],
                  ["address", s.t("f_address", "Address")],
                  ["mobile", s.t("f_mobile", "Mobile")],
                  ["whatsapp", s.t("f_whatsapp", "WhatsApp")],
                  ["phone", s.t("f_phone", "Phone")],
                  ["email", s.t("f_email", "Email")],
                ] as [keyof Row, string][]).map(([k, label]) => (
                  <label key={k} className="text-xs font-semibold">
                    {label}
                    <input value={(row[k] as string) || ""} onChange={(e) => updateRow(row.rowIndex, { [k]: e.target.value } as Partial<Row>)}
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800" />
                  </label>
                ))}
                <label className="text-xs font-semibold">
                  {s.t("h_cat", "Category")}
                  <select value={row.kind || ""} onChange={(e) => updateRow(row.rowIndex, { kind: (e.target.value || null) as Kind | null, category: e.target.value ? e.target.value[0].toUpperCase() + e.target.value.slice(1) : null })}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <option value="">{s.t("choose", "— choose —")}</option>
                    <option value="asset">{s.t("k_asset", "Asset")}</option>
                    <option value="liability">{s.t("k_liability", "Liability")}</option>
                    <option value="equity">{s.t("k_equity", "Equity / Capital")}</option>
                    <option value="income">{s.t("k_income", "Income")}</option>
                    <option value="expense">{s.t("k_expense", "Expense")}</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => setEditing(null)}>{s.t("save_row", "Save Row")}</Button>
              </div>
            </div>
          </div>
        );
      })()}
    </Card>
  );
}
