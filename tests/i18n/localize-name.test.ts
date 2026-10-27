import { describe, expect, it } from "vitest";
import { localizeName, transliterateProperNoun } from "@/lib/i18n/transliteration";

// Owner rule: a name (account, company, bank, branch, customer) stays exactly as saved; only an approved variant replaces it.
describe("localizeName — approved variant, else the saved name", () => {
  const LANGS = ["en", "ur", "ar", "fa", "ps"] as const;

  it("a name with no approved variant is shown exactly as saved in every language (no phonetic re-spelling)", () => {
    for (const saved of ["Quetta Main Branch", "Habib Bank Limited", "Al Ras General Trading LLC", "Chaman Shipping", "حامد شریف"]) {
      for (const lang of LANGS) expect(localizeName(saved, lang)).toBe(saved);
    }
    // the phonetic engine would have re-spelled it — localizeName must not
    expect(transliterateProperNoun("Chaman Shipping", "ur")).not.toBe("Chaman Shipping");
  });

  it("a whole-name entry of the curated dictionary is the approved variant", () => {
    expect(localizeName("Asmatullah", "ur")).toBe("عصمت اللہ");
    expect(localizeName("asmatullah", "ar")).toBe("عصمت الله");
    expect(localizeName("Pakistan", "ps")).toBe("پاکستان");
    expect(localizeName("Asmatullah", "en")).toBe("Asmatullah");
  });

  it("a curated single word inside a longer name does not re-spell the rest", () => {
    expect(localizeName("Asmatullah Traders 2", "ur")).toBe("Asmatullah Traders 2");
  });

  it("empty input stays empty", () => {
    expect(localizeName("", "ur")).toBe("");
    expect(localizeName(null, "ur")).toBe("");
    expect(localizeName(undefined, "fa")).toBe("");
  });
});
