import { describe, expect, it } from "vitest";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

describe("English view of names typed in Arabic-script languages", () => {
  it("Urdu / Arabic script names become Latin in the English UI (no source-script text left)", () => {
    for (const raw of ["احمد خان", "محمد یوسف", "حامد شریف"]) {
      const out = transliterateProperNoun(raw, "en");
      expect(out).toMatch(/^[A-Za-z .'-]+$/);
      expect(out.length).toBeGreaterThan(3);
    }
    expect(transliterateProperNoun("محمد یوسف", "en")).toMatch(/yousuf|yusuf/i);
  });
  it("Latin names, codes and digits are not touched in English", () => {
    expect(transliterateProperNoun("Ahmad Khan", "en")).toBe("Ahmad Khan");
    expect(transliterateProperNoun("  PER-000108  ", "en")).toBe("PER-000108");
    expect(transliterateProperNoun("05643616644", "en")).toBe("05643616644");
  });
  it("other languages keep their behaviour (Latin → script, script stays script)", () => {
    expect(transliterateProperNoun("Muhammad Aslam", "ur")).toMatch(/[؀-ۿ]/);
    expect(transliterateProperNoun("محمد اسلام", "ar")).toMatch(/[؀-ۿ]/);
  });
  it("empty input stays empty", () => {
    expect(transliterateProperNoun("   ", "en")).toBe("");
    expect(transliterateProperNoun("", "ur")).toBe("");
  });
});
