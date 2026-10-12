"use client";

import React from "react";
import { Ship, ArrowUpRight, X, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  currentValue: string;
  onSelect: (value: "import" | "export") => void;
}

export function CustomerOrderMovementModal({
  open,
  onClose,
  lang,
  currentValue,
  onSelect
}: Props) {
  if (!open) return null;

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Ship className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("modal_select_movement", "Select Import / Export Type")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("modal_movement_desc", "Choose whether cargo is arriving into or departing the destination territory.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            aria-label={tt("close", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2 Big Choice Cards matching reference-03.jpeg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Import */}
          <button
            type="button"
            onClick={() => {
              onSelect("import");
              onClose();
            }}
            className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition ${
              currentValue === "import"
                ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30"
                : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-emerald-600"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 group-hover:scale-105 transition">
                  <Ship className="h-6 w-6" />
                </div>
                {currentValue === "import" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {tt("mov_import", "Import")}
              </h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {tt("import_subtext", "Goods coming into country")}
              </p>

              <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{tt("imp_seaport", "Seaport Import")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{tt("imp_airport", "Airport Import")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{tt("imp_land", "Land Import")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{tt("imp_transit", "Transit Import")}</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span>{tt("select_import", "Select Import")}</span>
              <span>→</span>
            </div>
          </button>

          {/* Card 2: Export */}
          <button
            type="button"
            onClick={() => {
              onSelect("export");
              onClose();
            }}
            className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition ${
              currentValue === "export"
                ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 dark:border-purple-500 dark:bg-purple-950/30"
                : "border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/20 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-purple-600"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 group-hover:scale-105 transition">
                  <ArrowUpRight className="h-6 w-6" />
                </div>
                {currentValue === "export" && (
                  <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {tt("mov_export", "Export")}
              </h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {tt("export_subtext", "Goods going out from country")}
              </p>

              <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span>{tt("exp_seaport", "Seaport Export")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span>{tt("exp_airport", "Airport Export")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span>{tt("exp_land", "Land Export")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span>{tt("exp_transit", "Transit Export")}</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
              <span>{tt("select_export", "Select Export")}</span>
              <span>→</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
