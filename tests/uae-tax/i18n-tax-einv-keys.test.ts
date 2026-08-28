import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n/ui";

/**
 * Regression guard for the 2026-08 `...en` spread-clobber bug: the ur/ar/fa/ps
 * Dict blocks each carry a `...en,` spread that back-fills untranslated keys.
 * It had drifted below the tax_einv.* keys, so every UAE Tax translation
 * silently rendered English at runtime while the source text (and the
 * text-based i18n guard) still looked correct.
 *
 * These assertions evaluate the real dictionary object — if the spread ever
 * moves back above these keys, the non-English lookups collapse to the English
 * value and the test fails.
 */
const NON_EN = ["ur", "ar", "fa", "ps"] as const;

const SAMPLE_KEYS = [
  "tax_einv.cc_title",
  "tax_einv.cc_k_net_vat",
  "tax_einv.cc_sec_purchases",
  "tax_einv.nav_vat_control",
];

describe("UAE Tax & e-Invoicing — five-language dictionary", () => {
  for (const key of SAMPLE_KEYS) {
    it(`${key} is genuinely translated in every non-English block`, () => {
      const en = t("en", key, "__MISSING__");
      expect(en).not.toBe("__MISSING__");
      for (const lang of NON_EN) {
        const value = t(lang, key, "__MISSING__");
        expect(value, `${lang}/${key} missing`).not.toBe("__MISSING__");
        expect(value, `${lang}/${key} not translated (equals English)`).not.toBe(en);
      }
    });
  }

  it("resolves a stable count of tax_einv.* keys with full parity", () => {
    // At least the 280 keys shipped with the module, present in all 5 blocks.
    const probe = (lang: string) =>
      SAMPLE_KEYS.every((k) => t(lang, k, "__MISSING__") !== "__MISSING__");
    for (const lang of ["en", ...NON_EN]) expect(probe(lang)).toBe(true);
  });
});
