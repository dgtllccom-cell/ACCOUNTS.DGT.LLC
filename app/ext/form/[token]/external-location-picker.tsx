"use client";

import { useEffect, useId, useState } from "react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { PublicAddressChoice } from "@/lib/services/external-form-address";

export type ExternalLocationSelection = {
  country: PublicAddressChoice | null;
  state: PublicAddressChoice | null;
  city: PublicAddressChoice | null;
};
export const emptyExternalLocation: ExternalLocationSelection = { country: null, state: null, city: null };

function useChoices(token: string, lang: SupportedLanguage, kind: "country" | "state" | "city", countryId?: string, stateId?: string) {
  const [result, setResult] = useState<{ key: string; choices: PublicAddressChoice[]; failed: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([token, lang, kind, countryId, stateId, attempt]);
  const enabled = kind === "country" || Boolean(countryId);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    const params = new URLSearchParams({ kind, lang });
    if (countryId) params.set("countryId", countryId);
    if (stateId) params.set("stateProvinceId", stateId);
    fetch(`/api/public/form-link/${encodeURIComponent(token)}/locations?${params}`, { cache: "no-store", signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Locations unavailable");
        const data: { choices: PublicAddressChoice[] } = await res.json();
        if (!Array.isArray(data.choices)) throw new Error("Locations unavailable");
        if (!abort.signal.aborted) setResult({ key, choices: data.choices, failed: false });
      })
      .catch(() => { if (!abort.signal.aborted) setResult({ key, choices: [], failed: true }); });
    return () => abort.abort();
  }, [token, lang, kind, countryId, stateId, enabled, key]);
  return {
    choices: enabled && result?.key === key ? result.choices : [],
    loading: enabled && result?.key !== key,
    failed: enabled && result?.key === key && result.failed,
    retry: () => setAttempt((current) => current + 1),
  };
}

export function ExternalLocationPicker({ token, lang, value, onChange }: {
  token: string;
  lang: SupportedLanguage;
  value: ExternalLocationSelection;
  onChange: (next: ExternalLocationSelection) => void;
}) {
  const prefix = useId();
  const countries = useChoices(token, lang, "country");
  const states = useChoices(token, lang, "state", value.country?.id);
  const cities = useChoices(token, lang, "city", value.country?.id, value.state?.id);
  const label = [
    t(lang, "lochier.country", "Country"),
    t(lang, "lochier.state", "State / Province"),
    t(lang, "lochier.city", "City / Town"),
  ];
  const placeholders = [
    t(lang, "lochier.selectCountry", "Select country"),
    t(lang, "lochier.selectState", "Select state"),
    t(lang, "lochier.selectCity", "Select city"),
  ];
  const selections = [value.country, value.state, value.city];
  return <div className="space-y-3">{[countries, states, cities].map((list, idx) => {
    const id = `${prefix}-${idx}`;
    const selected = selections[idx];
    return <div className="space-y-1" key={id}>
      <label className="text-[11px] font-bold text-slate-700" htmlFor={id}>{label[idx]}{idx !== 1 ? " *" : ""}</label>
      <select id={id} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
        aria-busy={list.loading}
        value={selected?.id ?? ""}
        disabled={list.loading || list.failed || !list.choices.length}
        onChange={(event) => {
          const option = list.choices.find((row) => row.id === event.target.value) ?? null;
          if (idx === 0) onChange({ country: option, state: null, city: null });
          else if (idx === 1) onChange({ ...value, state: option, city: null });
          else onChange({ ...value, city: option });
        }}>
        <option value="">{list.loading ? t(lang, "common.loading", "Loading…") : placeholders[idx]}</option>
        {selected && !list.choices.some((option) => option.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
        {list.choices.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      {list.failed && <button type="button" className="text-xs underline" onClick={list.retry}>{t(lang, "com.retry", "Retry")}</button>}
    </div>;
  })}</div>;
}
