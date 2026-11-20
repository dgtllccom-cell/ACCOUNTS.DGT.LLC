/**
 * The tax word and the tax-registration word a document prints for a country — "VAT" / "TRN" in the UAE,
 * "Sales Tax" / "NTN / STRN" in Pakistan, "GST" / "GSTIN" in India, and so on.
 *
 * Words only: a tax RATE is never decided here. Rates come from what the bill saved on its lines (and the country's
 * tax master, Settings → Tax Rate Management / `country_tax_settings`). When that master names the country's tax
 * (or a Local Purchase bill carries its own tax type), that name wins over the default word.
 */

export type CountryTaxTerms = {
  /** e.g. "VAT", "Sales Tax", "GST" */
  taxLabel: string;
  /** e.g. "TRN", "NTN / STRN", "GSTIN" */
  taxIdLabel: string;
};

type Rule = { iso2: string[]; names: string[]; terms: CountryTaxTerms };

const RULES: Rule[] = [
  { iso2: ["AE"], names: ["united arab emirates", "uae", "emirates", "امارات", "الإمارات"], terms: { taxLabel: "VAT", taxIdLabel: "TRN" } },
  { iso2: ["SA"], names: ["saudi", "سعود"], terms: { taxLabel: "VAT", taxIdLabel: "VAT No" } },
  { iso2: ["OM"], names: ["oman", "عمان"], terms: { taxLabel: "VAT", taxIdLabel: "VATIN" } },
  { iso2: ["PK"], names: ["pakistan", "پاکستان", "باكستان"], terms: { taxLabel: "Sales Tax", taxIdLabel: "NTN / STRN" } },
  { iso2: ["IN"], names: ["india", "بھارت", "انڈیا", "الهند", "هند"], terms: { taxLabel: "GST", taxIdLabel: "GSTIN" } },
  { iso2: ["IR"], names: ["iran", "ایران", "إيران"], terms: { taxLabel: "VAT", taxIdLabel: "Economic Code" } },
  { iso2: ["AF"], names: ["afghan", "afghistan", "افغانستان", "أفغانستان"], terms: { taxLabel: "BRT", taxIdLabel: "TIN" } },
  { iso2: ["CN"], names: ["china", "chian", "چین", "الصين"], terms: { taxLabel: "VAT", taxIdLabel: "Tax ID" } },
  { iso2: ["TR"], names: ["turkiye", "turkey", "ترکی", "تركيا"], terms: { taxLabel: "KDV", taxIdLabel: "VKN" } },
  { iso2: ["KZ", "UZ", "TJ", "TM", "RU"], names: ["kazakhstan", "uzbekistan", "tajikistan", "turkmenistan", "russia"], terms: { taxLabel: "VAT", taxIdLabel: "TIN" } },
];

const GENERIC: CountryTaxTerms = { taxLabel: "Tax", taxIdLabel: "Tax ID" };

const clean = (v: unknown) => String(v ?? "").trim();

export function countryTaxTerms(input: {
  iso2?: string | null;
  countryName?: string | null;
  /** the configured tax name (country tax master default, or the bill's own tax type) */
  configuredTaxName?: string | null;
}): CountryTaxTerms {
  const iso = clean(input.iso2).toUpperCase();
  const name = clean(input.countryName).toLowerCase();
  const rule =
    (iso && RULES.find((r) => r.iso2.includes(iso))) ||
    (name && RULES.find((r) => r.names.some((n) => name.includes(n.toLowerCase())))) ||
    null;
  const base = rule ? rule.terms : GENERIC;
  const configured = clean(input.configuredTaxName);
  // A bare lower-case code such as "st" (the legacy Pakistan entry) does not read as a tax name on an invoice, so the
  // country's standard word is kept; a real name ("Sales Tax", "GST", "VAT") is used as configured.
  const isBareCode = configured.length <= 3 && configured === configured.toLowerCase();
  const usable = configured.length >= 2 && !isBareCode && !/^(n\/?a|none|null|undefined|-+)$/i.test(configured);
  return { taxLabel: usable ? configured : base.taxLabel, taxIdLabel: base.taxIdLabel };
}
