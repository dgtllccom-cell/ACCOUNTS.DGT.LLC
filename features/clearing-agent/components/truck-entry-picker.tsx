"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Truck, Search, CheckCircle2, X, ExternalLink } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export type TruckEntryValue = {
  truck_registration_type: "registered" | "temporary";
  truck_id: string;
  truck_number: string;
  truck_driver_name: string;
  truck_driver_mobile: string;
  truck_owner_name: string;
  truck_transport_company: string;
};

type TruckOption = {
  id: string;
  truck_number: string;
  registration_number?: string | null;
  truck_type?: string | null;
  capacity?: string | null;
  owner_name?: string | null;
  owner_mobile?: string | null;
  transport_company?: string | null;
  driver_name?: string | null;
  driver_mobile?: string | null;
  driver_cnic_passport?: string | null;
  registration_expiry_date?: string | null;
  insurance_expiry_date?: string | null;
  status?: string | null;
};

export function TruckEntryPicker({
  value, onChange, langProp, disabled,
}: {
  value: TruckEntryValue;
  onChange: (next: TruckEntryValue) => void;
  langProp?: string;
  disabled?: boolean;
}) {
  const s = useErpScreen("com", langProp);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TruckOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TruckOption | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mode = value.truck_registration_type;
  const setMode = (m: "registered" | "temporary") => {
    if (m === "temporary") {
      onChange({ ...value, truck_registration_type: "temporary", truck_id: "" });
      setSelected(null);
    } else {
      onChange({ ...value, truck_registration_type: "registered" });
    }
  };

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const r = await fetch(`/api/erp/master-data/trucks?selectable=true&limit=25&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setResults(Array.isArray(j.trucks) ? j.trucks : []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (mode !== "registered" || !open) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => void runSearch(query.trim()), 220);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query, open, mode, runSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Rehydrate the read-only card if editing an order that already has a registered truck
  useEffect(() => {
    if (mode === "registered" && value.truck_id && !selected) {
      void fetch(`/api/erp/master-data/trucks?limit=1&q=${encodeURIComponent(value.truck_number || "")}`)
        .then((r) => r.json())
        .then((j) => {
          const hit = (j.trucks || []).find((t: TruckOption) => t.id === value.truck_id);
          if (hit) setSelected(hit);
        })
        .catch(() => {});
    }
  }, [mode, value.truck_id, value.truck_number, selected]);

  const pick = (t: TruckOption) => {
    setSelected(t);
    setOpen(false);
    setQuery("");
    onChange({
      truck_registration_type: "registered",
      truck_id: t.id,
      truck_number: t.truck_number || "",
      truck_driver_name: t.driver_name || "",
      truck_driver_mobile: t.driver_mobile || "",
      truck_owner_name: t.owner_name || "",
      truck_transport_company: t.transport_company || "",
    });
  };

  const clearSelection = () => {
    setSelected(null);
    onChange({ ...value, truck_id: "", truck_number: "", truck_driver_name: "", truck_driver_mobile: "", truck_owner_name: "", truck_transport_company: "" });
  };

  const fld = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60";

  return (
    <div dir={s.dir} className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3 dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
        <Truck className="h-4 w-4" />
        <span>{s.t("truck_entry_title", "Truck Entry (By Road)")}</span>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
        {(["registered", "temporary"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 transition-colors ${mode === m ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            {m === "registered"
              ? s.t("truck_registered", "Permanent / Registered Truck")
              : s.t("truck_temporary", "Temporary Truck")}
          </button>
        ))}
      </div>

      {mode === "registered" ? (
        <div className="space-y-2">
          {!selected ? (
            <div ref={boxRef} className="relative">
              <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {s.t("truck_search_label", "Search & select the registered truck number")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  disabled={disabled}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  placeholder={s.t("truck_search_ph", "Type truck number, driver, owner or company…")}
                  className={`${fld} ps-8`}
                  autoComplete="off"
                />
              </div>
              {open && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {searching ? (
                    <div className="px-3 py-3 text-xs text-slate-400">{s.t("loading", "Loading…")}</div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-400">
                      {query.trim() ? s.t("truck_no_match", "No registered truck matches.") : s.t("truck_type_to_search", "Start typing to search the central truck registry.")}
                    </div>
                  ) : results.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pick(t)}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-start last:border-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <span className="text-xs font-black text-slate-900 dark:text-slate-50">{t.truck_number}</span>
                      <span className="text-[10px] text-slate-500">
                        {[t.driver_name, t.owner_name || t.transport_company, t.truck_type].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <a
                href="/dashboard/clearing-agent/truck-registration"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {s.t("truck_register_new", "Register a new truck")}
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {selected.truck_number}
                </span>
                <button type="button" disabled={disabled} onClick={clearSelection} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div><dt className="inline text-slate-500">{s.t("truck_driver", "Driver")}: </dt><dd className="inline font-bold">{selected.driver_name || "—"}</dd></div>
                <div><dt className="inline text-slate-500">{s.t("truck_driver_mobile", "Driver Mobile")}: </dt><dd className="inline font-bold">{selected.driver_mobile || "—"}</dd></div>
                <div><dt className="inline text-slate-500">{s.t("truck_owner", "Owner / Company")}: </dt><dd className="inline font-bold">{selected.owner_name || selected.transport_company || "—"}</dd></div>
                <div><dt className="inline text-slate-500">{s.t("truck_type", "Type / Capacity")}: </dt><dd className="inline font-bold">{[selected.truck_type, selected.capacity].filter(Boolean).join(" · ") || "—"}</dd></div>
                {selected.registration_number ? <div><dt className="inline text-slate-500">{s.t("truck_reg_no", "Registration No")}: </dt><dd className="inline font-bold">{selected.registration_number}</dd></div> : null}
              </dl>
              <p className="mt-1.5 text-[10px] text-slate-500">{s.t("truck_autofill_note", "Details are loaded from the central registry and saved with this order.")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("truck_number", "Truck Number")} *</label>
            <input disabled={disabled} value={value.truck_number} onChange={(e) => onChange({ ...value, truck_number: e.target.value })} placeholder="e.g. TKM-4821" className={fld} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("truck_driver", "Driver Name")}</label>
            <input disabled={disabled} value={value.truck_driver_name} onChange={(e) => onChange({ ...value, truck_driver_name: e.target.value })} className={fld} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("truck_driver_mobile", "Mobile Number")}</label>
            <input disabled={disabled} value={value.truck_driver_mobile} onChange={(e) => onChange({ ...value, truck_driver_mobile: e.target.value })} className={fld} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{s.t("truck_owner", "Owner / Transport Company")}</label>
            <input disabled={disabled} value={value.truck_owner_name} onChange={(e) => onChange({ ...value, truck_owner_name: e.target.value })} className={fld} />
          </div>
          <p className="sm:col-span-2 text-[10px] text-slate-500">{s.t("truck_temp_note", "Temporary trucks are saved with this order only and are not added to the central registry.")}</p>
        </div>
      )}
    </div>
  );
}
