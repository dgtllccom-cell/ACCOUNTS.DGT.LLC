import { classifyByKeywords, extractFields, extractLineItems } from "../lib/document-intelligence/extractors";

const sample = `
COMMERCIAL INVOICE

Invoice No: INV-2026-0453        Date: 12/07/2026
Contract No: CON-1001            Payment Due: 11-Aug-2026
Supplier: Golden Rice Trading LLC
Buyer: Digital Dock General Trading, Dubai

Currency: AED     Exchange Rate: 3.6725
PORT OF LOADING: Karachi        PORT OF DISCHARGE: Jebel Ali
Vessel: MSC ARIANE   Voyage: 214W
B/L No: MEDUXY123456
Container Numbers: MSCU1234567, TGHU7654321

Description            Qty   Unit   Unit Price   Amount
Basmati Rice 1121      1000  bags   45.00        45000.00
Sella Rice            500   bags   38.00        19000.00

Sub Total: AED 64,000.00
VAT 5%: AED 3,200.00
Freight: AED 2,500.00
Grand Total: AED 69,700.00
Advance Paid: AED 20,000.00
Balance Due: AED 49,700.00
HS Code: 1006.30.00
TRN: 100234567800003
`;

const registry = [
  { code: "commercial_invoice", name: "Commercial / Supplier Invoice", operational_domain: "business" as const, category: "purchase", target_module: "purchase_orders", classifier_keywords: ["commercial invoice", "supplier invoice", "tax invoice", "invoice no"], requires_qvc: true, min_confidence: 0.6 },
  { code: "bill_of_lading", name: "Bill of Lading", operational_domain: "shipping" as const, category: "shipping", target_module: "shipping_bl_records", classifier_keywords: ["bill of lading", "b/l no", "shipper", "consignee", "vessel", "voyage"], requires_qvc: false, min_confidence: 0.6 },
  { code: "other_document", name: "Other", operational_domain: "both" as const, category: "other", target_module: null, classifier_keywords: [], requires_qvc: true, min_confidence: 0.6 },
];

const cls = classifyByKeywords(sample, registry, "business");
console.log("CLASSIFY:", JSON.stringify(cls));
const fields = extractFields(sample, [{ pageNumber: 1, text: sample }], cls.code);
console.log("\nFIELDS:");
for (const f of fields) console.log(`  [${f.validationStatus}] ${f.key} = ${JSON.stringify(f.normalizedValue ?? f.rawValue)}  (conf ${f.confidence})`);
const lines = extractLineItems(sample, [{ pageNumber: 1, text: sample }]);
console.log("\nLINE ITEMS:", JSON.stringify(lines, null, 1));
