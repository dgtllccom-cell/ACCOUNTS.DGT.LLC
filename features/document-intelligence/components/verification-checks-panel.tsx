"use client";

/**
 * Document verification checks (read-only). Shows duplicate / already-used / mismatch findings for
 * one intake job against other documents and the matched order. Nothing here posts or edits —
 * the human decides in the owning module.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, CircleSlash, Loader2, RefreshCcw, ShieldAlert, XCircle, AlertTriangle } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";

type Check = { code: string; status: "pass" | "warning" | "fail" | "missing" | "not_applicable"; group?: "content" | "records"; expected?: string | null; found?: string | null; detail?: string | null };
type Result = { jobNo: string; matched: { module: string; label: string | null } | null; checks: Check[] };

const ICON = { ok: CheckCircle2, warning: AlertTriangle, fail: XCircle, missing: CircleDashed, not_applicable: CircleSlash } as const;
/** API status "pass" is shown under the neutral key "ok". */
const k = (st: Check["status"]) => (st === "pass" ? "ok" : st);
const TONE = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  fail: "text-rose-700 dark:text-rose-300",
  missing: "text-orange-700 dark:text-orange-300",
  not_applicable: "text-slate-400",
} as const;

export function VerificationChecksPanel({ jobId, lang }: { jobId: string | null; lang?: string }) {
  const s = useErpScreen("dverify", lang);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<Result>(`/api/erp/document-intelligence/${encodeURIComponent(jobId)}/verification`));
    } catch (e: any) {
      setError(e?.message || s.t("failed", "Verification could not be run."));
    } finally {
      setLoading(false);
    }
  }, [jobId, s]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!jobId) return null;

  const label = (code: string) =>
    ({
      duplicate_document: s.t("c_duplicate_document", "Duplicate document (same file)"),
      already_used_document: s.t("c_already_used", "Document already used for a record"),
      duplicate_invoice: s.t("c_duplicate_invoice", "Duplicate invoice number"),
      party_mismatch: s.t("c_party", "Supplier / customer matches the order"),
      currency_mismatch: s.t("c_currency", "Currency matches the order"),
      exchange_rate_mismatch: s.t("c_rate", "Exchange rate matches the order"),
      total_mismatch: s.t("c_total", "Total matches the order"),
      quantity_mismatch: s.t("c_quantity", "Quantity matches the order"),
      unit_rate_mismatch: s.t("c_unit_rate", "Unit rates match the order"),
      reference_mismatch: s.t("c_reference", "Contract / reference matches the order"),
      duplicate_posting: s.t("c_duplicate_posting", "No duplicate posting"),
      extraction_completed: s.t("c_extraction", "Document read (OCR + extraction finished)"),
      line_math: s.t("c_line_math", "Quantity × unit price = amount"),
      total_lines: s.t("c_total_lines", "Goods lines add up to the total"),
      currency_single: s.t("c_currency_single", "One currency on the document"),
      weights: s.t("c_weights", "Gross weight is not below net weight"),
      destination_consistent: s.t("c_destination", "Destination port matches the delivery place"),
      party_in_erp: s.t("c_party_erp", "Party found in the Account Master"),
      field_contract_number: s.t("fld_contract_number", "Contract number"),
      field_document_date: s.t("fld_document_date", "Contract / document date"),
      field_supplier_name: s.t("fld_supplier_name", "Supplier / seller"),
      field_customer_name: s.t("fld_customer_name", "Customer / buyer"),
      field_currency: s.t("fld_currency", "Currency"),
      field_grand_total: s.t("fld_grand_total", "Total amount"),
      field_goods_description: s.t("fld_goods_description", "Goods description"),
      field_quantity: s.t("fld_quantity", "Quantity"),
      field_unit_price: s.t("fld_unit_price", "Unit price"),
    })[code] ?? code;
  // Matched · Manual review required · Mismatch · Missing · Not applicable
  const statusLabel = (st: Check["status"]) =>
    ({ ok: s.t("st_matched", "Matched"), warning: s.t("st_review", "Manual review required"), fail: s.t("st_mismatch", "Mismatch"), missing: s.t("st_missing", "Missing"), not_applicable: s.t("st_na", "Not applicable") })[k(st)];

  const problems = data?.checks.filter((c) => c.status === "fail" || c.status === "warning" || c.status === "missing").length ?? 0;
  const contentChecks = data?.checks.filter((c) => c.group === "content") ?? [];
  const recordChecks = data?.checks.filter((c) => c.group !== "content") ?? [];
  // "No problems found" only when the document was actually read and every business check passed
  const contentOk = contentChecks.length > 0 && contentChecks.every((c) => c.status === "pass" || c.status === "not_applicable");
  const allClear = problems === 0 && contentOk;

  return (
    <div dir={s.dir} data-testid="verification-checks" className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <ShieldAlert className="h-4 w-4 text-blue-600" /> {s.t("title", "Verification Checks")}
          {data && (
            <span data-testid="verification-summary" data-all-clear={allClear ? "1" : "0"} className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", !allClear ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300")}>
              {problems ? `${problems} ${s.t("to_review", "to review")}` : allClear ? s.t("all_clear", "No problems found") : s.t("not_verified", "Not verified yet")}
            </span>
          )}
        </h3>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} {s.t("rerun", "Re-check")}
        </button>
      </div>
      <p className="mb-2 text-[11px] text-slate-500">
        {data?.matched
          ? `${s.t("compared_with", "Compared with")} ${data.matched.label ?? ""}`
          : s.t("no_match_hint", "Select the matching order to compare quantities, rates, currency and totals.")}{" "}
        {s.t("read_only", "These checks only warn — nothing is posted or changed.")}
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {data && [
        { key: "content", title: s.t("g_content", "Document content"), rows: contentChecks },
        { key: "records", title: s.t("g_records", "Against existing documents and records"), rows: recordChecks },
      ].filter((g) => g.rows.length).map((g) => (
        <div key={g.key} className="mt-2" data-testid={`check-group-${g.key}`}>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{g.title}</p>
          <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {g.rows.map((c) => {
              const Icon = ICON[k(c.status)];
              const showValue = (c.expected || c.found) && c.status !== "not_applicable";
              return (
                <li key={c.code} data-testid={`check-${c.code}`} data-status={c.status} className="flex flex-wrap items-start justify-between gap-2 py-1.5">
                  <span className={cn("flex items-center gap-1.5 font-medium", TONE[k(c.status)])}>
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {label(c.code)}
                  </span>
                  <span className="text-slate-500">
                    {statusLabel(c.status)}
                    {showValue && (
                      <span className="ms-1 font-mono" dir="auto">
                        ({c.expected ? `${s.t("expected", "expected")}: ${c.expected}` : ""}{c.expected && c.found ? " · " : ""}{c.found ? `${c.status === "pass" ? "" : `${s.t("found", "found")}: `}${c.found}` : ""})
                      </span>
                    )}
                    {c.detail === "quantity_calculated" && <span className="ms-1">· {s.t("d_qty_calculated", "quantity calculated from amount ÷ unit price")}</span>}
                    {c.detail === "choose" && <span className="ms-1">· {s.t("d_choose_party", "several matches — choose the right account")}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
