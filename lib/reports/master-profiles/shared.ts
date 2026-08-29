/**
 * Shared helpers for the Master Profile report builders.
 *
 * Each builder is a PURE function `(record, branding, lang) => MasterProfileConfig`
 * for the single reusable engine `buildMasterProfileReportHtml` /
 * `openMasterProfileReportWindow` (lib/reports/open-master-profile-report-window.ts).
 * Only real record data is emitted — empty rows/sections are dropped so a
 * Local / minimal record never renders half-empty cards.
 */

import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type {
  MProfileRow,
  MProfileSection,
  MProfileTable,
  MProfileMeta,
  MProfileKpi,
} from "@/lib/reports/open-master-profile-report-window";
import {
  type DocumentBranding,
  brandLinesFor,
} from "@/lib/reports/resolve-document-branding";

export type Lang = SupportedLanguage;

export function makeT(lang: Lang) {
  return (key: string, fallback: string) => t(lang, key as never, fallback);
}

export function isRtlLang(lang: Lang) {
  return ["ur", "ar", "fa", "ps"].includes(lang);
}

/** Push a label/value row only when the value is meaningfully present. */
export function pushRow(rows: MProfileRow[], label: string, value: unknown) {
  const s = value == null ? "" : String(value).trim();
  if (!s || /^(n\/?a|none|null|undefined|-+)$/i.test(s)) return;
  rows.push({ label, value: s });
}

/** Build a section only if it ends up with at least one row. */
export function section(
  title: string,
  build: (rows: MProfileRow[]) => void,
  opts: { fullWidth?: boolean; pageBreakBefore?: boolean } = {},
): MProfileSection | null {
  const rows: MProfileRow[] = [];
  build(rows);
  if (rows.length === 0) return null;
  return { title, rows, ...opts };
}

/** A full-width related list table — dropped when it has no rows. */
export function relatedTable(
  title: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>,
): MProfileTable | null {
  const clean = (rows || []).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  if (clean.length === 0) return null;
  return { title, columns, rows: clean };
}

export function compact<T>(arr: Array<T | null | undefined>): T[] {
  return arr.filter((x): x is T => x != null);
}

export function money(value: unknown, currency?: string) {
  const n = Number(value);
  const s = Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
  return currency ? `${s} ${currency}` : s;
}

export function fmtDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
}

/** Header banner meta cells — up to 4, only real values. */
export function metaCells(pairs: Array<[string, unknown]>): MProfileMeta[] {
  return pairs
    .map(([label, value]) => ({ label, value: value == null ? "" : String(value).trim() }))
    .filter((m) => m.value)
    .slice(0, 4);
}

/** KPI cards — engine expects 0 or 4. */
export function kpiCards(cards: MProfileKpi[]): MProfileKpi[] {
  return cards.length >= 4 ? cards.slice(0, 4) : [];
}

/** Branding fields shared by every builder's config. */
export function brandingConfig(b: DocumentBranding) {
  return {
    footerAccountName: b.entityName || undefined,
    brandEntityName: b.entityName || undefined,
    brandLines: brandLinesFor(b),
    logoUrl: b.logoUrl || undefined,
  } as const;
}
