"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Anchor, Building2, Landmark, Mail, MapPin, Settings, SlidersHorizontal,
  Warehouse, Globe, Globe2, Search, Filter, ShieldCheck, Database, RefreshCcw,
  Sparkles, Layers, Activity, CheckCircle2, ChevronRight, Download, Plus, ArrowUpRight,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const settingsItems = [
  {
    title: "Company Setup",
    description: "Company incorporation, owner identification, contacts, and registrations.",
    href: "/dashboard/settings/company-setup" as Route,
    icon: Building2,
    category: "Core Setup",
    badge: "Essential"
  },
  {
    title: "Location Management",
    description: "Configure the global 4-level location hierarchy: Country, State, City, and Tehsil.",
    href: "/dashboard/settings/location" as Route,
    icon: MapPin,
    category: "Core Setup",
    badge: "Hierarchy"
  },
  {
    title: "Bank Master Form",
    description: "Create banks once and use them everywhere — accounts, payments, receipts, ledger, purchases, and reports.",
    href: "/dashboard/settings/bank" as Route,
    icon: Landmark,
    category: "Master Data",
    badge: "Financial"
  },
  {
    title: "Customer Warehouse",
    description: "Register warehouses or storage facilities connected with the company.",
    href: "/dashboard/settings/warehouse" as Route,
    icon: Warehouse,
    category: "Master Data",
    badge: "Logistics"
  },
  {
    title: "Port / Boundary Master",
    description: "Manage departure and arrival ports, border checkpoints, and airports for shipments.",
    href: "/dashboard/settings/ports" as Route,
    icon: Anchor,
    category: "Master Data",
    badge: "Trade"
  },
  {
    title: "Management Parameters",
    description: "Draft parameter area for registration, contract, country, customer, and document types.",
    href: "/dashboard/settings/management" as Route,
    icon: SlidersHorizontal,
    category: "Core Setup",
    badge: "Parameters"
  },
  {
    title: "Nations & Branch Networks",
    description: "Country -> Main Branch -> City Branch topology overview and master configurations.",
    href: "/dashboard/settings/branch-network" as Route,
    icon: Globe,
    category: "Core Setup",
    badge: "Topology"
  },
  {
    title: "Official Email Accounts (Titan SMTP)",
    description: "Manage official branch email accounts, Hostinger Titan SMTP settings, passwords, and status.",
    href: "/dashboard/settings/email-accounts" as Route,
    icon: Mail,
    category: "Communications",
    badge: "Hostinger Titan"
  },
  {
    title: "Dashboard System & Module Manager",
    description: "Super Admin dashboard allotment, screen visibility toggles, and form alert controls per role.",
    href: "/dashboard/settings/dashboard-settings" as Route,
    icon: LayoutDashboard,
    category: "System & Security",
    badge: "Super Admin"
  },
  {
    title: "KYC Verification & Compliance Reports",
    description: "Track 15-day grace period countdowns, missing documents, and compliance status for country branches, city branches, and accounts.",
    href: "/dashboard/kyc-reports" as Route,
    icon: ShieldCheck,
    category: "System & Security",
    badge: "KYC Audit"
  },
  {
    title: "Local Translation Management",
    description: "Super Admin offline 5-language dictionary manager (English, Urdu, Pashto, Farsi, Arabic).",
    href: "/dashboard/translations" as Route,
    icon: Globe2,
    category: "System & Security",
    badge: "5 Languages"
  }
];

export default function SettingsPage() {
  const [selectedLayoutOption, setSelectedLayoutOption] = useState<"option1" | "option2" | "option3">("option1");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Core Setup", "Master Data", "Communications", "System & Security"];

  const filteredItems = settingsItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Design Options Switcher Toolbar */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
              Header Design Preview Options:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedLayoutOption("option1")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                selectedLayoutOption === "option1"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              Option 1: Command Center
            </button>
            <button
              onClick={() => setSelectedLayoutOption("option2")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                selectedLayoutOption === "option2"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              Option 2: Executive Banner
            </button>
            <button
              onClick={() => setSelectedLayoutOption("option3")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                selectedLayoutOption === "option3"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              Option 3: Minimalist Toolbar
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────
          HEADER OPTION 1: COMMAND CENTER (Glowing Badge + Search + 3 KPI Cards)
          ────────────────────────────────────────────────────────────── */}
      {selectedLayoutOption === "option1" && (
        <div className="space-y-5 rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 p-6 text-white shadow-xl dark:border-slate-800">
          {/* Top Bar: Breadcrumbs & Actions */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-300">Workspace</span>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-blue-400">Settings & Controls</span>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Controls</h1>
                  <p className="text-xs text-slate-400">
                    Enterprise configuration hub for branch, company, account, and permission workflows.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white">
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                Sync System
              </Button>
              <Button size="sm" className="bg-blue-600 text-xs font-semibold text-white shadow-md hover:bg-blue-500">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Parameter
              </Button>
            </div>
          </div>

          {/* Search & Category Filter Row */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-slate-800 pt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search settings modules, parameters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-slate-700 bg-slate-800/90 pl-9 text-xs text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-medium transition",
                    activeCategory === cat
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Setup Modules</span>
                <Layers className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">9 Active</span>
                <span className="text-[10px] text-emerald-400 font-medium">+100% operational</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Official Mailboxes</span>
                <Mail className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">Titan SMTP</span>
                <span className="text-[10px] text-blue-400 font-medium">SSL / STARTTLS</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>System Security</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-400">Protected</span>
                <span className="text-[10px] text-slate-400 font-medium">Multi-tenant Scoped</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          HEADER OPTION 2: EXECUTIVE HERO BANNER (Gradient Mesh + Embedded Search + Shortcut Key)
          ────────────────────────────────────────────────────────────── */}
      {selectedLayoutOption === "option2" && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          {/* Subtle decorative background circles */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-12 right-1/3 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-300 backdrop-blur">
                  <Activity className="h-3 w-3 text-blue-400" />
                  Digital Dock Enterprise Core
                </div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                  ERP Configuration Center
                </h1>
                <p className="mt-1 max-w-xl text-xs text-blue-200/80 leading-relaxed">
                  Manage core parameters, branch network topologies, company incorporations, bank masters, and official Titan email settings.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="bg-white/10 text-xs font-semibold text-white border border-white/20 hover:bg-white/20">
                  <Database className="mr-1.5 h-3.5 w-3.5" />
                  Backup DB
                </Button>
                <Button size="sm" className="bg-blue-500 text-xs font-semibold text-white shadow-lg hover:bg-blue-400">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Master
                </Button>
              </div>
            </div>

            {/* Embedded Search Box with Shortcut */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-300" />
                <Input
                  type="text"
                  placeholder="Type to filter settings or search parameter rules... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 border-blue-400/30 bg-slate-900/60 pl-10 pr-12 text-xs text-white placeholder:text-blue-200/60 focus:border-blue-400"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">
                  ⌘K
                </kbd>
              </div>

              <div className="flex items-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs font-semibold transition",
                      activeCategory === cat
                        ? "bg-white text-blue-950 shadow-md"
                        : "bg-white/10 text-blue-200 hover:bg-white/20"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          HEADER OPTION 3: MINIMALIST TABBED TOOLBAR (Clean Sleek Toolbar + Compact Pills)
          ────────────────────────────────────────────────────────────── */}
      {selectedLayoutOption === "option3" && (
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">System Settings</h1>
                <p className="text-xs text-muted-foreground">
                  Workspace setup & master data configurations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <Filter className="mr-1.5 h-3 w-3" />
                Filter
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="text-xs text-muted-foreground">
              Showing {filteredItems.length} of {settingsItems.length} modules
            </span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          SETTINGS MODULE CARDS GRID
          ────────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <item.icon className="h-5 w-5" aria-hidden />
              </div>

              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  {item.badge}
                </Badge>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>

            <h2 className="mt-4 font-bold text-card-foreground group-hover:text-primary">{item.title}</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>

      {/* Footer System Info Card */}
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Settings className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="font-bold text-sm">Digital Dock ERP Core Configuration</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              All settings modules are synced with role-based access permissions. Super Admins have full access across all countries and branch networks.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
