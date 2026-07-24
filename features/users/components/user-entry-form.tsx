
"use client";

// NOTE: This is still a draft UI, but we already connect Country/Main/City selection
// to the centralized Location + Branch system so IDs are not typed manually.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { supportedLanguages } from "@/lib/i18n/languages";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";

export type UserEntryKind = "super_admin" | "country" | "branch" | "agent" | "staff";

type RoleOption = { value: EnterpriseRole; label: string };

const roleOptionsByKind: Record<UserEntryKind, RoleOption[]> = {
  super_admin: [{ value: "super_admin", label: "Super Admin" }],
  country: [
    { value: "country_admin", label: "Country Admin" },
    { value: "main_branch_admin", label: "Main Branch Admin" },
    { value: "auditor_viewer", label: "Auditor / Viewer" }
  ],
  branch: [
    { value: "city_branch_admin", label: "City Branch Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "cashier", label: "Cashier" },
    { value: "staff_user", label: "Staff User" },
    { value: "auditor_viewer", label: "Auditor / Viewer" }
  ],
  agent: [{ value: "agent_user", label: "Agent User" }],
  staff: [{ value: "staff_user", label: "Staff User" }]
};

const scopeHelpByKind: Record<UserEntryKind, string> = {
  super_admin: "Global scope (no country or branch restriction).",
  country: "Country scope (choose a Country Id).",
  branch: "Branch scope (choose a Country Id, Country Main Branch Id, and/or City Branch Id).",
  agent: "Typically branch-scoped (choose a Country Id and City Branch Id).",
  staff: "Branch-scoped (choose a Country Id and City Branch Id)."
};

export function UserEntryForm({ kind }: { kind: UserEntryKind }) {
  const roleOptions = roleOptionsByKind[kind];

  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");

  const [mainBranches, setMainBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [cityBranches, setCityBranches] = useState<Array<{ id: string; name: string; code: string; city_name: string }>>([]);

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);

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
    setMainBranches([]);
    setCityBranches([]);
    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, {
        cache: "no-store"
      });
      if (!res.ok) return;
      const json = (await res.json()) as { countryBranches?: Array<{ id: string; name: string; code: string; is_main: boolean }> };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      if (!cancelled) setMainBranches(list.filter((b) => b.is_main).map((b) => ({ id: b.id, name: b.name, code: b.code })));
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
      const json = (await res.json()) as { cityBranches?: Array<{ id: string; name: string; code: string; city_name: string }> };
      const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
      if (!cancelled) setCityBranches(list.map((b) => ({ id: b.id, name: b.name, code: b.code, city_name: b.city_name })));
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId, countryBranchId]);

  return (
    <form className="rounded-lg border bg-card p-5" action="#" aria-label="User entry form (draft)">
      <div className="mb-4">
        <h2 className="font-medium">User setup (draft)</h2>
        <p className="text-sm text-muted-foreground">
          UI scaffold for user creation. API + approvals + audit logging will be wired next.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" placeholder="e.g. Asmat Khan" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@company.com" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferredLanguage">Preferred language</Label>
          <select
            id="preferredLanguage"
            name="preferredLanguage"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue="en"
          >
            {supportedLanguages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.englishName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={roleOptions[0]?.value}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{scopeHelpByKind[kind]}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold text-slate-950">Scope</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Country/Main/City are loaded from the centralized Location + Branch system.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <SearchSelect
              label={loadingCountries ? "Country (Loading...)" : "Country"}
              value={countryId}
              placeholder="Select country"
              options={countries.map((c) => ({ value: c.id, label: `${c.name} (${c.currency_code})` }))}
              disabled={kind === "super_admin" || loadingCountries}
              onValueChange={(value) => setCountryId(value)}
            />
            <input type="hidden" name="countryId" value={countryId} readOnly />
          </div>
          <div className="space-y-2">
            <SearchSelect
              label="Country Main Branch"
              value={countryBranchId}
              placeholder={countryId ? "Select main branch" : "Select country first"}
              options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
              disabled={kind === "super_admin" || !countryId}
              onValueChange={(value) => setCountryBranchId(value)}
            />
            <input type="hidden" name="countryBranchId" value={countryBranchId} readOnly />
          </div>
          <div className="space-y-2">
            <SearchSelect
              label="City Branch"
              value={cityBranchId}
              placeholder={countryBranchId ? "Select city branch" : "Select main branch first"}
              options={cityBranches.map((b) => ({ value: b.id, label: `${b.city_name} - ${b.name} (${b.code})` }))}
              disabled={kind === "super_admin" || !countryId || !countryBranchId}
              onValueChange={(value) => setCityBranchId(value)}
            />
            <input type="hidden" name="cityBranchId" value={cityBranchId} readOnly />
          </div>
        </div>

        {selectedCountry ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Selected country: {selectedCountry.name} ({selectedCountry.currency_code})
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" disabled className="cursor-not-allowed opacity-60">
          Save (API wiring next)
        </Button>
      </div>
    </form>
  );
}
