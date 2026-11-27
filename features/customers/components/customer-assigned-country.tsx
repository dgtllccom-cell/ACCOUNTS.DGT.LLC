"use client";

import { useEffect, useId, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type AssignedCountry = { id: string; name: string };

/** Operational choices must never be sourced from the physical address selector. */
export function CustomerAssignedCountry({
  lang, value, onChange, fixedCountryId,
}: {
  lang: SupportedLanguage;
  value: string;
  onChange: (id: string) => void;
  fixedCountryId?: string | null;
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
    else if (!value && countries.length === 1) onChange(countries[0].id);
  }, [countries, fixedCountryId, onChange, value]);

  const options = fixedCountryId ? countries.filter((country) => country.id === fixedCountryId) : countries;
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" htmlFor={id}>{t(lang, "hr.f_assigned_country", "Assigned Country")} *</label>
      <select id={id} className="w-full rounded-md border bg-background px-2 py-2 text-sm"
        value={value} onChange={(event) => onChange(event.target.value)} disabled={Boolean(fixedCountryId) || !countries.length}>
        <option value="">{t(lang, "lochier.selectCountry", "Select country")}</option>
        {options.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
      </select>
      {failed && <p role="alert" className="text-xs">{t(lang, "common.error", "Error")}</p>}
    </div>
  );
}
