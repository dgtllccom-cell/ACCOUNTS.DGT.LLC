"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCcw, Save, ShieldCheck, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { supportedLanguages } from "@/lib/i18n/languages";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiGet } from "@/lib/api/client";
import { SimpleModal } from "@/components/ui/simple-modal";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string };

type Banner = { tone: "ok" | "err"; text: string } | null;

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string }> = [
  { value: "super_admin", label: "Super Admin User", help: "Global scope (full access)." },
  { value: "country_admin", label: "Country Admin User", help: "Country scope (one country)." },
  { value: "country_user", label: "Country User", help: "Country scope user (one country)." },
  { value: "main_branch_admin", label: "Main Branch Admin User", help: "Main branch scope (one country main branch)." },
  { value: "city_branch_admin", label: "City/Branch User", help: "City branch scope (one city branch)." },
  { value: "accountant", label: "Accountant", help: "City branch scope with accounting permissions." },
  { value: "cashier", label: "Cashier", help: "City branch scope with payment permissions." },
  { value: "agent_user", label: "Agent User", help: "City branch scope with limited access." },
  { value: "staff_user", label: "Staff User", help: "City branch scope with limited access." },
  { value: "auditor_viewer", label: "Auditor / Viewer", help: "Read-only scope (country or city branch)." }
];

const genderOptions = ["Male", "Female", "Other"] as const;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function reportRow(label: string, value: string) {
  const blank = !value || value === "-";
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-dashed py-2 text-sm last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={blank ? "font-semibold text-muted-foreground/70" : "font-semibold text-foreground"}>
        {value || "-"}
      </span>
    </div>
  );
}

function normalizePermission(p: string) {
  return p.trim();
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

export function UserRegistrationForm() {
  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);
  const [generatingUserCode, setGeneratingUserCode] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ userId: string; userCode: string; createdAt: string } | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ user: { id: string; email: string | null; fullName: string | null }; roles: string[] } | null>(null);

  // Person
  const [gender, setGender] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Company + ERP user
  const [userCode, setUserCode] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const allPermissions = useMemo(() => {
    const items = Object.values(enterpriseRolePermissions).flat();
    return [...new Set(items.map(normalizePermission).filter(Boolean))].sort();
  }, []);

  const [activePermGroup, setActivePermGroup] = useState<string>("users");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(() => {
    const defaults = enterpriseRolePermissions["city_branch_admin"] ?? [];
    return [...new Set(defaults.map(normalizePermission))];
  });

  // Role + Scope
  const [role, setRole] = useState<EnterpriseRole>("city_branch_admin");
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [countryBranches, setCountryBranches] = useState<MainBranchRow[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [cityBranchId, setCityBranchId] = useState("");

  const fullName = `${firstName} ${lastName}`.trim();

  const roleHelp = useMemo(() => roleOptions.find((r) => r.value === role)?.help ?? "", [role]);
  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(
    () => countryBranches.find((b) => b.id === countryBranchId) ?? null,
    [countryBranches, countryBranchId]
  );
  const selectedCityBranch = useMemo(
    () => cityBranches.find((b) => b.id === cityBranchId) ?? null,
    [cityBranches, cityBranchId]
  );

  const requiresCountry = role !== "super_admin";
  const isCountryScopedOnly = role === "country_admin" || role === "country_user";
  const requiresMainBranch = role === "main_branch_admin" || (role !== "super_admin" && !isCountryScopedOnly);
  const requiresCityBranch =
    role !== "super_admin" && !isCountryScopedOnly && role !== "main_branch_admin" && role !== "auditor_viewer";

  const groupedPermissions = useMemo(() => groupPermissions(allPermissions), [allPermissions]);
  const activeGroupPermissions = useMemo(() => {
    return groupedPermissions.find(([k]) => k === activePermGroup)?.[1] ?? [];
  }, [activePermGroup, groupedPermissions]);

  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissionQuery, setPermissionQuery] = useState("");
  const filteredPermissionGroups = useMemo(() => {
    const q = permissionQuery.trim().toLowerCase();
    if (!q) return groupedPermissions;
    return groupedPermissions
      .map(([group, perms]) => {
        const next = perms.filter((p) => p.toLowerCase().includes(q));
        return [group, next] as const;
      })
      .filter(([, perms]) => perms.length);
  }, [groupedPermissions, permissionQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await apiGet<{ user: { id: string; email: string | null; fullName: string | null }; roles: string[] }>(
          "/api/erp/auth/session"
        );
        if (!cancelled) setSessionInfo(info);
      } catch {
        // Session details are optional for the form UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    let cancelled = false;
    setCountryBranchId("");
    setCityBranchId("");
    setCountryBranches([]);
    setCityBranches([]);
    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, {
        cache: "no-store"
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        countryBranches?: Array<{ id: string; name: string; code: string; local_currency: string; is_main: boolean }>;
      };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      const mains = list.filter((b) => b.is_main).map((b) => ({ id: b.id, name: b.name, code: b.code, local_currency: b.local_currency }));
      if (!cancelled) setCountryBranches(mains);
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId]);

  useEffect(() => {
    let cancelled = false;
    setCityBranchId("");
    setCityBranches([]);
    if (!countryId || !countryBranchId) return;

    (async () => {
      const res = await fetch(
        `/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(
          countryBranchId
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        cityBranches?: Array<{ id: string; name: string; code: string; city_name: string; local_currency: string }>;
      };
      const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
      if (!cancelled)
        setCityBranches(list.map((b) => ({ id: b.id, name: b.name, code: b.code, city_name: b.city_name, local_currency: b.local_currency })));
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId, countryBranchId]);

  useEffect(() => {
    // When role changes, clear incompatible scope selections.
    setBanner(null);
    setCreatedResult(null);

    // Load default permissions for the selected role (can be customized).
    const defaults = enterpriseRolePermissions[role] ?? [];
    setSelectedPermissions([...new Set(defaults.map(normalizePermission).filter(Boolean))]);

    if (role === "super_admin") {
      setCountryId("");
      setCountryBranchId("");
      setCityBranchId("");
      return;
    }
    if (isCountryScopedOnly) {
      setCountryBranchId("");
      setCityBranchId("");
      return;
    }
    if (role === "main_branch_admin") {
      setCityBranchId("");
    }
  }, [role]);

  async function issueUserCode(): Promise<string | null> {
    setBanner(null);

    if (requiresCountry && !isUuid(countryId)) {
      setBanner({ tone: "err", text: "Please select a valid Country first (required for User ID generation)." });
      return null;
    }

    setGeneratingUserCode(true);
    try {
      const qp = new URLSearchParams();
      qp.set("role", role);
      if (countryId) qp.set("countryId", countryId);
      const res = await fetch(`/api/erp/users/next-code?${qp.toString()}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const message =
          (typeof json?.error?.message === "string" && json.error.message) ||
          (typeof json?.error === "string" && json.error) ||
          "Failed to generate User ID.";
        setBanner({ tone: "err", text: message });
        return null;
      }
      const code = (json?.data?.code as string | undefined) ?? "";
      if (code) setUserCode(code);
      return code || null;
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Failed to generate User ID." });
      return null;
    } finally {
      setGeneratingUserCode(false);
    }
  }

  function togglePermission(permission: string) {
    const p = normalizePermission(permission);
    setSelectedPermissions((prev) => {
      const set = new Set(prev);
      if (set.has(p)) set.delete(p);
      else set.add(p);
      return [...set].sort();
    });
  }

  async function onSubmit() {
    setBanner(null);
    setCreatedResult(null);

    if (!fullName || fullName.length < 2) {
      setBanner({ tone: "err", text: "Full name is required." });
      return;
    }

    if (password.length < 8) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setBanner({ tone: "err", text: "Confirm Password does not match." });
      return;
    }

    if (requiresCountry && !isUuid(countryId)) {
      setBanner({ tone: "err", text: "Please select a valid Country." });
      return;
    }

    if (requiresMainBranch && !isUuid(countryBranchId)) {
      setBanner({ tone: "err", text: "Please select a valid Country Main Branch." });
      return;
    }

    if (requiresCityBranch && !isUuid(cityBranchId)) {
      setBanner({ tone: "err", text: "Please select a valid City Branch." });
      return;
    }

    let issuedCode = userCode.trim();
    if (!issuedCode) {
      const next = await issueUserCode();
      issuedCode = next?.trim() || "";
    }

    if (!issuedCode) {
      setBanner({ tone: "err", text: "User ID is required." });
      return;
    }

    // NOTE: We intentionally do not ask for Email/Phone/ID details on the ERP user wizard.
    // Supabase still requires a valid email for email/password users, so we derive one from User ID.
    // This keeps the UX clean while allowing secure login by User ID.
    const derivedEmail = `${issuedCode.toLowerCase()}@damaan.com`;

    setSaving(true);
    try {
      const res = await fetch("/api/erp/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role,
          fullName,
          email: derivedEmail,
          password,
          preferredLanguage,
          userCode: issuedCode || undefined,
          permissions: selectedPermissions,
          countryId: countryId || null,
          countryBranchId: countryBranchId || null,
          cityBranchId: cityBranchId || null
        })
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const message =
          (typeof json?.error?.message === "string" && json.error.message) ||
          (typeof json?.error === "string" && json.error) ||
          "Failed to create user.";
        setBanner({ tone: "err", text: message });
        return;
      }

      setBanner({ tone: "ok", text: `User created: ${issuedCode}` });
      const createdData = json?.data ?? {};
      setCreatedResult({
        userId: String(createdData?.userId || ""),
        userCode: String(createdData?.userCode || userCode.trim() || ""),
        createdAt: new Date().toISOString()
      });
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Failed to create user." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New Entry</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">User Registration</h1>
          <p className="text-sm text-muted-foreground">Unified user setup with branch hierarchy and live report preview.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" aria-hidden />
              Complete Registration & Branch Detail
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {banner ? (
              <div
                className={
                  banner.tone === "ok"
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                    : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
                }
                role="status"
              >
                {banner.text}
              </div>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Personal Information</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select Gender</option>
                    {genderOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Company & Branch Scope</h2>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <SearchSelect
                    label="User Type / Role"
                    value={role}
                    options={roleOptions.map((r) => ({ value: r.value, label: r.label, keywords: r.help }))}
                    onValueChange={(next) => setRole(next as EnterpriseRole)}
                  />
                  <p className="text-xs text-muted-foreground">{roleHelp}</p>
                </div>
              </div>

              {requiresCountry ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <SearchSelect
                    label={loadingCountries ? "Country (Loading...)" : "Country"}
                    value={countryId}
                    disabled={loadingCountries}
                    options={countries.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.currency_code})`,
                      keywords: `${c.iso2 ?? ""} ${c.iso3 ?? ""} ${c.currency_code}`
                    }))}
                    onValueChange={(id) => setCountryId(id)}
                  />

                  <SearchSelect
                    label="Country Main Branch"
                    value={countryBranchId}
                    disabled={!countryId || !requiresMainBranch}
                    placeholder={countryId ? (requiresMainBranch ? "Select main branch" : "Not required") : "Select country first"}
                    options={countryBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: b.local_currency }))}
                    onValueChange={(id) => setCountryBranchId(id)}
                  />

                  <SearchSelect
                    label="City Branch"
                    value={cityBranchId}
                    disabled={!countryId || !countryBranchId || !requiresCityBranch}
                    placeholder={countryBranchId ? (requiresCityBranch ? "Select city branch" : "Not required") : "Select main branch first"}
                    options={cityBranches.map((b) => ({
                      value: b.id,
                      label: `${b.city_name} - ${b.name} (${b.code})`,
                      keywords: b.local_currency
                    }))}
                    onValueChange={(id) => setCityBranchId(id)}
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">ERP Credentials</h2>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <div className="flex gap-2">
                    <Input value={userCode} onChange={(e) => setUserCode(e.target.value)} placeholder="Auto-generated User ID" />
                    <Button type="button" variant="outline" className="h-10 shrink-0" onClick={issueUserCode} disabled={generatingUserCode}>
                      <RefreshCcw className="h-4 w-4" aria-hidden />
                      <span className="ms-2">{generatingUserCode ? "..." : "Auto"}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">User can sign in using User ID.</p>
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm Password" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Language</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                  >
                    {supportedLanguages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.englishName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                Role Permissions
              </h2>
              <p className="text-sm text-muted-foreground">Defaults load by role. You can customize permissions before saving.</p>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setPermissionsModalOpen(true)}>
                  Select Permissions
                </Button>
                <span className="text-xs text-muted-foreground">
                  Selected: <b className="text-foreground">{selectedPermissions.length}</b>
                </span>
              </div>

              {permissionsModalOpen ? (
                <SimpleModal title="Role Permissions" onClose={() => setPermissionsModalOpen(false)} className="max-w-4xl">
                  <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Search</Label>
                        <Input value={permissionQuery} onChange={(e) => setPermissionQuery(e.target.value)} placeholder="Search permissions..." />
                      </div>
                      <div className="rounded-lg border bg-white p-3 text-xs dark:bg-background">
                        <p className="font-semibold text-muted-foreground">Selected Permissions</p>
                        <div className="mt-2 max-h-64 space-y-1 overflow-auto">
                          {selectedPermissions.length ? (
                            selectedPermissions.map((p) => (
                              <div key={p} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                                <span className="font-mono">{p}</span>
                                <button type="button" className="text-rose-700" onClick={() => togglePermission(p)}>
                                  Remove
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground">No permissions selected.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permission List</p>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setPermissionsModalOpen(false)}>
                          Done
                        </Button>
                      </div>
                      <div className="max-h-[60vh] space-y-4 overflow-auto rounded-lg border bg-white p-3 dark:bg-background">
                        {filteredPermissionGroups.map(([group, perms]) => (
                          <div key={group} className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {perms.map((p) => {
                                const checked = selectedPermissions.includes(p);
                                return (
                                  <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs hover:bg-muted/30">
                                    <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => togglePermission(p)} />
                                    <span className="font-mono">{p}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SimpleModal>
              ) : null}
            </section>

            <div className="flex justify-end">
              <Button type="button" className="h-10 gap-2" onClick={onSubmit} disabled={saving}>
                <Save className="h-4 w-4" aria-hidden />
                {saving ? "Saving..." : "Submit"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit border-slate-200/80 shadow-sm xl:sticky xl:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Live Report</span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                Preview
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-white p-4 dark:bg-background">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">User</p>
              <div className="mt-3">
                {reportRow("Name", fullName || "-")}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-background">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Role & Scope</p>
              <div className="mt-3">
                {reportRow("Role", roleOptions.find((r) => r.value === role)?.label ?? role)}
                {reportRow("Country", selectedCountry?.name ?? "-")}
                {reportRow("Main Branch", selectedMainBranch ? `${selectedMainBranch.name} (${selectedMainBranch.code})` : "-")}
                {reportRow(
                  "City Branch",
                  selectedCityBranch ? `${selectedCityBranch.city_name} - ${selectedCityBranch.name} (${selectedCityBranch.code})` : "-"
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-background">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Preferences</p>
              <div className="mt-3">
                {reportRow("Language", preferredLanguage)}
                {reportRow("User ID", userCode.trim() || "-")}
              </div>
            </div>

            {createdResult ? (
              <div className="rounded-lg border bg-white p-4 dark:bg-background">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Confirmation</p>
                <div className="mt-3">
                  {reportRow("Created User UUID", createdResult.userId || "-")}
                  {reportRow("Issued User ID", createdResult.userCode || userCode.trim() || "-")}
                  {reportRow("Role", roleOptions.find((r) => r.value === role)?.label ?? role)}
                  {reportRow("Country", selectedCountry?.name ?? "-")}
                  {reportRow("Main Branch", selectedMainBranch ? `${selectedMainBranch.name} (${selectedMainBranch.code})` : "-")}
                  {reportRow(
                    "City Branch",
                    selectedCityBranch ? `${selectedCityBranch.city_name} - ${selectedCityBranch.name} (${selectedCityBranch.code})` : "-"
                  )}
                  {reportRow("Permissions", String(selectedPermissions.length))}
                  {reportRow("Created By", sessionInfo?.user.fullName || sessionInfo?.user.email || "-")}
                  {reportRow("Created At", createdResult.createdAt)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
