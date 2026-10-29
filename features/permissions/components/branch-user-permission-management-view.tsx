"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Shield,
  PlusCircle,
  Edit,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Search,
  Save,
  RotateCcw,
  FileText,
  Info,
  Lightbulb,
  Building2,
  Ship,
  Compass,
  CreditCard,
  Users,
  ShoppingCart,
  FileSpreadsheet,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  User,
  MapPin,
  Globe,
  Sliders,
  GitBranch,
  ShieldCheck,
  Calendar,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { headerLabel, translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { localizeCountryName } from "@/lib/i18n/country-names";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";

export type BranchUserDetails = {
  id: string;
  name: string;
  userCode: string;
  username: string;
  email?: string;
  phone?: string;
  role: string;
  operationalDomain?: string;
  isActive: boolean;
  assignedOn?: string;
  lastLogin?: string;
  permissions: string[];
};

export type BranchInfo = {
  id: string;
  name: string;
  code: string;
  cityName?: string;
  countryName?: string;
  currency: string;
  operationalDomain?: string;
};

interface Props {
  branch: BranchInfo;
  users: BranchUserDetails[];
  initialUserId?: string;
}

type ActionType = "view" | "add" | "edit" | "delete";

type SubForm = {
  id: string;
  label: string;
  category: string;
  categoryColor: string;
  permissions: Record<ActionType, string>;
};

type ModuleItem = {
  id: string;
  label: string;
  icon: any;
  category: string;
  categoryColor: string;
  permissions: Record<ActionType, string>;
  children?: SubForm[];
};

const MODULE_TREE: ModuleItem[] = [
  {
    id: "dashboard",
    label: headerLabel("Dashboard"),
    icon: LayoutDashboard,
    category: "System",
    categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    permissions: {
      view: "dashboard:read",
      add: "dashboard:create",
      edit: "dashboard:update",
      delete: "dashboard:delete"
    }
  },
  {
    id: "shipping",
    label: headerLabel("Shipping & Clearing"),
    icon: Ship,
    category: "Shipping",
    categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    permissions: {
      view: "shipping_records:read",
      add: "shipping_records:create",
      edit: "shipping_records:update",
      delete: "shipping_records:delete"
    },
    children: [
      {
        id: "shipping-bookings",
        label: headerLabel("Shipping Bookings"),
        category: "Shipping",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "shipments:read",
          add: "shipments:create",
          edit: "shipments:update",
          delete: "shipments:delete"
        }
      },
      {
        id: "shipping-bl",
        label: headerLabel("BL Records Entry"),
        category: "Shipping",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "shipping:read",
          add: "shipping_transfers:create",
          edit: "shipping_transfers:read",
          delete: "shipping_transfers:approve"
        }
      }
    ]
  },
  {
    id: "tracking",
    label: headerLabel("Tracking"),
    icon: Compass,
    category: "Shipping",
    categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    permissions: {
      view: "shipping_records:read",
      add: "shipping:read",
      edit: "shipping_records:update",
      delete: "shipping_records:delete"
    },
    children: [
      {
        id: "tracking-containers",
        label: headerLabel("Live Container Tracking"),
        category: "Shipping",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "shipping_records:read",
          add: "shipping:read",
          edit: "shipping_records:update",
          delete: "shipping_records:delete"
        }
      },
      {
        id: "tracking-vessels",
        label: headerLabel("Vessel & Port Tracking"),
        category: "Shipping",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "shipping_records:read",
          add: "shipping:read",
          edit: "shipping_records:update",
          delete: "shipping_records:delete"
        }
      }
    ]
  },
  {
    id: "accounts",
    label: headerLabel("Accounts"),
    icon: CreditCard,
    category: "Finance",
    categoryColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    permissions: {
      view: "accounts:read",
      add: "accounts:create",
      edit: "accounts:update",
      delete: "accounts:delete"
    },
    children: [
      {
        id: "accounts-coa",
        label: headerLabel("Chart of Accounts"),
        category: "Finance",
        categoryColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        permissions: {
          view: "ledgers:read",
          add: "ledgers:create",
          edit: "ledgers:update",
          delete: "ledgers:delete"
        }
      },
      {
        id: "accounts-bank",
        label: headerLabel("Bank Accounts"),
        category: "Finance",
        categoryColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        permissions: {
          view: "banks:read",
          add: "transactions:create",
          edit: "transactions:read",
          delete: "transactions:delete"
        }
      },
      {
        id: "accounts-payments",
        label: headerLabel("Payments"),
        category: "Finance",
        categoryColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
        permissions: {
          view: "roznamcha:read",
          add: "roznamcha:create",
          edit: "roznamcha:post",
          delete: "roznamcha:delete"
        }
      }
    ]
  },
  {
    id: "customers",
    label: headerLabel("Customers"),
    icon: Users,
    category: "Sales",
    categoryColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    permissions: {
      view: "customers:read",
      add: "customers:create",
      edit: "customers:update",
      delete: "customers:delete"
    },
    children: [
      {
        id: "customers-list",
        label: headerLabel("Customer List"),
        category: "Sales",
        categoryColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
        permissions: {
          view: "customers:read",
          add: "customers:create",
          edit: "customers:update",
          delete: "customers:delete"
        }
      },
      {
        id: "customers-profile",
        label: headerLabel("Customer Profile"),
        category: "Sales",
        categoryColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
        permissions: {
          view: "customer_receipts:read",
          add: "customer_receipts:create",
          edit: "customer_receipts:post",
          delete: "customer_receipts:delete"
        }
      }
    ]
  },
  {
    id: "suppliers",
    label: headerLabel("Suppliers"),
    icon: ShoppingCart,
    category: "Purchase",
    categoryColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    permissions: {
      view: "companies:read",
      add: "companies:create",
      edit: "companies:update",
      delete: "companies:delete"
    },
    children: [
      {
        id: "suppliers-list",
        label: headerLabel("Supplier List"),
        category: "Purchase",
        categoryColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
        permissions: {
          view: "companies:read",
          add: "companies:create",
          edit: "companies:update",
          delete: "companies:delete"
        }
      },
      {
        id: "suppliers-profile",
        label: headerLabel("Supplier Profile"),
        category: "Purchase",
        categoryColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
        permissions: {
          view: "purchases:read",
          add: "purchases:create",
          edit: "purchases:update",
          delete: "purchases:delete"
        }
      }
    ]
  },
  {
    id: "reports",
    label: headerLabel("Reports"),
    icon: FileSpreadsheet,
    category: "Reports",
    categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    permissions: {
      view: "reports:read",
      add: "shipping_reports:read",
      edit: "documents:export",
      delete: "documents:print"
    },
    children: [
      {
        id: "reports-shipping",
        label: headerLabel("Shipping Reports"),
        category: "Reports",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "shipping_reports:read",
          add: "reports:read",
          edit: "documents:export",
          delete: "documents:print"
        }
      },
      {
        id: "reports-branch",
        label: headerLabel("Branch Reports"),
        category: "Reports",
        categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
        permissions: {
          view: "reports:read",
          add: "reports:read",
          edit: "documents:export",
          delete: "documents:print"
        }
      }
    ]
  },
  {
    id: "settings",
    label: headerLabel("Settings"),
    icon: Settings,
    category: "System",
    categoryColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    permissions: {
      view: "settings:read",
      add: "settings:update",
      edit: "settings:update",
      delete: "settings:delete"
    }
  }
];

export function BranchUserPermissionManagementView({
  branch,
  users: initialUsers,
  initialUserId
}: Props) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (s: string) => translateHeader(lang, s);
  // role.<key> five-language labels (same convention as the handover Access Register); unknown roles fall back to the header dictionary
  const roleText = (r: string | null | undefined) => (r ? t(lang, ("role." + r.trim().toLowerCase().replace(/[\s/]+/g, "_")) as never, tr(r.replace(/_/g, " "))) : "-");

  const [users, setUsers] = useState<BranchUserDetails[]>(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    initialUserId || (initialUsers[0]?.id ?? "")
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0] || null,
    [users, selectedUserId]
  );

  const [activeMainTab, setActiveMainTab] = useState<"modules" | "branch" | "role" | "settings">("modules");
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    accounts: true,
    customers: true,
    suppliers: true
  });

  const [currentPermissions, setCurrentPermissions] = useState<Set<string>>(
    new Set(selectedUser?.permissions || [])
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (selectedUser) {
      setCurrentPermissions(new Set(selectedUser.permissions || []));
    }
  }, [selectedUser?.id]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const isPermActive = (perm: string) => currentPermissions.has(perm);

  const togglePerm = (perm: string) => {
    setCurrentPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const isRowAllSelected = (item: ModuleItem | SubForm) => {
    const p = item.permissions;
    return (
      currentPermissions.has(p.view) &&
      currentPermissions.has(p.add) &&
      currentPermissions.has(p.edit) &&
      currentPermissions.has(p.delete)
    );
  };

  const toggleRowSelectAll = (item: ModuleItem | SubForm) => {
    const p = item.permissions;
    const all = isRowAllSelected(item);
    setCurrentPermissions((prev) => {
      const next = new Set(prev);
      const targets = [p.view, p.add, p.edit, p.delete];
      if (all) {
        targets.forEach((t) => next.delete(t));
      } else {
        targets.forEach((t) => next.add(t));
      }
      // If parent item has children, toggle them as well
      if ("children" in item && item.children) {
        item.children.forEach((child) => {
          const cp = child.permissions;
          if (all) {
            next.delete(cp.view);
            next.delete(cp.add);
            next.delete(cp.edit);
            next.delete(cp.delete);
          } else {
            next.add(cp.view);
            next.add(cp.add);
            next.add(cp.edit);
            next.add(cp.delete);
          }
        });
      }
      return next;
    });
  };

  // Filter modules
  const filteredModules = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return MODULE_TREE.filter((mod) => {
      const matchesFilter =
        activeModuleFilter === "all" || mod.id === activeModuleFilter;

      if (!matchesFilter) return false;
      if (!q) return true;

      const modMatches = mod.label.toLowerCase().includes(q) || mod.category.toLowerCase().includes(q);
      const childMatches = mod.children?.some(
        (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
      );

      return modMatches || childMatches;
    });
  }, [activeModuleFilter, searchTerm]);

  // Actions
  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setToast(null);

    const updatedPermsList = Array.from(currentPermissions);

    try {
      const res = await fetch("/api/erp/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          permissions: updatedPermsList
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || "Failed to update permissions.");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, permissions: updatedPermsList } : u))
      );

      setToast({
        kind: "ok",
        text: `${tr("Permissions saved successfully")} — ${selectedUser.name}`
      });
    } catch (err: any) {
      setToast({
        kind: "err",
        text: err.message || tr("An error occurred while saving.")
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (!selectedUser) return;
    const roleKey = selectedUser.role as keyof typeof enterpriseRolePermissions;
    const defaults = enterpriseRolePermissions[roleKey] || [];
    setCurrentPermissions(new Set(defaults));
    setToast({
      kind: "ok",
      text: `${tr("Permissions reset to the default role baseline. Click Save Rights & Update to persist.")} (${roleText(selectedUser.role)})`
    });
  };

  return (
    <div className="space-y-4 text-foreground p-3 sm:p-5 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Header Banner: Exact Match with Screenshot */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d47a1] via-[#1565c0] to-[#1e88e5] p-5 sm:p-6 text-white shadow-lg">
        {/* Subtle wavy backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: `url('/assets/dgt-maritime-banner.png')` }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white border border-white/30 shrink-0 shadow-inner">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs">
                {tr("USER RIGHTS & FORM ALLOCATION")}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 font-medium mt-0.5">
                {tr(
                  "ASSIGN PERMISSIONS AND FORM ACCESS FOR THE SELECTED USER. CONTROL WHAT THE USER CAN SEE AND DO IN THE SYSTEM."
                )}
              </p>
            </div>
          </div>

          {/* User Selector Dropdown for Admins */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <span className="text-xs font-bold text-blue-100">{tr("Selected User:")}</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-white/30 bg-white/20 backdrop-blur-md text-xs font-bold text-white outline-none cursor-pointer hover:bg-white/30 transition-colors"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="text-slate-900 bg-white">
                  {u.name === "Branch User" ? tr("Branch User") : u.name} ({roleText(u.role)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-bold shadow-xs transition-all ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Main 2-Column Grid (Table + Right Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): Tabs, Filters, Form Matrix */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 border-b border-border/80 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveMainTab("modules")}
              className={`flex items-center gap-2 px-3 py-2 font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeMainTab === "modules"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>{tr("MODULE & FORM ALLOCATION")}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("branch")}
              className={`flex items-center gap-2 px-3 py-2 font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeMainTab === "branch"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>{tr("BRANCH ACCESS")}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("role")}
              className={`flex items-center gap-2 px-3 py-2 font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeMainTab === "role"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{tr("ROLE ASSIGNMENT")}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("settings")}
              className={`flex items-center gap-2 px-3 py-2 font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeMainTab === "settings"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>{tr("ADDITIONAL SETTINGS")}</span>
            </button>
          </div>

          {activeMainTab === "modules" && (
            <>
              {/* Module Filter Pills Bar & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: "all", label: headerLabel("All Modules") },
                    { id: "dashboard", label: headerLabel("Dashboard") },
                    { id: "shipping", label: headerLabel("Shipping & Clearing") },
                    { id: "tracking", label: headerLabel("Tracking") },
                    { id: "accounts", label: headerLabel("Accounts") },
                    { id: "customers", label: headerLabel("Customers") },
                    { id: "suppliers", label: headerLabel("Suppliers") },
                    { id: "reports", label: headerLabel("Reports") },
                    { id: "settings", label: headerLabel("Settings") }
                  ].map((pill) => {
                    const isSelected = activeModuleFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setActiveModuleFilter(pill.id)}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        {tr(pill.label)}
                      </button>
                    );
                  })}
                </div>

                {/* Search forms or modules */}
                <div className="relative w-full sm:w-56 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={tr("Search forms or modules...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-xl border-border bg-card"
                  />
                </div>
              </div>

              {/* Main Tree Table matching screenshot */}
              <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-black text-[11px] border-b border-border/80">
                        <tr>
                          <th className="py-3 px-4 font-bold">{tr("Module / Form")}</th>
                          <th className="py-3 px-3 font-bold">{tr("Category")}</th>
                          <th className="py-3 px-3 text-center font-bold">
                            <span className="inline-flex items-center gap-1">
                              <Shield className="h-3.5 w-3.5 text-blue-600" />
                              {tr("View")}
                            </span>
                          </th>
                          <th className="py-3 px-3 text-center font-bold">
                            <span className="inline-flex items-center gap-1">
                              <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
                              {tr("Add")}
                            </span>
                          </th>
                          <th className="py-3 px-3 text-center font-bold">
                            <span className="inline-flex items-center gap-1">
                              <Edit className="h-3.5 w-3.5 text-blue-600" />
                              {tr("Edit")}
                            </span>
                          </th>
                          <th className="py-3 px-3 text-center font-bold">
                            <span className="inline-flex items-center gap-1">
                              <Trash2 className="h-3.5 w-3.5 text-blue-600" />
                              {tr("Delete")}
                            </span>
                          </th>
                          <th className="py-3 px-4 text-center font-bold">{tr("Select All")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredModules.map((mod) => {
                          const Icon = mod.icon;
                          const hasChildren = Boolean(mod.children && mod.children.length > 0);
                          const isExpanded = Boolean(expandedNodes[mod.id]);
                          const allRowSelected = isRowAllSelected(mod);

                          return (
                            <React.Fragment key={mod.id}>
                              {/* Parent Module Row */}
                              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpand(mod.id)}
                                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-0.5"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-5" />
                                    )}
                                    <Icon className="h-4 w-4 text-blue-600 shrink-0" />
                                    <span className="font-bold text-foreground">{tr(mod.label)}</span>
                                  </div>
                                </td>

                                <td className="py-3 px-3">
                                  <span
                                    className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${mod.categoryColor}`}
                                  >
                                    {tr(mod.category)}
                                  </span>
                                </td>

                                {/* View Checkbox */}
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isPermActive(mod.permissions.view)}
                                    onChange={() => togglePerm(mod.permissions.view)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                {/* Add Checkbox */}
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isPermActive(mod.permissions.add)}
                                    onChange={() => togglePerm(mod.permissions.add)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                {/* Edit Checkbox */}
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isPermActive(mod.permissions.edit)}
                                    onChange={() => togglePerm(mod.permissions.edit)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                {/* Delete Checkbox */}
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isPermActive(mod.permissions.delete)}
                                    onChange={() => togglePerm(mod.permissions.delete)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>

                                {/* Select All Row Checkbox */}
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={allRowSelected}
                                    onChange={() => toggleRowSelectAll(mod)}
                                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                              </tr>

                              {/* Child Forms (Sub-items) */}
                              {hasChildren &&
                                isExpanded &&
                                mod.children?.map((child) => {
                                  const childAllSelected = isRowAllSelected(child);
                                  return (
                                    <tr
                                      key={child.id}
                                      className="bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                                    >
                                      <td className="py-2.5 px-4 pl-11">
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {tr(child.label)}
                                          </span>
                                        </div>
                                      </td>

                                      <td className="py-2.5 px-3">
                                        <span
                                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${child.categoryColor}`}
                                        >
                                          {tr(child.category)}
                                        </span>
                                      </td>

                                      <td className="py-2.5 px-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isPermActive(child.permissions.view)}
                                          onChange={() => togglePerm(child.permissions.view)}
                                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>

                                      <td className="py-2.5 px-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isPermActive(child.permissions.add)}
                                          onChange={() => togglePerm(child.permissions.add)}
                                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>

                                      <td className="py-2.5 px-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isPermActive(child.permissions.edit)}
                                          onChange={() => togglePerm(child.permissions.edit)}
                                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>

                                      <td className="py-2.5 px-3 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isPermActive(child.permissions.delete)}
                                          onChange={() => togglePerm(child.permissions.delete)}
                                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>

                                      <td className="py-2.5 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={childAllSelected}
                                          onChange={() => toggleRowSelectAll(child)}
                                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeMainTab === "branch" && (
            <Card className="rounded-2xl border-border/80 p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>{tr("Branch Access Scope")}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border p-3 bg-muted/40">
                  <p className="text-muted-foreground font-semibold">{tr("Assigned City Branch")}</p>
                  <p className="text-sm font-black mt-1 text-foreground">{branch.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{branch.code}</p>
                </div>
                <div className="rounded-xl border p-3 bg-muted/40">
                  <p className="text-muted-foreground font-semibold">{tr("Country Hub")}</p>
                  <p className="text-sm font-black mt-1 text-foreground">{branch.countryName || "Pakistan"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{branch.currency}</p>
                </div>
              </div>
            </Card>
          )}

          {activeMainTab === "role" && (
            <Card className="rounded-2xl border-border/80 p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>{tr("Role Assignment")}</span>
              </h3>
              <div className="p-4 rounded-xl border bg-muted/30 text-xs space-y-2">
                <p className="font-bold text-foreground">{tr("Role:")} <span className="font-mono text-blue-600">{roleText(selectedUser?.role)}</span></p>
                <p className="text-muted-foreground">{tr("Operational Domain:")} <span className="font-semibold text-foreground uppercase">{selectedUser?.operationalDomain || "Shipping"}</span></p>
                <p className="text-[11px] text-slate-500">
                  {tr("Role decides the baseline permissions template and hierarchy level.")}
                </p>
              </div>
            </Card>
          )}

          {activeMainTab === "settings" && (
            <Card className="rounded-2xl border-border/80 p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <span>{tr("Additional Settings")}</span>
              </h3>
              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUser?.isActive ?? true}
                    readOnly
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="font-bold text-foreground">{tr("Account Status Active")}</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  {tr("Security policy ensures that inactive users cannot log in to any branch module.")}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (4 cols): User Information + Quick Actions + Important Note */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: User Information */}
          <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white font-black text-xs shrink-0 shadow-xs">
                  {selectedUser?.name ? selectedUser.name.substring(0, 2).toUpperCase() : "—"}
                </div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>{tr("User Information")}</span>
                </h3>
              </div>
              <Info className="h-4 w-4 text-blue-500 cursor-pointer" />
            </div>

            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Full Name")}
                </span>
                <span className="font-bold text-foreground">{selectedUser?.name === "Branch User" ? tr("Branch User") : selectedUser?.name || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  {tr("User ID")}
                </span>
                <span className="font-mono font-bold text-foreground">{selectedUser?.userCode || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono">@</span>
                  {tr("Username")}
                </span>
                <span className="font-mono text-muted-foreground">{selectedUser?.username || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Email")}
                </span>
                <span className="font-mono text-muted-foreground truncate max-w-[170px]">
                  {selectedUser?.email || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Phone")}
                </span>
                <span className="font-mono text-muted-foreground">{selectedUser?.phone || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Role")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 whitespace-nowrap">
                  <Ship className="h-3 w-3" />
                  {roleText(selectedUser?.role)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Branch")}
                </span>
                <span className="font-bold text-foreground">{branch.name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Country")}
                </span>
                <span className="font-semibold text-foreground">{branch.countryName ? localizeCountryName(branch.countryName, lang) : "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {tr("Status")}
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 whitespace-nowrap">
                  {selectedUser?.isActive ? tr("Active") : tr("Inactive")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {tr("ASSIGNED ON")}
                </span>
                <span className="text-[11px] text-muted-foreground">{selectedUser?.assignedOn || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {tr("Last Login")}
                </span>
                <span className="text-[11px] text-muted-foreground">{selectedUser?.lastLogin || "—"}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  {tr("ACCESS LEVEL")}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                  {tr("Full Access (Assigned Forms)")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Quick Actions */}
          <Card className="rounded-2xl border-border/80 shadow-xs">
            <div className="p-4 border-b border-border/70 flex items-center gap-2">
              <span className="text-blue-600 font-bold">⚡</span>
              <h3 className="text-sm font-black text-foreground">{tr("QUICK ACTIONS")}</h3>
            </div>

            <CardContent className="p-4 space-y-2.5">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Save className="h-4 w-4 me-2" />
                <span>{saving ? tr("Saving...") : tr("SAVE RIGHTS & UPDATE")}</span>
              </Button>

              <Button
                onClick={handleResetToDefault}
                variant="outline"
                className="w-full h-9 rounded-xl border-border bg-card font-bold text-xs hover:bg-accent text-foreground cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 me-2" />
                <span>{tr("RESET TO DEFAULT")}</span>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full h-9 rounded-xl border-border bg-card font-bold text-xs hover:bg-accent text-foreground cursor-pointer"
              >
                <Link href={`/dashboard/reports/branch-reports?branchId=${branch.id}` as Route}>
                  <FileText className="h-3.5 w-3.5 me-2" />
                  <span>{tr("VIEW USER LOG")}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Important Note (Green Alert Box from Screenshot) */}
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-emerald-900 dark:text-emerald-300">
              <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{tr("IMPORTANT NOTE")}</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-300/90 font-medium">
              <li>{tr("Only selected forms will be visible to the user.")}</li>
              <li>{tr("Make sure to assign at least one form per module.")}</li>
              <li>{tr("Changes will take effect immediately after saving.")}</li>
              <li>{tr("For branch-level users, ensure branch access is configured.")}</li>
              <li>{tr("Shipping Track access is mandatory for all Shipping Line users.")}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
