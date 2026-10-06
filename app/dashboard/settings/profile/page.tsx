import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, KeyRound, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t, type UiKey } from "@/lib/i18n/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Settings — Profile" };


export const dynamic = "force-dynamic";

const roleFallback: Record<string, string> = {
  super_admin: "Super Admin",
  country_admin: "Country Admin",
  country_user: "Country User",
  main_branch_admin: "Main Branch Admin",
  city_branch_admin: "City Branch Admin",
  accountant: "Accountant",
  cashier: "Cashier",
  agent_user: "Agent User",
  staff_user: "Staff User",
  auditor_viewer: "Auditor / Viewer"
};

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = name || email || "User";
  return (
    source
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read-only display field. Values are never editable from this page.
 *  `technical` renders opaque identifiers (UUIDs) in a muted monospace style with
 *  the full value on hover, so they read as system metadata, not primary data. */
function Field({
  label,
  value,
  technical,
}: {
  label: string;
  value: string | null | undefined;
  technical?: boolean;
}) {
  const raw = value ?? "";
  const isUuid = technical && UUID_RE.test(raw);
  const shown = isUuid ? `…${raw.slice(-12)}` : raw || "—";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p
        className={
          isUuid
            ? "mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono break-all"
            : "mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 break-words"
        }
        title={isUuid ? raw : undefined}
      >
        {shown}
      </p>
    </div>
  );
}

export default async function UserProfileSettingsPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  const lang = await getRequestLanguage();

  const primaryRole = session.roles[0] ?? "staff_user";
  const roleLabel = t(lang, `role.${primaryRole}` as UiKey, roleFallback[primaryRole] ?? primaryRole);
  const assignment = session.assignments[0] ?? null;

  const countryScope = session.isSuperAdmin
    ? t(lang, "prof.v_all_countries", "All Countries")
    : session.countryIds.join(", ") || assignment?.countryId || "-";
  const mainBranchScope = session.isSuperAdmin
    ? t(lang, "prof.v_all_main_branches", "All Main Branches")
    : session.countryBranchIds.join(", ") || assignment?.countryBranchId || "-";
  const cityScope = session.isSuperAdmin
    ? t(lang, "prof.v_all_city_branches", "All City Branches")
    : session.cityBranchIds.join(", ") || assignment?.cityBranchId || "-";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-blue-700 to-cyan-500 text-2xl font-black text-white shadow-lg shadow-blue-700/20">
              {initials(session.fullName, session.email)}
              <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-xl border border-white bg-white text-blue-700 shadow dark:border-slate-800 dark:bg-slate-950">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">{t(lang, "nav.my_profile", "My Profile")}</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{session.fullName || t(lang, "prof.erp_user", "ERP User")}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{t(lang, "common.active", "Active")}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{roleLabel}</span>
                <span>{session.email || t(lang, "bdash.no_email", "No email")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <Lock className="h-4 w-4" /> {t(lang, "prof.readonly_notice", "Read-only. Only login credentials can be changed.")}
          </div>
        </div>
      </div>

      {/* Read-only profile information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-blue-600" /> {t(lang, "prof.info_title", "Profile Information")}</CardTitle>
          <CardDescription>{t(lang, "prof.info_desc", "Complete identity, role and branch assignment for the signed-in user. These details are managed by administrators and cannot be edited here.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t(lang, "prof.f_full_name", "Employee / Full Name")} value={session.fullName} />
            <Field label={t(lang, "roz.user_id", "User ID")} value={session.userId} technical />
            <Field label={t(lang, "prof.f_user_role", "User Role")} value={roleLabel} />
            <Field label={t(lang, "common.country", "Country")} value={countryScope} />
            <Field label={t(lang, "crm.main_branch", "Main Branch")} value={mainBranchScope} />
            <Field label={t(lang, "crm.city_branch", "City / Branch")} value={cityScope} />
            <Field label={t(lang, "prof.f_branch_code", "Branch Code")} value={assignment?.countryBranchId ?? "-"} />
            <Field label={t(lang, "prof.f_state", "State / Province")} value={session.isSuperAdmin ? t(lang, "prof.v_all_states", "All States") : "-"} />
            <Field label={t(lang, "prof.f_department", "Department")} value={t(lang, "prof.v_erp_ops", "ERP Operations")} />
            <Field label={t(lang, "prof.f_designation", "Designation")} value={roleLabel} />
            <Field label={t(lang, "prof.f_login_email", "Login Email")} value={session.email} />
            <Field label={t(lang, "prof.f_account_status", "Account Status")} value={t(lang, "common.active", "Active")} />
            <Field label={t(lang, "prof.f_last_login", "Last Login")} value={t(lang, "prof.v_current_session", "Current session")} />
          </div>
        </CardContent>
      </Card>

      {/* Login & security — the ONLY editable area (staged: wired in next phase) */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> {t(lang, "prof.creds_title", "Login Credentials")}</CardTitle>
            <CardDescription>{t(lang, "prof.creds_desc", "Only User ID, Login Email and Password can be updated. All other information is read-only.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t(lang, "roz.user_id", "User ID")} value={session.userId} technical />
            <Field label={t(lang, "prof.f_login_email", "Login Email")} value={session.email} />
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link href="/dashboard/settings/profile">{t(lang, "prof.edit_login", "Edit Login Information")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-emerald-600" /> {t(lang, "prof.pwd_title", "Password")}</CardTitle>
            <CardDescription>{t(lang, "prof.pwd_desc", "Reset your password securely via an email link sent to your registered login email.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> {t(lang, "prof.pwd_link_note", "A secure, time-limited reset link will be emailed to")} {session.email || t(lang, "prof.your_login_email", "your login email")}.
            </div>
            <Button asChild className="w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              <Link href="/dashboard/settings/profile">{t(lang, "prof.reset_password", "Reset Password")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
