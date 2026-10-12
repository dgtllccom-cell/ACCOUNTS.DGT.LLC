import { describe, expect, it } from "vitest";
import { purchaseOrdersToModuleRows } from "@/features/journal/components/payment-module-approved-header";

describe("ten payment pages — module rows are plain reads of the order rows the journal already loaded", () => {
  const order = (over: Record<string, unknown>) => ({ id: "o1", order_total: 1000, advance_paid: 0, remaining_paid: 0, credit_amount: 0, currency_code: "usd", countryName: "Pakistan", ...over });

  it("paid = advance + remaining + credit; due falls back to total - paid; nothing is invented", () => {
    const [r] = purchaseOrdersToModuleRows([order({ advance_paid: 200, remaining_paid: 100, credit_amount: 50 })]);
    expect(r).toMatchObject({ id: "o1", country: "Pakistan", currency: "USD", total: 1000, paid: 350, due: 650, settled: false });
  });
  it("uses the stored remaining_due when present and never goes negative", () => {
    expect(purchaseOrdersToModuleRows([order({ advance_paid: 1200, remaining_due: -200 })])[0].due).toBe(0);
    expect(purchaseOrdersToModuleRows([order({ remaining_due: 400 })])[0].due).toBe(400);
  });
  it("settled when paid or fully covered; endorsement detected from the bill's payment condition", () => {
    expect(purchaseOrdersToModuleRows([order({ payment_status: "paid" })])[0].settled).toBe(true);
    expect(purchaseOrdersToModuleRows([order({ advance_paid: 1000 })])[0].settled).toBe(true);
    expect(purchaseOrdersToModuleRows([order({ form_data: { form: { paymentType: "Endorsement" } } })])[0].endorsement).toBe(true);
    expect(purchaseOrdersToModuleRows([order({})])[0].endorsement).toBe(false);
  });
  it("missing country shows a dash, not a made-up country", () => {
    expect(purchaseOrdersToModuleRows([order({ countryName: undefined })])[0].country).toBe("—");
  });
});
