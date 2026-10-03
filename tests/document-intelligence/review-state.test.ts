import { describe, expect, it } from "vitest";
import { buildTargetPayload, emptyReview, handoffBlockers, recomputeExchange } from "@/lib/document-intelligence/review-state";
import { getIntakeModule } from "@/lib/document-intelligence/intake-modules";

const SUP = "11111111-1111-4111-8111-111111111111";
const PARTY = "33333333-3333-4333-8333-333333333333";
const scope = { countryId: "c1", countryBranchId: "b1", cityBranchId: null };

function dalian() {
  const s = emptyReview("purchase_booking");
  s.form = { ...s.form, contractNo: "0907B", documentDate: "2026-09-05", currency: "USD", totalAmount: "60000", paymentTerms: "T/T", deliveryTerms: "CIF Dalian Port", goodsDescription: "Plastic Raw Material", notes: "n" };
  s.party = { id: PARTY, kind: "company", name: "DALIAN SUNSHINE IMP. & EXP.", documentName: "Dalian Sunshine Imp & Exp. Co., Ltd." };
  s.accounts.supplierAccountId = SUP;
  s.items = [{ description: "Plastic Raw Material", hsCode: "", quantity: 50, unit: "MT", unitPrice: 1200, amount: 60000, grossWeight: null, tareWeight: null, netWeight: null, lotNo: "", variety: "", quality: "", sourcePage: 1 }];
  s.exchange = { ...s.exchange, originalAmount: 60000, originalCurrency: "USD", finalCurrency: "USD" };
  return s;
}

describe("a supplier's Sales Contract entered as OUR Purchase Booking", () => {
  it("maps the document's Seller to our supplier and keeps the ORIGINAL contract number", () => {
    const p = buildTargetPayload(getIntakeModule("purchase_booking")!, dalian(), scope);
    expect(p.supplierName).toBe("DALIAN SUNSHINE IMP. & EXP.");
    expect(p.purchaseContractNo).toBe("0907B");
    expect(p.purchaseAccountId).toBe(SUP);
    expect(p.supplierAccountId).toBe(SUP);
    expect(p.currency).toBe("USD");
    expect(p.totalAmount).toBe(60000);
    expect(p.coursePrice).toBe(1200);
    // company masters are not customers, so no customer-table id is invented for supplierId
    expect(p.supplierId).toBeUndefined();
  });
  it("Sales module never writes supplier keys", () => {
    const s = dalian();
    s.moduleId = "sales_booking";
    s.accounts = { ...s.accounts, supplierAccountId: "", customerAccountId: SUP };
    const p = buildTargetPayload(getIntakeModule("sales_booking")!, s, scope);
    expect(p.customerAccountId).toBe(SUP);
    expect(p.salesAccountId).toBeUndefined(); // the optional sales/income account was not chosen
    expect(p.salesContractNo).toBe("0907B");
    expect(p.supplierName).toBeUndefined();
    expect(p.purchaseAccountId).toBeUndefined();
  });
});

describe("Shipping customer-order cargo form", () => {
  it("receives goods and weights but never a price, currency, amount or rate", () => {
    const s = dalian();
    s.moduleId = "customer_order";
    s.form.grossWeight = "51200"; s.form.tareWeight = "1200"; s.form.netWeight = "50000"; s.form.truckNo = "TL-9988";
    const p = buildTargetPayload(getIntakeModule("customer_order")!, s, scope);
    expect(p.goodsName).toBe("Plastic Raw Material");
    expect(p.netWeight).toBe(50000);
    expect(p.truckNumber).toBe("TL-9988");
    for (const banned of ["currency", "currencyCode", "purchaseCurrency", "totalAmount", "orderTotal", "coursePrice", "exchangeRate", "paymentTerms", "secondaryCurrency"]) {
      expect(p[banned], banned).toBeUndefined();
    }
  });
});

describe("exchange rate review", () => {
  const base = { originalAmount: 60000, originalCurrency: "USD", finalCurrency: "AED", rate: null, rateDate: null, direction: "multiply" as const, finalAmount: null, rateSource: "none" as const, confirmed: false };
  it("keeps the original amount and converts once when the rate changes", () => {
    const a = recomputeExchange({ ...base, rate: 3.6725, rateSource: "manual" });
    expect(a.originalAmount).toBe(60000);
    expect(a.finalAmount).toBe(220350);
    const b = recomputeExchange({ ...a, rate: 3.67 });
    expect(b.originalAmount).toBe(60000);
    expect(b.finalAmount).toBe(220200);
  });
  it("has no final amount until a rate exists", () => {
    expect(recomputeExchange(base).finalAmount).toBeNull();
  });
  it("same currency needs no rate", () => {
    const r = recomputeExchange({ ...base, finalCurrency: "USD" });
    expect(r.rate).toBe(1);
    expect(r.finalAmount).toBe(60000);
  });
  it("blocks hand-off while the rate is missing or unconfirmed — never auto-confirms", () => {
    const s = dalian();
    s.exchange = { ...base };
    expect(handoffBlockers(getIntakeModule("purchase_booking"), s)).toContain("rate");
    s.exchange = recomputeExchange({ ...base, rate: 3.6725, rateSource: "manual" });
    expect(handoffBlockers(getIntakeModule("purchase_booking"), s)).toContain("rate_unconfirmed");
    s.exchange = { ...s.exchange, confirmed: true };
    expect(handoffBlockers(getIntakeModule("purchase_booking"), s)).toEqual([]);
  });
  it("blocks hand-off without a supplier account or a party", () => {
    const s = dalian();
    s.accounts.supplierAccountId = "";
    s.party = { id: null, kind: null, name: "", documentName: "x" };
    expect(handoffBlockers(getIntakeModule("purchase_booking"), s)).toEqual(expect.arrayContaining(["account:supplier", "party"]));
  });
});
