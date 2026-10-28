"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronDown, Globe, Check } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export type CountryItem = {
  id: string;
  name: string;
  currency_code: string;
};

interface CountrySelectDropdownProps {
  countries: CountryItem[];
  currentCountryId: string;
  currentTab: string;
}

function getCountryFlag(name: string): string {
  const lower = (name || "").toLowerCase();
  if (lower.includes("emirates") || lower.includes("uae")) return "🇦🇪";
  if (lower.includes("afghanistan")) return "🇦🇫";
  if (lower.includes("pakistan")) return "🇵🇰";
  if (lower.includes("india")) return "🇮🇳";
  if (lower.includes("china")) return "🇨🇳";
  if (lower.includes("saudi")) return "🇸🇦";
  if (lower.includes("iran")) return "🇮🇷";
  if (lower.includes("tajikistan")) return "🇹🇯";
  if (lower.includes("uzbekistan")) return "🇺🇿";
  if (lower.includes("turkiye") || lower.includes("turkey")) return "🇹🇷";
  if (lower.includes("oman")) return "🇴🇲";
  if (lower.includes("qatar")) return "🇶🇦";
  if (lower.includes("kuwait")) return "🇰🇼";
  if (lower.includes("bahrain")) return "🇧🇭";
  return "🌐";
}

export function CountrySelectDropdown({
  countries,
  currentCountryId,
  currentTab
}: CountrySelectDropdownProps) {
  const lang = useActiveLanguage();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = countries.find((c) => c.id === currentCountryId) || countries[0];
  const selectedFlag = selected ? getCountryFlag(selected.name) : "🌐";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 px-3.5 rounded-xl border border-blue-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-extrabold inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer backdrop-blur-md"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{selectedFlag}</span>
        <span className="max-w-[160px] truncate">
          {selected ? `${selected.name} (${selected.currency_code})` : t(lang, "common.country", "Country")}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 z-50 p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 mb-1">
            {t(lang, "common.all_countries", "All Countries")} ({countries.length})
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {countries.map((c) => {
              const isCurrent = c.id === currentCountryId;
              const flag = getCountryFlag(c.name);
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/country?countryId=${c.id}&tab=${currentTab}` as Route}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">{flag}</span>
                    <span className="truncate">{c.name}</span>
                    <span className={`text-[11px] font-mono px-1 rounded ${isCurrent ? "bg-blue-700/60 text-blue-100" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                      {c.currency_code}
                    </span>
                  </div>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-2" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
