import { describe, expect, it } from "vitest";
import { salesOrderTranslationFields } from "@/lib/i18n/sales-order-translations";
import { roznamchaTranslationFields } from "@/lib/i18n/roznamcha-entry-translations";
import { buildVerifiedTranslationSet } from "@/lib/i18n/verified-record-translations";

describe("Sales record translation enrollment", () => {
  it("enrols parties, accounts, scope, remarks and nested goods", () => {
    const names = salesOrderTranslationFields({
      customerName: "Customer",
      formData: { form: { salesAccountName: "Sales", purchaseAccountName: "Purchases", branchName: "Dubai", countryName: "UAE", remarks: "Deliver carefully" }, goodsEntries: [{ goodsName: "Rice", description: "Premium", brand: "DGT", size: "25 KG", origin: "Pakistan", qtyName: "Bag" }] }
    }).map((field) => field.fieldName);
    expect(names).toEqual(expect.arrayContaining(["customer_name", "sales_account_name", "purchase_account_name", "branch_name", "country_name", "remarks", "product_name", "items.0.goods_name", "items.0.description"]));
  });
});

describe("Cash Entry and Daily Payment translation enrollment", () => {
  it("enrols narration, each line description and visible payment details", () => {
    const names = roznamchaTranslationFields({
      narration: "Cash paid",
      lines: [{ description: "Office payment" }, { description: "Cash credit" }],
      paymentDetails: { receiverSenderName: "Ahmad", purpose: "Rent", businessName: "DGT", invoiceName: "August invoice", purchaseInfo: "Supplies", transferInfo: "Branch transfer" }
    }).map((field) => field.fieldName);
    expect(names).toEqual(expect.arrayContaining(["narration", "lines.0.description", "lines.1.description", "payment.receiver_sender_name", "payment.purpose", "payment.business_name", "payment.invoice_name", "payment.purchase_info", "payment.transfer_info"]));
  });

  it.each([["ur", "نقد ادائیگی"], ["ar", "دفع نقدي"]] as const)("preserves %s source and never copies it into other languages", async (originalLanguage, value) => {
    const result = await buildVerifiedTranslationSet({ value, originalLanguage, mode: "translate" });
    expect(result.translations[originalLanguage]).toBe(value);
    for (const [language, translated] of Object.entries(result.translations)) {
      if (language !== originalLanguage) expect(translated).not.toBe(value);
    }
  });
});
