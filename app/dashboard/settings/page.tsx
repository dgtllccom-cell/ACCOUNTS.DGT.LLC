import Link from "next/link";
import type { Route } from "next";
import { Anchor, Building2, Landmark, Mail, MapPin, Settings, Ship, SlidersHorizontal, Warehouse, Globe, Globe2 } from "lucide-react";

const settingsItems = [
  {
    title: "Company Setup",
    description: "Company incorporation, owner identification, contacts, and registrations.",
    href: "/dashboard/settings/company-setup" as Route,
    icon: Building2
  },
  {
    title: "Location Management",
    description: "Configure the global 4-level location hierarchy: Country, State, City, and Tehsil.",
    href: "/dashboard/settings/location" as Route,
    icon: MapPin
  },
  {
    title: "Bank Master Form",
    description: "Create banks once and use them everywhere — accounts, payments, receipts, ledger, purchases, and reports.",
    href: "/dashboard/settings/bank" as Route,
    icon: Landmark
  },
  {
    title: "Customer Warehouse",
    description: "Register warehouses or storage facilities connected with the company.",
    href: "/dashboard/settings/warehouse" as Route,
    icon: Warehouse
  },
  {
    title: "Port / Boundary Master",
    description: "Manage departure and arrival ports, border checkpoints, and airports for shipments.",
    href: "/dashboard/settings/ports" as Route,
    icon: Anchor
  },
  {
    title: "Management",
    description: "Draft parameter area for registration, contract, country, customer, and document types.",
    href: "/dashboard/settings/management" as Route,
    icon: SlidersHorizontal
  },
  {
    title: "Nations & Branch Networks",
    description: "Country -> Main Branch -> City Branch topology overview and master configurations.",
    href: "/dashboard/settings/branch-network" as Route,
    icon: Globe
  },
  {
    title: "Email Accounts",
    description: "Manage official branch email accounts, SMTP settings, passwords, and connection status.",
    href: "/dashboard/settings/email-accounts" as Route,
    icon: Mail
  },
  {
    title: "Local Translation Management",
    description: "Super Admin offline 5-language dictionary manager (English, Urdu, Pashto, Farsi, Arabic).",
    href: "/dashboard/settings/translations" as Route,
    icon: Globe2
  }
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Setup screens used by branch, company, account, and permission workflows.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border bg-card p-5 transition hover:border-primary hover:shadow-sm"
          >
            <item.icon className="mb-4 h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <Settings className="mt-1 h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Configuration area</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Company, location, and management draft setup are available here. Management parameters
              can be connected to their forms in the next step.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
