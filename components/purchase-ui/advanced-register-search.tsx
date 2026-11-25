"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Filter, MapPin, RotateCcw, Search, Truck, X } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";

export type RegisterSearchField = {
  key: string;
  label: string;
  type?: "text" | "date" | "select";
  options?: { value: string; label: string }[];
  optionsFor?: (draft: Record<string, string>) => { value: string; label: string }[];
  clearOnChange?: readonly string[];
  group?: "origin" | "destination" | "dates";
  wide?: boolean;
  placeholder?: string;
};

export function AdvancedRegisterSearch({ open, onClose, onApply, value, fields, lang }: {
  open: boolean;
  onClose: () => void;
  onApply: (next: Record<string, string>) => void;
  value: Record<string, string>;
  fields: RegisterSearchField[];
  lang: string;
}) {
  const tr = (label: string) => translateHeader(lang, label);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); /* Reset only when opening; callers may rebuild value on render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  function renderField(field: RegisterSearchField) {
    const props = {
      name: field.key,
      value: draft[field.key] ?? "",
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const next = event.currentTarget.value;
        setDraft(prev => ({ ...prev, ...Object.fromEntries((field.clearOnChange ?? []).map(key => [key, ""])), [field.key]: next }));
      },
      className: "min-w-0 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
    };
    return <label key={field.key} className={cn("min-w-0 space-y-1 text-xs font-semibold", field.wide && "col-span-2")}>
      <span>{field.label}</span>
      {field.type === "select" ? <select {...props}>
        <option value="">{field.placeholder ?? tr("All")}</option>
        {(field.optionsFor ? field.optionsFor(draft) : field.options)?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : <input {...props} type={field.type ?? "text"} placeholder={field.placeholder} />}
    </label>;
  }
  const groups = [
    ["origin", "Loading (Origin)", Truck, "bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-200"],
    ["destination", "Received (Destination)", MapPin, "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200"],
    ["dates", "Dates", CalendarDays, "bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-200"],
  ] as const;

  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/30" />
      <Dialog.Content dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-blue-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <header className="flex min-h-11 items-center justify-between bg-gradient-to-r from-blue-950 to-blue-700 px-4 text-white">
          <Dialog.Title className="flex items-center gap-2 text-sm font-bold"><Filter className="size-4" aria-hidden="true" />{tr("Advanced Search & Filter")}</Dialog.Title>
          <Dialog.Close type="button" aria-label={tr("Close")} className="rounded p-1.5 hover:bg-white/15"><X className="size-5" aria-hidden="true" /></Dialog.Close>
        </header>
        <Dialog.Description className="sr-only">{tr("Search")}</Dialog.Description>
        <form onSubmit={event => {
          event.preventDefault();
          onApply(Object.fromEntries(fields.flatMap(({ key }) => draft[key]?.trim() ? [[key, draft[key].trim()]] : [])));
          onClose();
        }}>
          <div className="max-h-[min(70dvh,37rem)] overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">{fields.filter(field => !field.group).map(renderField)}</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {groups.map(([key, label, Icon, classes]) => {
                const members = fields.filter(field => field.group === key);
                if (!members.length) return null;
                return <fieldset key={key} className={cn("min-w-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700", key === "dates" && "sm:col-span-2")} aria-label={tr(label)}>
                  <div className={cn("flex items-center gap-2 px-2 py-1 text-xs font-bold", classes)}><Icon className="size-4" aria-hidden="true" />{tr(label)}</div>
                  <div className={cn("grid grid-cols-2 gap-2 p-2", key === "dates" && "sm:grid-cols-4")}>{members.map(renderField)}</div>
                </fieldset>;
              })}
            </div>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-700 sm:px-4">
            <button type="button" onClick={() => setDraft({})} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700"><RotateCcw className="size-3.5" aria-hidden="true" />{tr("Reset")}</button>
            <div className="flex items-center gap-2">
              <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white"><Search className="size-4" aria-hidden="true" />{tr("Search")}</button>
              <Dialog.Close type="button" className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700">{tr("Close")}<X className="size-3.5" aria-hidden="true" /></Dialog.Close>
            </div>
          </footer>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
