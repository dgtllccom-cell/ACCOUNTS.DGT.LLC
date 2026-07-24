import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { Building2, ChevronDown, Landmark, Layers3, LockKeyhole, Users } from "lucide-react";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { getCurrentErpSession } from "@/lib/auth/session";

type EntryStatus = "Ready" | "Next" | "Planned";

type BranchEntryItem = {
  title: string;
  description: string;
  href: Route;
  status: EntryStatus;
  allowRoles: EnterpriseRole[];
};

const branchEntryItems: BranchEntryItem[] = [
  {
    title: "Super Admin Branch",
    description: "Top level branch setup for country/company ownership.",
    href: "/dashboard/new-entry/branches/super-admin" as Route,
    status: "Ready",
    allowRoles: ["super_admin"]
  },
  {
    title: "Country Branch",
    description: "Country main branch setup under Super Admin ownership.",
    href: "/dashboard/new-entry/branch-entry/country-branch" as Route,
    status: "Ready",
    allowRoles: ["super_admin"]
  },
  {
    title: "City Branch",
    description: "City/sub-branch setup after selecting country and main branch.",
    href: "/dashboard/new-entry/branch-entry/city-branch" as Route,
    status: "Ready",
    allowRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  }
];

type UserEntryItem = {
  title: string;
  description: string;
  href: Route;
  status: EntryStatus;
  allowRoles: EnterpriseRole[];
};

const userEntryItems: UserEntryItem[] = [
  {
    title: "Super Admin User",
    description: "Create global-level administrators and assign enterprise permissions.",
    href: "/dashboard/new-entry/users/super-admin" as Route,
    status: "Ready",
    allowRoles: ["super_admin"]
  },
  {
    title: "Country User",
    description: "Create and assign users scoped to a single country.",
    href: "/dashboard/new-entry/users/country" as Route,
    status: "Ready",
    allowRoles: ["super_admin", "country_admin", "main_branch_admin"]
  },
  {
    title: "Branch User",
    description: "Create and assign users scoped to a selected city branch.",
    href: "/dashboard/new-entry/users/branch" as Route,
    status: "Ready",
    allowRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  },
  {
    title: "Agent User",
    description: "Create agent users for trading, shipping, or clearing workflows.",
    href: "/dashboard/new-entry/users/agent" as Route,
    status: "Next",
    allowRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  },
  {
    title: "Staff User",
    description: "Create staff users with limited task and branch access.",
    href: "/dashboard/new-entry/users/staff" as Route,
    status: "Next",
    allowRoles: ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"]
  }
];

type SimpleEntryItem = {
  title: string;
  description: string;
  href: Route;
  status: EntryStatus;
};

const accountEntryItems: SimpleEntryItem[] = [
  {
    title: "New Account",
    description: "Branch-aware account setup with live report preview.",
    href: "/dashboard/accounts/setup" as Route,
    status: "Ready"
  },
  {
    title: "New Account General Report",
    description: "Inspect all created accounts, journals, balances, and linked ledger activity.",
    href: "/dashboard/new-entry/accounts/general-report" as Route,
    status: "Ready"
  }
];

function StatusPill({ status }: { status: EntryStatus }) {
  const className =
    status === "Ready"
      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      : status === "Next"
        ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
        : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600";

  return <span className={className}>{status}</span>;
}

export default async function NewEntryPage() {
  const cookieStore = await cookies();
  const isPreviewSession = cookieStore.get("damaan_dashboard_preview")?.value === "1";

  let sessionRoles: EnterpriseRole[] | null = null;
  let isSuperAdmin = false;

  if (!isPreviewSession) {
    try {
      const session = await getCurrentErpSession();
      sessionRoles = session?.roles ?? null;
      isSuperAdmin = session?.isSuperAdmin ?? false;
    } catch {
      sessionRoles = null;
    }
  }

  const canAccess = (allowedRoles: EnterpriseRole[]) => {
    if (!sessionRoles) return true; // demo/template mode
    if (isSuperAdmin) return true;
    return allowedRoles.some((role) => sessionRoles.includes(role));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Entry</h1>
        <p className="text-sm text-muted-foreground">
          Start new branch, account, document, purchase, sale, and ledger workflows from one place.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden />
                  <h2 className="font-semibold">Branch Entry</h2>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Super Admin, Country, and City branch setup screens grouped under one dropdown.
                </p>
              </div>
              <ChevronDown
                className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>

            <div className="grid gap-3 border-t p-5">
              {branchEntryItems.map((item) => {
                const permitted = canAccess(item.allowRoles);
                const content = (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        {!permitted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                            Restricted
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                );

                if (!permitted) {
                  return (
                    <div
                      key={item.title}
                      className="rounded-lg border bg-slate-50 p-4 opacity-70"
                      aria-disabled="true"
                    >
                      {content}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-lg border bg-white p-4 transition hover:border-primary hover:shadow-sm"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </details>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="font-semibold">Account</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Create branch-level accounts and khaata records.</p>
          </div>

          <div className="grid gap-3 p-5">
            {accountEntryItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-lg border bg-white p-4 transition hover:border-primary hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" aria-hidden />
                  <h2 className="font-semibold">User Entry</h2>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Create Super Admin, Country, Branch, Agent, and Staff users from one dropdown.
                </p>
              </div>
              <ChevronDown
                className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              />
            </summary>

            <div className="grid gap-3 border-t p-5">
              {userEntryItems.map((item) => {
                const permitted = canAccess(item.allowRoles);
                const content = (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                        {!permitted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                            Restricted
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                );

                if (!permitted) {
                  return (
                    <div
                      key={item.title}
                      className="rounded-lg border bg-slate-50 p-4 opacity-70"
                      aria-disabled="true"
                    >
                      {content}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-lg border bg-white p-4 transition hover:border-primary hover:shadow-sm"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </details>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <Layers3 className="mt-1 h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Branch hierarchy</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Super Admin Branch will sit at the top. Country Branch, Main Branch, and City Branch
              screens will follow under this same New Entry structure.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
