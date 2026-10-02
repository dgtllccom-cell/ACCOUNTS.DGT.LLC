"use client";

import React, { useEffect, useRef, useState } from "react";
import { Truck, X } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import {
  temporaryTruckProblems,
  type TemporaryTruckField
} from "@/lib/services/clearing-customer-order-workflow-rules";

export type TemporaryTruckValues = { truckNumber: string; driverName: string; driverMobile: string };

type Props = {
  open: boolean;
  lang: string;
  initial: TemporaryTruckValues;
  onConfirm: (values: TemporaryTruckValues) => void;
  onCancel: () => void;
};

/**
 * Compact modal for a Temporary / One-Trip truck. Exactly THREE mandatory fields — truck / vehicle
 * number, driver name, driver mobile (international, with country code). It never creates a Fleet
 * Master record; the confirmed values are stored on the order and on the Road leg only.
 */
export function CustomerOrderTempTruckModal({ open, lang, initial, onConfirm, onCancel }: Props) {
  const tt = (k: string, fb: string) => t(lang as never, ("com." + k) as never, fb);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [values, setValues] = useState<TemporaryTruckValues>(initial);
  const [problems, setProblems] = useState<TemporaryTruckField[]>([]);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setProblems([]);
      setTimeout(() => firstRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const found = temporaryTruckProblems({ truckNumber: values.truckNumber, driverName: values.driverName, driverMobile: values.driverMobile });
    setProblems(found);
    if (found.length) return;
    onConfirm({ truckNumber: values.truckNumber.trim(), driverName: values.driverName.trim(), driverMobile: values.driverMobile.trim() });
  };

  const err = (f: TemporaryTruckField[]) => f.find((x) => problems.includes(x));
  const input = (bad: boolean) =>
    `w-full rounded-lg border px-2.5 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/40 ${
      bad ? "border-rose-400 dark:border-rose-700" : "border-slate-300 dark:border-slate-700"
    }`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/50 p-3"
      role="dialog"
      aria-modal="true"
      dir={isRtl ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Truck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">{tt("tt_modal_title", "Temporary / One-Trip Truck")}</h3>
              <p className="text-[11px] text-slate-500">{tt("tt_modal_desc", "All three details are required. This truck is not added to the Fleet Master.")}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={tt("cancel", "Cancel")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{tt("tt_field_number", "Truck / Vehicle Number")} *</label>
            <input
              ref={firstRef}
              type="text"
              dir="ltr"
              value={values.truckNumber}
              onChange={(e) => setValues((v) => ({ ...v, truckNumber: e.target.value }))}
              placeholder={tt("ph_truck_reg", "e.g. TL-9988-KHI")}
              className={input(!!err(["truck_number"]))}
              aria-invalid={!!err(["truck_number"])}
            />
            {err(["truck_number"]) && <p className="mt-1 text-[11px] font-semibold text-rose-600">{tt("tt_err_number", "Truck / Vehicle Number is required.")}</p>}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{tt("tt_field_driver", "Driver Name")} *</label>
            <input
              type="text"
              value={values.driverName}
              onChange={(e) => setValues((v) => ({ ...v, driverName: e.target.value }))}
              placeholder={tt("driver_full_name_ph", "Driver full name")}
              className={input(!!err(["driver_name"]))}
              aria-invalid={!!err(["driver_name"])}
            />
            {err(["driver_name"]) && <p className="mt-1 text-[11px] font-semibold text-rose-600">{tt("tt_err_driver", "Driver Name is required.")}</p>}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{tt("tt_field_mobile", "Driver Mobile Number")} *</label>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              value={values.driverMobile}
              onChange={(e) => setValues((v) => ({ ...v, driverMobile: e.target.value }))}
              placeholder="+92 300 1234567"
              className={input(!!err(["driver_mobile", "driver_mobile_invalid"]))}
              aria-invalid={!!err(["driver_mobile", "driver_mobile_invalid"])}
            />
            {err(["driver_mobile"]) && <p className="mt-1 text-[11px] font-semibold text-rose-600">{tt("tt_err_mobile", "Driver Mobile Number is required.")}</p>}
            {err(["driver_mobile_invalid"]) && !err(["driver_mobile"]) && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">{tt("tt_err_mobile_invalid", "Enter a valid mobile number with country code, e.g. +92 300 1234567.")}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {tt("cancel", "Cancel")}
          </button>
          <button type="button" onClick={submit} className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm">
            {tt("tt_save_confirm", "Save / Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
