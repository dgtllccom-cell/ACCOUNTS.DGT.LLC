"use client";

import React from "react";
import { MapPin, ArrowRightLeft, RotateCw, X, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  currentType: string;
  onSelect: (type: "direct" | "transit" | "re_export", label?: string) => void;
}

export function CustomerOrderOperationTypeModal({
  open,
  onClose,
  lang,
  currentType,
  onSelect
}: Props) {
  if (!open) return null;

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  const options = [
    {
      id: "direct" as const,
      title: tt("op_direct_import", "Direct Import (Local)"),
      desc: tt("op_direct_desc", "Direct domestic clearance and delivery to warehouse/customer."),
      icon: MapPin,
      bgColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      activeBorder: "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 dark:bg-blue-950/30",
      bullets: [
        tt("bullet_direct_clearance", "Direct clearance"),
        tt("bullet_local_warehouse", "To local warehouse"),
        tt("bullet_customer_delivery", "Customer delivery")
      ]
    },
    {
      id: "transit" as const,
      title: tt("op_transit", "Transit"),
      desc: tt("op_transit_desc", "Transit movement through national corridor to third-country."),
      icon: ArrowRightLeft,
      bgColor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      activeBorder: "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 dark:bg-amber-950/30",
      bullets: [
        tt("bullet_transit_corridor", "Transit via corridor"),
        tt("bullet_multi_country", "Multi-country route"),
        tt("bullet_non_local", "Non local delivery")
      ]
    },
    {
      id: "re_export" as const,
      title: tt("op_re_export", "Re-Export"),
      desc: tt("op_re_export_desc", "Cargo imported into customs bond and re-exported outward."),
      icon: RotateCw,
      bgColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      activeBorder: "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 dark:bg-emerald-950/30",
      bullets: [
        tt("bullet_imported_reexport", "Imported & re-export"),
        tt("bullet_bonded_warehouse", "Bonded warehouse"),
        tt("bullet_special_procedure", "Special procedure")
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
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {tt("modal_select_operation_type", "Select Operation Type")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tt("modal_operation_type_desc", "Specify the customs procedure and shipment disposition.")}
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

        {/* 3 Choice Cards Grid matching reference-03.jpeg */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentType === opt.id || currentType?.toLowerCase()?.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id, opt.title);
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
