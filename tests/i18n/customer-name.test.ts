import { describe, expect, it } from "vitest";
import { isAuthorizedNameTranslation, resolveCustomerName } from "@/lib/i18n/customer-name";

// A customer saved in Arabic script ("Muhammad Karim") with machine-generated variants for the other languages
const machineOnly = {
  customer_name: "محمد کریم",
  customer_name_en: "Muhammad Karim",
  customer_name_ur: "محمد کریم",
  customer_name_ar: "محمد كريم",
  customer_name_fa: "محمد کریم",
  customer_name_ps: "محمد کریم",
  name_translation_authorized: false
};
const authorized = { ...machineOnly, name_translation_authorized: true };

describe("authorized name translation", () => {
  it("machine output awaiting review is never authorized", () => {
    expect(isAuthorizedNameTranslation({ source: "auto", translation_status: "needs_review", translated_by_engine: "auto_unverified" })).toBe(false);
    expect(isAuthorizedNameTranslation({ source: "auto", translation_status: "complete", translated_by_engine: "local_multilingual" })).toBe(false);
    expect(isAuthorizedNameTranslation({ source: "imported", translation_status: "pending", translated_by_engine: "trigger_enroll" })).toBe(false);
    expect(isAuthorizedNameTranslation(null)).toBe(false);
  });
  it("an engine label is never an authorization: the local dictionary / translator / transliteration write 'complete' rows for names they only re-spelled", () => {
    for (const translated_by_engine of ["local_dictionary", "local_translator", "local_multilingual", "local_transliteration", "dictionary", "glossary"]) {
      expect(isAuthorizedNameTranslation({ source: "auto", translation_status: "complete", translated_by_engine })).toBe(false);
    }
  });
  it("human-corrected, manual and explicitly verified rows are authorized", () => {
    expect(isAuthorizedNameTranslation({ source: "auto", translation_status: "needs_review", human_corrected: true })).toBe(true);
    expect(isAuthorizedNameTranslation({ source: "manual", translation_status: "complete", translated_by_engine: "local_dictionary" })).toBe(true);
    expect(isAuthorizedNameTranslation({ source: "auto", translation_status: "human_verified" })).toBe(true);
    expect(isAuthorizedNameTranslation({ source: "imported", translation_status: "verified", translated_by_engine: "verified" })).toBe(true);
  });
});

describe("resolveCustomerName", () => {
  it("without an authorized translation every language shows the saved legal name — one line only", () => {
    for (const lang of ["en", "ur", "ar", "fa", "ps"] as const) {
      const r = resolveCustomerName(machineOnly, lang);
      expect(r.primary).toBe("محمد کریم");
      expect(r.usedTranslation).toBe(false);
      expect(r.savedName).toBe("محمد کریم");
    }
  });
  it("with an authorized translation each language shows its own version as the primary name", () => {
    expect(resolveCustomerName(authorized, "en").primary).toBe("Muhammad Karim");
    expect(resolveCustomerName(authorized, "ar").primary).toBe("محمد كريم");
    expect(resolveCustomerName(authorized, "en").usedTranslation).toBe(true);
  });
  it("falls back to the saved name when the authorized row has no version for that language", () => {
    const partial = { customer_name: "Ali Khan", customer_name_en: "Ali Khan", customer_name_ur: "علی خان", name_translation_authorized: true };
    expect(resolveCustomerName(partial, "ur").primary).toBe("علی خان");
    expect(resolveCustomerName(partial, "ps").primary).toBe("Ali Khan");
    expect(resolveCustomerName(partial, "fa").primary).toBe("Ali Khan");
  });
  it("the second line (bilingual option) is the saved name when a translation is primary", () => {
    const r = resolveCustomerName(authorized, "en");
    expect(r.secondary).toBe("محمد کریم");
  });
  it("never invents a name for an empty record and trims whitespace", () => {
    expect(resolveCustomerName({ customer_name: "  Ali  " }, "ur").primary).toBe("Ali");
    expect(resolveCustomerName({}, "en").primary).toBe("");
  });
  it("preserves the saved name even when original_customer_name is set", () => {
    const r = resolveCustomerName({ customer_name: "x", original_customer_name: "Ali Khan", customer_name_ur: "علی خان", name_translation_authorized: true }, "ur");
    expect(r.savedName).toBe("Ali Khan");
    expect(r.primary).toBe("علی خان");
  });
});
