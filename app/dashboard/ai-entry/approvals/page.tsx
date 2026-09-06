"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Loader2, CheckCircle2, XCircle, Undo2, RefreshCw, FileText, Languages, ArrowRight, Inbox } from "lucide-react";

type Row = {
  id: string;
  document_intake_job_id: string;
  status: string;
  submitted_at: string;
  submitted_by_name: string | null;
  reviewer_notes: string | null;
  returned_reason: string | null;
  job_no: string;
  original_language: string | null;
  doc_type_code: string | null;
  target_module: string | null;
  country_name: string | null;
  city_branch_name: string | null;
  original_filename: string | null;
  source_type: string | null;
  field_count: number;
};

export default function ApprovalQueuePage() {
  const s = useErpScreen("ait");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ rows: Row[] }>("/api/erp/approvals/pending-for-me");
      setRows(res.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function decide(row: Row, action: "approve" | "reject" | "return") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt(s.t("approval_reject_reason", "Reason for rejecting this draft:")) || undefined;
      if (!reason) return;
    } else if (action === "return") {
      reason = window.prompt(s.t("approval_return_reason", "What needs correcting?")) || undefined;
      if (!reason) return;
    }
    setBusyId(row.id);
    try {
      const r = await fetch(`/api/erp/approvals/draft/${row.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: action === "reject" ? reason : undefined,
          returnReason: action === "return" ? reason : undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || j?.error || `HTTP ${r.status}`);
      setToast(
        action === "approve"
          ? s.t("approval_approved_toast", "Draft approved — {job} is ready to be consumed into its ERP record.").replace("{job}", row.job_no)
          : action === "reject"
          ? s.t("approval_rejected_toast", "Draft {job} rejected.").replace("{job}", row.job_no)
          : s.t("approval_returned_toast", "Draft {job} sent back for correction.").replace("{job}", row.job_no),
      );
      await load();
    } catch (e) {
      setToast((e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6" dir={s.dir}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={s.textStart}>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-50">{s.t("approval_title", "Approval Queue")}</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {s.t("approval_intro", "AI-reviewed drafts awaiting your approval. Approving only clears a draft for posting — the record is still created through its module's own workflow and audit trail. Nothing is posted from here.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {s.t("approval_refresh", "Refresh")}
        </button>
      </div>

      {toast && (
        <div className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
          <Inbox className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-500">{s.t("approval_empty", "No drafts are waiting for your approval.")}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className={s.textStart}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-slate-50">{row.job_no}</span>
                    {row.status === "returned_for_review" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        {s.t("approval_status_returned", "Returned for review")}
                      </span>
                    )}
                    {row.source_type && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">{row.source_type}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {[row.original_filename, row.doc_type_code, row.target_module].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{row.field_count} {s.t("approval_fields", "fields")}</span>
                    {row.original_language && <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" />{row.original_language}</span>}
                    {(row.country_name || row.city_branch_name) && <span>{[row.country_name, row.city_branch_name].filter(Boolean).join(" / ")}</span>}
                    {row.submitted_by_name && <span>{s.t("approval_by", "by")} {row.submitted_by_name}</span>}
                  </p>
                  {row.reviewer_notes && <p className="mt-1 text-[11px] italic text-slate-500">“{row.reviewer_notes}”</p>}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/document-intelligence?job=${row.document_intake_job_id}` as never)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  {s.t("approval_open_draft", "Open draft")} <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, "approve")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {s.t("approval_approve", "Approve")}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, "return")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300"
                >
                  <Undo2 className="h-3.5 w-3.5" /> {s.t("approval_return", "Return for correction")}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, "reject")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                >
                  <XCircle className="h-3.5 w-3.5" /> {s.t("approval_reject", "Reject")}
                </button>
                {busyId === row.id && <Loader2 className="h-4 w-4 animate-spin self-center text-slate-400" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
