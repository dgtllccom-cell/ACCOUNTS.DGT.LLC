"use client";

/**
 * FiveLanguageReferenceCard — the canonical example of a five-language ERP screen.
 *
 * Copy this pattern for every new page / form / report / modal / table:
 *   1. one `useErpScreen(namespace, langProp?)` call — nothing else needed
 *   2. `s.t("key", "English fallback")` for every visible string (labels, options,
 *      headers, statuses, empty/loading/error states, notifications)
 *   3. `dir={s.dir}` on the root; `s.textStart` / `s.textEnd` for alignment
 *   4. NO local { en, ur, ar, fa, ps } object — keys live in lib/i18n/ui.ts only
 *
 * Switch the app language EN→UR→PS→FA→AR and the whole card (title, subtitle, field
 * label, every <option>, table headers, the status pill, the empty state, the note)
 * follows, with correct RTL. `scripts/i18n-ui-guard.mjs` enforces that the keys exist
 * in all five language blocks.
 */

import { useMemo, useState } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Row = { code: string; name: string; branch: "main" | "city" };

const SAMPLE_ROWS: Row[] = [
  { code: "BR-001", name: "KARACHI MAIN", branch: "main" },
  { code: "BR-014", name: "QUETTA CITY", branch: "city" },
  { code: "BR-021", name: "CHAMAN CITY", branch: "city" },
];

export function FiveLanguageReferenceCard({ lang }: { lang?: string }) {
  const s = useErpScreen("i18nref", lang);
  const [filter, setFilter] = useState<"all" | "main" | "city">("all");

  const rows = useMemo(
    () => (filter === "all" ? SAMPLE_ROWS : SAMPLE_ROWS.filter((r) => r.branch === filter)),
    [filter],
  );

  return (
    <section
      dir={s.dir}
      className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <h2 className="text-base font-black">{s.t("title", "Five-Language Reference Screen")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {s.t("subtitle", "Every label, option, header, state and message renders through the central dictionary.")}
      </p>

      <label className="mt-4 block max-w-xs">
        <span className={`mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${s.textStart}`}>
          {s.t("field_label", "Branch")}
        </span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
        >
          <option value="all">{s.t("opt_all", "All Branches")}</option>
          <option value="main">{s.t("opt_main", "Main Branch")}</option>
          <option value="city">{s.t("opt_city", "City Branch")}</option>
        </select>
      </label>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className={`py-1.5 ${s.textStart}`}>{s.t("col_code", "Code")}</th>
            <th className={`py-1.5 ${s.textStart}`}>{s.t("col_name", "Name")}</th>
            <th className={`py-1.5 ${s.textEnd}`}>{s.t("col_status", "Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted-foreground">
                {s.t("empty", "No records match the selected branch.")}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.code} className="border-b border-border/50">
                {/* Business data (codes, names) is NOT translated. */}
                <td className={`py-1.5 font-mono ${s.textStart}`}>{r.code}</td>
                <td className={`py-1.5 ${s.textStart}`}>{r.name}</td>
                <td className={`py-1.5 ${s.textEnd}`}>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {s.t("status_active", "Active")}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {s.t("note_rtl", "Direction, alignment and font follow the active language automatically.")}
      </p>
    </section>
  );
}
