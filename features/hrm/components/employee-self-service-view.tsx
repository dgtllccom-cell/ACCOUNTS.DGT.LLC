"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Bundle = {
  profile: any;
  payslips: any[];
  leaveBalances: any[];
  leaveRequests: any[];
  kyc: any;
  documents: any[];
  attendance: any[];
  lifecycle: any[];
};

const NUM = (v: any) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

export function EmployeeSelfServiceView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Bundle>("/api/erp/hr/self")
      .then((r) => setData(r))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>;

  if (error || !data?.profile) {
    return (
      <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-8">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {error || s.t("ess_not_linked", "Your login is not linked to an employee record.")}
        </div>
      </section>
    );
  }

  const p = data.profile;
  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: "single_document" as const,
    title: s.t("ess_title", "My Employee Profile"),
    subtitle: `${p.name} · ${p.employee_code}`,
    lang: s.lang,
    orientation: "portrait" as const,
    partyDetails: { type: "employee" as const, name: p.name, code: p.employee_code, designationOrContact: p.designation },
    columns: [
      { key: "period_month", label: s.t("payroll_period", "Period") },
      { key: "run_no", label: s.t("payroll_run_no", "Run") },
      { key: "gross_salary", label: s.t("payroll_gross", "Gross"), align: "right" as const, format: "number" as const },
      { key: "net_salary", label: s.t("payroll_net", "Net"), align: "right" as const, format: "number" as const },
      { key: "currency", label: s.t("currency", "Ccy") },
      { key: "status", label: s.t("status_label", "Status") },
    ],
    rows: data.payslips,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-lg space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("ess_title", "My Employee Profile")}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{p.name} · {p.employee_code} · {p.designation || "—"} · {p.country || "—"}</p>
          </div>
          <UniversalPrintActionButton reportConfig={printConfig} />
        </header>

        <Card title={s.t("ess_profile", "Profile")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
            <F s={s} k="department" label="Department" v={p.department} />
            <F s={s} k="ess_category" label="Category" v={p.category} />
            <F s={s} k="ess_employment_type" label="Employment Type" v={p.employment_type} />
            <F s={s} k="ess_status" label="Status" v={p.status} />
            <F s={s} k="ess_joining" label="Joining Date" v={p.joining_date} />
            <F s={s} k="ess_confirmation" label="Confirmation Date" v={p.confirmation_date} />
            <F s={s} k="ess_manager" label="Reporting Manager" v={p.reporting_manager} />
            <F s={s} k="ess_branch" label="Branch" v={p.city_branch || p.main_branch} />
            <F s={s} k="currency" label="Salary Currency" v={p.currency} />
            <F s={s} k="basic_salary" label="Basic Salary" v={`${NUM(p.basic_salary)} ${p.currency || ""}`} />
            <F s={s} k="monthly_salary" label="Monthly Salary" v={`${NUM(p.monthly_salary)} ${p.currency || ""}`} />
            <F s={s} k="ess_pay_method" label="Payment Method" v={p.salary_payment_method} />
            <F s={s} k="ess_email" label="Email" v={p.email} />
            <F s={s} k="ess_mobile" label="Mobile" v={p.mobile} />
          </dl>
        </Card>

        <Card title={s.t("ess_kyc", "KYC Status")}>
          {data.kyc ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${data.kyc.kyc_status === "verified" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                {data.kyc.kyc_status === "verified" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {s.t(`kyc_status_${data.kyc.kyc_status}`, data.kyc.kyc_status)}
              </span>
              <span className="text-slate-500">{s.t("kyc_verified", "Verified")}: {data.kyc.verified_count}/{data.kyc.required_count}</span>
              {Number(data.kyc.missing_mandatory_count) > 0 ? <span className="text-rose-600">{s.t("kyc_missing", "Missing")}: {(data.kyc.missing_items ?? []).map((m: any) => m.label).join(", ")}</span> : null}
            </div>
          ) : <p className="text-xs text-slate-400">—</p>}
          {data.documents.length ? (
            <table className="mt-3 w-full text-xs">
              <thead className="text-left text-slate-400"><tr><Th className="py-1">{s.t("kyc_number", "Document")}</Th><Th className="py-1">{s.t("kyc_expiry_date", "Expiry")}</Th><Th className="py-1">{s.t("status_label", "Status")}</Th></tr></thead>
              <tbody>{data.documents.map((d, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{d.document_type} {d.document_number ? `· ${d.document_number}` : ""}</td><td className="py-1.5">{d.expiry_date || "—"}</td><td className="py-1.5">{s.t(`kyc_docstatus_${d.status}`, d.status)}</td></tr>)}</tbody>
            </table>
          ) : null}
        </Card>

        <Card title={s.t("ess_payslips", "Payslips")}>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400"><tr><Th className="py-1">{s.t("payroll_period", "Period")}</Th><Th className="py-1">{s.t("payroll_run_no", "Run")}</Th><Th className="py-1 text-right">{s.t("payroll_gross", "Gross")}</Th><Th className="py-1 text-right">{s.t("payroll_net", "Net")}</Th><Th className="py-1">{s.t("currency", "Ccy")}</Th><Th className="py-1">{s.t("status_label", "Status")}</Th></tr></thead>
            <tbody>
              {data.payslips.length === 0 ? <tr><td colSpan={6} className="py-4 text-center text-slate-400">{s.t("ess_no_payslips", "No payslips yet.")}</td></tr> :
                data.payslips.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{r.period_month}</td><td className="py-1.5 font-mono">{r.run_no}</td><td className="py-1.5 text-right tabular-nums">{NUM(r.gross_salary)}</td><td className="py-1.5 text-right tabular-nums font-bold">{NUM(r.net_salary)}</td><td className="py-1.5">{r.currency}</td><td className="py-1.5">{s.t(`payroll_st_${r.status}`, r.status)}</td></tr>)}
            </tbody>
          </table>
        </Card>

        <Card title={s.t("ess_leave", "Leave Balances")}>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400"><tr><Th className="py-1">{s.t("bal_type", "Leave Type")}</Th><Th className="py-1">{s.t("bal_year", "Year")}</Th><Th className="py-1 text-right">{s.t("bal_entitled", "Entitled")}</Th><Th className="py-1 text-right">{s.t("bal_taken", "Taken")}</Th><Th className="py-1 text-right">{s.t("bal_pending", "Pending")}</Th><Th className="py-1 text-right">{s.t("bal_remaining", "Remaining")}</Th></tr></thead>
            <tbody>
              {data.leaveBalances.length === 0 ? <tr><td colSpan={6} className="py-4 text-center text-slate-400">—</td></tr> :
                data.leaveBalances.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{r.leave_type_name}</td><td className="py-1.5">{r.year}</td><td className="py-1.5 text-right tabular-nums">{NUM(r.entitled_days)}</td><td className="py-1.5 text-right tabular-nums">{NUM(r.taken_days)}</td><td className="py-1.5 text-right tabular-nums">{NUM(r.pending_days)}</td><td className="py-1.5 text-right tabular-nums font-bold">{NUM(r.remaining_days)}</td></tr>)}
            </tbody>
          </table>
        </Card>

        <Card title={s.t("ess_attendance", "Recent Attendance")}>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400"><tr><Th className="py-1">{s.t("date", "Date")}</Th><Th className="py-1">{s.t("sh_start", "In")}</Th><Th className="py-1">{s.t("sh_end", "Out")}</Th><Th className="py-1">{s.t("status_label", "Status")}</Th><Th className="py-1 text-right">{s.t("payroll_ot", "OT Hrs")}</Th></tr></thead>
            <tbody>
              {data.attendance.length === 0 ? <tr><td colSpan={5} className="py-4 text-center text-slate-400">—</td></tr> :
                data.attendance.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{r.attendance_date}</td><td className="py-1.5">{r.check_in || "—"}</td><td className="py-1.5">{r.check_out || "—"}</td><td className="py-1.5">{r.status}</td><td className="py-1.5 text-right tabular-nums">{NUM(r.overtime_hours)}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function F({ s, k, label, v }: { s: ReturnType<typeof useErpScreen>; k: string; label: string; v: any }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t(k, label)}</dt>
      <dd className="font-semibold text-slate-700 dark:text-slate-200">{v == null || v === "" ? "—" : String(v)}</dd>
    </div>
  );
}
