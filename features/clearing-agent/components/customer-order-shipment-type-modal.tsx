"use client";

import React from "react";
import { Ship, Plane, Truck, Train, X, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  currentMode: string;
  onSelect: (mode: "by_sea" | "by_air" | "by_road" | "by_rail", packageType?: string) => void;
}

export function CustomerOrderShipmentTypeModal({
  open,
  onClose,
  lang,
  currentMode,
  onSelect
}: Props) {
  if (!open) return null;

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const options = [
    {
      mode: "by_sea" as const,
      title: tt("mode_sea", "By Sea"),
      icon: Ship,
      bgColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      activeBorder: "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 dark:bg-blue-950/30",
      bullets: [
        tt("bullet_fcl", "FCL (Full Container)"),
        tt("bullet_lcl", "LCL (Less Container)"),
        tt("bullet_breakbulk", "Break Bulk"),
        tt("bullet_roro", "Ro-Ro")
      ]
    },
    {
      mode: "by_air" as const,
      title: tt("mode_air", "By Air"),
      icon: Plane,
      bgColor: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
      activeBorder: "border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20 dark:bg-sky-950/30",
      bullets: [
        tt("bullet_general_cargo", "General Cargo"),
        tt("bullet_courier", "Courier"),
        tt("bullet_charter", "Charter"),
        tt("bullet_consolidation", "Consolidation")
      ]
    },
    {
      mode: "by_road" as const,
      title: tt("mode_road", "By Road"),
      icon: Truck,
      bgColor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      activeBorder: "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 dark:bg-amber-950/30",
      bullets: [
        tt("bullet_truck_transport", "Truck Transport"),
        tt("bullet_cross_border", "Cross Border"),
        tt("bullet_inland_truck", "Inland Truck"),
        tt("bullet_ftl_ltl", "FTL / LTL")
      ]
    },
    {
      mode: "by_rail" as const,
      title: tt("mode_train", "By Train"),
      icon: Train,
      bgColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
      activeBorder: "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 dark:bg-indigo-950/30",
      bullets: [
        tt("bullet_rail_transport", "Rail Transport"),
        tt("bullet_block_train", "Block Train"),
        tt("bullet_container_train", "Container Train"),
        tt("bullet_intermodal", "Intermodal")
      ]
    }
  ];

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
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Ship className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("modal_select_shipment_type", "Select Shipment Type")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("modal_shipment_type_desc", "Select primary transportation mode and packaging for this customer order.")}
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

        {/* 4 Cards Grid matching reference-03.jpeg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => {
                  onSelect(opt.mode);
                  onClose();
                }}
                className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? opt.activeBorder
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-blue-600"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${opt.bgColor} group-hover:scale-105 transition`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {opt.title}
                  </h4>

                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    {opt.bullets.map((b, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="truncate">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  <span>{tt("select", "Select")}</span>
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
