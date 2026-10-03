import { describe, expect, it } from "vitest";
import { extractFields, extractLineItems } from "@/lib/document-intelligence/extractors";
import { initialReview, missingFields } from "@/lib/document-intelligence/review-init";
import { getIntakeModule } from "@/lib/document-intelligence/intake-modules";
import { buildPreparedDraft } from "@/lib/document-intelligence/draft-mapping";

// Same contract as the bug report. Extraction → fields → review form must carry every value through.
const TEXT = `DALIAN SUNSHINE IMP & EXP. CO., LTD.
SALES CONTRACT
Contract No.: 0907B
Date: 2026-09-05
The Seller: Dalian Sunshine Imp & Exp. Co., Ltd. (CHINA)
The Buyer: DGT LLC (UAE)
DESCRIPTION QUANTITY (MT) UNIT PRICE (USD/MT) AMOUNT (USD)
Plastic Raw Material 50 1,200 60,000
Total 50 1,200 60,000
1. Payment Terms: T/T
2. Delivery Terms: CIF Dalian Port`;

const pages = [{ pageNumber: 1, text: TEXT }] as any;

function bundle() {
  const fields = extractFields(TEXT, pages, "sales_contract").map((c) => ({
    field_key: c.key, raw_value: c.rawValue, normalized_value: c.normalizedValue, corrected_value: null, page_number: c.pageNumber, confidence: c.confidence,
  }));
  const lineItems = extractLineItems(TEXT, pages).map((l) => ({
    description: l.description, hs_code: l.hsCode, quantity: l.quantity, unit: l.unit, unit_price: l.unitPrice, amount: l.amount, gross_weight: l.grossWeight, net_weight: l.netWeight, page_number: l.pageNumber,
  }));
  return { job: { contract_reference: null, document_reference: null }, fields, lineItems };
}

describe("Dalian Sunshine contract — extraction reaches the review form", () => {
  it("fills Total Amount, Supplier, Date, original contract number, currency and terms (no blanks)", () => {
    const m = getIntakeModule("purchase_booking")!;
    const s = initialReview(bundle(), m, null);
    expect(s.form.contractNo).toBe("0907B");
    expect(s.form.documentDate).toBe("2026-09-05");
    expect(s.form.currency).toBe("USD");
    expect(s.form.totalAmount).toBe("60000");
    expect(s.form.paymentTerms).toBe("T/T");
    expect(s.form.deliveryTerms).toBe("CIF Dalian Port");
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ description: "Plastic Raw Material", quantity: 50, unit: "mt", unitPrice: 1200, amount: 60000 });
    expect(s.exchange.originalAmount).toBe(60000);
    expect(s.exchange.originalCurrency).toBe("USD");
  });

  it("keeps the document's Seller / Buyer as extracted fields for the module to interpret", () => {
    const f = Object.fromEntries(bundle().fields.map((x) => [x.field_key, x.normalized_value]));
    expect(f.supplier_name).toBe("Dalian Sunshine Imp & Exp. Co., Ltd.");
    expect(f.customer_name).toBe("DGT LLC");
  });

  it("the original contract number never becomes a generated ERP number", () => {
    const s = initialReview(bundle(), getIntakeModule("purchase_booking")!, null);
    expect(s.form.contractNo).not.toMatch(/^AE-ACC-/);
    expect(s.form.reference).toBe("");
  });

  it("only the party is still missing before matching — nothing else is blank", () => {
    const m = getIntakeModule("purchase_booking")!;
    expect(missingFields(m, initialReview(bundle(), m, null))).toEqual(["party"]);
  });

  it("legacy prepared-draft mapping also carries goods, price and terms", () => {
    const fields = bundle().fields.map((f) => ({ ...f, confidence: 0.9, verified: false, validation_status: "green" }));
    const d = buildPreparedDraft("purchase_orders", fields as any, []);
    expect(d.payload.goodsName).toBe("Plastic Raw Material");
    expect(d.payload.coursePrice).toBe(1200);
    expect(d.payload.purchaseContractNo).toBe("0907B");
    expect(d.payload.paymentDaysAndMethodDetails).toBeTruthy();
  });
});

describe("saved review is restored exactly on reopen", () => {
  it("returns the saved corrections, accounts and exchange rate instead of re-deriving them", () => {
    const m = getIntakeModule("purchase_booking")!;
    const first = initialReview(bundle(), m, null);
    first.form.totalAmount = "61000";
    first.accounts.supplierAccountId = "44444444-4444-4444-8444-444444444444";
    first.exchange = { ...first.exchange, finalCurrency: "AED", rate: 3.6725, rateSource: "manual", direction: "multiply", confirmed: true, originalAmount: 61000 };
    const reopened = initialReview({ ...bundle(), draft: { status: "prepared", draft_payload: { _review: first } } }, m, null);
    expect(reopened.form.totalAmount).toBe("61000");
    expect(reopened.accounts.supplierAccountId).toBe("44444444-4444-4444-8444-444444444444");
    expect(reopened.exchange.rate).toBe(3.6725);
    expect(reopened.exchange.finalAmount).toBe(224022.5);
    expect(reopened.exchange.confirmed).toBe(true);
  });
});
