import { describe, expect, it } from "vitest";
import { purchaseOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";
import { invoiceQrSvg } from "@/lib/reports/invoice-templates/shared";
import { renderInvoiceHtml, themeInvoiceHtml } from "@/lib/reports/invoice-templates/render-invoice-html";
import { DEFAULT_TEMPLATE_FLAGS } from "@/lib/reports/invoice-templates/types";
import { decodeQrByteMode, encodeByteMode } from "@/components/ui/qr-code";

const rec = {
  id: "po-qr-1",
  currency_code: "USD",
  created_at: "2026-10-16T00:00:00Z",
  purchase_order_no: "PO-QR-0001",
  form_data: {
    supplierName: "Supplier QR Co",
    goodsEntries: [{ goodsName: "Pistachio", netWeight: 100, qtyNo: 2, qtyName: "Bags", coursePrice: 10, totalAmount: 20, finalAmount: 20 }],
  },
};
const opts: MapOptions = {
  docType: "purchase_invoice",
  lang: "en" as any,
  orientation: "portrait",
  branding: { entityName: "DGT Trading LLC", countryName: "Pakistan", address: "Quetta" } as any,
} as any;
const URL = "https://api.dgt.llc/i/AbCdEfGhIjKlMnOpQrStUvWxYz0123_-";

describe("invoice QR code encodes the public link", () => {
  it("round-trips the exact public URL through the QR encoder", () => {
    const enc = encodeByteMode(URL);
    expect(enc).not.toBeNull();
    expect(decodeQrByteMode(enc!.matrix, enc!.size)).toBe(URL);
  });

  it("draws a real SVG code for a link and nothing without one", () => {
    expect(invoiceQrSvg(URL, 48)).toContain("<svg");
    expect(invoiceQrSvg(null, 48)).toBe("");
    expect(invoiceQrSvg("", 48)).toBe("");
  });

  it("shows the code on a printed design only when the document has a link", () => {
    const input: any = { ...purchaseOrderToTradeInput(rec as any, opts), docType: "purchase_invoice" };
    const withLink = renderInvoiceHtml({ ...input, publicUrl: URL }, "modern", DEFAULT_TEMPLATE_FLAGS, "mint");
    const withoutLink = renderInvoiceHtml({ ...input, publicUrl: null }, "modern", DEFAULT_TEMPLATE_FLAGS, "mint");
    expect(withLink).toContain('class="qr-box"');
    expect(withoutLink).not.toContain('class="qr-box"');
  });
});

describe("server-side invoice theme", () => {
  it("applies the saved ERP color as the accent and keeps company and goods headers black", () => {
    const html = themeInvoiceHtml("<html><head></head><body></body></html>", "mint");
    expect(html).toContain("--erp-invoice-accent: #6BAF9A");
    expect(html).toContain(".brand-name, .company-name, .company-title { color: #111827 !important; }");
    expect(html).toContain("table.items th { background: #111827 !important;");
  });

  it("falls back to the default purple for an unknown color id", () => {
    expect(themeInvoiceHtml("<head></head>", "not-a-color")).toContain("--erp-invoice-accent: #5B21B6");
  });
});
