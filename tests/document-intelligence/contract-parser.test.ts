import { describe, expect, it } from "vitest";
import { parseTradeContract, parseNumber, normaliseDate } from "@/lib/document-intelligence/contract-parser";

// The contract from the Document Intake bug report (Dalian Sunshine → DGT LLC, no. 0907B).
const TABLE_CONTRACT = `DALIAN SUNSHINE IMP & EXP. CO., LTD.
SALES CONTRACT
Contract No.: 0907B
Date: 2026-09-05
The Seller: Dalian Sunshine Imp & Exp. Co., Ltd. (CHINA)
The Buyer: DGT LLC (UAE)
The Buyer and Seller have agreed to conclude this Sales Contract under the following terms and conditions:
DESCRIPTION QUANTITY (MT) UNIT PRICE (USD/MT) AMOUNT (USD)
Plastic Raw Material 50 1,200 60,000
Total 50 1,200 60,000
1. Payment Terms: T/T
2. Delivery Terms: CIF Dalian Port
3. Quality: As per Seller's standard
4. Packing: Standard export packing
For the Seller:
Dalian Sunshine Imp & Exp. Co., Ltd.
Date: 2026-09-05
For the Buyer:
DGT LLC (UAE)`;

const KEY_VALUE_CONTRACT = `SALES CONTRACT
Contract No.: 0907B
Date: 2026-09-05
Seller: Dalian Sunshine Imp & Exp. Co., Ltd.
Buyer: DGT LLC
Description: Plastic Raw Material
Quantity: 50 MT
Unit Price: USD 1,200
Total Amount: USD 60,000
Payment Terms: T/T
Delivery Terms: CIF Dalian Port`;

describe("parseTradeContract — the reported Dalian Sunshine contract", () => {
  it("reads seller, buyer, original contract number and date (table layout)", () => {
    const p = parseTradeContract(TABLE_CONTRACT);
    expect(p.isTradeContract).toBe(true);
    expect(p.sellerName).toBe("Dalian Sunshine Imp & Exp. Co., Ltd.");
    expect(p.sellerCountry).toBe("CHINA");
    expect(p.buyerName).toBe("DGT LLC");
    expect(p.buyerCountry).toBe("UAE");
    expect(p.contractNo).toBe("0907B");
    expect(p.contractDate).toBe("2026-09-05");
  });

  it("extracts the goods line and the 50 MT × USD 1,200 = USD 60,000 arithmetic", () => {
    const p = parseTradeContract(TABLE_CONTRACT);
    expect(p.goods).toHaveLength(1);
    const g = p.goods[0];
    expect(g.description).toBe("Plastic Raw Material");
    expect(g.quantity).toBe(50);
    expect(g.unit).toBe("MT");
    expect(g.unitPrice).toBe(1200);
    expect(g.amount).toBe(60000);
    expect(g.currency).toBe("USD");
    expect(g.consistent).toBe(true);
    expect(p.total).toEqual({ amount: 60000, source: "stated" });
    expect(p.currency).toBe("USD");
    expect(p.warnings).toEqual([]);
  });

  it("reads payment and delivery terms", () => {
    const p = parseTradeContract(TABLE_CONTRACT);
    expect(p.paymentTerms).toBe("T/T");
    expect(p.incoterm).toBe("CIF");
    expect(p.deliveryPlace).toBe("Dalian Port");
    expect(p.quality).toBe("As per Seller's standard");
    expect(p.packing).toBe("Standard export packing");
  });

  it("handles the key/value layout and still produces a total", () => {
    const p = parseTradeContract(KEY_VALUE_CONTRACT);
    expect(p.sellerName).toBe("Dalian Sunshine Imp & Exp. Co., Ltd.");
    expect(p.buyerName).toBe("DGT LLC");
    expect(p.goods[0]).toMatchObject({ description: "Plastic Raw Material", quantity: 50, unit: "MT", unitPrice: 1200, amount: 60000, currency: "USD" });
    expect(p.total?.amount).toBe(60000);
  });

  it("calculates the total from quantity × unit price when no total is printed, and says so", () => {
    const p = parseTradeContract(`Contract No.: C-1\nSeller: Acme Ltd\nBuyer: DGT LLC\nDescription: Resin\nQuantity: 50 MT\nUnit Price: USD 1,200\n`);
    expect(p.total).toEqual({ amount: 60000, source: "calculated" });
  });

  it("flags a printed amount that does not equal quantity × price", () => {
    const p = parseTradeContract(TABLE_CONTRACT.replace("Plastic Raw Material 50 1,200 60,000", "Plastic Raw Material 50 1,200 61,000").replace("Total 50 1,200 60,000", "Total 50 1,200 61,000"));
    expect(p.goods[0].consistent).toBe(false);
    expect(p.warnings.some((w) => /does not equal/.test(w))).toBe(true);
  });
});

describe("parseTradeContract — weights, transport refs, bank block", () => {
  const text = `PURCHASE CONTRACT
Contract No.: PC-77/2026
Seller: Sino Plastics Co.
Buyer: DGT LLC
Description: HDPE granules   HS Code: 3901.20
Lot No.: L-5521
Variety: Film grade
Gross Weight: 51,200 KG
Tare Weight: 1,200 KG
Net Weight: 50,000 KG
Truck No.: TL-9988
B/L No.: COSU1234567890
Container: MSKU1234567
Beneficiary: Sino Plastics Co.
Beneficiary Bank: Bank of China Dalian Branch
A/C No.: 1234 5678 9012 3456
SWIFT: BKCHCNBJ300
IBAN: DE89370400440532013000`;

  it("pulls weights, refs and bank details", () => {
    const p = parseTradeContract(text);
    expect(p.hsCode).toBe("390120");
    expect(p.lotNo).toBe("L-5521");
    expect(p.variety).toBe("Film grade");
    expect(p.grossWeight).toBe(51200);
    expect(p.tareWeight).toBe(1200);
    expect(p.netWeight).toBe(50000);
    expect(p.warnings.some((w) => /tare/i.test(w))).toBe(false);
    expect(p.truckNo).toBe("TL-9988");
    expect(p.blNo).toBe("COSU1234567890");
    expect(p.containerNos).toEqual(["MSKU1234567"]);
    expect(p.bank.beneficiary).toBe("Sino Plastics Co.");
    expect(p.bank.bankName).toBe("Bank of China Dalian Branch");
    expect(p.bank.accountNo).toBe("1234 5678 9012 3456");
    expect(p.bank.swift).toBe("BKCHCNBJ300");
    expect(p.bank.iban).toBe("DE89370400440532013000");
  });

  it("warns when gross − tare ≠ net", () => {
    const p = parseTradeContract(text.replace("Net Weight: 50,000 KG", "Net Weight: 49,000 KG"));
    expect(p.warnings.some((w) => /tare/i.test(w))).toBe(true);
  });
});

describe("helpers", () => {
  it("parses US, EU and plain numbers", () => {
    expect(parseNumber("USD 60,000")).toBe(60000);
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("abc")).toBeNull();
  });
  it("normalises dates", () => {
    expect(normaliseDate("2026-09-05")).toBe("2026-09-05");
    expect(normaliseDate("05/09/2026")).toBe("2026-09-05");
    expect(normaliseDate("5 September 2026")).toBe("2026-09-05");
    expect(normaliseDate("September 5, 2026")).toBe("2026-09-05");
  });
  it("is not fooled by an ordinary invoice with no seller/buyer pair", () => {
    expect(parseTradeContract("INVOICE\nTotal: 100").isTradeContract).toBe(false);
  });
});
