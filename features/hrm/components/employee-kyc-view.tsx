"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, Clock, X, Check, Ban, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";

const STATUS_TONE: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending_verification: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  pending: "bg-slate-100 text-slate-500 dark:bg-slate-800",
  incomplete: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  expired: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export function EmployeeKycView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [openEmp, setOpenEmp] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (search) qs.set("search", search);
      const [q, k] = await Promise.all([
        apiGet<{ rows: Row[] }>(`/api/erp/hr/kyc?${qs.toString()}`),
        apiGet<{ kpis: Record<string, number> }>("/api/erp/hr/kyc/kpis"),
      ]);
      setRows(q.rows ?? []);
      setKpis(k.kpis ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { void load(); }, [load]);

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("kyc_title", "Employee KYC / QVC Register"),
    subtitle: s.t("kyc_subtitle", "KYC completeness and pending verification"),
    lang: s.lang,
    orientation: "landscape" as const,
    kpis: [
      { label: s.t("kyc_k_verified", "Verified"), value: String(kpis.verified ?? 0), color: "emerald" as const },
      { label: s.t("kyc_k_pending", "Pending Verification"), value: String(kpis.pending ?? 0), color: "amber" as const },
      { label: s.t("kyc_k_incomplete", "Incomplete"), value: String(kpis.incomplete ?? 0), color: "red" as const },
      { label: s.t("kyc_k_expiring", "Docs Expiring ≤30d"), value: String(kpis.docs_expiring_30d ?? 0), color: "amber" as const },
    ],
    columns: [
      { key: "employee_code", label: s.t("code", "Code") },
      { key: "employee_name", label: s.t("employee", "Employee") },
      { key: "country_name", label: s.t("country", "Country") },
      { key: "required_count", label: s.t("kyc_required", "Required"), align: "right" as const },
      { key: "verified_count", label: s.t("kyc_verified", "Verified"), align: "right" as const },
      { key: "missing_mandatory_count", label: s.t("kyc_missing", "Missing"), align: "right" as const },
      { key: "kyc_status", label: s.t("status_label", "Status") },
    ],
    rows,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("kyc_title", "Employee KYC / QVC Register")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              {s.t("kyc_blurb", "Employee document checklist (passport, visa, national ID, labour card, contract, bank proof …). Incomplete or unverified employees appear in the Pending Verification queue with the exact missing items. Verified records stay in permanent history.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
            </button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label={s.t("kyc_k_total", "Total")} value={kpis.total ?? 0} />
          <Kpi label={s.t("kyc_k_verified", "Verified")} value={kpis.verified ?? 0} icon={ShieldCheck} tone="text-emerald-600" />
          <Kpi label={s.t("kyc_k_pending", "Pending Verification")} value={kpis.pending ?? 0} icon={Clock} tone="text-amber-600" />
          <Kpi label={s.t("kyc_k_incomplete", "Incomplete")} value={kpis.incomplete ?? 0} icon={ShieldAlert} tone="text-rose-600" />
          <Kpi label={s.t("kyc_k_expired", "Expired Docs")} value={kpis.expired ?? 0} icon={ShieldAlert} tone="text-rose-600" />
          <Kpi label={s.t("kyc_k_expiring", "Expiring ≤30d")} value={kpis.docs_expiring_30d ?? 0} icon={Clock} tone="text-amber-600" />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search", "Search…")} className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <option value="">{s.t("all_status", "All Statuses")}</option>
            {["incomplete", "pending_verification", "expired", "verified"].map((k) => (
              <option key={k} value={k}>{s.t(`kyc_status_${k}`, k)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                <Th className="px-3 py-2.5">{s.t("employee", "Employee")}</Th>
                <Th className="px-3 py-2.5">{s.t("country", "Country")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("kyc_required", "Required")}</Th>
                <Th className="px-3 py-2.5 text-right">{s.t("kyc_verified", "Verified")}</Th>
                <Th className="px-3 py-2.5">{s.t("kyc_missing_items", "Missing Mandatory Items")}</Th>
                <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
                <Th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("empty", "No records found.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employee_id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.employee_name}<div className="font-mono text-[10px] text-slate-400">{r.employee_code}</div></td>
                    <td className="px-3 py-2 text-slate-500">{r.country_name || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.required_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{r.verified_count}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {(r.missing_items ?? []).length === 0 ? "—" : (r.missing_items ?? []).map((m: any) => m.label).join(", ")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.kyc_status] || STATUS_TONE.pending}`}>
                        {s.t(`kyc_status_${r.kyc_status}`, r.kyc_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setOpenEmp(r)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                        {s.t("kyc_open", "Open Checklist")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openEmp ? (
        <KycChecklistDrawer s={s} employeeId={openEmp.employee_id} onClose={() => setOpenEmp(null)} onChanged={() => void load()} />
      ) : null}
    </section>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon?: any; tone?: string }) {
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

function KycChecklistDrawer({
  s, employeeId, onClose, onChanged,
}: {
  s: ReturnType<typeof useErpScreen>;
  employeeId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{ employee: Row | null; items: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ employee: Row; items: Row[] }>(`/api/erp/hr/kyc/${employeeId}`);
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (it: Row) => {
    setEditCode(it.code);
    setForm({
      requirementCode: it.code,
      documentNumber: it.document_number ?? "",
      issuingAuthority: it.issuing_authority ?? "",
      issueDate: it.issue_date ?? "",
      expiryDate: it.expiry_date ?? "",
      fileUrl: it.file_url ?? "",
      notes: it.notes ?? "",
    });
  };

  const saveDoc = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload: Row = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      payload.requirementCode = form.requirementCode;
      await apiPost(`/api/erp/hr/kyc/${employeeId}`, payload);
      setEditCode(null);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (docId: string, decision: "verified" | "rejected") => {
    const reason = decision === "rejected" ? window.prompt(s.t("kyc_reject_reason", "Rejection reason:")) ?? undefined : undefined;
    setBusy(true);
    try {
      await apiPatch(`/api/erp/hr/kyc/documents/${docId}`, { decision, reason });
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
            {s.t("kyc_checklist", "KYC Checklist")}
            {data?.employee ? <span className="ms-2 font-mono text-xs font-normal text-slate-400">{data.employee.employee_code} · {data.employee.name}</span> : null}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="mt-4 space-y-2">
            {(data?.items ?? []).map((it) => (
              <div key={it.code} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{it.label}</span>
                    {it.is_mandatory ? <span className="ms-1 text-[10px] font-bold text-rose-500">*</span> : null}
                    <span className={`ms-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[it.status || "pending"] || STATUS_TONE.pending}`}>
                      {s.t(`kyc_docstatus_${it.status || "pending"}`, it.status || "pending")}
                    </span>
                    {it.expiry_date ? <span className="ms-2 text-[10px] text-slate-400">{s.t("kyc_expires", "expires")} {it.expiry_date}</span> : null}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEdit(it)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                      {it.document_id ? s.t("edit", "Edit") : s.t("kyc_add_doc", "Add Document")}
                    </button>
                    {it.document_id && it.status !== "verified" ? (
                      <button type="button" disabled={busy} onClick={() => void verify(it.document_id, "verified")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                        <Check className="h-3 w-3" />{s.t("kyc_verify", "Verify")}
                      </button>
                    ) : null}
                    {it.document_id && it.status !== "rejected" ? (
                      <button type="button" disabled={busy} onClick={() => void verify(it.document_id, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900">
                        <Ban className="h-3 w-3" />{s.t("kyc_reject", "Reject")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {it.document_number || it.rejection_reason ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {it.document_number ? <span>{s.t("kyc_number", "No")}: {it.document_number}</span> : null}
                    {it.rejection_reason ? <span className="ms-2 text-rose-500">{it.rejection_reason}</span> : null}
                  </div>
                ) : null}

                {editCode === it.code ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <L label={s.t("kyc_number", "Document No")}><input value={form.documentNumber ?? ""} onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_authority", "Issuing Authority")}><input value={form.issuingAuthority ?? ""} onChange={(e) => setForm((p) => ({ ...p, issuingAuthority: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_issue_date", "Issue Date")}><input type="date" value={form.issueDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_expiry_date", "Expiry Date")}><input type="date" value={form.expiryDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_file_url", "File URL / Reference")}><input value={form.fileUrl ?? ""} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_notes", "Notes")}><input value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={INP} /></L>
                    <div className="col-span-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={() => void saveDoc()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{s.t("save", "Save")}</button>
                      <button type="button" onClick={() => setEditCode(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
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
