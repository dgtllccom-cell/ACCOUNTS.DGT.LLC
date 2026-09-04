/**
 * Shared date helpers for the Universal ERP Date / Date-Range Picker and every
 * screen that consumes it. All dates move around as `YYYY-MM-DD` strings (ISO
 * calendar date, no time, no zone) so a selected range means the same thing on
 * the client, the API query, the report totals and the Print / PDF / Excel
 * output.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type IsoDate = string; // "YYYY-MM-DD"
export type DateRangeValue = { from: IsoDate | null; to: IsoDate | null };

const RTL: readonly string[] = ["ur", "ar", "fa", "ps"];
export const isRtlLang = (l?: string | null) => !!l && RTL.includes(l);

/** Local `YYYY-MM-DD` for a Date (never toISOString — that shifts across midnight in +offsets). */
export function toIso(d: Date): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` to a local Date at 00:00. Returns null for anything invalid. */
export function fromIso(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

export function todayIso(): IsoDate {
  return toIso(new Date());
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = fromIso(iso) ?? new Date();
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Week starts on Sunday (matches the calendar grid + most ERP reporting). */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function cmp(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function clampIso(iso: IsoDate, min?: IsoDate | null, max?: IsoDate | null): IsoDate {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export function isBetween(iso: IsoDate, from: IsoDate | null, to: IsoDate | null): boolean {
  if (!from || !to) return false;
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return iso >= lo && iso <= hi;
}

// ── locale-aware formatting (always Gregorian + Latin digits) ────────────────

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(lang: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = lang + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    // `-u-ca-gregory-nu-latn` forces the Gregorian calendar + Latin digits even
    // for fa / ps whose default locale calendar is Persian/solar.
    f = new Intl.DateTimeFormat(`${lang || "en"}-u-ca-gregory-nu-latn`, {
      calendar: "gregory",
      numberingSystem: "latn",
      ...opts,
    });
    fmtCache.set(key, f);
  }
  return f;
}

/**
 * "01 Sep 2026" — day, short month, year — assembled in a fixed order so every
 * ERP screen, report header and PDF reads the same regardless of the locale's
 * own date ordering. Gregorian calendar, Latin digits, month name localised.
 */
export function formatErpDate(iso: string | null | undefined, lang: SupportedLanguage | string = "en"): string {
  const d = fromIso(iso ?? null);
  if (!d) return "";
  const parts = fmt(lang, { day: "2-digit", month: "short", year: "numeric" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`.trim();
}

/** "01 Sep 2026 – 17 Sep 2026" (or a single date, or ""). */
export function formatErpRange(
  value: DateRangeValue,
  lang: SupportedLanguage | string = "en",
): string {
  const from = formatErpDate(value.from, lang);
  const to = formatErpDate(value.to, lang);
  if (from && to) return from === to ? from : `${from} – ${to}`;
  return from || to || "";
}

export function monthLabel(d: Date, lang: SupportedLanguage | string = "en"): string {
  return fmt(lang, { month: "long", year: "numeric" }).format(d);
}

/** Sun..Sat short names in the language (index 0 = Sunday). */
export function weekdayShortNames(lang: SupportedLanguage | string = "en"): string[] {
  const f = fmt(lang, { weekday: "short" });
  // 2023-01-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + i)));
}

// ── quick-range presets ─────────────────────────────────────────────────────

export type PresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "all_time";

export const DEFAULT_PRESETS: PresetKey[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "this_month",
  "last_month",
  "this_year",
];

/** Resolve a preset to a concrete { from, to } (both null for all_time). */
export function resolvePreset(key: PresetKey, ref: Date = new Date()): DateRangeValue {
  const t = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  switch (key) {
    case "today":
      return { from: toIso(t), to: toIso(t) };
    case "yesterday": {
      const y = new Date(t);
      y.setDate(y.getDate() - 1);
      return { from: toIso(y), to: toIso(y) };
    }
    case "last_7_days": {
      const s = new Date(t);
      s.setDate(s.getDate() - 6);
      return { from: toIso(s), to: toIso(t) };
    }
    case "last_30_days": {
      const s = new Date(t);
      s.setDate(s.getDate() - 29);
      return { from: toIso(s), to: toIso(t) };
    }
    case "this_week": {
      const s = startOfWeek(t);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return { from: toIso(s), to: toIso(e) };
    }
    case "last_week": {
      const s = startOfWeek(t);
      s.setDate(s.getDate() - 7);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return { from: toIso(s), to: toIso(e) };
    }
    case "this_month":
      return { from: toIso(startOfMonth(t)), to: toIso(endOfMonth(t)) };
    case "last_month": {
      const s = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      return { from: toIso(s), to: toIso(endOfMonth(s)) };
    }
    case "this_quarter": {
      const q = Math.floor(t.getMonth() / 3);
      const s = new Date(t.getFullYear(), q * 3, 1);
      const e = new Date(t.getFullYear(), q * 3 + 3, 0);
      return { from: toIso(s), to: toIso(e) };
    }
    case "this_year":
      return { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` };
    case "last_year":
      return { from: `${t.getFullYear() - 1}-01-01`, to: `${t.getFullYear() - 1}-12-31` };
    case "all_time":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

/** Which preset (if any) exactly matches the given range — for highlighting. */
export function matchPreset(value: DateRangeValue, presets: PresetKey[], ref: Date = new Date()): PresetKey | null {
  for (const k of presets) {
    const r = resolvePreset(k, ref);
    if (r.from === value.from && r.to === value.to) return k;
  }
  return null;
}

/** 6-row month grid (42 cells) of ISO dates, starting on the Sunday on/before the 1st. */
export function monthGrid(view: Date): IsoDate[] {
  const first = startOfMonth(view);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toIso(d);
  });
}
