import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  Database,
  GitBranch,
  Globe2,
  LockKeyhole,
  Network,
  ShieldCheck,
  Users
} from "lucide-react";

const hierarchy = [
  {
    title: "Super Admin",
    scope: "Global",
    detail: "Creates countries, main branches, admins, permissions, currency rates, and global USD reports.",
    icon: ShieldCheck
  },
  {
    title: "Country Main Branch",
    scope: "Single country",
    detail: "Country Admin manages one country, creates city branches, and views country-only reports.",
    icon: Globe2
  },
  {
    title: "City / Sub Branch",
    scope: "Selected city branch",
    detail: "Branch Admin manages local users, customers, daily transactions, and branch reports.",
    icon: Building2
  },
  {
    title: "Staff / User",
    scope: "Assigned work",
    detail: "Staff can only access assigned branch tasks, transactions, and documents.",
    icon: Users
  }
];

const databaseTables = [
  "users / profiles",
  "roles",
  "countries",
  "country_branches",
  "city_branches",
  "permissions",
  "user_role_assignments",
  "transactions",
  "currency_rates",
  "reports"
];

const permissionRows = [
  ["Super Admin", "All countries, all branches, all users, all USD reports"],
  ["Country Admin", "Only assigned country, its main branch, city branches, users, reports"],
  ["Branch Admin", "Only assigned city branch, local users, daily transactions"],
  ["Staff/User", "Only assigned tasks and records"]
];

const apiRows = [
  ["POST", "/api/branch-management/countries", "Create country"],
  ["POST", "/api/branch-management/country-branches", "Create one main branch per country"],
  ["POST", "/api/branch-management/city-branches", "Create city branch after selected country"]
];

export default function BranchManagementPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Multi-Country Branch Management</h1>
          <p className="text-sm text-muted-foreground">
            Super Admin, country main branch, city branch, role access, and USD reporting foundation.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Foundation designed
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {hierarchy.map((item) => (
          <article key={item.title} className="rounded-lg border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase text-slate-500">{item.scope}</p>
            <h2 className="mt-1 font-semibold text-slate-950">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Network className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">Branch Creation Flow</h2>
              <p className="text-sm text-muted-foreground">The software must follow this order.</p>
            </div>
          </div>
          <div className="grid gap-3 p-5">
            {[
              ["1", "Super Admin creates Country", "Pakistan, India, Iran, Afghanistan, Dubai."],
              ["2", "Super Admin creates Country Main Branch", "Only one main branch is allowed per country."],
              ["3", "Country Admin creates City Branch", "System asks to select country first, then city and branch name."],
              ["4", "Branch Admin runs daily branch work", "Local users, customers, transactions, and branch reports."],
              ["5", "Reports roll up to USD", "Local amounts are stored, USD rates convert global reports."]
            ].map(([step, title, detail]) => (
              <div key={step} className="grid grid-cols-[42px_1fr] gap-3 rounded-lg border bg-white p-4">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-white">
                  {step}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <LockKeyhole className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">Role Access Matrix</h2>
              <p className="text-sm text-muted-foreground">Every query and report uses these boundaries.</p>
            </div>
          </div>
          <div className="divide-y p-5">
            {permissionRows.map(([role, scope]) => (
              <div key={role} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold text-slate-950">{role}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{scope}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-lg border bg-card xl:col-span-2">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Database className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-semibold">Database Tables</h2>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {databaseTables.map((table) => (
              <div key={table} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                {table}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <BadgeDollarSign className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-semibold">USD Reporting</h2>
          </div>
          <div className="space-y-3 p-5 text-sm leading-6 text-muted-foreground">
            <p>Transactions keep local currency and local amount.</p>
            <p>Currency rates convert the posted amount into USD.</p>
            <p>Super Admin global reports always read USD totals.</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <GitBranch className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-semibold">Backend API Draft</h2>
        </div>
        <div className="grid gap-3 p-5">
          {apiRows.map(([method, path, detail]) => (
            <div key={path} className="grid gap-2 rounded-lg border bg-white p-4 md:grid-cols-[90px_1fr_1fr]">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-center text-xs font-bold text-white">{method}</span>
              <code className="text-sm font-semibold text-slate-800">{path}</code>
              <span className="text-sm text-slate-500">{detail}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

