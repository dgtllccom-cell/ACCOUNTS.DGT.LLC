"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

// One control: the dashboard's own settings. (It used to be preceded by an "All Dates (2026)" box that was a plain <div> with fixed
// state — clicking it did nothing — and the button was labelled just "Settings", the same as the top bar's preferences button.)
export function CountryHeaderControls() {
  const lang = useActiveLanguage();

  const handleOpenSettings = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-dashboard-settings"));
    }
  };

  const label = t(lang, "dash.dashboard_settings", "Dashboard Settings");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleOpenSettings}
        className="h-9 px-3.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs transition-all cursor-pointer"
        title={label}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>{label}</span>
      </button>
    </div>
  );
}
