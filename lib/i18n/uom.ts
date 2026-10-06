import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Unit-of-measure display localiser. UOM words ("Bags", "Cartons", "KG", "Ton" …)
 * are UI chrome, not business data — they must follow the active language like any
 * other label. The stored value stays canonical (English) on the record; this only
 * changes what the user SEES.
 *
 * Unknown / custom units (e.g. a company-specific pack name the user typed) are
 * returned unchanged — those are genuine user data.
 *
 * Keys live in lib/i18n/ui.ts under `uom.*` (all five languages).
 */
const ALIASES: Record<string, string> = {
  bags: "bags", bag: "bag", "bag(s)": "bags",
  cartons: "cartons", carton: "carton", ctn: "carton", ctns: "cartons",
  loose: "loose", "loose qty": "loose",
  kg: "kg", kgs: "kgs", "k.g": "kg", "k.g.": "kg", kilogram: "kilogram", kilograms: "kilogram", kilo: "kg", kilos: "kg",
  ton: "ton", tons: "tons", tonne: "ton", tonnes: "tons",
  mt: "mt", "m.ton": "mt", "metric ton": "metric_ton", "metric tons": "mt", "metric tonne": "mt",
  pcs: "pcs", pc: "piece", piece: "piece", pieces: "pieces", "pc(s)": "pcs", nos: "pcs", no: "pcs",
  dozen: "dozen", dz: "dozen", doz: "dozen",
  box: "box", boxes: "boxes", "box / carton": "box",
  pallet: "pallet", pallets: "pallet", plt: "pallet",
  bale: "bale", bales: "bales",
  bundle: "bundle", bundles: "bundle", bdl: "bundle",
  quintal: "quintal", qtl: "quintal",
  unit: "unit", units: "units", unt: "unit",
  sack: "sack", sacks: "sack",
  drum: "drum", drums: "drum",
  roll: "roll", rolls: "roll",
  liter: "liter", litre: "liter", liters: "liter", litres: "liter", ltr: "liter", l: "liter",
  gram: "gram", grams: "gram", gm: "gram", gms: "gram", g: "gram",
  meter: "meter", metre: "meter", meters: "meter", metres: "meter", mtr: "meter", m: "meter",
  container: "container", containers: "container", cntr: "container",
};

export function localizeUom(lang: SupportedLanguage | string, value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return raw;
  const key = ALIASES[raw.toLowerCase()];
  if (!key) return raw; // custom / unknown unit → user data, leave as-is
  return t(lang as SupportedLanguage, `uom.${key}` as never, raw);
}

/** Convenience for select-option lists: keeps the canonical value, localises the label. */
export function uomOption(lang: SupportedLanguage | string, value: string): { label: string; value: string } {
  return { label: localizeUom(lang, value), value };
}
