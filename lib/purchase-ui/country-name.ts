/**
 * Display name of a country in the active language for the approved headers. Only the label changes — the stored value / filter key is
 * always the original country name or id. Unknown countries keep the name the ERP already provides (master-data localisation).
 */
const KEYS: ReadonlyArray<[RegExp, string]> = [
  [/^(united arab emirates|uae|u\.a\.e\.?)$/i, "unitedArabEmirates"],
  [/^pakistan$/i, "pakistan"],
  [/^afghanistan$/i, "afghanistan"],
  [/^iran(,? islamic republic of)?$/i, "iran"],
  [/^(china|people'?s republic of china)$/i, "china"],
  [/^india$/i, "india"],
];

export function countryLabel(name: string, t: (key: string, fallback: string) => string): string {
  const clean = String(name ?? "").trim();
  for (const [re, key] of KEYS) if (re.test(clean)) return t(key, clean);
  return clean;
}
