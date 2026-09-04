"use client";

import { useState } from "react";
import { ErpDatePicker, type DateRangeValue } from "@/components/ui/erp-date-picker";

// Temporary design preview — /ui-preview/date-picker
// Standalone check of the Universal ERP Date / Date-Range Picker in all modes.
export default function DatePickerPreviewPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: "2026-09-01", to: "2026-09-17" });
  const [single, setSingle] = useState<string | null>("2026-09-04");
  const [lang, setLang] = useState("en");

  return (
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Universal Date Picker — Preview</h1>
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              try {
                localStorage.setItem("erp_lang", e.target.value);
                document.cookie = `erp_lang=${e.target.value};path=/;max-age=99999999`;
              } catch {}
              location.reload();
            }}
            className="ml-auto rounded border px-2 py-1 text-sm"
          >
            {["en", "ur", "ps", "fa", "ar"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Range (dual month + presets)</h2>
          <div className="max-w-sm">
            <ErpDatePicker mode="range" value={range} onApply={setRange} label="Date Range" />
          </div>
          <pre className="text-xs text-slate-500">{JSON.stringify(range)}</pre>
        </section>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Single date</h2>
          <div className="max-w-xs">
            <ErpDatePicker
              mode="single"
              value={{ from: single }}
              onApply={(v) => setSingle(v.from)}
              label="As of Date"
              applyLabel="update"
            />
          </div>
          <pre className="text-xs text-slate-500">{JSON.stringify({ single })}</pre>
        </section>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Range, no presets, min/max bounded</h2>
          <div className="max-w-sm">
            <ErpDatePicker
              mode="range"
              value={range}
              onApply={setRange}
              presets={false}
              min="2026-09-05"
              max="2026-09-25"
              months={1}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
