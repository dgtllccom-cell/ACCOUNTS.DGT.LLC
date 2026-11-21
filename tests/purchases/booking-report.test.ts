import { describe, expect, it } from "vitest";
import {
  buildPurchaseBookingReport,
  bookingRemarksEditable,
  formatRateWithOperator,
  remarkPatchBody,
} from "@/lib/purchases/booking-report";

// AE-001-0005 as saved (amounts, rate, operator, weights read from the row on 21 Nov 2026; party names generalised)
const AE0005 = {
  id: "8cd5a174-8354-4faf-b646-e0558ee5426c",
  purchase_order_no: "AE-001-0005",
  purchase_contract_no: "0000",
  ledger_posting_status: "draft",
  payment_status: "pending",
  currency_code: "PKR",
  payment_currency: "AED",
  exchange_rate: "77.20000000",
  order_total: "262305.6995",
  form_data: {
    form: {
      billNo: "DUBAI-0000",
      purchaseDate: "2026-11-20",
      branchName: "Dubai City Branch",
      branchCode: "ARE-AEDU-001",
      operator: "/",
      exchangeRate: 77.2,
      paymentType: "Credit",
      shippingMode: "By Sea",
      advancePercent: 10,
      purchaseAccountNo: "ACC-000006",
      purchaseAccountName: "Purchase Office",
      salesAccountNo: "ACC-000010",
      salesAccountName: "Supplier Party",
      loadingCountry: "Afghanistan",
      loadingPort: "Mazar-i-Sharif Airport (MZR)",
      loadingDate: "2026-11-25",
      receivedCountry: "United Arab Emirates",
      receivedPort: "Jebel Ali Port (Dubai)",
      receivedDate: "2026-11-25",
      destinationPort: "Jebel Ali Port (Dubai)",
      loadingReport: "",
      paymentReport: "",
      remarks: "",
    },
    totals: { totalNet: 108000, totalQty: 2160, grandFinal: 262305.6994818653, totalGross: 108540, grandPrimaryFinal: 20250000 },
    goodsEntries: [
      {
        op: "/", size: "50%", brand: "NO", qtyNo: 2160, hsCode: "0713.3120", origin: "Afghanistan", qtyName: "BAGS",
        goodsName: "BLACK MAFTA", coursePrice: 7500, totalAmount: 20250000, finalAmount: 262305.6994818653,
        grossWeight: 108540, netWeight: 108000, exchangeRate: 77.2, purchaseCurrency: "PKR",
      },
    ],
  },
};

describe("buildPurchaseBookingReport", () => {
  it("AE-001-0005 (PKR ÷ 77.2) shows ÷ 77.2 and a final amount of 262,305.70 AED — never multiplied", () => {
    const r = buildPurchaseBookingReport(AE0005);
    expect(r.op).toBe("/");
    expect(r.rateLabel).toBe("÷ 77.2");
    expect(r.currency).toBe("PKR");
    expect(r.baseCurrency).toBe("AED");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].rateLabel).toBe("÷ 77.2");
    expect(r.lines[0].amount).toBe(20250000);
    expect(r.lines[0].finalAmount).toBe(262305.7);
    expect(r.totals.amount).toBe(20250000);
    expect(r.totals.finalAmount).toBe(262305.7);
    expect(r.totals.finalAmount).not.toBe(1563300000);
    expect(r.totals.qty).toBe(2160);
    expect(r.totals.grossMt).toBeCloseTo(108.54, 3);
    expect(r.totals.netMt).toBe(108);
    expect(r.payment.advanceAmount).toBe(2025000);
    expect(r.payment.advanceFinal).toBe(26230.57);
    expect(r.payment.balanceFinal).toBe(236075.13);
    expect(r.bookingNo).toBe("AE-001-0005");
    expect(r.billNo).toBe("DUBAI-0000");
    expect(r.status).toBe("draft");
    expect(r.purchaseAccount).toMatchObject({ code: "ACC-000006", name: "Purchase Office" });
    expect(r.salesAccount).toMatchObject({ code: "ACC-000010", name: "Supplier Party" });
    expect(r.receiving.finalDestination).toBe("Jebel Ali Port (Dubai)");
    expect(r.locked).toBe(false);
  });

  it("a USD bill (× 3.675) multiplies: 230,000 USD → 845,250 AED", () => {
    const usd = {
      id: "usd-1", purchase_order_no: "AE-001-0099", ledger_posting_status: "draft", currency_code: "USD", payment_currency: "AED", exchange_rate: 3.675,
      form_data: { form: { operator: "*" }, goodsEntries: [{ goodsName: "Rice", qtyNo: 1000, coursePrice: 230, totalAmount: 230000, exchangeRate: 3.675, op: "*" }] },
    };
    const r = buildPurchaseBookingReport(usd);
    expect(r.rateLabel).toBe("× 3.675");
    expect(r.lines[0].rateLabel).toBe("× 3.675");
    expect(r.lines[0].finalAmount).toBe(845250);
    expect(r.totals.finalAmount).toBe(845250);
  });

  it("a bill without data shows nothing invented", () => {
    const r = buildPurchaseBookingReport({ id: "x", form_data: {} });
    expect(r.lines).toEqual([]);
    expect(r.branch.name).toBe("");
    expect(r.paymentType).toBe("");
    expect(r.payment.advancePercent).toBeNull();
    expect(r.totals.qty).toBeNull();
    expect(r.rateLabel).toBe("");
  });

  it("reads string-encoded form_data", () => {
    const r = buildPurchaseBookingReport({ ...AE0005, form_data: JSON.stringify(AE0005.form_data) });
    expect(r.rateLabel).toBe("÷ 77.2");
  });
});

describe("remarks", () => {
  it("formats the rate with its operator", () => {
    expect(formatRateWithOperator(3.675, "*")).toBe("× 3.675");
    expect(formatRateWithOperator(77.2, "/")).toBe("÷ 77.2");
    expect(formatRateWithOperator(0, "*")).toBe("");
  });

  it("a remark save changes ONLY that one form field — amounts, goods, totals and accounts pass through", () => {
    const body = remarkPatchBody(AE0005, "payment", "Credit 30 days");
    expect(Object.keys(body)).toEqual(["formData"]);
    expect(body.formData.form.paymentReport).toBe("Credit 30 days");
    const { paymentReport: _a, ...restAfter } = body.formData.form;
    const { paymentReport: _b, ...restBefore } = AE0005.form_data.form;
    expect(restAfter).toEqual(restBefore);
    expect(body.formData.goodsEntries).toEqual(AE0005.form_data.goodsEntries);
    expect(body.formData.totals).toEqual(AE0005.form_data.totals);
    expect(remarkPatchBody(AE0005, "quantity", "ok").formData.form.quantityReport).toBe("ok");
    expect(remarkPatchBody(AE0005, "journal", "n").formData.form.remarks).toBe("n");
    expect(remarkPatchBody(AE0005, "loading", "l").formData.form.loadingReport).toBe("l");
  });

  it("posted / transferred bills are read-only (the PATCH API would reverse their posting)", () => {
    expect(bookingRemarksEditable(AE0005)).toBe(true);
    expect(bookingRemarksEditable({ ...AE0005, ledger_posting_status: "posted", is_edited_since_transfer: false })).toBe(false);
    expect(bookingRemarksEditable({ ...AE0005, ledger_posting_status: "posted", is_edited_since_transfer: true })).toBe(false);
    expect(bookingRemarksEditable({ ...AE0005, ledger_posting_status: "transferred" })).toBe(false);
    expect(buildPurchaseBookingReport({ ...AE0005, ledger_posting_status: "transferred" }).locked).toBe(true);
  });
});
