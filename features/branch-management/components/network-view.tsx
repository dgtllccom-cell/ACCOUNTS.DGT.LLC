"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, ChevronRight, Globe2, Loader2, Mail, MapPin, Phone, Printer,
  ShieldCheck, Ship, Users, Wallet
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { BranchRulesDrawer, type BranchRulesScope } from "./branch-rules-drawer";

type Screen = ReturnType<typeof useErpScreen>;

const humanize = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function useNetworkView(type: "country" | "branch", id: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/branch-management/network-view?type=${type}&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? (typeof json?.error === "string" ? json.error : `HTTP ${res.status}`));
      setData(json?.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [type, id]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}

function DomainBadge({ s, type }: { s: Screen; type: string }) {
  const shipping = type === "shipping";
  const both = type === "both";
  const cls = shipping
    ? "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800"
    : both
      ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800"
      : "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-800";
  const label = shipping ? s.t("badge_shipping", "Shipping & Clearing") : both ? s.t("badge_both", "Business + Shipping") : s.t("badge_business", "Business");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${cls}`}>
      {shipping ? <Ship className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {label}
    </span>
  );
}

function StatusBadge({ s, status }: { s: Screen; status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
          : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? s.t("status_active", "Active") : s.t("status_inactive", "Inactive")}
    </span>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: ReactNode; tone?: "slate" | "indigo" | "teal" | "emerald" }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900 dark:text-slate-50",
    indigo: "text-indigo-700 dark:text-indigo-300",
    teal: "text-teal-700 dark:text-teal-300",
    emerald: "text-emerald-700 dark:text-emerald-300"
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children, id, right }: { title: string; icon?: ReactNode; children: ReactNode; id?: string; right?: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          {icon}
          {title}
        </h2>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** LTR-wrapped value, or null so Field renders the em-dash placeholder. */
const ltr = (v: ReactNode) => (v === null || v === undefined || v === "" ? null : <span dir="ltr">{v}</span>);

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900 dark:text-slate-100">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Empty({ s }: { s: Screen }) {
  return <p className="py-4 text-center text-sm text-slate-500">{s.t("none_found", "No records found.")}</p>;
}

function UsersTable({ s, users }: { s: Screen; users: any[] }) {
  if (!users.length) return <Empty s={s} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800">
            <th className={`py-2 ${s.textStart}`}>{s.t("col_name", "Name")}</th>
            <th className={`py-2 ${s.textStart}`}>{s.t("col_role", "Role")}</th>
            <th className={`py-2 ${s.textStart}`}>{s.t("col_domain", "Domain")}</th>
            <th className={`py-2 ${s.textStart}`}>{s.t("col_status", "Status")}</th>
            <th className={`py-2 ${s.textStart}`}>{s.t("col_permissions", "Permissions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.assignmentId} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-900">
              <td className="py-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</p>
                <p className="text-xs text-slate-500" dir="ltr">{u.email ?? ""}</p>
              </td>
              <td className="py-2">{s.tGlobal(`role.${u.role}`, humanize(u.role))}</td>
              <td className="py-2"><DomainBadge s={s} type={u.domain === "shipping" ? "shipping" : u.domain === "both" ? "both" : "business"} /></td>
              <td className="py-2"><StatusBadge s={s} status={u.status} /></td>
              <td className="py-2">
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {u.permissions.length} {s.t("permissions_count", "permissions")}
                  </summary>
                  <div className="mt-1 flex max-w-sm flex-wrap gap-1" dir="ltr">
                    {u.permissions.slice(0, 40).map((p: string) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">{p}</span>
                    ))}
                    {u.permissions.length > 40 && <span className="text-[10px] text-slate-500">+{u.permissions.length - 40}</span>}
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shell({ s, children, title, subtitle, back, printId, badges }: { s: Screen; children: ReactNode; title: string; subtitle?: string; back: { href: string; label: string }; printId: string; badges?: ReactNode }) {
  const doPrint = () => {
    import("@/lib/reports/print-dom-fragment").then((m) => {
      if (!m.printDomFragmentViaModal(printId, title, { lang: s.lang })) window.print();
    });
  };
  return (
    <div dir={s.dir} className="mx-auto w-full max-w-[1400px] space-y-5 px-1 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back.href} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <ArrowLeft className={`h-3.5 w-3.5 ${s.isRtl ? "rotate-180" : ""}`} />
          {back.label}
        </Link>
        <button type="button" onClick={doPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
          <Printer className="h-3.5 w-3.5" />
          {s.t("print_pdf", "Print / PDF")}
        </button>
      </div>
      <div id={printId} className="space-y-5">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
            {badges}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Loading({ s }: { s: Screen }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}
    </div>
  );
}

function ErrorBox({ s, message, onRetry }: { s: Screen; message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
      <AlertTriangle className="mx-auto h-6 w-6 text-rose-600" />
      <p className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-200">{s.t("load_failed", "Could not load this view.")}</p>
      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">{s.t("retry", "Retry")}</button>
    </div>
  );
}

/* ───────────────────────── Country Operations View ───────────────────────── */

export function CountryOperationsView({ countryId, lang }: { countryId: string; lang?: string }) {
  const s = useErpScreen("netv", lang);
  const { data, error, loading, reload } = useNetworkView("country", countryId);
  const [rules, setRules] = useState<BranchRulesScope | null>(null);
  const back = { href: "/dashboard/branch-management/general-report", label: s.t("back_report", "Back to Branch General Report") };

  if (loading) return <div dir={s.dir}><Loading s={s} /></div>;
  if (error || !data) return <div dir={s.dir}><ErrorBox s={s} message={error ?? ""} onRetry={reload} /></div>;

  const c = data.country;
  const main = data.mainBranches?.[0];
  const admin = data.countryAdmins?.[0];

  return (
    <>
      <Shell
        s={s}
        title={`${c.name} — ${s.t("country_ops", "Country Operations")}`}
        subtitle={s.t("country_ops_sub", "Country → Country Main Branch → Admin & Users → City / Operational Branches")}
        back={back}
        printId="network-country-view"
        badges={<StatusBadge s={s} status={c.status} />}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label={s.t("active_branches", "Active branches")} value={data.totals.activeBranches} tone="indigo" />
          <Stat label={s.t("business_branches", "Business branches")} value={data.totals.businessBranches} tone="indigo" />
          <Stat label={s.t("shipping_branches", "Shipping branches")} value={data.totals.shippingBranches} tone="teal" />
          <Stat label={s.t("total_users", "Users")} value={data.totals.users} tone="emerald" />
          <Stat label={s.t("total_accounts", "Accounts")} value={data.totals.accounts} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Section title={s.t("country_identity", "Country")} icon={<Globe2 className="h-4 w-4 text-indigo-500" />}>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={s.t("name", "Name")} value={c.name} />
              <Field label={s.t("code", "Code")} value={ltr(c.code)} />
              <Field label={s.t("currency", "Currency")} value={ltr(c.currency)} />
              <Field label={s.t("status", "Status")} value={<StatusBadge s={s} status={c.status} />} />
            </dl>
          </Section>

          <Section title={s.t("main_branch", "Country Main Branch")} icon={<Building2 className="h-4 w-4 text-indigo-500" />}>
            {main ? (
              <dl className="grid grid-cols-2 gap-4">
                <Field label={s.t("name", "Name")} value={main.name} />
                <Field label={s.t("code", "Code")} value={ltr(main.code)} />
                <Field label={s.t("status", "Status")} value={<StatusBadge s={s} status={main.status} />} />
                <Field label={s.t("col_domain", "Domain")} value={<DomainBadge s={s} type={main.domain === "shipping" ? "shipping" : "business"} />} />
              </dl>
            ) : (
              <Empty s={s} />
            )}
          </Section>

          <Section title={s.t("country_admin", "Country Admin")} icon={<ShieldCheck className="h-4 w-4 text-indigo-500" />}>
            {admin ? (
              <ul className="space-y-3">
                {data.countryAdmins.map((a: any) => (
                  <li key={a.userId} className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{a.name}</p>
                      <p className="break-all text-xs text-slate-500" dir="ltr">{a.email}</p>
                    </div>
                    <StatusBadge s={s} status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{s.t("not_assigned", "Not assigned")}</p>
            )}
          </Section>
        </div>

        <Section title={s.t("contact_info", "Contact & operating information")} icon={<Phone className="h-4 w-4 text-indigo-500" />}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={s.t("email", "Email")} value={ltr(c.email ?? c.adminEmail)} />
            <Field label={s.t("phone", "Phone")} value={ltr(main?.phone ?? (c.phoneCode ? `+${String(c.phoneCode).replace(/^\+/, "")}` : null))} />
            <Field label={s.t("whatsapp", "WhatsApp")} value={ltr(main?.whatsapp ?? c.whatsapp)} />
            <Field label={s.t("address", "Address")} value={main?.address} />
            <Field label={s.t("reporting_currency", "Reporting currency")} value={ltr(c.reportingCurrency)} />
            <Field label={s.t("language", "Default language")} value={c.language ? c.language.toUpperCase() : null} />
          </dl>
        </Section>

        <Section title={s.t("direct_users", "Users assigned directly to the Country Main Branch")} icon={<Users className="h-4 w-4 text-indigo-500" />}>
          <UsersTable s={s} users={data.directUsers} />
        </Section>

        <Section
          title={s.t("city_branches", "City & operational branches")}
          icon={<MapPin className="h-4 w-4 text-indigo-500" />}
          right={<span className="text-xs font-semibold text-slate-500">{data.branches.length}</span>}
        >
          {data.branches.length === 0 ? (
            <Empty s={s} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.branches.map((b: any) => (
                <article key={b.id} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-bold text-slate-900 dark:text-slate-50">{b.name}</h3>
                      <p className="font-mono text-xs text-slate-500" dir="ltr">{b.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <DomainBadge s={s} type={b.type} />
                      <StatusBadge s={s} status={b.status} />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <Field label={s.t("city", "City")} value={b.cityName} />
                    <Field label={s.t("country", "Country")} value={b.countryName} />
                    <Field label={s.t("col_domain", "Domain")} value={b.type === "shipping" ? s.t("domain_shipping", "Shipping & Clearing Domain") : s.t("domain_business", "Business Domain")} />
                    <Field label={s.t("branch_admin", "Branch Admin")} value={b.admin?.name} />
                    <Field label={s.t("total_users", "Users")} value={<span className="font-bold tabular-nums">{b.users}</span>} />
                    <Field label={s.t("authorized_accounts", "Authorized accounts")} value={<span className="font-bold tabular-nums">{b.accounts}</span>} />
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <Link href={`/dashboard/branch-management/branch/${b.id}`} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700">{s.t("act_view", "View")}</Link>
                    <Link href={`/dashboard/new-entry/branch-entry/city-branch?editId=${b.id}`} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200">{s.t("act_edit", "Edit")}</Link>
                    <button
                      type="button"
                      onClick={() => setRules({ scopeType: "city_branch", scopeId: b.id, scopeName: b.name, parentHierarchy: [c.name, main?.name ?? "", b.cityName].filter(Boolean) })}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200"
                    >
                      {s.t("act_rules", "Rules")}
                    </button>
                    <Link href={`/dashboard/branch-management/branch/${b.id}#users`} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200">{s.t("act_users", "Users")}</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      </Shell>
      {rules && <BranchRulesDrawer isOpen onClose={() => setRules(null)} scope={rules} lang={s.lang} />}
    </>
  );
}

/* ───────────────────────── Branch Detail View ───────────────────────── */

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function BranchDetailView({ branchId, lang }: { branchId: string; lang?: string }) {
  const s = useErpScreen("netv", lang);
  const { data, error, loading, reload } = useNetworkView("branch", branchId);
  const [rules, setRules] = useState<BranchRulesScope | null>(null);

  if (loading) return <div dir={s.dir}><Loading s={s} /></div>;
  if (error || !data) {
    return (
      <div dir={s.dir} className="space-y-4">
        <ErrorBox s={s} message={error ?? ""} onRetry={reload} />
      </div>
    );
  }
  const b = data.branch;
  const back = { href: `/dashboard/branch-management/country/${data.country.id}`, label: `${s.t("back_country", "Back to")} ${data.country.name}` };

  return (
    <>
      <Shell
        s={s}
        title={b.name}
        subtitle={`${data.country.name} › ${data.mainBranch?.name ?? ""} › ${b.cityName}`}
        back={back}
        printId="network-branch-view"
        badges={
          <>
            <DomainBadge s={s} type={b.type} />
            <StatusBadge s={s} status={b.status} />
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label={s.t("total_users", "Users")} value={data.users.length} tone="emerald" />
          <Stat label={s.t("authorized_accounts", "Authorized accounts")} value={data.accounts.total} />
          <Stat label={s.t("ledgers", "Ledgers")} value={data.ledgers.total} />
          <Stat label={s.t("linked_companies", "Linked companies")} value={data.companies.length} tone="indigo" />
          <Stat label={s.t("linked_customers", "Linked customers")} value={data.customers.length} tone="teal" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={s.t("identity", "Identity & address")} icon={<MapPin className="h-4 w-4 text-indigo-500" />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label={s.t("name", "Name")} value={b.name} />
              <Field label={s.t("code", "Code")} value={ltr(b.code)} />
              <Field label={s.t("city", "City")} value={b.cityName} />
              <Field label={s.t("currency", "Currency")} value={ltr(b.currency)} />
              <Field label={s.t("address", "Address")} value={b.address} />
              <Field label={s.t("owner", "Owner")} value={b.ownerName} />
              <Field label={s.t("phone", "Phone")} value={ltr(b.phone)} />
              <Field label={s.t("whatsapp", "WhatsApp")} value={ltr(b.whatsapp)} />
              <Field label={s.t("email", "Email")} value={ltr(b.email)} />
              <Field label={s.t("col_domain", "Domain")} value={b.type === "shipping" ? s.t("domain_shipping", "Shipping & Clearing Domain") : s.t("domain_business", "Business Domain")} />
            </dl>
          </Section>

          <div className="space-y-5">
            <Section title={s.t("parent_hierarchy", "Parent hierarchy")} icon={<Globe2 className="h-4 w-4 text-indigo-500" />}>
              <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <li><Link href={`/dashboard/branch-management/country/${data.country.id}`} className="text-indigo-700 hover:underline dark:text-indigo-300">{data.country.name}</Link></li>
                <ChevronRight className={`h-4 w-4 text-slate-400 ${s.isRtl ? "rotate-180" : ""}`} />
                <li>{data.mainBranch?.name ?? "—"}</li>
                <ChevronRight className={`h-4 w-4 text-slate-400 ${s.isRtl ? "rotate-180" : ""}`} />
                <li>{b.name}</li>
              </ol>
            </Section>

            <Section title={s.t("branch_admin", "Branch Admin")} icon={<ShieldCheck className="h-4 w-4 text-indigo-500" />}>
              {data.admin ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label={s.t("name", "Name")} value={data.admin.name} />
                  <Field label={s.t("email", "Email")} value={ltr(data.admin.email)} />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">{s.t("not_assigned", "Not assigned")}</p>
              )}
            </Section>

            <Section
              title={s.t("separation", "Business / Shipping separation")}
              icon={data.separation.usersOtherDomain + data.separation.accountsOtherDomain === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            >
              {data.separation.usersOtherDomain + data.separation.accountsOtherDomain === 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{s.t("sep_ok", "No users or accounts from the other domain are attached to this branch.")}</p>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {s.t("sep_bad", "Records from the other domain are attached — review:")} {data.separation.usersOtherDomain} / {data.separation.accountsOtherDomain}
                </p>
              )}
            </Section>
          </div>
        </div>

        <Section id="users" title={s.t("branch_users", "Branch Admin & users")} icon={<Users className="h-4 w-4 text-indigo-500" />}
          right={
            <button
              type="button"
              onClick={() => setRules({ scopeType: "city_branch", scopeId: b.id, scopeName: b.name, parentHierarchy: [data.country.name, data.mainBranch?.name ?? "", b.cityName].filter(Boolean) })}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              {s.t("act_rules", "Rules")}
            </button>
          }
        >
          <UsersTable s={s} users={data.users} />
        </Section>

        <Section title={s.t("authorized_accounts", "Authorized accounts")} icon={<Wallet className="h-4 w-4 text-indigo-500" />} right={<span className="text-xs font-semibold text-slate-500">{data.accounts.total}</span>}>
          {data.accounts.rows.length === 0 ? <Empty s={s} /> : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800">
                    <th className={`py-2 ${s.textStart}`}>{s.t("code", "Code")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("col_name", "Name")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("kind", "Type")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("currency", "Currency")}</th>
                    <th className={`py-2 ${s.textEnd}`}>{s.t("balance", "Balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.rows.map((a: any) => (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                      <td className="py-1.5 font-mono text-xs" dir="ltr">{a.code}</td>
                      <td className="py-1.5">{a.name}</td>
                      <td className="py-1.5 text-xs">{humanize(String(a.kind ?? ""))}</td>
                      <td className="py-1.5 font-mono text-xs" dir="ltr">{a.currency}</td>
                      <td className={`py-1.5 tabular-nums ${s.textEnd}`} dir="ltr">{fmt(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title={s.t("ledgers", "Ledgers")} right={<span className="text-xs font-semibold text-slate-500">{data.ledgers.total}</span>}>
          {data.ledgers.rows.length === 0 ? <Empty s={s} /> : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800">
                    <th className={`py-2 ${s.textStart}`}>{s.t("code", "Code")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("col_name", "Name")}</th>
                    <th className={`py-2 ${s.textEnd}`}>{s.t("debit", "Debit")}</th>
                    <th className={`py-2 ${s.textEnd}`}>{s.t("credit", "Credit")}</th>
                    <th className={`py-2 ${s.textEnd}`}>{s.t("balance", "Balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledgers.rows.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                      <td className="py-1.5 font-mono text-xs" dir="ltr">{l.code}</td>
                      <td className="py-1.5">{l.name}</td>
                      <td className={`py-1.5 tabular-nums ${s.textEnd}`} dir="ltr">{fmt(l.debit)}</td>
                      <td className={`py-1.5 tabular-nums ${s.textEnd}`} dir="ltr">{fmt(l.credit)}</td>
                      <td className={`py-1.5 tabular-nums ${s.textEnd}`} dir="ltr">{fmt(l.balance)} <span className="text-[10px] text-slate-400">{l.currency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={s.t("linked_companies", "Linked companies")} icon={<Building2 className="h-4 w-4 text-indigo-500" />}>
            {data.companies.length === 0 ? <Empty s={s} /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-900">
                {data.companies.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="font-mono text-xs text-slate-500" dir="ltr">{c.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={s.t("linked_customers", "Linked customers")} icon={<Users className="h-4 w-4 text-indigo-500" />}>
            {data.customers.length === 0 ? <Empty s={s} /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-900">
                {data.customers.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-slate-500" dir="ltr">{c.mobile}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title={s.t("modules", "Operational modules available")} icon={<Ship className="h-4 w-4 text-indigo-500" />}>
          <div className="flex flex-wrap gap-2">
            {data.modules.map((m: string) => (
              <span key={m} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {s.t(`mod_${m}`, humanize(m))}
              </span>
            ))}
          </div>
        </Section>

        <Section title={s.t("audit", "Activity & audit history")} icon={<Mail className="h-4 w-4 text-indigo-500" />}>
          {data.audit.length === 0 ? <Empty s={s} /> : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800">
                    <th className={`py-2 ${s.textStart}`}>{s.t("audit_when", "When")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("audit_action", "Action")}</th>
                    <th className={`py-2 ${s.textStart}`}>{s.t("audit_actor", "By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.map((a: any) => (
                    <tr key={a.id} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                      <td className="py-1.5 text-xs tabular-nums" dir="ltr">{String(a.at).replace("T", " ").slice(0, 16)}</td>
                      <td className="py-1.5 font-mono text-xs" dir="ltr">{a.action}</td>
                      <td className="py-1.5">{a.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">{s.t("audit_note", "Archived branches appear only in authorized audit history, never in active lists or totals.")}</p>
        </Section>
      </Shell>
      {rules && <BranchRulesDrawer isOpen onClose={() => setRules(null)} scope={rules} lang={s.lang} />}
    </>
  );
}
