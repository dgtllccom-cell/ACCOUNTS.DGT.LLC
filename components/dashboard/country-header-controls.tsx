"use client";

import React, { useState } from "react";
import { Calendar, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export function CountryHeaderControls() {
  const lang = useActiveLanguage();
  const [dateRange, setDateRange] = useState("All Dates (2026)");

  const handleOpenSettings = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-dashboard-settings"));
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Date Filter */}
      <div className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer select-none">
        <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>{dateRange}</span>
        <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
      </div>

      {/* Settings Button */}
      <button
        type="button"
        onClick={handleOpenSettings}
        className="h-9 px-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        title={t(lang, "common.settings", "Settings")}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>{t(lang, "common.settings", "Settings")}</span>
      </button>
    </div>
  );
}
