import { describe, it, expect } from "vitest";
import { translateCountry } from "@/lib/i18n/table-values";
import { getPhraseTranslator } from "@/lib/i18n/localize-records";

describe("Universal 5-Language Country & Term Localization", () => {
  it("translates all primary countries into Urdu correctly", async () => {
    expect(translateCountry("Pakistan", "ur")).toBe("پاکستان");
    expect(translateCountry("Afghanistan", "ur")).toBe("افغانستان");
    expect(translateCountry("United Arab Emirates", "ur")).toBe("متحدہ عرب امارات");
    expect(translateCountry("UAE", "ur")).toBe("متحدہ عرب امارات");
    expect(translateCountry("China", "ur")).toBe("چین");
    expect(translateCountry("India", "ur")).toBe("بھارت");
  });

  it("translates all primary countries into Arabic correctly", async () => {
    expect(translateCountry("Pakistan", "ar")).toBe("باكستان");
    expect(translateCountry("Afghanistan", "ar")).toBe("أفغانستان");
    expect(translateCountry("United Arab Emirates", "ar")).toBe("الإمارات العربية المتحدة");
    expect(translateCountry("China", "ar")).toBe("الصين");
    expect(translateCountry("India", "ar")).toBe("الهند");
  });

  it("translates all primary countries into Farsi correctly", async () => {
    expect(translateCountry("Pakistan", "fa")).toBe("پاکستان");
    expect(translateCountry("Afghanistan", "fa")).toBe("افغانستان");
    expect(translateCountry("United Arab Emirates", "fa")).toBe("امارات متحده عربی");
    expect(translateCountry("China", "fa")).toBe("چین");
    expect(translateCountry("India", "fa")).toBe("هند");
  });

  it("translates all primary countries into Pashto correctly", async () => {
    expect(translateCountry("Pakistan", "ps")).toBe("پاکستان");
    expect(translateCountry("Afghanistan", "ps")).toBe("افغانستان");
    expect(translateCountry("United Arab Emirates", "ps")).toBe("متحده عربي امارات");
    expect(translateCountry("China", "ps")).toBe("چین");
    expect(translateCountry("India", "ps")).toBe("هند");
  });

  it("preserves English untouched when viewing in English", async () => {
    expect(translateCountry("Pakistan", "en")).toBe("Pakistan");
    expect(translateCountry("United Arab Emirates", "en")).toBe("United Arab Emirates");
    expect(translateCountry("China", "en")).toBe("China");
  });

  it("translates country names through getPhraseTranslator fallback", async () => {
    const tpUr = await getPhraseTranslator("ur");
    expect(tpUr("Pakistan")).toBe("پاکستان");
    expect(tpUr("United Arab Emirates")).toBe("متحدہ عرب امارات");
    expect(tpUr("China")).toBe("چین");
    expect(tpUr("Afghanistan")).toBe("افغانستان");
  });
});
