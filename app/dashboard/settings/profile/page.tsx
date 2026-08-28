import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, KeyRound, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentErpSession } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Settings — Profile" };


export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  country_admin: "Country Admin",
  country_user: "Country User",
  main_branch_admin: "Main Branch Admin",
  city_branch_admin: "City / Branch Admin",
  accountant: "Accountant",
  cashier: "Cashier",
  agent_user: "Loading / Agent User",
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

/** Read-only display field. Values are never editable from this page. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 break-words">{value || "-"}</p>
    </div>
  );
}

export default async function UserProfileSettingsPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const primaryRole = session.roles[0] ?? "staff_user";
  const assignment = session.assignments[0] ?? null;

  // Scope values are shown READ-ONLY. Super admins see "All"; others see their
  // assigned scope. (Human-readable Country/Branch/State/City names are resolved
  // in the next phase via a server query; IDs shown until then.)
  const countryScope = session.isSuperAdmin
    ? "All Countries"
    : session.countryIds.join(", ") || assignment?.countryId || "-";
  const mainBranchScope = session.isSuperAdmin
    ? "All Main Branches"
    : session.countryBranchIds.join(", ") || assignment?.countryBranchId || "-";
  const cityScope = session.isSuperAdmin
    ? "All City Branches"
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
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">My Profile</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{session.fullName || "ERP User"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{roleLabels[primaryRole] ?? primaryRole}</span>
                <span>{session.email || "No email"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <Lock className="h-4 w-4" /> Read-only. Only login credentials can be changed.
          </div>
        </div>
      </div>

      {/* Read-only profile information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-blue-600" /> Profile Information</CardTitle>
          <CardDescription>Complete identity, role and branch assignment for the signed-in user. These details are managed by administrators and cannot be edited here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Employee / Full Name" value={session.fullName} />
            <Field label="User ID" value={session.userId} />
            <Field label="User Role" value={roleLabels[primaryRole] ?? primaryRole} />
            <Field label="Country" value={countryScope} />
            <Field label="Main Branch" value={mainBranchScope} />
            <Field label="City / Branch" value={cityScope} />
            <Field label="Branch Code" value={assignment?.countryBranchId ?? "-"} />
            <Field label="State / Province" value={session.isSuperAdmin ? "All States" : "-"} />
            <Field label="Department" value="ERP Operations" />
            <Field label="Designation" value={roleLabels[primaryRole] ?? primaryRole} />
            <Field label="Login Email" value={session.email} />
            <Field label="Account Status" value="Active" />
            <Field label="Last Login" value="Current session" />
          </div>
        </CardContent>
      </Card>

      {/* Login & security — the ONLY editable area (staged: wired in next phase) */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> Login Credentials</CardTitle>
            <CardDescription>Only User ID, Login Email and Password can be updated. All other information is read-only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="User ID" value={session.userId} />
            <Field label="Login Email" value={session.email} />
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link href="/dashboard/settings/profile">Edit Login Information</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-emerald-600" /> Password</CardTitle>
            <CardDescription>Reset your password securely via an email link sent to your registered login email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> A secure, time-limited reset link will be emailed to {session.email || "your login email"}.
            </div>
            <Button asChild className="w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              <Link href="/dashboard/settings/profile">Reset Password</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
