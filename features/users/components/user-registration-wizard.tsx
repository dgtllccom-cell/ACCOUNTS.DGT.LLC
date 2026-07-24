"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  ShieldCheck,
  Upload,
  UserPlus,
  MapPin,
  ClipboardList,
  Search,
  Building2,
  Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import type { LocationCountry } from "@/features/locations/location-api";
import { listCities, listCountries, type LocationCity } from "@/features/locations/location-api";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { apiGet, apiPost } from "@/lib/api/client";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { CompanyPicker, type CompanyRow } from "@/features/companies/components/company-picker";
import { UserLiveReportPanel } from "./user-live-report-panel";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string; country_branch_id: string };

type WizardStep = 1 | 2 | 3;

type Banner = { tone: "ok" | "err"; text: string } | null;
type CompanyContact = { type?: string; value?: string; isPrimary?: boolean };

function getCompanyContact(company: CompanyRow | null, types: string[]) {
  if (!company?.contacts?.length) return "";
  const normalized = types.map((type) => type.toLowerCase());
  const primary = company.contacts.find((contact: CompanyContact) => contact.isPrimary && normalized.includes((contact.type ?? "").toLowerCase()));
  const match = primary ?? company.contacts.find((contact: CompanyContact) => normalized.includes((contact.type ?? "").toLowerCase()));
  return match?.value ?? "";
}

function companyValue(value: string | null | undefined) {
  return value?.trim() ? value.trim() : "-";
}

const genderOptions = ["Male", "Female", "Other"] as const;

const branchTypeOptions = [
  { value: "main", label: "Main Branch" },
  { value: "city", label: "City Branch" }
] as const;

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string }> = [
  { value: "super_admin", label: "Super Admin User", help: "Global scope (full access)." },
  { value: "country_admin", label: "Country Admin User", help: "Country scope (one country)." },
  { value: "country_user", label: "Country User", help: "Country scope user (one country)." },
  { value: "main_branch_admin", label: "Main Branch Admin User", help: "Main branch scope (one main branch)." },
  { value: "city_branch_admin", label: "City/Branch User", help: "City branch scope (one city branch)." },
  { value: "accountant", label: "Accountant", help: "Branch scope with accounting permissions." },
  { value: "cashier", label: "Cashier", help: "Branch scope with payment permissions." },
  { value: "agent_user", label: "Agent User", help: "Limited branch access." },
  { value: "staff_user", label: "Staff User", help: "Limited branch access." },
  { value: "auditor_viewer", label: "Auditor / Viewer", help: "Read-only scope." }
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makeAutoRegNo() {
  const rand = Math.floor(10000 + Math.random() * 89999);
  return `REG-${rand}`;
}

function toCountryOption(row: LocationCountry): SearchSelectOption {
  return {
    value: row.id,
    label: row.name,
    keywords: `${row.name} ${row.iso2 ?? ""} ${row.iso3 ?? ""} ${row.currency_code ?? ""}`
  };
}

function toSimpleOption(value: string, label = value): SearchSelectOption {
  return { value, label, keywords: label };
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

function reportRow(label: string, value: string, tone: "muted" | "primary" = "muted") {
  const safe = value?.trim() ? value.trim() : "-";
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={tone === "primary" ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>{safe}</div>
    </div>
  );
}

export function UserRegistrationWizard({ userIdProp }: { userIdProp?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUserId = userIdProp || searchParams.get("userId");

  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [createdResult, setCreatedResult] = useState<null | { userId: string; userCode: string; createdAt: string }>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");
  const [profileFile, setProfileFile] = useState<File | null>(null);

  // Step 1
  const [gender, setGender] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null);
  const [loadingSelectedCompany, setLoadingSelectedCompany] = useState(false);
  const [accountRegNo, setAccountRegNo] = useState(() => makeAutoRegNo());

  // Step 2
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [branchType, setBranchType] = useState<"" | "main" | "city">("");
  const [role, setRole] = useState<EnterpriseRole>("city_branch_admin");

  const [mainBranches, setMainBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");

  // Step 3
  const [userCode, setUserCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activePermGroup, setActivePermGroup] = useState<string>("users");
  const [permQuery, setPermQuery] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(() => {
    const defaults = enterpriseRolePermissions["city_branch_admin"] ?? [];
    return [...new Set(defaults.map((p) => p.trim()).filter(Boolean))];
  });

  // Edit list states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedReportUserId, setSelectedReportUserId] = useState("current");
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isResettingBranch, setIsResettingBranch] = useState(true);
  const [shouldDefaultPermissions, setShouldDefaultPermissions] = useState(true);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/erp/users/journal-report?limit=500").then((r) => r.json());
      if (res && res.rows && Array.isArray(res.rows)) {
        setUsersList(res.rows);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchSpecificUser(id: string) {
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.userId) {
        setBanner(null);
        setCreatedResult(null);
        setIsResettingBranch(false);
        setShouldDefaultPermissions(false);

        setEditUserId(data.userId);
        setFullName(data.fullName);
        setGender("Male");
        setUserCode(data.userCode);
        setRole(data.role);
        setCountryId(data.countryId || "");
        setSelectedCompanyId(data.defaultCompanyId || data.companyId || "");

        if (data.countryBranchId && !data.cityBranchId) {
          setBranchType("main");
          setCountryBranchId(data.countryBranchId);
          setCityBranchId("");
        } else if (data.cityBranchId) {
          setBranchType("city");
          setCityBranchId(data.cityBranchId);
        } else {
          setBranchType("");
          setCountryBranchId("");
          setCityBranchId("");
        }

        setPassword("");
        setConfirmPassword("");
        setSelectedPermissions(data.permissions || []);
        setStep(1);
        setSelectedReportUserId(data.userId);
      }
    } catch (err) {
      console.error("Failed to load user for edit", err);
    }
  }

  const loadUserForEditing = (row: any) => {
    setBanner(null);
    setCreatedResult(null);
    setIsResettingBranch(false);
    setShouldDefaultPermissions(false);

    setEditUserId(row.userId);
    setFullName(row.fullName);
    setGender("Male");
    setUserCode(row.userCode);
    setRole(row.role);
    setCountryId(row.countryId || "");
    setSelectedCompanyId(row.defaultCompanyId || row.companyId || "");

    const isMain = row.branchType === "Main Branch" || row.role === "main_branch_admin";
    const isCity = row.branchType === "City Branch" && row.role !== "main_branch_admin";

    if (isMain) {
      setBranchType("main");
      setCountryBranchId(row.branchId || "");
      setCityBranchId("");
    } else if (isCity) {
      setBranchType("city");
      setCityBranchId(row.branchId || "");
    } else {
      setBranchType("");
      setCountryBranchId("");
      setCityBranchId("");
    }

    setPassword("");
    setConfirmPassword("");
    setSelectedPermissions(row.permissions || []);
    setStep(1);
    setSelectedReportUserId(row.userId);
  };

  useEffect(() => {
    if (urlUserId && !editUserId) {
      fetchSpecificUser(urlUserId);
    }
  }, [urlUserId, editUserId]);
  useEffect(() => {
    if (!selectedCompanyId) {
      setSelectedCompany(null);
      return;
    }

    let cancelled = false;
    setLoadingSelectedCompany(true);
    apiGet<{ company: CompanyRow }>(`/api/erp/companies/${encodeURIComponent(selectedCompanyId)}`)
      .then((res) => {
        if (cancelled) return;
        const company = res.company ?? null;
        setSelectedCompany(company);
        if (!company) return;

        const ownerOrName = company.owner_name || company.legal_name || company.name || "";
        if (ownerOrName) setFullName(ownerOrName);
        if (company.country_id) setCountryId((current) => current || company.country_id || "");
      })
      .catch(() => {
        if (!cancelled) setSelectedCompany(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSelectedCompany(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);


  const countryOptions = useMemo(() => countries.map(toCountryOption), [countries]);
  const branchTypeSelectOptions = useMemo(
    () => branchTypeOptions.map((o) => ({ value: o.value, label: o.label, keywords: o.label })),
    []
  );
  const roleSelectOptions = useMemo(
    () =>
      roleOptions.map((o) => ({
        value: o.value,
        label: o.label,
        keywords: `${o.label} ${o.help}`
      })),
    []
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const selectedCompanyEmail = useMemo(() => getCompanyContact(selectedCompany, ["email"]), [selectedCompany]);
  const selectedCompanyPhone = useMemo(() => getCompanyContact(selectedCompany, ["phone", "mobile", "telephone", "office"]), [selectedCompany]);

  const branchCode = useMemo(() => {
    if (branchType === "main") return selectedMainBranch?.code ?? "";
    if (branchType === "city") return selectedCityBranch?.code ?? "";
    return "";
  }, [branchType, selectedMainBranch, selectedCityBranch]);

  const cityName = useMemo(() => {
    if (branchType === "city") return selectedCityBranch?.city_name ?? "";
    if (branchType === "main") {
      const cityId = selectedMainBranch?.city_id ?? null;
      if (!cityId) return "";
      const match = cities.find((c) => c.id === cityId);
      return match?.name ?? "";
    }
    return "";
  }, [branchType, selectedCityBranch, selectedMainBranch, cities]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries();
        if (!cancelled) setCountries(rows);
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // When country changes, reset the branch selections.
    setBanner(null);
    setCreatedResult(null);
    if (isResettingBranch) {
      setBranchType("");
      setCountryBranchId("");
      setCityBranchId("");
      setMainBranches([]);
      setCityBranches([]);
      setCities([]);
    } else {
      setIsResettingBranch(true);
    }

    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { countryBranches?: MainBranchRow[] };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      setMainBranches(list.filter((b) => Boolean(b.is_main)));
    })().catch(() => null);

    (async () => {
      const res = await fetch(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { cityBranches?: CityBranchRow[] };
      const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
      setCityBranches(list);
    })().catch(() => null);

    (async () => {
      const list = await listCities({ countryId });
      setCities(list);
    })().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  useEffect(() => {
    // Default permissions for role.
    setCreatedResult(null);
    if (shouldDefaultPermissions) {
      const defaults = enterpriseRolePermissions[role] ?? [];
      setSelectedPermissions([...new Set(defaults.map((p) => p.trim()).filter(Boolean))]);
    } else {
      setShouldDefaultPermissions(true);
    }

    // Scope requirements:
    if (role === "super_admin") {
      setCountryId("");
      setBranchType("");
      setCountryBranchId("");
      setCityBranchId("");
      return;
    }
    if (role === "country_admin" || role === "country_user") {
      setBranchType("");
      setCountryBranchId("");
      setCityBranchId("");
      return;
    }
    if (role === "main_branch_admin") {
      setCityBranchId("");
      return;
    }
  }, [role]);

  async function generateUserCode() {
    setBanner(null);
    const qp = new URLSearchParams({ role });
    if (countryId) qp.set("countryId", countryId);

    try {
      const res = await fetch(`/api/erp/users/next-code?${qp.toString()}`, { credentials: "include" });
      const json = (await res.json()) as { code?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to issue next User ID.");
      const code = normalizeUserCode(String(json.code || ""));
      setUserCode(code);
      return code;
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Failed to generate User ID." });
      return null;
    }
  }

  useEffect(() => {
    // Auto-generate user code once role and required country scope is selected.
    if (!role) return;
    if (role !== "super_admin" && !isUuid(countryId)) return;
    if (!userCode) generateUserCode().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, countryId]);

  function togglePermission(perm: string) {
    const p = perm.trim();
    if (!p) return;
    setSelectedPermissions((current) => {
      const has = current.includes(p);
      if (has) return current.filter((x) => x !== p);
      return [...current, p];
    });
  }

  function canGoNext() {
    if (step === 1) return Boolean(selectedCompanyId && gender && fullName.trim().length >= 2);
    if (step === 2) {
      if (role === "super_admin") return true;
      if (!isUuid(countryId)) return false;
      if (role === "country_admin" || role === "country_user") return true;
      if (role === "main_branch_admin") return Boolean(branchType === "main" && isUuid(countryBranchId));
      // Branch-scoped roles:
      if (branchType === "main") return Boolean(isUuid(countryBranchId));
      if (branchType === "city") return Boolean(isUuid(cityBranchId));
      return false;
    }
    return true;
  }

  function next() {
    if (step === 1) setStep(2);
    if (step === 2) setStep(3);
  }

  function prev() {
    if (step === 3) setStep(2);
    if (step === 2) setStep(1);
  }

  async function finish() {
    setBanner(null);
    setCreatedResult(null);

    if (!fullName || fullName.trim().length < 2) {
      setBanner({ tone: "err", text: "Full Name must be at least 2 characters." });
      return;
    }

    if (!gender) {
      setBanner({ tone: "err", text: "Gender is required." });
      return;
    }

    const issuedCode = normalizeUserCode(userCode || "");
    if (!issuedCode) {
      setBanner({ tone: "err", text: "User ID is required." });
      return;
    }

    const isEdit = Boolean(editUserId);

    if (!isEdit && (!password || password.length < 8)) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }

    if (password && password.length < 8) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setBanner({ tone: "err", text: "Confirm Password does not match." });
      return;
    }

    // Resolve scope IDs from the selected branch type.
    let resolvedCountryId: string | null = countryId || null;
    let resolvedCountryBranchId: string | null = null;
    let resolvedCityBranchId: string | null = null;

    if (role === "super_admin") {
      resolvedCountryId = null;
    } else if (role === "country_admin" || role === "country_user") {
      resolvedCountryBranchId = null;
      resolvedCityBranchId = null;
    } else if (role === "main_branch_admin") {
      resolvedCountryBranchId = countryBranchId || null;
    } else {
      // branch roles
      if (branchType === "main") {
        resolvedCountryBranchId = countryBranchId || null;
        resolvedCityBranchId = null;
      } else {
        resolvedCityBranchId = cityBranchId || null;
        resolvedCountryBranchId = selectedCityBranch?.country_branch_id ?? null;
      }
    }

    if (role !== "super_admin" && !resolvedCountryId) {
      setBanner({ tone: "err", text: "Country is required for this role." });
      return;
    }

    const preferredLanguage = (localStorage.getItem("erp_lang") || "en").toString();

    // Supabase requires email. We generate a stable internal email and rely on User ID login via profiles.user_code.
    const email = `${issuedCode.toLowerCase()}@users.damaan.local`;

    setSaving(true);
    try {
      const payload: any = {
        role,
        companyId: selectedCompanyId || null,
        fullName: fullName.trim(),
        userCode: issuedCode,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        permissions: selectedPermissions
      };

      let res;
      if (isEdit) {
        payload.userId = editUserId;
        if (password) {
          payload.password = password;
        }

        const fetchRes = await fetch("/api/erp/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user.");
        res = { userId: editUserId!, userCode: issuedCode };
      } else {
        payload.email = email;
        payload.password = password;
        payload.preferredLanguage = preferredLanguage;
        res = await apiPost<{ userId: string; userCode: string }>("/api/erp/users", payload);
      }

      setBanner({ tone: "ok", text: isEdit ? "User updated successfully." : "User created successfully." });
      localStorage.setItem("user_journal_dirty", new Date().toISOString());
      setCreatedResult({ userId: res.userId, userCode: res.userCode, createdAt: new Date().toISOString() });
      fetchUsers();
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "User operation failed." });
    } finally {
      setSaving(false);
    }
  }

  const steps = useMemo(
    () => [
      { number: 1 as const, label: "Personal Information", icon: <UserPlus className="h-4 w-4" aria-hidden /> },
      { number: 2 as const, label: "Country / Branch / Role", icon: <MapPin className="h-4 w-4" aria-hidden /> },
      { number: 3 as const, label: "Security & Permissions", icon: <ShieldCheck className="h-4 w-4" aria-hidden /> }
    ],
    []
  );

  const mainBranchOptions: SearchSelectOption[] = useMemo(
    () => mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: `${b.name} ${b.code}` })),
    [mainBranches]
  );

  const cityBranchOptions: SearchSelectOption[] = useMemo(
    () =>
      cityBranches.map((b) => ({
        value: b.id,
        label: `${b.name} (${b.code})`,
        keywords: `${b.name} ${b.code} ${b.city_name}`
      })),
    [cityBranches]
  );

  const filteredSidebarUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = sidebarFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        (u.userCode ?? "").toLowerCase().includes(q) ||
        (u.fullName ?? "").toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [usersList, sidebarFilter]);

  return (
    <div className="space-y-4">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">User Registration & Setup</h1>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              {editUserId ? "Edit Mode" : "New User"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-1.5 font-medium">
            <span><strong>Journal ID:</strong> <span className="font-mono text-slate-700">{accountRegNo}</span></span>
            <span><strong>Login User ID:</strong> <span className="text-[#1455ff] font-extrabold">{userCode || "-"}</span></span>
            <span><strong>System ID:</strong> <span className="font-mono text-slate-700">{accountRegNo}</span></span>
            <span><strong>Registered:</strong> <span className="text-slate-700">{editUserId ? "Active" : "Draft"}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/new-entry/users/journal-report")} className="h-9">
            <ClipboardList className="mr-1.5 h-4 w-4 text-slate-500" /> User Journal Report
          </Button>
        </div>
      </div>

      {/* ── Left Column Form + Right Column Preview ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Side: Direct Single-Page Form */}
        <div className="lg:col-span-5 space-y-4">
          {/* Header Banner */}
          {banner ? (
            <div
              className={
                banner.tone === "ok"
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 animate-fade-in"
                  : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 animate-fade-in"
              }
            >
              {banner.text}
            </div>
          ) : null}

          {/* Edit status indicator & cancel edit button */}
          {editUserId && (
            <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <span>Currently editing user <b>{userCode}</b>.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-amber-950 font-bold hover:bg-amber-100"
                onClick={() => {
                  setEditUserId(null);
                  setFullName("");
                  setSelectedCompanyId("");
                  setSelectedCompany(null);
                  setUserCode("");
                  setCountryId("");
                  setBranchType("");
                  setCountryBranchId("");
                  setCityBranchId("");
                  setSelectedPermissions([]);
                  setPassword("");
                  setConfirmPassword("");
                  setBanner(null);
                  setSelectedReportUserId("current");
                }}
              >
                Cancel Edit
              </Button>
            </div>
          )}

          {/* Confirmation Message */}
          {createdResult ? (
            <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <div className="text-sm font-semibold text-emerald-900">Operation Successful</div>
                <div className="grid gap-1 text-sm text-emerald-900">
                  <div><b>User ID:</b> {createdResult.userCode}</div>
                  <div><b>Role:</b> {roleOptions.find((r) => r.value === role)?.label ?? role}</div>
                  <div><b>Scope:</b> {selectedCountry?.name ?? "-"} {branchCode ? ` / ${branchCode}` : ""} {cityName ? ` / ${cityName}` : ""}</div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCreatedResult(null);
                      setEditUserId(null);
                      setStep(1);
                      setGender("");
                      setFullName("");
                      setSelectedCompanyId("");
                      setSelectedCompany(null);
                      setAccountRegNo(makeAutoRegNo());
                      setCountryId("");
                      setBranchType("");
                      setCountryBranchId("");
                      setCityBranchId("");
                      setUserCode("");
                      setPassword("");
                      setConfirmPassword("");
                      setProfileFile(null);
                      setPreviewImageUrl("");
                      setSelectedReportUserId("current");
                    }}
                  >
                    Register New User
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/dashboard/new-entry/users/journal-report")}
                  >
                    View Journal Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Card 1: Personal Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-655">1</span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Personal Information</h2>
            </div>

            <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <CompanyPicker
                label="Company / Owner (Master Data) *"
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                placeholder="Search Company Management records"
                createButtonPlacement="both"
              />
              {selectedCompanyId ? (
                <div className="rounded-lg border bg-white p-3 text-[10px] shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b pb-2">
                    <div className="font-black uppercase tracking-wide text-slate-700">Master Data Profile</div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">{loadingSelectedCompany ? "Loading" : "Linked"}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><span className="text-slate-400">Company:</span> <b>{companyValue(selectedCompany?.name)}</b></div>
                    <div><span className="text-slate-400">Owner:</span> <b>{companyValue(selectedCompany?.owner_name || selectedCompany?.legal_name)}</b></div>
                    <div><span className="text-slate-400">Country:</span> <b>{companyValue(selectedCompany?.country_name)}</b></div>
                    <div><span className="text-slate-400">State / City:</span> <b>{companyValue([selectedCompany?.state_name, selectedCompany?.city_name].filter(Boolean).join(" / "))}</b></div>
                    <div><span className="text-slate-400">Area:</span> <b>{companyValue(selectedCompany?.area_name)}</b></div>
                    <div><span className="text-slate-400">ZIP:</span> <b>{companyValue(selectedCompany?.zip_code)}</b></div>
                    <div><span className="text-slate-400">Email:</span> <b>{companyValue(selectedCompanyEmail)}</b></div>
                    <div><span className="text-slate-400">Phone:</span> <b>{companyValue(selectedCompanyPhone)}</b></div>
                    <div className="sm:col-span-2"><span className="text-slate-400">Address:</span> <b>{companyValue(selectedCompany?.address)}</b></div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-white/70 px-3 py-2 text-[10px] font-semibold text-slate-500">Select a Company Management record. Company, owner, country, city, address, email, and phone will auto-fill from Master Data.</div>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-slate-50/50 p-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-white shadow-xs shrink-0">
                {previewImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewImageUrl} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-4 w-4 text-slate-400" aria-hidden />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-slate-700 mb-2">Profile Picture</div>
                <Label className="cursor-pointer flex w-max items-center justify-center h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 border text-slate-500 shadow-sm transition gap-1.5 text-[10px] font-semibold">
                  <Paperclip className="h-3 w-3" />
                  <span>Attach</span>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProfileFile(file);
                      if (!file) {
                        setPreviewImageUrl("");
                        return;
                      }
                      setPreviewImageUrl(URL.createObjectURL(file));
                    }}
                    className="hidden"
                  />
                </Label>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold">Gender *</Label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  {genderOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold">Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Owner / user name from Company Master" readOnly={Boolean(selectedCompany)} className={`h-9 text-xs ${selectedCompany ? "bg-slate-50 font-semibold" : ""}`} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[10px] font-bold">Account Registration Number (Auto)</Label>
                <Input value={accountRegNo} readOnly className="bg-slate-50 font-bold font-mono h-9 text-xs" />
              </div>
            </div>
          </div>

          {/* Card 2: Scope Flow */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-655">2</span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Scope & Assignment</h2>
            </div>

            <div className="grid gap-3.5 md:grid-cols-1">
              <SearchSelect
                label={loadingCountries ? "Country (Loading...)" : "Country *"}
                value={countryId}
                placeholder="Select country"
                options={countryOptions}
                disabled={loadingCountries || role === "super_admin"}
                onValueChange={setCountryId}
              />

              <SearchSelect
                label="Branch Type *"
                value={branchType}
                placeholder="Select branch type"
                options={branchTypeSelectOptions}
                disabled={role === "super_admin" || role === "country_admin" || role === "country_user"}
                onValueChange={(v) => {
                  setBranchType(v as any);
                  setCountryBranchId("");
                  setCityBranchId("");
                }}
              />

              {branchType === "main" ? (
                <SearchSelect
                  label="Branch Name *"
                  value={countryBranchId}
                  placeholder="Select main branch"
                  options={mainBranchOptions}
                  disabled={role === "super_admin" || role === "country_admin" || role === "country_user" || !countryId}
                  onValueChange={setCountryBranchId}
                />
              ) : branchType === "city" ? (
                <SearchSelect
                  label="Branch Name *"
                  value={cityBranchId}
                  placeholder="Select city branch"
                  options={cityBranchOptions}
                  disabled={role === "super_admin" || role === "country_admin" || role === "country_user" || !countryId}
                  onValueChange={setCityBranchId}
                />
              ) : (
                <div className="rounded-lg border bg-slate-50/60 p-2.5 text-[10px] font-semibold text-slate-500 text-center">
                  Select Country & Branch Type above.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold">Branch Code (Auto)</Label>
                  <Input value={branchCode} readOnly className="bg-slate-50 font-bold font-mono h-9 text-xs text-blue-600" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold">City (Auto)</Label>
                  <Input value={cityName} readOnly className="bg-slate-50 font-bold h-9 text-xs text-slate-800" />
                </div>
              </div>

              <SearchSelect
                label="Role *"
                value={role}
                placeholder="Select role"
                options={roleSelectOptions}
                onValueChange={(v) => setRole(v as EnterpriseRole)}
              />
            </div>
          </div>

          {/* Card 3: Security & Credentials */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-660">3</span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Credentials & Permissions</h2>
            </div>

            <div className="grid gap-3.5 md:grid-cols-1">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold">User ID *</Label>
                <div className="flex gap-2">
                  <Input value={userCode} onChange={(e) => setUserCode(e.target.value)} placeholder="User login ID" className="h-9 text-xs" />
                  <Button type="button" variant="outline" size="icon" aria-label="Regenerate ID" onClick={generateUserCode} className="flex-shrink-0 h-9 w-9">
                    <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold">{editUserId ? "Password (leave blank to keep current)" : "Password *"}</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold">{editUserId ? "Confirm Password" : "Confirm Password *"}</Label>
                <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" type="password" className="h-9 text-xs" />
              </div>
            </div>

            <div className="grid gap-3 grid-cols-1 pt-1.5">
              {/* Perm groups */}
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Permission Groups</div>
                <Input className="h-8 text-xs mb-2 bg-white" value={permQuery} onChange={(e) => setPermQuery(e.target.value)} placeholder="Search group..." />
                <div className="max-h-[140px] overflow-y-auto rounded-lg border bg-white text-xs">
                  {filteredGroups.map(([group, perms]) => {
                    const active = group === activePermGroup;
                    const count = perms.filter((p) => selectedPermissions.includes(p)).length;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setActivePermGroup(group)}
                        className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-slate-50 transition-colors border-b last:border-b-0 ${active ? "bg-slate-100/60 font-bold text-slate-900" : "text-slate-600"}`}
                      >
                        <span className="truncate">{group}</span>
                        <span className="text-[10px] font-bold font-mono px-1 bg-slate-200/50 rounded">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissions items */}
              <div className="rounded-lg border bg-slate-50/60 p-3">
                <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Granted Permissions ({activePermGroup})</div>
                <div className="max-h-[180px] overflow-y-auto rounded-lg border bg-white p-1.5">
                  {activeGroupPermissions.length ? (
                    <div className="space-y-0.5">
                      {activeGroupPermissions.map((perm) => {
                        const checked = selectedPermissions.includes(perm);
                        return (
                          <label key={perm} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded text-primary"
                              checked={checked}
                              onChange={() => togglePermission(perm)}
                            />
                            <span className="font-semibold text-slate-700 truncate">{perm}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">No permissions match filter query.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Unified Save & Action Controls */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/dashboard/new-entry/users/journal-report")}
              className="h-10 text-xs font-bold border-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={finish}
              disabled={saving}
              className="bg-primary hover:bg-primary/95 text-white h-10 px-6 text-xs font-bold shadow-md shadow-blue-100"
            >
              {saving ? "Saving..." : editUserId ? "Save Changes" : "Register User"}
            </Button>
          </div>
        </div>

        {/* Right Side: High-fidelity Live Report Preview */}
        <div className="lg:col-span-7 h-fit lg:sticky lg:top-16 space-y-3">
          <UserLiveReportPanel
            fullName={fullName}
            gender={gender}
            accountRegNo={accountRegNo}
            role={role}
            userCode={userCode || "PK-QUETTA-0531"}
            hideHeader={true}
            rawPassword={password || "admin123"}
            status={editUserId ? "Active" : "Draft"}
            selectedCountryName={selectedCountry?.name}
            selectedCountryCode={selectedCountry?.iso2 ?? selectedCountry?.iso3 ?? undefined}
            selectedBranchName={branchType === "main" ? selectedMainBranch?.name : branchType === "city" ? `${selectedCityBranch?.city_name} - ${selectedCityBranch?.name}` : "Global"}
            selectedBranchCode={branchCode}
            selectedBranchType={branchType === "main" ? "Main Branch" : branchType === "city" ? "City Branch" : "Global"}
            selectedCityName={cityName}
            selectedPermissions={selectedPermissions}
            onBack={() => router.push("/dashboard/new-entry/users/journal-report")}
          />
        </div>
      </div>
    </div>
  );
}






