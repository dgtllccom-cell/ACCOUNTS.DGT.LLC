import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { purchaseOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocType } from "@/lib/reports/trade-documents/types";
import { INVOICE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE_ID, listTemplatesForDocType } from "@/lib/reports/invoice-templates/registry";
import { DEFAULT_TEMPLATE_FLAGS } from "@/lib/reports/invoice-templates/types";

/**
 * Print Reports hub: the Proforma Invoice and Trade Contract entries must open through the
 * template-aware engine (openInvoiceDocument), not the legacy fixed-layout openTradeDocument.
 * The user picks one of the five registry templates (default Classic); the data mapping is unchanged.
 */

const hub = fs.readFileSync("app/dashboard/print-reports/page.tsx", "utf8");

const rec = {
  id: "po-hub-1",
  purchase_order_no: "PO-HUB-1",
  currency_code: "USD",
  created_at: "2026-11-01T00:00:00Z",
  form_data: {
    supplierName: "Supplier Hub",
    goodsEntries: [{ goodsName: "Pistachio", netWeight: 100, qtyNo: 2, qtyName: "Bags", coursePrice: 10, totalAmount: 20, finalAmount: 20 }],
  },
};
// Mirrors the hub's mapping call exactly (no orientation / bank options).
const hubOpts = (docType: TradeDocType): MapOptions => ({
  docType,
  lang: "en",
  branding: { entityName: "DGT Trading LLC", countryName: "Pakistan" } as any,
});

describe("Print Reports hub opens trade documents through the template engine (static)", () => {
  it("the hub no longer calls the legacy fixed-layout opener", () => {
    expect(hub).not.toMatch(/openTradeDocument/);
    expect(hub).not.toMatch(/trade-documents\/open-trade-document/);
  });

  it("the hub opens the document through openInvoiceDocument with the picked template and default flags", () => {
    expect(hub).toMatch(/openInvoiceDocument\(input, tradeDocTemplateId, DEFAULT_TEMPLATE_FLAGS\)/);
  });

  it("the Proforma and Trade Contract entries open the template picker (not the document directly)", () => {
    expect(hub).toMatch(/handlePrintProformaInvoice = useCallback\(\(\) => \{ openTradeDoc\("proforma_invoice"\); \}/);
    expect(hub).toMatch(/handlePrintTradeDocument = useCallback\(\(\) => \{ openTradeDoc\("contract"\); \}/);
  });

  it("the picker defaults to the registry default template and lists the registry templates", () => {
    expect(hub).toMatch(/useState<InvoiceTemplateId>\(DEFAULT_INVOICE_TEMPLATE_ID\)/);
    expect(hub).toMatch(/setTradeDocTemplateId\(DEFAULT_INVOICE_TEMPLATE_ID\)/);
    expect(hub).toMatch(/listTemplatesForDocType\(tradeDocPick\)/);
  });

  it("the data mapping is still the hub's purchaseOrderToTradeInput call, unchanged in shape", () => {
    expect(hub).toMatch(/purchaseOrderToTradeInput\(o, \{ docType: tradeDocPick, lang, branding \}\)/);
  });
});

describe("invoice template registry backs the hub picker (behavior)", () => {
  it("offers exactly the five templates in order, with classic as the default", () => {
    expect(INVOICE_TEMPLATES.map((d) => d.id)).toEqual(["classic", "modern", "professional", "compact", "premium"]);
    expect(DEFAULT_INVOICE_TEMPLATE_ID).toBe("classic");
  });

  it("every template is offered for Proforma Invoice and Trade Contract", () => {
    for (const docType of ["proforma_invoice", "contract"] as const) {
      expect(listTemplatesForDocType(docType).map((d) => d.id)).toEqual(["classic", "modern", "professional", "compact", "premium"]);
    }
  });

  it("Classic with default flags produces the same document the hub produced before (legacy builder)", () => {
    const classic = INVOICE_TEMPLATES.find((d) => d.id === "classic")!;
    for (const docType of ["proforma_invoice", "contract"] as const) {
      const input = purchaseOrderToTradeInput(rec, hubOpts(docType));
      expect(classic.render(input, DEFAULT_TEMPLATE_FLAGS)).toBe(buildTradeDocumentHtml(input));
    }
  });

  it("each template renders a Proforma Invoice and a Trade Contract as a non-empty HTML document", () => {
    for (const def of INVOICE_TEMPLATES) {
      for (const docType of ["proforma_invoice", "contract"] as const) {
        const input = purchaseOrderToTradeInput(rec, hubOpts(docType));
        const html = def.render(input, DEFAULT_TEMPLATE_FLAGS);
        expect(html.length, `${def.id} / ${docType}`).toBeGreaterThan(500);
        expect(html, `${def.id} / ${docType}`).toMatch(/<html|<!doctype html|<body/i);
      }
    }
  });
});
