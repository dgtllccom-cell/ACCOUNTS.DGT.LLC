import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseCountry, parseTradeContract } from "@/lib/document-intelligence/contract-parser";
import { extractFields, extractLineItems } from "@/lib/document-intelligence/extractors";
import { buildTargetPayload, emptyReview, splitPortCountry } from "@/lib/document-intelligence/review-state";
import { formFromFields, fieldMap } from "@/lib/document-intelligence/review-init";
import { getIntakeModule } from "@/lib/document-intelligence/intake-modules";
import { fallbackDocType } from "@/lib/services/document-intake-service";

// The real local OCR output (tesseract eng+ara+chi_sim, one block per page) of a 4-page phone-scanned bilingual English / Chinese
// supplier SALES CONTRACT — the kind of document that showed "OCR finished but no fields could be extracted" on Production.
// It keeps the genuine OCR noise: "SULIANA" for SULTANA, "JEBELALL UA.E.", a garbled page-3 letterhead.
const RAW = fs.readFileSync(path.join(__dirname, "fixtures", "dalian-sales-contract-scan.ocr.txt"), "utf8");
const PAGES = RAW.split("\n\n\f\n\n").map((text, i) => ({ pageNumber: i + 1, text }));
const TEXT = PAGES.map((p) => p.text).join("\n\n");

describe("scanned bilingual (English / Chinese) supplier sales contract", () => {
  const c = parseTradeContract(TEXT);

  it("reads the parties through the bilingual labels (Seller 卖方: / Buyer 买方:)", () => {
    expect(c.isTradeContract).toBe(true);
    expect(c.sellerName).toMatch(/^DALIAN SUNSHINE IMP\. & EXP\. CO\.?,\s?LTD\.$/);
    expect(c.buyerName).toBe("DAMAAN GENERAL TRADING LLC");
    expect(c.sellerNameLocal).toBe("大连赛恩进出口有限公司");
  });

  it("reads contract number, date, currency and the total written in words", () => {
    expect(c.contractNo).toBe("DSA2023-1018");
    expect(c.contractDate).toBe("2023-10-11");
    expect(c.currency).toBe("USD");
    expect(c.currencies).toEqual(["USD"]);
    expect(c.total).toEqual({ amount: 1158740, source: "stated" });
  });

  it("reads the goods row although the scan lost the quantity cell — the quantity is amount ÷ price and marked as calculated", () => {
    expect(c.goods).toHaveLength(1);
    const g = c.goods[0];
    expect(g.description).toMatch(/GOLDEN RAISINS$/);
    expect(g.unitPrice).toBe(5267);
    expect(g.amount).toBe(1158740);
    expect(g.unit).toBe("MT");
    expect(g.quantity).toBe(220);
    expect(g.quantitySource).toBe("amount_div_price");
    expect(g.specification).toContain("GRADE A, CROP 2023");
    expect(g.hsCode).toBe("080620");
  });

  it("reads terms, ports, shipment, origin, packing, weights and the bank block", () => {
    expect(c.paymentTerms).toBe("30% T/T in advance, 70% balance against copy of B/L.");
    expect(c.incoterm).toBe("CFR");
    expect(c.deliveryPlace).toBe("JEBEL ALI");
    expect(c.portOfLoading).toBe("DALIAN, CHINA");
    expect(c.portOfDestination).toMatch(/^JEBEL/);
    expect(c.shipmentTime).toBe("Before December 15, 2023");
    expect(c.countryOfOrigin).toBe("China");
    expect(c.packing).toBe("10 KG net per carton, 22,000 cartons in total.");
    expect(c.netWeight).toBe(220000);
    expect(c.grossWeight).toBe(228800);
    expect(c.bank.bankName).toBe("BANK OF CHINA, DALIAN BRANCH");
    expect(c.bank.swift).toBe("BKCHCNBJ810");
    expect(c.bank.accountNo).toBe("3070 5678 9012");
  });

  it("field candidates: no invented invoice number, calculated quantity flagged for review, no noise branch", () => {
    const f = extractFields(TEXT, PAGES, "purchase_contract");
    const byKey = Object.fromEntries(f.map((x) => [x.key, x]));
    expect(byKey.invoice_number).toBeUndefined(); // "Commercial Invoice in 3 originals" is not an invoice number
    expect(byKey.branch_name).toBeUndefined();
    expect(byKey.supplier_name.normalizedValue).toMatch(/^DALIAN SUNSHINE/);
    expect(byKey.supplier_name_local.normalizedValue).toBe("大连赛恩进出口有限公司");
    expect(byKey.grand_total.normalizedValue).toBe("1158740");
    expect(byKey.quantity.validationStatus).not.toBe("green");
    expect(byKey.quantity.validationMessage).toMatch(/calculated/i);
    expect(byKey.port_of_loading.normalizedValue).toBe("DALIAN, CHINA");
    const items = extractLineItems(TEXT, PAGES);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 220, unit: "mt", unitPrice: 5267, amount: 1158740, currency: "USD" });
  });

  it("the reviewed form carries loading / destination / origin into the Purchase Booking in the masters' spelling", () => {
    const f = extractFields(TEXT, PAGES, "purchase_contract");
    const m = fieldMap(f.map((x) => ({ field_key: x.key, normalized_value: x.normalizedValue, raw_value: x.rawValue })));
    const form = formFromFields(m, {});
    expect(form.loadingPort).toBe("DALIAN, CHINA");
    expect(form.countryOfOrigin).toBe("China");
    const mod = getIntakeModule("purchase_booking")!;
    const state = { ...emptyReview(mod.id), form };
    const p = buildTargetPayload(mod, state, {});
    expect(p.loadingPort).toBe("Dalian");
    expect(p.loadingCountry).toBe("China");
    expect(p.receivedCountry).toBe("United Arab Emirates");
    expect(p.origin).toBe("China");
    expect(p.purchaseContractNo).toBe("DSA2023-1018");
    expect(String(p.paymentDaysAndMethodDetails)).toContain("Shipment: Before December 15, 2023");
  });
});

describe("helpers", () => {
  it("normaliseCountry / splitPortCountry", () => {
    expect(normaliseCountry("U.A.E.")).toBe("United Arab Emirates");
    expect(normaliseCountry("CHINA")).toBe("China");
    expect(normaliseCountry("pakistan")).toBe("Pakistan");
    expect(splitPortCountry("JEBEL ALI, U.A.E.")).toEqual({ port: "Jebel Ali", country: "United Arab Emirates" });
    expect(splitPortCountry("Karachi")).toEqual({ port: "Karachi", country: "" });
    expect(splitPortCountry("")).toEqual({ port: "", country: "" });
  });

  it("an empty document type registry never crashes processing: the module decides a built-in type", () => {
    expect(fallbackDocType(null, "purchase_orders", "business")).toMatchObject({ code: "purchase_contract", target_module: "purchase_orders", expected_fields: [] });
    expect(fallbackDocType("other_document", "sales_orders", "business").code).toBe("sales_contract");
    expect(fallbackDocType(null, null, null)).toMatchObject({ code: "other_document", operational_domain: "both" });
  });
});
