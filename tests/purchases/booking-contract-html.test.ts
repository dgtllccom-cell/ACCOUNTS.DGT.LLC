import { describe, expect, it } from "vitest";
import { buildPurchaseBookingReport } from "@/lib/purchases/booking-report";
import { renderBookingContractHtml } from "@/lib/purchases/booking-contract-html";

const BILL = {
  id: "po-1", purchase_order_no: "AE-001-0005", purchase_contract_no: "0000", ledger_posting_status: "draft",
  currency_code: "PKR", payment_currency: "AED", exchange_rate: 77.2,
  form_data: {
    form: { operator: "/", billNo: "DUBAI-0000", purchaseDate: "2026-11-20", paymentType: "Credit", advancePercent: 10,
      salesAccountNo: "ACC-000010", salesAccountName: "Supplier Party", purchaseAccountNo: "ACC-000006", purchaseAccountName: "Purchase Office",
      loadingPort: "Mazar-i-Sharif Airport (MZR)", receivedPort: "Jebel Ali Port (Dubai)", qualityReport: "Passed", paymentReport: "Credit 30 days" },
    goodsEntries: [{ op: "/", goodsName: "BLACK MAFTA", size: "50%", qtyNo: 2160, qtyName: "BAGS", qtyKgs: 50.25, coursePrice: 7500, totalAmount: 20250000, exchangeRate: 77.2 }],
    totals: { totalQty: 2160, totalGross: 108540, totalNet: 108000, grandPrimaryFinal: 20250000 },
    workflow: { countrySerialNo: "AE-PB-0005" },
  },
};

describe("renderBookingContractHtml", () => {
  const data = buildPurchaseBookingReport(BILL);

  it("is two A4 pages: Purchase Contract and Contract Report & Annexure, with the bill's operator", () => {
    const html = renderBookingContractHtml(data, { entityName: "Test Trading LLC", email: "info@example.test" }, "en");
    expect(html.match(/<section class="page/g)).toHaveLength(2);
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain("@page { size: A4 portrait");
    expect(html).toContain("Purchase Contract");
    expect(html).toContain("Contract Report &amp; Annexure");
    expect(html).toContain("Page 1 of 2");
    expect(html).toContain("Page 2 of 2");
    expect(html).toContain("÷ 77.2");
    expect(html).toContain("AED 262,305.70");
    expect(html).toContain("PKR 20,250,000.00");
    expect(html).toContain("AE-PB-0005");
    expect(html).toContain("Supplier Party"); // seller = the Cr party
    expect(html).toContain("Test Trading LLC"); // buyer / header = our company profile
    expect(html).toContain("Credit 30 days"); // payment remarks
    expect(html).toContain("Passed");
  });

  it("invents nothing: no branding → no company header, missing values print —", () => {
    const html = renderBookingContractHtml(buildPurchaseBookingReport({ id: "x", form_data: {} }), null, "en");
    expect(html).not.toContain('class="hdr');
    expect(html).not.toContain('class="logo"');
    expect(html).toContain("No goods saved on this booking.");
    expect(html).not.toContain("Payment Terms"); // no saved terms → no terms block
    expect(html).toContain("—");
  });

  it("follows the selected language with RTL", () => {
    const html = renderBookingContractHtml(data, null, "ur");
    expect(html).toContain('<html lang="ur" dir="rtl">');
    expect(html).toContain("خریداری کا معاہدہ");
    expect(html).toContain("صفحہ 1 از 2");
    expect(html).toContain("÷ 77.2");
  });

  it("escapes saved text", () => {
    const evil = buildPurchaseBookingReport({ ...BILL, form_data: { ...BILL.form_data, form: { ...BILL.form_data.form, remarks: "<script>x</script>" } } });
    expect(renderBookingContractHtml(evil, null, "en")).not.toContain("<script>x");
  });
});
