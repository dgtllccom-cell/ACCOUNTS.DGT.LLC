"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Globe2, Building2, MapPin, Check } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type BranchScopeCountry = { id: string; name: string; iso2?: string | null };
export type BranchScopeCountryBranch = { id: string; name: string; code?: string | null; countryId: string };
export type BranchScopeCityBranch = { id: string; name: string; code?: string | null; countryBranchId: string };

export type BranchScopeValue = {
  countryId: string;
  countryBranchId: string;
  cityBranchId: string;
};

/**
 * Single combined "Country → Main Branch → City Branch" scope selector, replacing
 * three separate <select> elements with one hierarchical dropdown. Selecting a city
 * branch automatically implies its parent main branch and country; selecting a main
 * branch automatically implies its parent country.
 *
 * Built as a shared component (features/purchases/) so the same consolidated pattern
 * can be reused across the other purchase/report screens, per the standing request to
 * apply this structure consistently.
 */
export function BranchScopeDropdown({
  lang,
  countries,
  countryBranches,
  cityBranches,
  value,
  onChange,
  className = ""
}: {
  lang: SupportedLanguage | string;
  countries: BranchScopeCountry[];
  countryBranches: BranchScopeCountryBranch[];
  cityBranches: BranchScopeCityBranch[];
  value: BranchScopeValue;
  onChange: (next: BranchScopeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedCountryIds, setExpandedCountryIds] = useState<Set<string>>(new Set());
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const branchesByCountry = useMemo(() => {
    const map = new Map<string, BranchScopeCountryBranch[]>();
    for (const b of countryBranches) {
      const key = b.countryId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [countryBranches]);

  const citiesByBranch = useMemo(() => {
    const map = new Map<string, BranchScopeCityBranch[]>();
    for (const c of cityBranches) {
      const key = c.countryBranchId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [cityBranches]);

  // Auto-expand the branch of whatever is currently selected so the panel opens
  // showing the active scope rather than a fully collapsed tree.
  useEffect(() => {
    if (value.countryId) {
      setExpandedCountryIds((prev) => new Set(prev).add(value.countryId));
    }
    if (value.countryBranchId) {
      setExpandedBranchIds((prev) => new Set(prev).add(value.countryBranchId));
    }
  }, [value.countryId, value.countryBranchId]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selectedCountry = countries.find((c) => c.id === value.countryId) || null;
  const selectedBranch = countryBranches.find((b) => b.id === value.countryBranchId) || null;
  const selectedCity = cityBranches.find((c) => c.id === value.cityBranchId) || null;

  const label = selectedCity
    ? `${selectedBranch?.name ?? ""} - ${selectedCity.name}`
    : selectedBranch
      ? selectedBranch.name
      : selectedCountry
        ? selectedCountry.name
        : t(lang, "lp.all_branches", "All Countries / Branches");

  function toggleCountry(id: string) {
    setExpandedCountryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBranch(id: string) {
    setExpandedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    onChange({ countryId: "", countryBranchId: "", cityBranchId: "" });
    setOpen(false);
  }

  function selectCountry(countryId: string) {
    onChange({ countryId, countryBranchId: "", cityBranchId: "" });
    setOpen(false);
  }

  function selectBranch(countryId: string, branchId: string) {
    onChange({ countryId, countryBranchId: branchId, cityBranchId: "" });
    setOpen(false);
  }

  function selectCity(countryId: string, branchId: string, cityId: string) {
    onChange({ countryId, countryBranchId: branchId, cityBranchId: cityId });
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <Globe2 className="h-3 w-3 text-blue-500" aria-hidden /> {t(lang, "lp.branch_scope_label", "Country / Branch / City")}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-64 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-blue-500"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="absolute start-0 top-full z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button
            type="button"
            onClick={selectAll}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold ${
              !value.countryId ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t(lang, "lp.all_branches", "All Countries / Branches")}
            {!value.countryId && <Check className="h-3.5 w-3.5" aria-hidden />}
          </button>

          {countries.map((country) => {
            const branches = branchesByCountry.get(country.id) ?? [];
            const isExpanded = expandedCountryIds.has(country.id);
            const isCountrySelected = value.countryId === country.id && !value.countryBranchId;
            return (
              <div key={country.id} className="mt-0.5">
                <div
                  className={`flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-black uppercase tracking-wide ${
                    isCountrySelected ? "bg-blue-50 text-blue-700" : "text-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCountry(country.id)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {branches.length > 0 ? (
                      isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    ) : (
                      <span className="inline-block h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectCountry(country.id)}
                    className="flex flex-1 items-center gap-1.5 truncate py-0.5 text-start"
                  >
                    <Globe2 className="h-3 w-3 shrink-0 text-blue-500" aria-hidden />
                    <span className="truncate">{country.name}</span>
                  </button>
                  {isCountrySelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                </div>

                {isExpanded && branches.length > 0 && (
                  <div className="ms-4 border-s border-slate-100 ps-2">
                    {branches.map((branch) => {
                      const cities = citiesByBranch.get(branch.id) ?? [];
                      const branchExpanded = expandedBranchIds.has(branch.id);
                      const isBranchSelected = value.countryBranchId === branch.id && !value.cityBranchId;
                      return (
                        <div key={branch.id} className="mt-0.5">
                          <div
                            className={`flex items-center gap-1 rounded-lg px-1 py-1 text-[11px] font-bold ${
                              isBranchSelected ? "bg-blue-50 text-blue-700" : "text-slate-600"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleBranch(branch.id)}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label={branchExpanded ? "Collapse" : "Expand"}
                            >
                              {cities.length > 0 ? (
                                branchExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                              ) : (
                                <span className="inline-block h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => selectBranch(country.id, branch.id)}
                              className="flex flex-1 items-center gap-1.5 truncate py-0.5 text-start"
                            >
                              <Building2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                              <span className="truncate">{branch.name}</span>
                            </button>
                            {isBranchSelected && <Check className="h-3 w-3 shrink-0" aria-hidden />}
                          </div>

                          {branchExpanded && cities.length > 0 && (
                            <div className="ms-4 border-s border-slate-100 ps-2">
                              {cities.map((city) => {
                                const isCitySelected = value.cityBranchId === city.id;
                                return (
                                  <button
                                    key={city.id}
                                    type="button"
                                    onClick={() => selectCity(country.id, branch.id, city.id)}
                                    className={`flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-[11px] font-semibold ${
                                      isCitySelected ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    <MapPin className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden />
                                    <span className="truncate">{city.name}</span>
                                    {isCitySelected && <Check className="ms-auto h-3 w-3 shrink-0" aria-hidden />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
