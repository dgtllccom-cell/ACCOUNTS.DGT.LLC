"use client";

import { useEffect, useId, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type AssignedCountry = { id: string; name: string };

/**
 * The record's ASSIGNED (operational / access-scope) country.
 *
 * It is deliberately a separate control from the physical-address
 * LocationHierarchySelect: choosing an address country (e.g. India) must never
 * move a record assigned to another country (e.g. UAE) out of that scope.
 * `fixedCountryId` locks it (edit mode, or a parent that already owns the scope).
 */
export function AssignedCountrySelect({
  lang, value, onChange, fixedCountryId, fixedCountryName, hint, locked,
}: {
  lang: SupportedLanguage;
  value: string;
  onChange: (id: string) => void;
  fixedCountryId?: string | null;
  /** Shown when the locked country is not in the caller's selectable list. */
  fixedCountryName?: string | null;
  hint?: string;
  /** Read-only (e.g. editing an existing record), even when no country is set. */
  locked?: boolean;
}) {
  const id = useId();
  const [countries, setCountries] = useState<AssignedCountry[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    apiGet<{ countries?: AssignedCountry[] }>("/api/branch-management/countries")
      .then((data) => { if (active) setCountries(data.countries ?? []); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (fixedCountryId && fixedCountryId !== value) onChange(fixedCountryId);
    else if (!fixedCountryId && !locked && !value && countries.length === 1) onChange(countries[0].id);
  }, [countries, fixedCountryId, locked, onChange, value]);

  let options = fixedCountryId ? countries.filter((country) => country.id === fixedCountryId) : countries;
  if (fixedCountryId && options.length === 0 && fixedCountryName) {
    options = [{ id: fixedCountryId, name: fixedCountryName }];
  }
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" htmlFor={id}>{t(lang, "hr.f_assigned_country", "Assigned Country")} *</label>
      <select id={id} className="w-full rounded-md border bg-background px-2 py-2 text-sm"
        value={value} onChange={(event) => onChange(event.target.value)} disabled={Boolean(locked) || Boolean(fixedCountryId) || !countries.length}>
        <option value="">{t(lang, "lochier.selectCountry", "Select country")}</option>
        {options.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
      </select>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {failed && <p role="alert" className="text-xs">{t(lang, "common.error", "Error")}</p>}
    </div>
  );
}
