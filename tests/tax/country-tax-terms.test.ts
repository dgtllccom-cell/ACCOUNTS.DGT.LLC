import { describe, expect, it } from "vitest";
import { countryTaxTerms } from "@/lib/tax/country-tax-terms";

describe("tax words per country (never a rate)", () => {
  it("UAE, Saudi, Oman: VAT", () => {
    expect(countryTaxTerms({ countryName: "United Arab Emirates" })).toEqual({ taxLabel: "VAT", taxIdLabel: "TRN" });
    expect(countryTaxTerms({ iso2: "SA" }).taxLabel).toBe("VAT");
    expect(countryTaxTerms({ countryName: "Oman" }).taxLabel).toBe("VAT");
  });

  it("Pakistan: Sales Tax with NTN / STRN (English or Urdu country name)", () => {
    expect(countryTaxTerms({ countryName: "Pakistan" })).toEqual({ taxLabel: "Sales Tax", taxIdLabel: "NTN / STRN" });
    expect(countryTaxTerms({ countryName: "پاکستان" }).taxLabel).toBe("Sales Tax");
  });

  it("India GST, Iran VAT, Afghanistan BRT", () => {
    expect(countryTaxTerms({ countryName: "India" })).toEqual({ taxLabel: "GST", taxIdLabel: "GSTIN" });
    expect(countryTaxTerms({ countryName: "Iran" })).toEqual({ taxLabel: "VAT", taxIdLabel: "Economic Code" });
    expect(countryTaxTerms({ countryName: "Afghanistan" })).toEqual({ taxLabel: "BRT", taxIdLabel: "TIN" });
    expect(countryTaxTerms({ countryName: "AFGHISTAN" }).taxLabel).toBe("BRT");
  });

  it("a configured tax name wins; a bare code like the legacy 'st' does not", () => {
    expect(countryTaxTerms({ countryName: "Pakistan", configuredTaxName: "GST" }).taxLabel).toBe("GST");
    expect(countryTaxTerms({ countryName: "Pakistan", configuredTaxName: "st" }).taxLabel).toBe("Sales Tax");
  });

  it("an unknown country gets neutral words", () => {
    expect(countryTaxTerms({ countryName: "Atlantis" })).toEqual({ taxLabel: "Tax", taxIdLabel: "Tax ID" });
  });
});
