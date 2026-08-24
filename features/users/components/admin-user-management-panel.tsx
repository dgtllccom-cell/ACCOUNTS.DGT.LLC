"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Globe2,
  GitBranch,
  Users,
  Search,
  Plus,
  Eye,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Filter,
  UserPlus,
  Printer,
  Sparkles,
  Lock,
  Layers,
  Building,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RolePermissionMatrix } from "./role-permission-matrix";
import { UserLiveReportPanel } from "./user-live-report-panel";
import { Th } from "@/components/ui/translated-th";

export type BranchUser = {
  id: string;
  name: string;
  username: string;
  loginId?: string;
  lastLogin?: string | null;
  temporaryPassword?: string | null;
  mobile?: string;
  email?: string;
  role: string;
  classification: string;
  mainUser?: boolean;
  countryName?: string;
  cityName?: string;
  branchName?: string;
  branchCode?: string;
  department?: string;
  permissions?: string[];
  status?: "Active" | "Inactive" | string;
};

export type CityBranch = {
  id: string;
  name: string;
  code: string;
  cityName: string;
  currency: string;
  status: string;
  users: BranchUser[];
  mainUsersCount?: number;
  totalUsersCount?: number;
};

export type MainBranch = {
  id: string;
  name: string;
  code: string;
  currency: string;
  isMain: boolean;
  status: string;
  cityBranches: CityBranch[];
  users: BranchUser[];
  mainUsersCount?: number;
  totalUsersCount?: number;
};

export type CountryData = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currencyCode: string;
  isActive: boolean;
  mainBranches: MainBranch[];
  users: BranchUser[];
  mainUsersCount: number;
  totalUsersCount: number;
};

export function AdminUserManagementPanel() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [superAdminBranches, setSuperAdminBranches] = useState<any[]>([]);

  // Filtering & View state
  const [activeTab, setActiveTab] = useState<"hierarchy" | "all-users" | "roles">("hierarchy");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("all");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Accordion toggle states
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [expandedMainBranches, setExpandedMainBranches] = useState<Record<string, boolean>>({});

  // Live report modal view state
  const [selectedReportUser, setSelectedReportUser] = useState<BranchUser | null>(null);

  const fetchHierarchyData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/erp/users/login-management", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setCountries(json.data.countries || []);
          setSuperAdminBranches(json.data.superAdminBranches || []);
          
          // Expand first country by default
          if (json.data.countries?.length > 0) {
            const initialCountryState: Record<string, boolean> = {};
            const initialMainState: Record<string, boolean> = {};
            json.data.countries.forEach((c: CountryData, idx: number) => {
              initialCountryState[c.id] = true;
              c.mainBranches?.forEach((mb) => {
                initialMainState[mb.id] = true;
              });
            });
            setExpandedCountries(initialCountryState);
            setExpandedMainBranches(initialMainState);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load user branch hierarchy:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHierarchyData();
  }, []);

  const toggleCountryExpand = (countryId: string) => {
    setExpandedCountries((prev) => ({ ...prev, [countryId]: !prev[countryId] }));
  };

  const toggleMainBranchExpand = (mainBranchId: string) => {
    setExpandedMainBranches((prev) => ({ ...prev, [mainBranchId]: !prev[mainBranchId] }));
  };

  // Flattened all users list for search/filtering
  const allUsersFlattened = useMemo(() => {
    const list: Array<BranchUser & { countryName: string; countryCode?: string; branchName: string; branchCode: string; branchType: string }> = [];
    const seenIds = new Set<string>();

    const pushUser = (u: BranchUser, extra: { countryName: string; countryCode?: string; branchName: string; branchCode: string; branchType: string }) => {
      const key = u.id || u.username || u.loginId;
      if (key && seenIds.has(key)) return;
      if (key) seenIds.add(key);
      list.push({ ...u, ...extra });
    };

    // Super Admin and Clearing Agent Head Office Users
    superAdminBranches.forEach((sb) => {
      sb.users?.forEach((u: any) => {
        pushUser(u, {
          countryName: u.countryName || "Global",
          countryCode: "HQ",
          branchName: u.branchName || sb.name || "Global Executive HQ",
          branchCode: u.branchCode || sb.code || "HQ-SUPERADMIN",
          branchType: u.role === "super_admin" ? "Super Admin" : "Clearing HQ"
        });
      });
    });

    countries.forEach((country) => {
      // Direct country users
      country.users?.forEach((u) => {
        pushUser(u, {
          countryName: country.name,
          countryCode: country.iso2 || country.name.substring(0, 2).toUpperCase(),
          branchName: "Country HQ",
          branchCode: `MAIN-${country.currencyCode}`,
          branchType: "Country Main"
        });
      });

      country.mainBranches?.forEach((mb) => {
        // Main branch users
        mb.users?.forEach((u) => {
          pushUser(u, {
            countryName: country.name,
            countryCode: country.iso2 || country.name.substring(0, 2).toUpperCase(),
            branchName: mb.name,
            branchCode: mb.code,
            branchType: "Main Branch"
          });
        });

        // City branch users
        mb.cityBranches?.forEach((cb) => {
          cb.users?.forEach((u) => {
            pushUser(u, {
              countryName: country.name,
              countryCode: country.iso2 || country.name.substring(0, 2).toUpperCase(),
              branchName: `${cb.cityName} - ${cb.name}`,
              branchCode: cb.code,
              branchType: "City Branch"
            });
          });
        });
      });
    });

    return list;
  }, [countries, superAdminBranches]);

  // Overall metric counts
  const totalMetrics = useMemo(() => {
    let totalMainBranches = 0;
    let totalCityBranches = 0;

    countries.forEach((c) => {
      totalMainBranches += c.mainBranches?.length || 0;
      c.mainBranches?.forEach((mb) => {
        totalCityBranches += mb.cityBranches?.length || 0;
      });
    });

    const totalCount = allUsersFlattened.length;
    const totalMainUsers = allUsersFlattened.filter((u) => u.mainUser || ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin"].includes(u.role?.toLowerCase())).length;

    return {
      totalCountries: countries.length,
      totalMainBranches,
      totalCityBranches,
      totalUsers: totalCount,
      totalMainUsers
    };
  }, [countries, allUsersFlattened]);

  const formatLastLogin = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  const isUserActive = (u: BranchUser) => String(u.status || "").toLowerCase() === "active";

  const triggerUserPatch = async (userId: string, payload: Record<string, unknown>, successLabel: string) => {
    const response = await fetch("/api/erp/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || body?.message || "Failed to update user.");
    }

    await fetchHierarchyData();
    return successLabel;
  };

  const resetUserPassword = async (user: BranchUser) => {
    const temporaryPassword = `DEV-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase()}!Aa1`;
    const ok = window.confirm(`Generate and apply a new temporary password for ${user.name}?`);
    if (!ok) return;
    await triggerUserPatch(user.id, { password: temporaryPassword }, `Temporary password set for ${user.username}: ${temporaryPassword}`);
    window.alert(`Temporary password set once for ${user.username}:\n${temporaryPassword}`);
  };

  const toggleUserStatus = async (user: BranchUser) => {
    const nextStatus = !isUserActive(user);
    const actionLabel = nextStatus ? "activate" : "disable";
    const ok = window.confirm(`Do you want to ${actionLabel} ${user.name}?`);
    if (!ok) return;
    await triggerUserPatch(user.id, { isActive: nextStatus }, `User ${actionLabel}d.`);
  };

  // Filtered users for "All Users" view
  const filteredUsers = useMemo(() => {
    return allUsersFlattened.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.branchCode && u.branchCode.toLowerCase().includes(q)) ||
        (u.branchName && u.branchName.toLowerCase().includes(q)) ||
        (u.cityName && u.cityName.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q);

      const matchesCountry = selectedCountryFilter === "all" || u.countryName === selectedCountryFilter;
      const matchesBranch = selectedBranchFilter === "all" || u.branchCode === selectedBranchFilter;

      return matchesSearch && matchesCountry && matchesBranch;
    });
  }, [allUsersFlattened, searchQuery, selectedCountryFilter, selectedBranchFilter]);

  const renderUserTableRow = (u: BranchUser, branchCodeStr: string, countryNameStr: string) => {
    const userRoleLabel = u.classification || u.role;

    return (
      <tr key={u.id} className="border-b transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
        <td className="px-4 py-3 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
              {u.id.substring(0, 8)}
            </span>
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</div>
          <div className="text-xs text-slate-500">{u.email || u.username}</div>
        </td>

        <td className="px-4 py-3">
          <Badge
            variant="outline"
            className={
              u.role === "super_admin"
                ? "border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                : u.role === "country_admin"
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : u.role === "main_branch_admin"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }
          >
            {userRoleLabel}
          </Badge>
        </td>

        <td className="px-4 py-3">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            <GitBranch className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-mono font-bold tracking-tight">{branchCodeStr}</span>
          </div>
        </td>

        <td className="px-4 py-3">
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{u.loginId || u.username}</span>
        </td>

        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {u.status || "Active"}
          </span>
        </td>

        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
          {countryNameStr}
        </td>

        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
          {u.cityName || "-"}
        </td>

        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
          {formatLastLogin(u.lastLogin)}
        </td>

        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                setSelectedReportUser({
                  ...u,
                  countryName: countryNameStr,
                  branchCode: branchCodeStr
                });
              }}
            >
              <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>View Details</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => resetUserPassword(u)}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Reset Password</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => toggleUserStatus(u)}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>{isUserActive(u) ? "Disable" : "Activate"}</span>
            </Button>

            <Link href={`/dashboard/users/edit/${u.id}`}>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
                Edit Scope
              </Button>
            </Link>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Live Report Modal */}
      {selectedReportUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-slate-900 shadow-2xl border border-slate-800">
            <UserLiveReportPanel
              fullName={selectedReportUser.name}
              gender="Male"
              accountRegNo={`REG-${selectedReportUser.id.substring(0, 5)}`}
              role={selectedReportUser.role}
              userCode={selectedReportUser.id.substring(0, 8)}
              status={selectedReportUser.status || "Active"}
              selectedCountryName={selectedReportUser.countryName || "Pakistan"}
              selectedBranchName={selectedReportUser.branchName || "Main Branch"}
              selectedBranchCode={selectedReportUser.branchCode || "PK-MAIN-001"}
              selectedCityName={selectedReportUser.cityName || "Main City"}
              lastActivityDate={selectedReportUser.lastLogin || undefined}
              onBack={() => setSelectedReportUser(null)}
            />
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Admin Control Panel</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            User Login Management & Branch Scope Directory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Country Main Branches, City Branch Codes, Login IDs & Hierarchical Access Table
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHierarchyData}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/dashboard/country">
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <span>+ Add Branch / Country</span>
            </Button>
          </Link>

          <Link href="/dashboard/users/new">
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm">
              <UserPlus className="h-4 w-4" />
              <span>+ Register New User</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Users</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMetrics.totalUsers}</div>
          <p className="mt-1 text-xs text-slate-500">{totalMetrics.totalMainUsers} Admin / Main Users</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Countries</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Globe2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMetrics.totalCountries}</div>
          <p className="mt-1 text-xs text-slate-500">Registered Operations</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Main Country Branches</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMetrics.totalMainBranches}</div>
          <p className="mt-1 text-xs text-slate-500">With Unique Main Branch Codes</p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">City / Sub Branches</span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <GitBranch className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMetrics.totalCityBranches}</div>
          <p className="mt-1 text-xs text-slate-500">City Branch Codes & Scope</p>
        </div>
      </div>

      {/* Tabs & Search Navigation Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "hierarchy"
                ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Country & Branch Hierarchy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all-users")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "all-users"
                ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>All Users List ({allUsersFlattened.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "roles"
                ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>System Role Matrix</span>
          </button>
        </div>

        {activeTab !== "roles" && (
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search user, branch code, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm font-medium">Loading Branch Codes & User Hierarchy...</p>
        </div>
      ) : activeTab === "roles" ? (
        <RolePermissionMatrix />
      ) : activeTab === "all-users" ? (
        /* Flat All Users Table View */
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between border-b px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                All System Users ({filteredUsers.length})
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="h-3.5 w-3.5" />
                <span>Country:</span>
                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                >
                  <option value="all">All Countries</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-100/60 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-600 dark:text-slate-400">
                <tr>
                  <Th className="px-4 py-3">User Code</Th>
                  <Th className="px-4 py-3">Full Name / Login Email</Th>
                  <Th className="px-4 py-3">Role Classification</Th>
                  <Th className="px-4 py-3">Branch Code</Th>
                  <Th className="px-4 py-3">Login ID</Th>
                  <Th className="px-4 py-3">Status</Th>
                  <Th className="px-4 py-3">Country</Th>
                  <Th className="px-4 py-3">City</Th>
                  <Th className="px-4 py-3">Last Login</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      No matching users found for your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => renderUserTableRow(user, user.branchCode, user.countryName))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Hierarchical Country -> Main Branch -> City Branch View */
        <div className="space-y-6">
          {countries.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <Globe2 className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">No Countries or Branches Created Yet</h3>
              <p className="text-xs text-slate-500 mt-1">Start by adding a country and main branch to organize users.</p>
              <Link href="/dashboard/country" className="inline-block mt-4">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Country & Main Branch</span>
                </Button>
              </Link>
            </div>
          ) : (
            countries.map((country) => {
              const isCountryExpanded = expandedCountries[country.id] ?? true;

              return (
                <div
                  key={country.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden"
                >
                  {/* Country Header Bar */}
                  <div
                    onClick={() => toggleCountryExpand(country.id)}
                    className="flex cursor-pointer items-center justify-between border-b bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white hover:from-slate-850 hover:to-slate-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" className="p-1 rounded hover:bg-slate-700/50">
                        {isCountryExpanded ? (
                          <ChevronDown className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        )}
                      </button>
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {country.iso2 || country.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold tracking-tight">{country.name}</h2>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                            {country.currencyCode}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300">
                          {country.mainBranches?.length || 0} Main Branches • {country.totalUsersCount || 0} Total Users
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link href="/dashboard/country">
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700">
                          Manage Country
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Country Content (Main Branches & City Branches) */}
                  {isCountryExpanded && (
                    <div className="p-5 space-y-6 bg-slate-50/40 dark:bg-slate-950/40">
                      {/* Direct Country Level Users if any */}
                      {country.users && country.users.length > 0 && (
                        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-2xs">
                          <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <Globe2 className="h-3.5 w-3.5 text-blue-500" />
                            <span>Country Level Admin Users</span>
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="border-b bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500">
                                <tr>
                                  <Th className="px-4 py-2">User Code</Th>
                                  <Th className="px-4 py-2">Full Name / Email</Th>
                                  <Th className="px-4 py-2">Role</Th>
                                  <Th className="px-4 py-2">Branch Code</Th>
                                  <Th className="px-4 py-2">Login ID</Th>
                                  <Th className="px-4 py-2">Country</Th>
                                  <Th className="px-4 py-2">City</Th>
                                  <Th className="px-4 py-2">Last Login</Th>
                                  <Th className="px-4 py-2">Status</Th>
                                  <Th className="px-4 py-2 text-right">Actions</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {country.users.map((u) => renderUserTableRow(u, `MAIN-${country.currencyCode}`, country.name))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Main Branches */}
                      {country.mainBranches?.map((mainBranch) => {
                        const isMainExpanded = expandedMainBranches[mainBranch.id] ?? true;

                        return (
                          <div
                            key={mainBranch.id}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
                          >
                            {/* Main Branch Header with Prominent Branch Code */}
                            <div
                              onClick={() => toggleMainBranchExpand(mainBranch.id)}
                              className="flex cursor-pointer items-center justify-between border-b bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <button type="button" className="p-0.5 rounded text-slate-500">
                                  {isMainExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <div className="grid h-8 w-8 place-items-center rounded bg-emerald-600 text-white font-bold">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                      {mainBranch.name}
                                    </h3>
                                    {/* PROMINENT MAIN BRANCH CODE */}
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                      <GitBranch className="h-3 w-3" />
                                      Main Branch Code: {mainBranch.code}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Currency: {mainBranch.currency} • {mainBranch.cityBranches?.length || 0} City Branches
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Link href="/dashboard/city">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                    <Plus className="h-3 w-3" />
                                    <span>+ Add City Branch</span>
                                  </Button>
                                </Link>
                              </div>
                            </div>

                            {/* Main Branch Body */}
                            {isMainExpanded && (
                              <div className="p-4 space-y-5">
                                {/* Main Branch Users Table */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                      <Users className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>Main Branch Registered Users ({mainBranch.users?.length || 0})</span>
                                    </h4>
                                  </div>

                                  {mainBranch.users && mainBranch.users.length > 0 ? (
                                    <div className="overflow-x-auto rounded-md border">
                                      <table className="w-full text-left text-sm">
                                        <thead className="border-b bg-slate-50 dark:bg-slate-800/40 text-xs uppercase font-semibold text-slate-500">
                                          <tr>
                                            <Th className="px-4 py-2.5">User Code</Th>
                                            <Th className="px-4 py-2.5">Full Name / Email</Th>
                                            <Th className="px-4 py-2.5">Role</Th>
                                            <Th className="px-4 py-2.5">Branch Code</Th>
                                            <Th className="px-4 py-2.5">Login ID</Th>
                                            <Th className="px-4 py-2.5">Country</Th>
                                            <Th className="px-4 py-2.5">City</Th>
                                            <Th className="px-4 py-2.5">Last Login</Th>
                                            <Th className="px-4 py-2.5">Status</Th>
                                            <Th className="px-4 py-2.5 text-right">Actions</Th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {mainBranch.users.map((u) => renderUserTableRow(u, mainBranch.code, country.name))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="rounded-md border border-dashed p-4 text-center text-xs text-slate-400">
                                      No direct users registered for this main branch yet.
                                    </div>
                                  )}
                                </div>

                                {/* City Branches under this Main Branch */}
                                {mainBranch.cityBranches && mainBranch.cityBranches.length > 0 && (
                                  <div className="pt-2 border-t space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <MapPin className="h-3.5 w-3.5 text-amber-500" />
                                      <span>City Branches under {mainBranch.name}</span>
                                    </h4>

                                    <div className="grid gap-4">
                                      {mainBranch.cityBranches.map((cityBranch) => (
                                        <div
                                          key={cityBranch.id}
                                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                              <div className="grid h-7 w-7 place-items-center rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                                <GitBranch className="h-3.5 w-3.5" />
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                    {cityBranch.cityName} - {cityBranch.name}
                                                  </span>
                                                  {/* CITY BRANCH CODE */}
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                    Code: {cityBranch.code}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            <span className="text-xs text-slate-500 font-medium">
                                              {cityBranch.users?.length || 0} Registered Users
                                            </span>
                                          </div>

                                          {/* City Branch Users Table */}
                                          {cityBranch.users && cityBranch.users.length > 0 ? (
                                            <div className="overflow-x-auto rounded-md border bg-white dark:bg-slate-900">
                                              <table className="w-full text-left text-sm">
                                                  <thead className="border-b bg-slate-50 dark:bg-slate-800/40 text-xs uppercase font-semibold text-slate-500">
                                                    <tr>
                                                      <Th className="px-4 py-2">User Code</Th>
                                                      <Th className="px-4 py-2">Full Name / Email</Th>
                                                      <Th className="px-4 py-2">Role</Th>
                                                      <Th className="px-4 py-2">Branch Code</Th>
                                                      <Th className="px-4 py-2">Login ID</Th>
                                                      <Th className="px-4 py-2">Country</Th>
                                                      <Th className="px-4 py-2">City</Th>
                                                      <Th className="px-4 py-2">Last Login</Th>
                                                      <Th className="px-4 py-2">Status</Th>
                                                      <Th className="px-4 py-2 text-right">Actions</Th>
                                                    </tr>
                                                  </thead>
                                                <tbody>
                                                  {cityBranch.users.map((u) =>
                                                    renderUserTableRow(u, cityBranch.code, country.name)
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : (
                                            <div className="rounded-md border border-dashed p-3 text-center text-xs text-slate-400 bg-white dark:bg-slate-900">
                                              No users assigned to {cityBranch.cityName} branch ({cityBranch.code}) yet.
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
