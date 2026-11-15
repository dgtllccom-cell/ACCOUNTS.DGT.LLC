import { describe, expect, it } from "vitest";
import { COUNTRY_CURRENCY_MAP, getCurrencyForCountry } from "@/lib/currency/country-currency-map";

/**
 * Country -> currency pairs as stored in the DEV `countries` table (currency_code), which is the source the
 * Country Main Branch save uses (country_branches.local_currency is copied from countries.currency_code).
 * Verified against the database on 2026-11-15; Pakistan must be PKR.
 */
const DEV_COUNTRY_CURRENCY: Array<[string, string]> = [
  ["Afghanistan", "AFN"],
  ["Bahrain", "BHD"],
  ["Chile", "CLP"],
  ["China", "CNY"],
  ["India", "INR"],
  ["Iran", "IRR"],
  ["Kazakhstan", "KZT"],
  ["Kuwait", "KWD"],
  ["Oman", "OMR"],
  ["Pakistan", "PKR"],
  ["Qatar", "QAR"],
  ["Russia", "RUB"],
  ["Saudi Arabia", "SAR"],
  ["Tajikistan", "TJS"],
  ["Turkiye", "TRY"],
  ["Turkmenistan", "TMT"],
  ["United Arab Emirates", "AED"],
  ["USA", "USD"],
  ["Uzbekistan", "UZS"]
];

describe("country to currency mapping (reference data)", () => {
  it("maps Pakistan to PKR", () => {
    expect(getCurrencyForCountry("Pakistan")).toBe("PKR");
    expect(getCurrencyForCountry("pakistan")).toBe("PKR");
    expect(COUNTRY_CURRENCY_MAP["Pakistan"]).toBe("PKR");
  });

  it("agrees with the DEV countries reference for every pair", () => {
    for (const [country, currency] of DEV_COUNTRY_CURRENCY) {
      expect(getCurrencyForCountry(country), country).toBe(currency);
    }
  });

  it("has only ISO-4217 three-letter codes", () => {
    for (const code of Object.values(COUNTRY_CURRENCY_MAP)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("falls back to USD for an unknown or empty country name", () => {
    expect(getCurrencyForCountry("Narnia")).toBe("USD");
    expect(getCurrencyForCountry("")).toBe("USD");
    expect(getCurrencyForCountry(null)).toBe("USD");
  });
});
