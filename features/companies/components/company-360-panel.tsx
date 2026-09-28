"use client";

/**
 * Company 360 — one legal company and everything that already points at it, read by reference
 * from the authoritative tables (owner, sister companies, branches, Bank Master entries,
 * accounts, documents, purchase orders, invoices, clearing orders, inquiries, tax entity,
 * history). Nothing is copied or recalculated; no account or posting is created from here.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { AlertTriangle, BellPlus, Building2, FileText, GitBranch, Loader2, Pencil, Plus, Printer, ShieldCheck, X } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openCompany360Report } from "@/lib/reports/open-company-360-report-window";
import { COMPANY_STATUS_OPTIONS, COMPANY_TYPES, LEGAL_STRUCTURE_OPTIONS, REGISTRATION_TYPE_OPTIONS, STATUS_TONE, optionLabel } from "@/features/companies/company-labels";
import { cn } from "@/lib/utils";
import { translateHeader } from "@/lib/i18n/table-headers";

type C360 = {
  company: any;
  owner: any | null;
  sisterCompanies: any[];
  branches: any[];
  bankMaster: any[];
  accounts: any[];
  documents: any[];
  purchaseOrders: any[];
  invoices: any[];
  clearingOrders: any[];
  inquiries: any[];
  taxEntities: any[];
  history: any[];
  compliance: Array<{ code: string; severity: "critical" | "needs_review" | "reminder" }>;
};

const card = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
const SEV: Record<string, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  needs_review: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  reminder: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
};

const d = (x: unknown) => (x ? String(x).slice(0, 10) : "—");
/** Status / action codes (pending, in_progress, update …) through the central header dictionary. */
const code = (lang: string, x: unknown) => (x ? translateHeader(lang, String(x).replace(/_/g, " ")) : "—");

export function Company360Panel({
  companyId,
  onEdit,
  onAddSister,
  onClose,
}: {
  companyId: string;
  onEdit?: (id: string) => void;
  onAddSister?: (ownerPersonId?: string) => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const s = useErpScreen("c360");
  const [data, setData] = useState<C360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const [reminderFor, setReminderFor] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiGet<any>(`/api/erp/companies/${encodeURIComponent(companyId)}/profile?view=360&lang=${s.lang}`);
      setData(r?.company360 ?? null);
    } catch (e: any) {
      setError(e?.message || s.t("load_failed", "Company 360 could not be loaded."));
    }
  }, [companyId, s]);

  useEffect(() => {
    void load();
  }, [load]);

  const complianceText = (code: string) =>
    ({
      license_expired: s.t("cmp_license_expired", "Trade license / registration has expired"),
      license_expiring: s.t("cmp_license_expiring", "Trade license / registration expires within 30 days"),
      registration_number_missing: s.t("cmp_reg_missing", "Registration / license number is missing"),
      trn_missing: s.t("cmp_trn_missing", "TRN / tax number is missing"),
      documents_missing: s.t("cmp_docs_missing", "No company documents are attached"),
    })[code] ?? code;
  const sevLabel = (sv: string) =>
    ({ critical: s.t("sev_critical", "Critical"), needs_review: s.t("sev_review", "Needs review"), reminder: s.t("sev_reminder", "Reminder") })[sv] ?? sv;

  async function openReminder(code: string) {
    setReminderFor(code);
    setReminderMsg(null);
    if (!assignees.length) {
      try {
        const r = await apiGet<any>("/api/erp/users/eligible-assignees");
        setAssignees((r?.users ?? []).map((u: any) => ({ id: u.id, name: u.name })));
      } catch {
        setAssignees([]);
      }
    }
  }

  async function createReminder() {
    if (!data || !reminderFor || !assignTo) return;
    setBusy(true);
    setReminderMsg(null);
    const c = data.company;
    try {
      const res = await fetch("/api/erp/user-tasks", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "x-erp-lang": s.lang },
        body: JSON.stringify({
          title: `${complianceText(reminderFor)} — ${c.legal_name || c.name}`,
          description: s.t("reminder_desc", "Created from Company 360 compliance check."),
          assignedTo: assignTo,
          countryId: c.country_id ?? null,
          relatedModule: "company_master",
          relatedRecordTable: "companies",
          relatedRecordId: c.id,
          relatedRecordLabel: c.company_code || c.name,
          relatedRoute: `/dashboard/settings/company-setup?view=360&companyId=${c.id}`,
          priority: reminderFor === "license_expired" ? "urgent" : reminderFor === "license_expiring" ? "high" : "normal",
          dueAt: c.license_expiry_date && reminderFor.startsWith("license_") ? String(c.license_expiry_date).slice(0, 10) : null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.ok === false) throw new Error(body?.error?.message || s.t("reminder_failed", "The reminder task could not be created."));
      setReminderMsg(`${s.t("reminder_created", "Reminder task created")}: ${body?.data?.taskNo ?? ""}`);
      setReminderFor(null);
    } catch (e: any) {
      setReminderMsg(e?.message || s.t("reminder_failed", "The reminder task could not be created."));
    } finally {
      setBusy(false);
    }
  }

  function print() {
    if (!data) return;
    const c = data.company;
    openCompany360Report({
      lang: s.lang,
      company: {
        id: c.id,
        name: c.name,
        legalName: c.legal_name,
        tradeName: c.trade_name,
        companyType: c.effective_company_type,
        companyTypeLabel: optionLabel(COMPANY_TYPES, c.effective_company_type, s.lang) || null,
        status: c.company_status,
        statusLabel: optionLabel(COMPANY_STATUS_OPTIONS, c.company_status || "active", s.lang),
        legalStructureLabel: optionLabel(LEGAL_STRUCTURE_OPTIONS, c.legal_structure, s.lang) || null,
        natureOfBusiness: c.nature_of_business || c.business_type,
        registrationType: optionLabel(REGISTRATION_TYPE_OPTIONS, c.registration_type, s.lang) || null,
        licenseNumber: c.registration_number,
        taxNumber: c.tax_number,
        incorporationDate: c.incorporation_date ? d(c.incorporation_date) : null,
        licenseExpiryDate: c.license_expiry_date ? d(c.license_expiry_date) : null,
        baseCurrency: c.base_currency,
        countryName: c.country_name,
        stateName: c.state_name,
        cityName: c.city_name,
        address: c.address,
        companyCode: c.company_code,
      },
      owner: data.owner ? { name: data.owner.customer_name, customerCode: data.owner.person_code, phone: data.owner.mobile, email: data.owner.email } : null,
      sisterCompanies: data.sisterCompanies.map((x) => ({ name: x.legal_name || x.name, licenseNumber: x.registration_number, countryName: x.country_name, status: optionLabel(COMPANY_STATUS_OPTIONS, x.company_status || "active", s.lang) })),
      banks: data.bankMaster.map((b) => ({ bankName: b.bank_name, accountTitle: b.account_title, currency: b.currency })),
      linkedBranches:
        data.company.effective_company_type === "internal"
          ? data.branches.map((b) => ({ name: b.name, code: b.code, levelLabel: b.level === "country_branch" ? s.t("main_branch", "Main Branch") : s.t("city_branch", "City Branch") }))
          : undefined,
      linkedCounts: [
        { label: s.t("n_documents", "Documents"), count: data.documents.length },
        { label: s.t("n_purchase_orders", "Purchase orders"), count: data.purchaseOrders.length },
        { label: s.t("n_invoices", "Invoices"), count: data.invoices.length },
        { label: s.t("n_clearing_orders", "Clearing orders"), count: data.clearingOrders.length },
        { label: s.t("n_inquiries", "Customer inquiries"), count: data.inquiries.length },
        { label: s.t("n_accounts", "Linked accounts"), count: data.accounts.length },
      ],
      compliance: data.compliance.map((x) => `${sevLabel(x.severity)}: ${complianceText(x.code)}`),
    });
  }

  if (error) {
    return (
      <div dir={s.dir} className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div dir={s.dir} className="flex items-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading Company 360…")}
      </div>
    );
  }

  const c = data.company;
  const type = c.effective_company_type as string | null;
  const status = (c.company_status || "active") as string;

  const listTable = (headers: string[], rows: Array<Array<React.ReactNode>>, testId: string) => (
    <div className="overflow-x-auto">
      <table data-testid={testId} className="w-full min-w-[480px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
            {headers.map((h) => (
              <th key={h} className={cn("px-2 py-1.5 font-semibold", s.textStart)}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-2 py-3 text-center text-slate-400">{s.t("none", "None recorded")}</td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                {r.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-slate-800 dark:text-slate-200">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div dir={s.dir} data-testid="company-360" className="space-y-4 font-sans">
      {/* Header */}
      <div className={cn(card, "flex flex-wrap items-start justify-between gap-3")}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 data-testid="c360-name" className="text-lg font-bold text-slate-900 dark:text-white">{c.legal_name || c.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              {c.company_code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{c.company_code}</span>}
              {type && <span data-testid="c360-type" className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{optionLabel(COMPANY_TYPES, type, s.lang)}</span>}
              <span className={cn("rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset", STATUS_TONE[status] ?? STATUS_TONE.active)}>{optionLabel(COMPANY_STATUS_OPTIONS, status, s.lang)}</span>
              {c.trade_name && <span className="text-slate-500">{c.trade_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <button type="button" data-testid="c360-edit" onClick={() => onEdit(c.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <Pencil className="h-3.5 w-3.5" /> {s.t("edit", "Edit")}
            </button>
          )}
          {type === "customer" && c.owner_person_id && onAddSister && (
            <button type="button" data-testid="c360-add-sister" onClick={() => onAddSister(c.owner_person_id)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40">
              <Plus className="h-3.5 w-3.5" /> {s.t("add_sister", "Add Sister Company")}
            </button>
          )}
          <button type="button" data-testid="c360-print" onClick={print} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700">
            <Printer className="h-3.5 w-3.5" /> {s.t("print", "Print / PDF")}
          </button>
          {onClose && (
            <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg border border-slate-300 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Compliance */}
      <section className={card}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> {s.t("sec_compliance", "Compliance & Reminders")}
        </h3>
        {data.compliance.length === 0 ? (
          <p className="text-xs text-slate-500">{s.t("no_findings", "No open compliance findings.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {data.compliance.map((x) => (
              <li key={x.code} data-testid={`compliance-${x.code}`} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs", SEV[x.severity])}>
                <span><b>{sevLabel(x.severity)}</b> · {complianceText(x.code)}</span>
                <button type="button" onClick={() => void openReminder(x.code)} className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 font-semibold hover:bg-white dark:bg-slate-900/60">
                  <BellPlus className="h-3.5 w-3.5" /> {s.t("create_reminder", "Create reminder task")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {reminderFor && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{s.t("responsible_user", "Responsible user")}</label>
              <select data-testid="reminder-assignee" className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">{s.t("select", "— Select —")}</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <button type="button" data-testid="reminder-create" disabled={!assignTo || busy} onClick={() => void createReminder()} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : s.t("create", "Create")}
            </button>
            <button type="button" onClick={() => setReminderFor(null)} className="h-9 rounded-lg border border-slate-300 px-3 text-xs dark:border-slate-700">{s.t("cancel", "Cancel")}</button>
          </div>
        )}
        {reminderMsg && <p data-testid="reminder-msg" className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{reminderMsg}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Legal details */}
        <section className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_legal", "Legal Identity & Registration")}</h3>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-3 gap-y-1.5 text-xs">
            {[
              [s.t("legal_structure", "Legal Structure"), optionLabel(LEGAL_STRUCTURE_OPTIONS, c.legal_structure, s.lang)],
              [s.t("nature", "Nature of Business"), c.nature_of_business || c.business_type],
              [s.t("registration_type", "Registration Type"), optionLabel(REGISTRATION_TYPE_OPTIONS, c.registration_type, s.lang)],
              [s.t("registration_number", "Registration / License No."), c.registration_number],
              [s.t("tax_number", "TRN / Tax Number"), c.tax_number],
              [s.t("incorporation_date", "Registration Date"), c.incorporation_date ? d(c.incorporation_date) : null],
              [s.t("license_expiry", "License Expiry"), c.license_expiry_date ? d(c.license_expiry_date) : null],
              [s.t("base_currency", "Base Currency"), c.base_currency],
              [s.t("country", "Country"), c.country_name],
              [s.t("address", "Address"), [c.address, c.city_name, c.state_name].filter(Boolean).join(", ")],
            ].map(([k, val]) => (
              <div key={String(k)} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{val || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Owner & sisters / branches */}
        <section className={card}>
          {type === "internal" ? (
            <>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <GitBranch className="h-4 w-4 text-blue-600" /> {s.t("sec_branches", "Branches Operating Under This Company")}
              </h3>
              {listTable(
                [s.t("branch", "Branch"), s.t("level", "Level"), s.t("code", "Code")],
                data.branches.map((b) => [b.name, b.level === "country_branch" ? s.t("main_branch", "Main Branch") : s.t("city_branch", "City Branch"), b.code || "—"]),
                "c360-branches"
              )}
              <p className="mt-2 text-[11px] text-slate-500">{s.t("branch_note", "Branches remain branch records; they only reference this legal company.")}</p>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_owner", "Customer / Owner")}</h3>
              {data.owner ? (
                <div data-testid="c360-owner" className="mb-3 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">{data.owner.customer_name}</div>
                  <div className="text-slate-500">{[data.owner.person_code, data.owner.mobile, data.owner.email].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              ) : (
                <p className="mb-3 text-xs text-slate-500">{s.t("no_owner", "No owner is linked to this company.")}</p>
              )}
              <h4 className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-300">{s.t("sec_sisters", "Sister Companies (same owner)")}</h4>
              {listTable(
                [s.t("company", "Company"), s.t("registration_number", "Registration / License No."), s.t("country", "Country")],
                data.sisterCompanies.map((x) => [
                  <button key={x.id} type="button" className="font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => router.push(`/dashboard/settings/company-setup?view=360&companyId=${x.id}` as Route)}>
                    {x.legal_name || x.name}
                  </button>,
                  x.registration_number || "—",
                  x.country_name || "—",
                ]),
                "c360-sisters"
              )}
            </>
          )}
        </section>
      </div>

      {/* Linked authoritative records */}
      <section className={card}>
        <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_transactions", "Orders, Invoices & CRM (this company only)")}</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">{s.t("n_purchase_orders", "Purchase orders")}</h4>
            {listTable([s.t("ref", "Reference"), s.t("date", "Date"), s.t("amount", "Amount")], data.purchaseOrders.map((p) => [p.purchase_order_no || p.purchase_contract_no || "—", d(p.created_at), `${p.currency_code ?? ""} ${Number(p.order_total ?? 0).toLocaleString("en-US")}`]), "c360-pos")}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">{s.t("n_invoices", "Invoices")}</h4>
            {listTable([s.t("ref", "Reference"), s.t("date", "Date"), s.t("amount", "Amount")], data.invoices.map((p) => [p.invoice_no || "—", d(p.document_date), `${p.document_currency ?? ""} ${Number(p.document_total_value ?? 0).toLocaleString("en-US")}`]), "c360-invoices")}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">{s.t("n_clearing_orders", "Clearing orders")}</h4>
            {listTable([s.t("ref", "Reference"), s.t("date", "Date"), s.t("status", "Status")], data.clearingOrders.map((p) => [p.order_no || "—", d(p.created_at), code(s.lang, p.status)]), "c360-clearing")}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300">{s.t("n_inquiries", "Customer inquiries")}</h4>
            {listTable([s.t("ref", "Reference"), s.t("date", "Date"), s.t("status", "Status")], data.inquiries.map((p) => [p.inquiry_no || "—", d(p.inquiry_date || p.created_at), code(s.lang, p.status)]), "c360-inquiries")}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Documents */}
        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileText className="h-4 w-4 text-blue-600" /> {s.t("n_documents", "Documents")}
            </h3>
            <button type="button" onClick={() => router.push(`/dashboard/documents?companyId=${encodeURIComponent(c.id)}` as Route)} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
              {s.t("open_documents", "Open company documents")}
            </button>
          </div>
          {listTable([s.t("document", "Document"), s.t("type", "Type"), s.t("date", "Date")], data.documents.map((x) => [x.title || x.file_name, code(s.lang, x.document_type || x.category), d(x.created_at)]), "c360-documents")}
        </section>

        {/* Bank master + accounts (reference only) */}
        <section className={card}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> {s.t("sec_accounts", "Bank Master & Accounts (reference only)")}
          </h3>
          {listTable([s.t("bank", "Bank"), s.t("account_title", "Account Title"), s.t("currency", "Currency")], data.bankMaster.map((b) => [b.bank_name, b.account_title || "—", b.currency || "—"]), "c360-banks")}
          <div className="mt-3">
            {listTable([s.t("account_code", "Account Code"), s.t("account_name", "Account Name"), s.t("currency", "Currency")], data.accounts.map((a) => [a.code || "—", a.name || "—", a.currency || "—"]), "c360-accounts")}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {s.t("accounts_note", "Accounts are opened only in New Account and posted only through Roznamcha / Journal. This view does not create accounts or balances.")}
          </p>
        </section>
      </div>

      {/* Tax + history */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_tax", "Tax Registration")}</h3>
          {listTable([s.t("tax_number", "TRN / Tax Number"), s.t("legal_name", "Legal Name"), s.t("filing_frequency", "Filing Frequency")], data.taxEntities.map((x) => [x.trn || "—", x.legal_name || "—", x.filing_frequency || "—"]), "c360-tax")}
        </section>
        <section className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{s.t("sec_history", "Audit History")}</h3>
          {listTable([s.t("action", "Action"), s.t("user", "User"), s.t("date", "Date")], data.history.map((h) => [code(s.lang, h.action), h.actor_name || "—", d(h.created_at)]), "c360-history")}
        </section>
      </div>
    </div>
  );
}
