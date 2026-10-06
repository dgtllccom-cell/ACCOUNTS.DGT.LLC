import { describe, expect, it } from "vitest";
import { getTranslationRecordAdapter } from "@/lib/i18n/translation-record-adapters";
import { buildVerifiedTranslationSet, validateManualTranslationInput } from "@/lib/i18n/verified-record-translations";

describe("shared translation correction foundation", () => {
  it("restricts corrections to the three approved central-record adapters", () => {
    expect(getTranslationRecordAdapter("purchase_orders")).toMatchObject({ resource: "purchases", integration: "complete" });
    expect(getTranslationRecordAdapter("sales_orders")).toMatchObject({ resource: "sales", integration: "complete" });
    expect(getTranslationRecordAdapter("roznamcha_entries")).toMatchObject({ resource: "roznamcha", integration: "complete" });
    expect(getTranslationRecordAdapter("profiles")).toBeNull();
  });

  it("preserves the source and rejects unchanged target-language copies", () => {
    expect(validateManualTranslationInput({
      fieldName: "remarks",
      originalText: "Handle carefully",
      originalLanguage: "en",
      translations: { en: "Handle carefully", ur: "Handle carefully" }
    })).toContain("not a verified translation");
    expect(validateManualTranslationInput({
      fieldName: "remarks",
      originalText: "Handle carefully",
      originalLanguage: "en",
      translations: { en: "Changed source", ur: "احتیاط سے سنبھالیں" }
    })).toContain("original source text cannot be changed");
  });

  it("uses deterministic local dictionary output and leaves unknown text pending", async () => {
    const known = await buildVerifiedTranslationSet({ value: "Purchase order", originalLanguage: "en", mode: "translate" });
    for (const [language, value] of Object.entries(known.translations)) {
      if (language !== "en") expect(value).not.toBe("Purchase order");
    }
    const unknown = await buildVerifiedTranslationSet({ value: "ZXQ custom free text", originalLanguage: "en", mode: "translate" });
    expect(unknown.status).toBe("pending");
    expect(unknown.translations.ur).not.toBe("ZXQ custom free text");
  });
});
