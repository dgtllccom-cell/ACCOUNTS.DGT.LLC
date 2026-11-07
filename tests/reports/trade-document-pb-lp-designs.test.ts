import { describe, expect, it } from "vitest";
import {
  localPurchaseToTradeInput,
  purchaseOrderToTradeInput,
  type MapOptions,
} from "@/lib/reports/trade-documents/from-transaction";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import { renderModernInvoice } from "@/lib/reports/invoice-templates/modern";
import { renderProfessionalInvoice } from "@/lib/reports/invoice-templates/professional";
import { renderCompactInvoice } from "@/lib/reports/invoice-templates/compact";
import { renderPremiumInvoice } from "@/lib/reports/invoice-templates/premium";
import { DEFAULT_TEMPLATE_FLAGS } from "@/lib/reports/invoice-templates/types";

/**
 * QA regressions for the Purchase Booking and Local Purchase trade documents (DEV records):
 *  - Purchase Booking DEMO-5-30372 (purchase_orders row 0af337d9): 1,300 cartons, net 26,000 kg, gross 26,260 kg,
 *    unit 148.75, line 193,375.00 USD. Fixture copied from the saved row.
 *  - Local Purchase 3f7c20ad (local_purchases row): 140 bags, net 7,000 kg, gross 7,000 kg, PKR 310,000.00, no FX.
 * Covers: gross weight printed when the lines carry it (Classic and the shared designs), amount in words keeps the
 * cents of the document total, the internal brand/size attributes are not printed in the description (shared
 * designs), the header never prints the bare country name (shared designs), and contracts are signed by the seller
 * and the buyer in every design.
 */

const pbRec = {
  id: "0af337d9-0786-4d4b-a100-235ab982b45b",
  purchase_order_no: "DEMO-5-30372",
  purchase_contract_no: "DSA2025-0908",
  currency_code: "USD",
  exchange_rate: "3.67000000",
  order_total: "709686.2500",
  advance_paid: "0.0000",
  created_at: "2026-10-31 12:02:10.373+00",
  form_data: {
    form: {
      currency: "USD", paymentType: "Advance Payment", totalAmount: 193375, exchangeRate: 3.67,
      supplierName: "Demo Supplier Co", advancePercent: 10, purchaseOrderNo: "DEMO-5-30372",
      manualBillNumber: "DEMO-5-30372", purchaseCurrency: "USD",
    },
    totals: { totalAmount: 193375, totalQuantity: 1300 },
    goodsEntries: [{
      qtyNo: 1300, qtyKgs: 20.2, qtyName: "CARTONS", emptyKgs: 0.2, goodsName: "Cashew Kernel",
      netWeight: 26000, priceType: "P/KGs", divideType: "D/KGs", coursePrice: 148.75, grossWeight: 26260,
      totalAmount: 193375, currencyType: "USD", divideWeight: 20, exchangeRate: 3.67, purchaseCurrency: "AED",
    }],
  },
};

const localRec = {
  id: "3f7c20ad-910e-4c90-9ae1-307619ddc658",
  goods_name: "Pistachio In-Shell + Walnut In-Shell",
  supplier_name: "E2E Supplier Tz8jp1a",
  quantity_name: "Bags",
  quantity_kgs: "140.0000",
  total_gross_weight: "7000.0000",
  net_weight: "7000.0000",
  numbers: "140.0000",
  purchase_rate: "44.2857",
  purchase_currency: "PKR",
  purchase_cost: "310000.0000",
  final_cost: "310000.0000",
  exchange_rate: "1.00000000",
  local_currency: "PKR",
  purchase_account_no: "1002",
  brand: null,
  size: null,
  chassis_code: null,
  created_at: "2026-10-15 20:14:21.777658+00",
};

const brand = (over: Record<string, unknown> = {}) => ({
  entityName: null, legalName: null, logoUrl: null, stampUrl: null, address: null, phone: null,
  email: null, website: null, registrationNumber: null, taxNumber: null, countryName: null, branchName: null,
  ...over,
}) as any;

const opts = (over: Partial<MapOptions> = {}): MapOptions => ({
  docType: "commercial_invoice",
  lang: "en",
  branding: brand({ entityName: "DGT Trading LLC", countryName: "Pakistan" }),
  ...over,
});

const withDoc = (input: TradeDocumentInput, docType: TradeDocumentInput["docType"]): TradeDocumentInput => ({ ...input, docType });

describe("Purchase Booking DEMO-5-30372 - saved row values", () => {
  it("maps quantity, net and gross weight, unit price and the document-currency line amount", () => {
    const input = purchaseOrderToTradeInput(pbRec, opts());
    expect(input.docNo).toBe("CI-DEMO-5-30372");
    expect(input.currency).toBe("USD");
    expect(input.goods).toHaveLength(1);
    expect(input.goods[0]).toMatchObject({
      description: "Cashew Kernel",
      quantity: 1300,
      netWeight: 26000,
      grossWeight: 26260,
      unitPrice: 148.75,
      amount: 193375,
    });
    expect(input.totals?.grandTotal).toBe(193375);
    expect(input.totals?.totalNetWeight).toBe(26000);
    expect(input.totals?.totalGrossWeight).toBe(26260);
  });

  it("the Commercial Invoice body prints the gross weight column and the saved gross value", () => {
    const html = buildTradeDocumentHtml(withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice"));
    expect(html).toContain("Net Wt (KG)");
    expect(html).toContain("Gross Wt (KG)");
    expect(html).toMatch(/26,260/);
  });
});

describe("gross weight is printed when the source lines carry it", () => {
  const noGross = { ...pbRec, form_data: { ...pbRec.form_data, goodsEntries: [{ ...pbRec.form_data.goodsEntries[0], grossWeight: undefined }] } };

  it("Classic Commercial Invoice adds the gross column only when a line has a gross weight", () => {
    const withG = buildTradeDocumentHtml(withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice"));
    const withoutG = buildTradeDocumentHtml(withDoc(purchaseOrderToTradeInput(noGross as any, opts()), "commercial_invoice"));
    expect(withG).toContain("Gross Wt (KG)");
    expect(withoutG).not.toContain("Gross Wt (KG)");
  });

  it.each([
    ["Modern", renderModernInvoice],
    ["Professional", renderProfessionalInvoice],
    ["Compact", renderCompactInvoice],
    ["Premium", renderPremiumInvoice],
  ])("%s prints net and gross weight columns with the saved values", (_name, render) => {
    const html = render(withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice"), DEFAULT_TEMPLATE_FLAGS);
    expect(html).toContain("Net Wt (KG)");
    expect(html).toContain("Gross Wt (KG)");
    expect(html).toMatch(/26,000/);
    expect(html).toMatch(/26,260/);
  });
});

describe("amount in words keeps the cents of the document total", () => {
  it("Classic: a fractional total is spelled with its cents", () => {
    const input = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice");
    const frac = { ...input, goods: [{ ...input.goods[0], amount: 1234.56 }], totals: { ...input.totals, grandTotal: 1234.56, subTotal: 1234.56 } };
    expect(buildTradeDocumentHtml(frac)).toMatch(/Fifty Six Cents Only USD/);
  });

  it("shared designs: a fractional total is spelled with its cents", () => {
    const input = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice");
    const frac = { ...input, goods: [{ ...input.goods[0], amount: 1234.56 }], totals: { ...input.totals, grandTotal: 1234.56, subTotal: 1234.56 } };
    expect(renderModernInvoice(frac, DEFAULT_TEMPLATE_FLAGS)).toMatch(/Fifty Six Cents Only USD/);
  });

  it("the saved whole total is spelled exactly", () => {
    const input = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice");
    expect(renderCompactInvoice(input, DEFAULT_TEMPLATE_FLAGS)).toMatch(/One Hundred Ninety Three Thousand Three Hundred Seventy Five Only USD/);
  });
});

describe("internal brand / size attributes are never printed in the goods description (shared designs)", () => {
  const withVariant = (input: TradeDocumentInput): TradeDocumentInput => ({
    ...input,
    goods: input.goods.map((g) => ({ ...g, brand: "ZZBRAND", size: "ZZSIZE" })),
  });

  it.each([
    ["Modern", renderModernInvoice],
    ["Professional", renderProfessionalInvoice],
    ["Compact", renderCompactInvoice],
    ["Premium", renderPremiumInvoice],
  ])("%s prints only the goods name", (_name, render) => {
    const html = render(withDoc(withVariant(purchaseOrderToTradeInput(pbRec, opts())), "commercial_invoice"), DEFAULT_TEMPLATE_FLAGS);
    expect(html).toContain("Cashew Kernel");
    expect(html).not.toContain("ZZBRAND");
    expect(html).not.toContain("ZZSIZE");
  });

  it("Classic also keeps brand and size out of the description", () => {
    const html = buildTradeDocumentHtml(withDoc(withVariant(purchaseOrderToTradeInput(pbRec, opts())), "commercial_invoice"));
    expect(html).not.toContain("ZZBRAND");
    expect(html).not.toContain("ZZSIZE");
  });
});

describe("the header never prints the bare country name as the company (shared designs)", () => {
  const countryOnly = opts({ branding: brand({ entityName: "Pakistan", countryName: "Pakistan", legalName: "DGT Trading LLC" }) });

  it.each([
    ["Modern", renderModernInvoice],
    ["Professional", renderProfessionalInvoice],
    ["Compact", renderCompactInvoice],
    ["Premium", renderPremiumInvoice],
  ])("%s uses the legal name when the entity name is only the country", (_name, render) => {
    const html = render(withDoc(purchaseOrderToTradeInput(pbRec, countryOnly), "commercial_invoice"), DEFAULT_TEMPLATE_FLAGS);
    expect(html).toContain("DGT Trading LLC");
    expect(html).not.toMatch(/class="brand-name">Pakistan</);
  });
});

describe("contracts are signed by the seller and the buyer in every design", () => {
  const contract = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "contract");

  it.each([
    ["Modern", renderModernInvoice],
    ["Professional", renderProfessionalInvoice],
    ["Compact", renderCompactInvoice],
    ["Premium", renderPremiumInvoice],
  ])("%s prints the seller and buyer authorised-signatory captions", (_name, render) => {
    const html = render(contract, DEFAULT_TEMPLATE_FLAGS);
    expect(html).toContain("Seller — Authorized Signatory");
    expect(html).toContain("Buyer — Authorized Signatory");
    expect(html).not.toContain("Prepared By");
  });

  it("a Commercial Invoice keeps the Prepared By caption in the shared designs", () => {
    const ci = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice");
    expect(renderModernInvoice(ci, DEFAULT_TEMPLATE_FLAGS)).toContain("Prepared By");
  });
});

describe("a Packing List never carries payment terms", () => {
  it("Classic and a shared design omit Payment Terms on a packing list, but keep them on the commercial invoice", () => {
    const packing = withDoc(purchaseOrderToTradeInput(pbRec, opts({ docType: "packing_list" })), "packing_list");
    const invoice = withDoc(purchaseOrderToTradeInput(pbRec, opts()), "commercial_invoice");
    expect(invoice.delivery?.paymentTerms).toBe("Advance Payment");
    expect(buildTradeDocumentHtml(packing)).not.toContain("Advance Payment");
    expect(renderModernInvoice(packing, DEFAULT_TEMPLATE_FLAGS)).not.toContain("Advance Payment");
    expect(buildTradeDocumentHtml(invoice)).toContain("Advance Payment");
    expect(renderModernInvoice(invoice, DEFAULT_TEMPLATE_FLAGS)).toContain("Advance Payment");
  });
});

describe("Local Purchase 3f7c20ad - saved row values", () => {
  it("maps the line in the document currency (PKR, no FX) with quantity and weights", () => {
    const input = localPurchaseToTradeInput(localRec, opts({ docType: "commercial_invoice" }));
    expect(input.currency).toBe("PKR");
    expect(input.docNo).toBe("CI-LP-3f7c20ad");
    expect(input.goods[0]).toMatchObject({ quantity: 140, unit: "Bags", netWeight: 7000, grossWeight: 7000, amount: 310000 });
    expect(input.totals?.grandTotal).toBe(310000);
    expect(input.tradeScope).toBe("local");
  });

  it("the Local Purchase Commercial Invoice prints its totals in PKR", () => {
    const html = buildTradeDocumentHtml(localPurchaseToTradeInput(localRec, opts({ docType: "commercial_invoice" })));
    expect(html).toMatch(/Three Hundred Ten Thousand Only PKR/);
    expect(html).toContain("Gross Wt (KG)");
  });
});
