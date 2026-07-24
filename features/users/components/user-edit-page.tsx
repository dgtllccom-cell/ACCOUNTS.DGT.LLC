"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Shield,
  Building2,
  Globe2,
  Activity,
  Clock,
  Bell,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  MapPin,
  Lock,
  Settings,
  Edit3,
  Search,
} from "lucide-react";
import { listCountries } from "@/features/locations/location-api";
import type { LocationCountry } from "@/features/locations/location-api";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

type UserEditTab = "general" | "security" | "permissions" | "branch" | "country" | "activity" | "history" | "notifications";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string; country_branch_id: string };

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string }> = [
  { value: "super_admin", label: "Super Admin User", help: "Global scope (full access)." },
  { value: "country_admin", label: "Country Admin User", help: "Country scope (one country)." },
  { value: "country_user", label: "Country User", help: "Country scope user (one country)." },
  { value: "main_branch_admin", label: "Main Branch Admin User", help: "Main branch scope." },
  { value: "city_branch_admin", label: "City/Branch Admin", help: "City branch scope." },
  { value: "accountant", label: "Accountant", help: "Branch scope with accounting permissions." },
  { value: "cashier", label: "Cashier", help: "Branch scope with payment permissions." },
  { value: "agent_user", label: "Agent User", help: "Limited branch access." },
  { value: "staff_user", label: "Staff User", help: "Limited branch access." },
  { value: "auditor_viewer", label: "Auditor / Viewer", help: "Read-only scope." },
];

const purposeOptions = [
  "System Administration",
  "Country Operations",
  "Branch Management",
  "City Operations",
  "Global Administration",
  "Account Management",
  "Finance Management",
  "Sales Operations",
  "Customer Service",
  "Logistics",
  "HR Management",
  "Audit & Compliance",
  "IT Support",
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function groupPermissions(perms: string[]) {
  const groups = new Map<string, string[]>();
  for (const perm of perms) {
    const [resource] = perm.split(":");
    const key = (resource || "other").trim() || "other";
    const list = groups.get(key) ?? [];
    list.push(perm);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => [k, v.sort()] as const);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

type Props = { userId: string };

export function UserEditPage({ userId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<UserEditTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [permQuery, setPermQuery] = useState("");
  const [activePermGroup, setActivePermGroup] = useState("users");

  // User data
  const [userData, setUserData] = useState<any>(null);

  // Form fields - General
  const [fullName, setFullName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [purpose, setPurpose] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Form fields - Security
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [passwordExpiry, setPasswordExpiry] = useState(90);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(true);
  const [allowPasswordChange, setAllowPasswordChange] = useState(true);
  const [accountLockout, setAccountLockout] = useState(false);

  // Form fields - Role & Permissions
  const [role, setRole] = useState<EnterpriseRole>("city_branch_admin");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Form fields - Branch / Country scope
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [mainBranches, setMainBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [branchType, setBranchType] = useState<"" | "main" | "city">("");

  // Activity data
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Load user data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(userId)}`);
        const found = await res.json();
        if (found) {
          setUserData(found);
          setFullName(found.fullName || "");
          setUserCode(found.userCode || "");
          setRole((found.role || "city_branch_admin") as EnterpriseRole);
          setCountryId(found.countryId || "");
          setIsActive(found.isActive);
          setSelectedPermissions(found.permissions || []);
          setEmail(found.email || "");
          setPhone(found.phone || "");
          setPurpose(found.purpose || "");

          if (found.role === "super_admin" || found.role === "country_admin" || found.role === "country_user") {
            setBranchType("");
            setCountryBranchId("");
            setCityBranchId("");
          } else {
            if (found.cityBranchId) {
              setBranchType("city");
              setCityBranchId(found.cityBranchId);
              setCountryBranchId(found.countryBranchId || "");
            } else if (found.countryBranchId) {
              setBranchType("main");
              setCountryBranchId(found.countryBranchId);
              setCityBranchId("");
            }
          }
        }
      } catch {
        setBanner({ tone: "err", text: "Failed to load user data." });
      } finally {
        setLoading(false);
      }
    }
    if (userId) load();
  }, [userId]);

  // Load countries
  useEffect(() => {
    setLoadingCountries(true);
    listCountries()
      .then(setCountries)
      .finally(() => setLoadingCountries(false));
  }, []);

  // Load branches when country changes
  useEffect(() => {
    if (!countryId) return;
    fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
        setMainBranches(list.filter((b: MainBranchRow) => Boolean(b.is_main)));
      })
      .catch(() => null);

    fetch(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
        setCityBranches(list);
      })
      .catch(() => null);
  }, [countryId]);

  const countryOptions = useMemo(
    () => countries.map((c) => ({ value: c.id, label: c.name, keywords: `${c.name} ${c.iso2 ?? ""} ${c.iso3 ?? ""}` })),
    [countries]
  );

  const mainBranchOptions: SearchSelectOption[] = useMemo(
    () => mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: `${b.name} ${b.code}` })),
    [mainBranches]
  );

  const cityBranchOptions: SearchSelectOption[] = useMemo(
    () => cityBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: `${b.name} ${b.code} ${b.city_name}` })),
    [cityBranches]
  );

  const allPermissions = useMemo(() => {
    const items = Object.values(enterpriseRolePermissions).flat();
    return [...new Set(items.map((p) => p.trim()).filter(Boolean))].sort();
  }, []);

  const groupedPermissions = useMemo(() => groupPermissions(allPermissions), [allPermissions]);

  const filteredGroups = useMemo(() => {
    const q = permQuery.trim().toLowerCase();
    if (!q) return groupedPermissions;
    return groupedPermissions
      .map(([group, perms]) => {
        const next = perms.filter((p) => p.toLowerCase().includes(q));
        return [group, next] as const;
      })
      .filter(([, perms]) => perms.length);
  }, [groupedPermissions, permQuery]);

  const activeGroupPermissions = useMemo(() => {
    return filteredGroups.find(([g]) => g === activePermGroup)?.[1] ?? filteredGroups[0]?.[1] ?? [];
  }, [activePermGroup, filteredGroups]);

  function togglePermission(perm: string) {
    const p = perm.trim();
    if (!p) return;
    setSelectedPermissions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  function applyRoleDefaults() {
    const defaults = enterpriseRolePermissions[role] ?? [];
    setSelectedPermissions([...new Set(defaults.map((p) => p.trim()).filter(Boolean))]);
  }

  async function handleSave() {
    setBanner(null);
    if (password && password.length < 8) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }
    if (password && password !== confirmPassword) {
      setBanner({ tone: "err", text: "Passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      let resolvedCountryBranchId: string | null = null;
      let resolvedCityBranchId: string | null = null;
      const resolvedCountryId = role === "super_admin" ? null : (countryId || null);

      if (role !== "super_admin" && role !== "country_admin" && role !== "country_user") {
        if (branchType === "main") {
          resolvedCountryBranchId = countryBranchId || null;
        } else if (branchType === "city") {
          resolvedCityBranchId = cityBranchId || null;
          const cityRow = cityBranches.find((b) => b.id === cityBranchId);
          resolvedCountryBranchId = cityRow?.country_branch_id ?? null;
        }
      }

      const payload: any = {
        userId,
        fullName: fullName.trim(),
        isActive,
        role,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        permissions: selectedPermissions,
        email: email.trim() || null,
        phone: phone.trim() || null,
        purpose: purpose.trim() || null
      };
      if (password) payload.password = password;

      const res = await fetch("/api/erp/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user.");

      localStorage.setItem("user_journal_dirty", new Date().toISOString());
      setBanner({ tone: "ok", text: "User updated successfully! Returning to report..." });
      setTimeout(() => router.push("/dashboard/new-entry/users/journal-report"), 1500);
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: UserEditTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "general", label: "General", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "permissions", label: "Roles & Permissions", icon: Shield },
    { id: "branch", label: "Branch Access", icon: Building2 },
    { id: "country", label: "Country Access", icon: Globe2 },
    { id: "activity", label: "Activity Log", icon: Activity },
    { id: "history", label: "Login History", icon: Clock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  const selectedCountry = countries.find((c) => c.id === countryId) ?? null;
  const selectedMainBranch = mainBranches.find((b) => b.id === countryBranchId) ?? null;
  const selectedCityBranch = cityBranches.find((b) => b.id === cityBranchId) ?? null;

  if (loading) {
    return (
      <div className="ue-shell flex items-center justify-center min-h-screen">
        <UserEditStyles />
        <div className="flex flex-col items-center gap-4 text-[var(--ue-muted)]">
          <Loader2 className="h-10 w-10 animate-spin text-[#1f5eff]" />
          <span className="text-sm font-bold">Loading user profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ue-shell min-h-screen">
      <UserEditStyles />

      {/* ── Top Navigation Bar ── */}
      <header className="ue-topbar">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="ue-back-btn"
            onClick={() => router.push("/dashboard/new-entry/users/journal-report")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Report</span>
          </button>
          <div className="h-5 w-px bg-[var(--ue-line)]" />
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-black shadow-md">
              {initials(fullName || userData?.fullName || "U")}
            </div>
            <div>
              <div className="text-sm font-black text-[var(--ue-title)] leading-none">
                {fullName || userData?.fullName || "User"}
              </div>
              <div className="text-[10px] font-semibold text-[var(--ue-muted)] mt-0.5 flex items-center gap-1.5">
                <Edit3 className="h-3 w-3" />
                Edit User / Profile Management
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {banner && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold ${
                banner.tone === "ok"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {banner.tone === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {banner.text}
            </div>
          )}
          <button
            type="button"
            className="ue-cancel-btn"
            onClick={() => router.push("/dashboard/new-entry/users/journal-report")}
            disabled={saving}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            className="ue-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <nav className="ue-tab-nav">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`ue-tab ${activeTab === id ? "ue-tab-active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab Content ── */}
      <main className="ue-content">

        {/* ━━ GENERAL TAB ━━ */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: User Information */}
            <div className="lg:col-span-2 space-y-6">
              <div className="ue-card">
                <div className="ue-card-header">
                  <User className="h-4 w-4 text-[#1f5eff]" />
                  <h2 className="ue-card-title">User Information</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="ue-field">
                    <label className="ue-label">User Name *</label>
                    <input className="ue-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name" />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">User ID (Login Code)</label>
                    <input className="ue-input ue-input-mono" value={userCode} readOnly />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Login User ID</label>
                    <input className="ue-input ue-input-mono text-[#1455ff]" value={userCode} readOnly />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Purpose / Work</label>
                    <select className="ue-input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                      <option value="">Select Purpose</option>
                      {purposeOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Email</label>
                    <input className="ue-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" type="email" />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Phone</label>
                    <input className="ue-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
                  </div>
                </div>
              </div>

              {/* Role & Permissions Summary */}
              <div className="ue-card">
                <div className="ue-card-header">
                  <Shield className="h-4 w-4 text-violet-600" />
                  <h2 className="ue-card-title">Role & Permissions</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="ue-field sm:col-span-2">
                    <label className="ue-label">Role *</label>
                    <select className="ue-input" value={role} onChange={(e) => setRole(e.target.value as EnterpriseRole)}>
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <div className="text-[10px] text-[var(--ue-muted)] mt-1">
                      {roleOptions.find((r) => r.value === role)?.help}
                    </div>
                  </div>
                  <div className="ue-field sm:col-span-2">
                    <label className="ue-label">Access Level</label>
                    <div className="ue-badge-row">
                      {role === "super_admin" && <span className="ue-badge ue-badge-violet">Full Access</span>}
                      {(role === "country_admin" || role === "country_user") && <span className="ue-badge ue-badge-blue">Country Level</span>}
                      {(role === "main_branch_admin" || role === "city_branch_admin") && <span className="ue-badge ue-badge-orange">Branch Level</span>}
                      {(role === "accountant" || role === "cashier") && <span className="ue-badge ue-badge-green">Finance Level</span>}
                      {role === "auditor_viewer" && <span className="ue-badge ue-badge-slate">Read Only</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Status & Organization */}
            <div className="space-y-6">
              {/* Status Card */}
              <div className="ue-card">
                <div className="ue-card-header">
                  <Settings className="h-4 w-4 text-slate-500" />
                  <h2 className="ue-card-title">Status</h2>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--ue-line)] bg-slate-50/50 dark:bg-slate-900/30">
                  <div>
                    <div className="text-xs font-black text-[var(--ue-title)]">Account Status</div>
                    <div className="text-[10px] text-[var(--ue-muted)] mt-0.5">
                      {isActive ? "User is active and can login" : "User is inactive and cannot login"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ue-toggle ${isActive ? "ue-toggle-active" : ""}`}
                    onClick={() => setIsActive((v) => !v)}
                  >
                    <span className="ue-toggle-thumb" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[10px]">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">Active — User is active and can login</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="font-bold text-red-700 dark:text-red-300">Inactive — User is inactive and cannot login</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-amber-700 dark:text-amber-300">Locked — Account is locked out</span>
                  </div>
                </div>
              </div>

              {/* Organization Details */}
              <div className="ue-card">
                <div className="ue-card-header">
                  <Building2 className="h-4 w-4 text-orange-500" />
                  <h2 className="ue-card-title">Organization Details</h2>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="ue-info-row">
                    <span className="ue-info-label">System ID</span>
                    <span className="ue-info-value font-mono">{userId?.slice(0, 12).toUpperCase() || "—"}</span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">Branch Code</span>
                    <span className="ue-info-value font-mono text-[#1455ff]">
                      {selectedMainBranch?.code || selectedCityBranch?.code || (userData as any)?.branchCode || "—"}
                    </span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">Branch Name</span>
                    <span className="ue-info-value">{selectedMainBranch?.name || selectedCityBranch?.name || userData?.branchName || "—"}</span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">Country</span>
                    <span className="ue-info-value">{selectedCountry?.name || userData?.countryName || "Global"}</span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">Last Login</span>
                    <span className="ue-info-value">{userData?.lastActivity ? new Date(userData.lastActivity).toLocaleString() : "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━ SECURITY TAB ━━ */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="ue-card">
              <div className="ue-card-header">
                <Lock className="h-4 w-4 text-[#1f5eff]" />
                <h2 className="ue-card-title">Login & Security</h2>
              </div>
              <div className="space-y-4">
                <div className="ue-field">
                  <label className="ue-label">New Password</label>
                  <div className="relative">
                    <input
                      className="ue-input pr-10"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ue-muted)] hover:text-[var(--ue-title)]" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--ue-muted)] mt-1">Minimum 8 characters. Leave blank to keep current password.</div>
                </div>
                <div className="ue-field">
                  <label className="ue-label">Confirm Password</label>
                  <div className="relative">
                    <input
                      className="ue-input pr-10"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ue-muted)] hover:text-[var(--ue-title)]" onClick={() => setShowConfirmPassword((v) => !v)}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <div className="text-[10px] text-red-600 font-semibold mt-1">Passwords do not match</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="ue-field">
                    <label className="ue-label">Session Timeout (min)</label>
                    <input className="ue-input" type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(Number(e.target.value))} min={5} max={1440} />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Password Expiry (days)</label>
                    <input className="ue-input" type="number" value={passwordExpiry} onChange={(e) => setPasswordExpiry(Number(e.target.value))} min={1} max={365} />
                  </div>
                  <div className="ue-field">
                    <label className="ue-label">Max Login Attempts</label>
                    <input className="ue-input" type="number" value={maxLoginAttempts} onChange={(e) => setMaxLoginAttempts(Number(e.target.value))} min={1} max={20} />
                  </div>
                </div>
              </div>
            </div>

            <div className="ue-card">
              <div className="ue-card-header">
                <Shield className="h-4 w-4 text-violet-600" />
                <h2 className="ue-card-title">Additional Settings</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Two-Factor Authentication (2FA)", sub: "Require 2FA for login", value: twoFaEnabled, set: setTwoFaEnabled },
                  { label: "Allow Password Change", sub: "User can change their own password", value: allowPasswordChange, set: setAllowPasswordChange },
                  { label: "Login Notifications", sub: "Send email on new login", value: loginNotifications, set: setLoginNotifications },
                  { label: "Account Lockout", sub: "Lock after failed attempts", value: accountLockout, set: setAccountLockout },
                ].map(({ label, sub, value, set }) => (
                  <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--ue-line)] bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <div className="text-xs font-bold text-[var(--ue-title)]">{label}</div>
                      <div className="text-[10px] text-[var(--ue-muted)] mt-0.5">{sub}</div>
                    </div>
                    <button type="button" className={`ue-toggle ${value ? "ue-toggle-active" : ""}`} onClick={() => set((v: boolean) => !v)}>
                      <span className="ue-toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--ue-line)] space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--ue-muted)]">Login Info</div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Last Login</span>
                  <span className="ue-info-value">{userData?.lastActivity ? new Date(userData.lastActivity).toLocaleString() : "—"}</span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Last Activity</span>
                  <span className="ue-info-value">{userData?.lastActivityAction || "—"}</span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Login IP</span>
                  <span className="ue-info-value font-mono">—</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━ PERMISSIONS TAB ━━ */}
        {activeTab === "permissions" && (
          <div className="ue-card">
            <div className="ue-card-header">
              <Shield className="h-4 w-4 text-violet-600" />
              <h2 className="ue-card-title">Roles & Permissions</h2>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--ue-muted)]">{selectedPermissions.length} permissions assigned</span>
                <button type="button" className="ue-btn-sm" onClick={applyRoleDefaults}>
                  <RefreshCw className="h-3.5 w-3.5" /> Apply Role Defaults
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="ue-label">Role</label>
              <select className="ue-input max-w-xs" value={role} onChange={(e) => setRole(e.target.value as EnterpriseRole)}>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Permission Group Sidebar */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--ue-muted)] mb-2">Permission Groups</div>
                <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
                  {filteredGroups.map(([group, perms]) => {
                    const count = perms.filter((p) => selectedPermissions.includes(p)).length;
                    const active = group === activePermGroup;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setActivePermGroup(group)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-left transition-all ${
                          active ? "bg-[#1f5eff] text-white" : "bg-slate-50 dark:bg-slate-800 text-[var(--ue-title)] hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span className="truncate">{group}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-[var(--ue-muted)]"}`}>
                          {count}/{perms.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permission Items */}
              <div className="lg:col-span-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ue-muted)] pointer-events-none" />
                  <input
                    className="ue-input pl-9"
                    value={permQuery}
                    onChange={(e) => setPermQuery(e.target.value)}
                    placeholder="Search permissions..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {activeGroupPermissions.map((perm) => {
                    const checked = selectedPermissions.includes(perm);
                    return (
                      <label key={perm} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer transition-all border ${checked ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-slate-50 dark:bg-slate-800 border-[var(--ue-line)] hover:bg-slate-100"}`}>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded text-[#1f5eff]"
                          checked={checked}
                          onChange={() => togglePermission(perm)}
                        />
                        <span className={`font-mono text-[10px] font-semibold truncate ${checked ? "text-blue-700 dark:text-blue-300" : "text-[var(--ue-title)]"}`}>{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━ BRANCH ACCESS TAB ━━ */}
        {activeTab === "branch" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="ue-card">
              <div className="ue-card-header">
                <Building2 className="h-4 w-4 text-orange-500" />
                <h2 className="ue-card-title">Branch Assignment</h2>
              </div>
              <div className="space-y-4">
                <div className="ue-field">
                  <label className="ue-label">Country *</label>
                  <SearchSelect
                    label={loadingCountries ? "Loading..." : "Select Country"}
                    value={countryId}
                    placeholder="Select country"
                    options={countryOptions}
                    disabled={loadingCountries || role === "super_admin"}
                    onValueChange={setCountryId}
                  />
                </div>
                <div className="ue-field">
                  <label className="ue-label">Branch Type</label>
                  <select
                    className="ue-input"
                    value={branchType}
                    onChange={(e) => setBranchType(e.target.value as "" | "main" | "city")}
                    disabled={!countryId || role === "super_admin" || role === "country_admin" || role === "country_user"}
                  >
                    <option value="">Select Branch Type</option>
                    <option value="main">Main Branch</option>
                    <option value="city">City Branch</option>
                  </select>
                </div>
                {branchType === "main" && (
                  <div className="ue-field">
                    <label className="ue-label">Main Branch *</label>
                    <SearchSelect
                      label="Select Main Branch"
                      value={countryBranchId}
                      placeholder="Select main branch"
                      options={mainBranchOptions}
                      disabled={!countryId}
                      onValueChange={setCountryBranchId}
                    />
                  </div>
                )}
                {branchType === "city" && (
                  <div className="ue-field">
                    <label className="ue-label">City Branch *</label>
                    <SearchSelect
                      label="Select City Branch"
                      value={cityBranchId}
                      placeholder="Select city branch"
                      options={cityBranchOptions}
                      disabled={!countryId}
                      onValueChange={setCityBranchId}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="ue-card">
              <div className="ue-card-header">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <h2 className="ue-card-title">Branch Details</h2>
              </div>
              <div className="space-y-2.5">
                <div className="ue-info-row">
                  <span className="ue-info-label">Branch Code</span>
                  <span className="ue-info-value font-mono text-[#1455ff]">
                    {selectedMainBranch?.code || selectedCityBranch?.code || "—"}
                  </span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Branch Name</span>
                  <span className="ue-info-value">{selectedMainBranch?.name || selectedCityBranch?.name || "—"}</span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Branch Type</span>
                  <span className="ue-info-value">{branchType === "main" ? "Main Branch" : branchType === "city" ? "City Branch" : "—"}</span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">City</span>
                  <span className="ue-info-value">{selectedCityBranch?.city_name || "—"}</span>
                </div>
                <div className="ue-info-row">
                  <span className="ue-info-label">Currency</span>
                  <span className="ue-info-value font-mono">{selectedMainBranch?.local_currency || selectedCityBranch?.local_currency || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ━━ COUNTRY ACCESS TAB ━━ */}
        {activeTab === "country" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="ue-card">
              <div className="ue-card-header">
                <Globe2 className="h-4 w-4 text-blue-600" />
                <h2 className="ue-card-title">Country Assignment</h2>
              </div>
              <div className="space-y-4">
                <div className="ue-field">
                  <label className="ue-label">Assigned Country</label>
                  <SearchSelect
                    label={loadingCountries ? "Loading..." : "Select Country"}
                    value={countryId}
                    placeholder="Select country"
                    options={countryOptions}
                    disabled={loadingCountries || role === "super_admin"}
                    onValueChange={setCountryId}
                  />
                  {role === "super_admin" && (
                    <div className="text-[10px] text-amber-600 font-semibold mt-1">Super Admin has global access — no country restriction.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="ue-card">
              <div className="ue-card-header">
                <Globe2 className="h-4 w-4 text-blue-500" />
                <h2 className="ue-card-title">Country Details</h2>
              </div>
              {selectedCountry ? (
                <div className="space-y-2.5">
                  <div className="ue-info-row">
                    <span className="ue-info-label">Country Name</span>
                    <span className="ue-info-value">{selectedCountry.name}</span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">ISO Code</span>
                    <span className="ue-info-value font-mono">{selectedCountry.iso2 || "—"}</span>
                  </div>
                  <div className="ue-info-row">
                    <span className="ue-info-label">Currency</span>
                    <span className="ue-info-value font-mono">{(selectedCountry as any).currency_code || "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--ue-muted)] py-4">{role === "super_admin" ? "Super Admin — Global Access" : "No country selected"}</div>
              )}
            </div>
          </div>
        )}

        {/* ━━ ACTIVITY LOG TAB ━━ */}
        {activeTab === "activity" && (
          <div className="ue-card">
            <div className="ue-card-header">
              <Activity className="h-4 w-4 text-cyan-600" />
              <h2 className="ue-card-title">Activity Log</h2>
            </div>
            {userData?.activityCounts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {Object.entries(userData.activityCounts).map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-[var(--ue-line)] bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <div className="text-[9px] font-black uppercase tracking-wider text-[var(--ue-muted)]">{key}</div>
                    <div className="mt-1 text-xl font-black text-[var(--ue-title)]">{String(val)}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm text-[var(--ue-muted)] py-6 text-center">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Detailed activity log coming soon
            </div>
          </div>
        )}

        {/* ━━ LOGIN HISTORY TAB ━━ */}
        {activeTab === "history" && (
          <div className="ue-card">
            <div className="ue-card-header">
              <Clock className="h-4 w-4 text-indigo-600" />
              <h2 className="ue-card-title">Login History</h2>
            </div>
            <div className="space-y-2.5 mb-4">
              <div className="ue-info-row">
                <span className="ue-info-label">Last Login</span>
                <span className="ue-info-value">{userData?.lastActivity ? new Date(userData.lastActivity).toLocaleString() : "—"}</span>
              </div>
              <div className="ue-info-row">
                <span className="ue-info-label">Last Action</span>
                <span className="ue-info-value">{userData?.lastActivityAction || "—"}</span>
              </div>
              <div className="ue-info-row">
                <span className="ue-info-label">Total Logins</span>
                <span className="ue-info-value">{userData?.activityCounts?.logins ?? "—"}</span>
              </div>
            </div>
            <div className="text-sm text-[var(--ue-muted)] py-6 text-center">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Full login history coming soon
            </div>
          </div>
        )}

        {/* ━━ NOTIFICATIONS TAB ━━ */}
        {activeTab === "notifications" && (
          <div className="ue-card max-w-xl">
            <div className="ue-card-header">
              <Bell className="h-4 w-4 text-amber-600" />
              <h2 className="ue-card-title">Notification Preferences</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "Login Alerts", sub: "Notify on new login from unknown device" },
                { label: "Password Change Alerts", sub: "Notify when password is changed" },
                { label: "Role Change Alerts", sub: "Notify when role or permissions change" },
                { label: "Activity Digest", sub: "Weekly activity summary email" },
                { label: "System Announcements", sub: "Receive ERP system update announcements" },
              ].map(({ label, sub }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--ue-line)] bg-slate-50/50">
                  <div>
                    <div className="text-xs font-bold text-[var(--ue-title)]">{label}</div>
                    <div className="text-[10px] text-[var(--ue-muted)] mt-0.5">{sub}</div>
                  </div>
                  <button type="button" className="ue-toggle ue-toggle-active">
                    <span className="ue-toggle-thumb" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function UserEditStyles() {
  return (
    <style>{`
      .ue-shell {
        --ue-bg: #f0f5ff;
        --ue-card: rgba(255,255,255,.97);
        --ue-line: #d9e4f5;
        --ue-title: #0a1028;
        --ue-text: #17213c;
        --ue-muted: #64728b;
        --ue-topbar: rgba(255,255,255,.95);
        background: var(--ue-bg);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .dark .ue-shell {
        --ue-bg: #071120;
        --ue-card: #101b2f;
        --ue-line: #24344c;
        --ue-title: #f8fafc;
        --ue-text: #dbe7f7;
        --ue-muted: #90a4c2;
        --ue-topbar: rgba(10,17,40,.95);
      }
      .ue-topbar {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 24px;
        background: var(--ue-topbar);
        border-bottom: 1px solid var(--ue-line);
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 20px rgba(15,23,42,.06);
        gap: 12px;
        flex-wrap: wrap;
      }
      .ue-tab-nav {
        position: sticky;
        top: 60px;
        z-index: 40;
        background: var(--ue-card);
        border-bottom: 1px solid var(--ue-line);
        padding: 0 24px;
        box-shadow: 0 2px 10px rgba(15,23,42,.04);
      }
      .ue-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 12px 14px;
        font-size: 11px;
        font-weight: 800;
        color: var(--ue-muted);
        border-bottom: 2px solid transparent;
        transition: all .15s;
        white-space: nowrap;
      }
      .ue-tab:hover { color: var(--ue-title); border-bottom-color: #c7d5f0; }
      .ue-tab-active { color: #1f5eff !important; border-bottom-color: #1f5eff !important; }
      .ue-content {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
      }
      .ue-card {
        background: var(--ue-card);
        border: 1px solid var(--ue-line);
        border-radius: 14px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(15,23,42,.05);
      }
      .ue-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--ue-line);
        flex-wrap: wrap;
      }
      .ue-card-title {
        font-size: 13px;
        font-weight: 900;
        color: var(--ue-title);
        letter-spacing: -.01em;
      }
      .ue-field { display: flex; flex-direction: column; gap: 4px; }
      .ue-label { font-size: 11px; font-weight: 800; color: var(--ue-title); }
      .ue-input {
        height: 36px;
        width: 100%;
        border-radius: 9px;
        border: 1.5px solid var(--ue-line);
        background: var(--ue-card);
        padding: 0 12px;
        color: var(--ue-title);
        font-size: 12px;
        font-weight: 600;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .ue-input:focus {
        border-color: #245cff;
        box-shadow: 0 0 0 3px rgba(36,92,255,.12);
      }
      .ue-input:read-only { background: #f8faff; color: var(--ue-muted); cursor: default; }
      .ue-input-mono { font-family: ui-monospace, monospace; font-size: 11px; }
      .ue-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border-radius: 9px;
        border: 1.5px solid var(--ue-line);
        background: var(--ue-card);
        color: var(--ue-title);
        font-size: 11px;
        font-weight: 800;
        transition: all .15s;
        box-shadow: 0 2px 8px rgba(15,23,42,.06);
      }
      .ue-back-btn:hover { border-color: #245cff; color: #1f5eff; background: rgba(36,92,255,.06); }
      .ue-save-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        height: 36px;
        padding: 0 18px;
        border-radius: 9px;
        background: #1f5eff;
        color: #fff;
        font-size: 12px;
        font-weight: 900;
        box-shadow: 0 8px 20px rgba(31,94,255,.28);
        transition: all .15s;
      }
      .ue-save-btn:hover { background: #1a50e0; transform: translateY(-1px); }
      .ue-save-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }
      .ue-cancel-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 14px;
        border-radius: 9px;
        border: 1.5px solid var(--ue-line);
        background: var(--ue-card);
        color: var(--ue-title);
        font-size: 12px;
        font-weight: 800;
        transition: all .15s;
      }
      .ue-cancel-btn:hover { border-color: #ef4444; color: #ef4444; }
      .ue-toggle {
        position: relative;
        display: inline-flex;
        height: 20px;
        width: 36px;
        align-items: center;
        border-radius: 9999px;
        background: #cbd5e1;
        border: none;
        padding: 0;
        cursor: pointer;
        transition: background .2s;
        flex-shrink: 0;
      }
      .ue-toggle-active { background: #10b981; }
      .ue-toggle-thumb {
        height: 16px;
        width: 16px;
        border-radius: 9999px;
        background: white;
        transition: transform .2s;
        transform: translateX(2px);
        box-shadow: 0 1px 4px rgba(0,0,0,.18);
      }
      .ue-toggle-active .ue-toggle-thumb { transform: translateX(18px); }
      .ue-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid var(--ue-line);
      }
      .ue-info-row:last-child { border-bottom: none; }
      .ue-info-label { font-size: 10px; font-weight: 700; color: var(--ue-muted); text-transform: uppercase; letter-spacing: .04em; }
      .ue-info-value { font-size: 11px; font-weight: 700; color: var(--ue-title); text-align: right; }
      .ue-badge-row { display: flex; flex-wrap: wrap; gap: 6px; }
      .ue-badge { display: inline-flex; align-items: center; border-radius: 9999px; padding: 3px 10px; font-size: 10px; font-weight: 800; border: 1.5px solid; }
      .ue-badge-violet { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
      .ue-badge-blue { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
      .ue-badge-orange { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
      .ue-badge-green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
      .ue-badge-slate { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
      .ue-btn-sm {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 10px;
        border-radius: 7px;
        border: 1.5px solid var(--ue-line);
        background: var(--ue-card);
        color: var(--ue-title);
        font-size: 10px;
        font-weight: 800;
        transition: all .15s;
      }
      .ue-btn-sm:hover { border-color: #245cff; color: #1f5eff; }
    `}</style>
  );
}
