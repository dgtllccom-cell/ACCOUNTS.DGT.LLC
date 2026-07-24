import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, CheckCircle2, KeyRound, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentErpSession } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  return source
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{value || "-"}</p>
    </div>
  );
}

function StrengthBar({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")} />
      <span className={active ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500"}>{label}</span>
    </div>
  );
}

export default async function UserProfileSettingsPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const primaryRole = session.roles[0] ?? "staff_user";
  const assignment = session.assignments[0] ?? null;
  const permissionPreview = session.permissions.includes("*:*") ? ["Full ERP Access", "All Countries", "All Reports", "All Settings"] : session.permissions.slice(0, 12);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
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
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">ERP User Profile</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{session.fullName || "ERP User"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Active</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{roleLabels[primaryRole] ?? primaryRole}</span>
                <span>{session.email || "No email"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard/new-entry/users/registration">Create User</Link>
            </Button>
            <Button asChild className="rounded-xl bg-blue-700 text-white hover:bg-blue-800">
              <Link href="/dashboard/users">User Directory</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-blue-600" /> Profile Information</CardTitle>
            <CardDescription>Complete identity, role, branch scope, and contact details for the signed-in user.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full Name" value={session.fullName} />
              <Field label="User ID" value={session.userId} />
              <Field label="Employee Code" value={session.userId.slice(0, 8).toUpperCase()} />
              <Field label="Role" value={roleLabels[primaryRole] ?? primaryRole} />
              <Field label="Email Address" value={session.email} />
              <Field label="Mobile Number" value="Update from user setup" />
              <Field label="Country Scope" value={session.isSuperAdmin ? "All Countries" : session.countryIds.join(", ") || assignment?.countryId} />
              <Field label="Main Branch Scope" value={session.isSuperAdmin ? "All Main Branches" : session.countryBranchIds.join(", ") || assignment?.countryBranchId} />
              <Field label="City Branch Scope" value={session.isSuperAdmin ? "All City Branches" : session.cityBranchIds.join(", ") || assignment?.cityBranchId} />
              <Field label="Department" value="ERP Operations" />
              <Field label="Last Login" value="Current session" />
              <Field label="Date Created" value="Profile record" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-emerald-600" /> Password & Security</CardTitle>
            <CardDescription>Secure password update panel with strength guidance. Backend password reset remains routed through ERP auth.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input type="password" placeholder="Current password" className="h-11 rounded-xl" />
              <Input type="password" placeholder="New password" className="h-11 rounded-xl" />
              <Input type="password" placeholder="Confirm new password" className="h-11 rounded-xl" />
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <StrengthBar label="Minimum 8 characters" active />
                <StrengthBar label="Uppercase and lowercase letters" active />
                <StrengthBar label="Number or symbol included" active={false} />
              </div>
              <Button className="w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
                <KeyRound className="mr-2 h-4 w-4" /> Change Password
              </Button>
              <p className="text-xs leading-6 text-slate-500">Password reset and verification emails are logged through the ERP communication system.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-orange-600" /> Email Account</CardTitle>
            <CardDescription>Update and verify the user email used for ERP notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={session.email ?? ""} readOnly className="h-11 rounded-xl" />
            <Button variant="outline" className="w-full rounded-xl">Change Email</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-4 w-4 text-cyan-600" /> Mobile & WhatsApp</CardTitle>
            <CardDescription>Mobile details are used for WhatsApp and security alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Mobile number" className="h-11 rounded-xl" />
            <Button variant="outline" className="w-full rounded-xl">Update Mobile</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-600" /> Permissions</CardTitle>
            <CardDescription>Role-based access inherited from ERP permission templates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {permissionPreview.map((permission) => (
                <span key={permission} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                  {permission}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Permission profile is active
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
