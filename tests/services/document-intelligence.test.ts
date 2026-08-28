import { describe, it, expect } from "vitest";
import { extractFields, classifyByKeywords } from "@/lib/document-intelligence/extractors";
import { buildCompositeIdentity, rowInScope, NO_MATCH_MESSAGE, type IntakeScope } from "@/lib/document-intelligence/scope";
import { buildPreparedDraft } from "@/lib/document-intelligence/draft-mapping";
import { checkRateLimit } from "@/lib/document-intelligence/rate-limit";
import { validateUpload, malwareScan } from "@/lib/document-intelligence/storage";
import type { RegistryDocType } from "@/lib/document-intelligence/types";

const page = (text: string) => [{ pageNumber: 1, text }];

describe("document intake — extractors", () => {
  it("extracts invoice number, currency, grand total and containers", () => {
    const text = [
      "COMMERCIAL INVOICE",
      "Invoice No: INV-2026-0453",
      "Currency: AED",
      "Grand Total: AED 69700.00",
      "Container Numbers: MSCU1234567, TGHU7654321",
    ].join("\n");
    const f = extractFields(text, page(text), "commercial_invoice");
    const by = Object.fromEntries(f.map((x) => [x.key, x.normalizedValue ?? x.rawValue]));
    expect(by.invoice_number).toBe("INV-2026-0453");
    expect(by.currency).toBe("AED");
    expect(Number(by.grand_total)).toBe(69700);
    expect(f.some((x) => x.key === "container_numbers")).toBe(true);
  });

  it("extracts a bank transfer amount and payment method", () => {
    const text = "BANK TRANSFER ADVICE\nPayment Method: Bank Transfer\nAmount: AED 41,500.00";
    const f = extractFields(text, page(text), "bank_transfer_advice");
    const by = Object.fromEntries(f.map((x) => [x.key, x.normalizedValue ?? x.rawValue]));
    expect(Number(by.grand_total)).toBe(41500);
    expect(String(by.payment_method).toLowerCase()).toContain("bank");
  });

  it("classifies a commercial invoice over a sales invoice", () => {
    const registry: RegistryDocType[] = [
      { code: "commercial_invoice", name: "Commercial Invoice", operational_domain: "business", category: "purchase", target_module: "purchase_orders", classifier_keywords: ["commercial invoice", "supplier invoice", "invoice no"], min_confidence: 0.5, requires_qvc: true, expected_fields: [] },
      { code: "sales_invoice", name: "Sales Invoice", operational_domain: "business", category: "sales", target_module: "sales_orders", classifier_keywords: ["sales invoice", "bill to"], min_confidence: 0.5, requires_qvc: true, expected_fields: [] },
    ];
    const res = classifyByKeywords("COMMERCIAL INVOICE\nSupplier Invoice\nInvoice No: 1", registry, "business");
    expect(res.code).toBe("commercial_invoice");
  });
});

describe("document intake — scope isolation", () => {
  it("composite identity is deterministic and scope-distinct", () => {
    const base = { operationalDomain: "business" as const, countryId: "C1", contractReference: "CON-1001" };
    const dubai = buildCompositeIdentity({ ...base, countryId: "AE" });
    const pk = buildCompositeIdentity({ ...base, countryId: "PK" });
    expect(dubai).not.toBe(pk);
    expect(buildCompositeIdentity({ ...base, countryId: "AE" })).toBe(dubai);
  });

  it("rowInScope blocks a different country for a non-global user", () => {
    const scope: IntakeScope = { domain: "business", countryIds: ["AE"], countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: false };
    expect(rowInScope(scope, { operational_domain: "business", country_id: "AE" })).toBe(true);
    expect(rowInScope(scope, { operational_domain: "business", country_id: "PK" })).toBe(false);
  });

  it("a shipping-scoped domain never matches business rows", () => {
    const scope: IntakeScope = { domain: "shipping", countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: ["A1"], isSuperAdmin: false };
    expect(rowInScope(scope, { operational_domain: "business", country_id: "AE" })).toBe(false);
  });

  it("exposes the exact no-match message required by the spec", () => {
    expect(NO_MATCH_MESSAGE).toBe("No authorized matching record was found in your country/branch scope.");
  });
});

describe("document intake — reviewed draft mapping (AI prepares, never posts)", () => {
  it("maps verified fields to purchase_orders payload keys and coerces amounts", () => {
    const fields = [
      { field_key: "contract_number", corrected_value: null, normalized_value: "PC-1", raw_value: "PC-1", confidence: 0.9, page_number: 1, verified: true, validation_status: "green" },
      { field_key: "grand_total", corrected_value: "69700.00", normalized_value: "69700", raw_value: "69,700", confidence: 0.8, page_number: 1, verified: true, validation_status: "green" },
      { field_key: "currency", corrected_value: null, normalized_value: "AED", raw_value: "AED", confidence: 0.95, page_number: 1, verified: true, validation_status: "green" },
    ];
    const d = buildPreparedDraft("purchase_orders", fields as any, []);
    expect(d.payload.purchaseContractNo).toBe("PC-1");
    expect(d.currency).toBe("AED");
    expect(d.unresolved).toEqual([]);
  });

  it("reports unresolved red-unverified mapped fields", () => {
    const fields = [
      { field_key: "contract_number", corrected_value: null, normalized_value: null, raw_value: "??", confidence: 0.2, page_number: null, verified: false, validation_status: "red" },
    ];
    const d = buildPreparedDraft("purchase_orders", fields as any, []);
    expect(d.unresolved).toContain("contract_number");
  });
});

describe("document intake — upload safety", () => {
  it("trusts the file signature over the declared MIME and rejects unknown bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    // a genuine PNG mislabelled as PDF is normalised to image/png, not trusted blindly
    expect(validateUpload(png, "application/pdf", "a.pdf").mimeType).toBe("image/png");
    // random bytes with no known signature are rejected
    expect(() => validateUpload(Buffer.from("not a real document at all"), "application/pdf", "a.pdf")).toThrow();
  });

  it("malware scan rejects an embedded-file PDF and a PE binary", async () => {
    const badPdf = Buffer.from("%PDF-1.4\n/EmbeddedFile 1 0 R\n");
    expect((await malwareScan({ buffer: badPdf, mimeType: "application/pdf", ext: "pdf", sha256: "x", size: badPdf.length } as any)).ok).toBe(false);
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect((await malwareScan({ buffer: pe, mimeType: "application/pdf", ext: "pdf", sha256: "x", size: pe.length } as any)).ok).toBe(false);
  });
});

describe("document intake — rate limit", () => {
  it("allows a burst then blocks with a retry-after", () => {
    const who = "rl-test-" + Math.random();
    let blocked = false;
    for (let i = 0; i < 200; i++) {
      const r = checkRateLimit("upload", who);
      if (!r.ok) { blocked = true; expect(r.retryAfterSec).toBeGreaterThan(0); break; }
    }
    expect(blocked).toBe(true);
  });
});
