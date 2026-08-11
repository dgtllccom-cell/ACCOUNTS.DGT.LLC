import { describe, expect, it } from "vitest";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  buildVerifiedTranslationSet,
  purchaseOrderTranslationFields,
  resolveVerifiedTranslation
} from "@/lib/i18n/purchase-order-translations";

const languages: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];

describe("purchase-order record translations", () => {
  it.each([
    ["en", "Unlisted purchase description"],
    ["ur", "غیر فہرست خریداری کی تفصیل"],
    ["ar", "وصف شراء غير مدرج"]
  ] as const)("preserves %s input but never verifies copied source text", async (originalLanguage, value) => {
    const result = await buildVerifiedTranslationSet({ value, originalLanguage, mode: "translate" });
    expect(result.translations[originalLanguage]).toBe(value);
    for (const language of languages.filter((code) => code !== originalLanguage)) {
      expect(result.translations[language]).not.toBe(value);
    }
    expect(result.status).toBe("pending");
  });

  it("serves an explicitly verified five-language record in every selected language", async () => {
    const supplied = {
      en: "Purchase order",
      ur: "خریداری آرڈر",
      ar: "أمر شراء",
      fa: "سفارش خرید",
      ps: "د پېرود امر"
    } as const;
    const result = await buildVerifiedTranslationSet({ value: supplied.en, originalLanguage: "en", supplied });
    expect(result.status).toBe("complete");
    for (const language of languages) {
      expect(resolveVerifiedTranslation(result.translations, language)).toBe(supplied[language]);
    }
  });

  it("enrols header, parties, accounts, scope, remarks and nested goods fields", () => {
    const fields = purchaseOrderTranslationFields({
      form: {
        supplierName: "Supplier", customerName: "Buyer", purchaseAccountName: "Purchases",
        salesAccountName: "Payable", countryName: "Pakistan", branchName: "Karachi", remarks: "Handle carefully"
      },
      goodsEntries: [{ goodsName: "Rice", description: "Premium rice", brand: "DGT", size: "25 KG", origin: "Pakistan", qtyName: "Bag" }]
    }, []).map((field) => field.fieldName);
    expect(fields).toEqual(expect.arrayContaining([
      "supplier_name", "buyer_name", "purchase_account_name", "sales_account_name",
      "country_name", "branch_name", "remarks", "product_name", "goods_description",
      "items.0.goods_name", "items.0.description", "items.0.brand", "items.0.size",
      "items.0.origin", "items.0.unit_name"
    ]));
  });
});
