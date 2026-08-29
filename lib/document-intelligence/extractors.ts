/**
 * AI Document Intake — local heuristic field extractors.
 *
 * 100% local, deterministic regex/rule extraction over the OCR/text-layer output.
 * Every extracted value carries a confidence (0..1) and, where a page can be
 * identified, a page number. No external calls.
 */

import type { FieldCandidate, LineItemCandidate, OcrPage } from "./types";

const CURRENCIES = ["USD", "AED", "PKR", "AFN", "INR", "SAR", "EUR", "GBP", "CNY", "JPY", "QAR", "KWD", "BHD", "OMR", "IRR", "TRY"];
const CURRENCY_SYMBOLS: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "﷼": "SAR", "¥": "CNY", "درهم": "AED", "روپیہ": "PKR", "افغانی": "AFN" };

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function pageOf(pages: OcrPage[], needle: string): number | null {
  const n = needle.toLowerCase().slice(0, 40);
  for (const p of pages) if (p.text.toLowerCase().includes(n)) return p.pageNumber;
  return null;
}

function parseAmount(raw: string): number | null {
  const m = clean(raw).replace(/[^0-9.,-]/g, "");
  if (!m) return null;
  // handle 1.234,56 (eu) vs 1,234.56 (us)
  let v = m;
  if (/,\d{2}$/.test(v) && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normDate(raw: string): string | null {
  const s = clean(raw);
  // dd/mm/yyyy | dd-mm-yyyy | dd.mm.yyyy | yyyy-mm-dd | dd Mon yyyy
  let m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  // "8 September 2025" / "8-Sep-2025"
  m = s.match(/\b(\d{1,2})[ -]?([A-Za-z]{3,9})[ ,-]?(\d{4})\b/);
  if (m) {
    const mi = months.indexOf(m[2].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  // "September 8, 2025" / "September 8. 2025" / "Sept 8th 2025" (month first)
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[.,]?\s+(\d{4})\b/);
  if (m) {
    const mi = months.indexOf(m[1].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

type Rule = {
  key: string;
  label: string;
  patterns: RegExp[];
  kind?: "date" | "amount" | "currency" | "text" | "container" | "hs";
  required?: boolean;
  // when set, the rule only runs for these doc-type codes (keeps e.g. cheque
  // status off a purchase contract that merely mentions "cancel this contract")
  onlyDocTypes?: string[];
};

const FINANCE_DOCS = ["cheque_image", "bank_transfer_advice", "payment_confirmation", "cash_receipt", "advance_receipt", "sales_receipt", "payment_confirmation"];

// Ordered — earlier, more specific patterns win.
const RULES: Rule[] = [
  { key: "invoice_number", label: "Invoice Number", patterns: [/invoice\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i, /\binv[\s\-#:]*([A-Z0-9][A-Z0-9/\-.]{3,30})/i] },
  { key: "contract_number", label: "Contract Number", patterns: [/contract\s*(?:no\.?|number|#|ref)[:./_\s-]*\b([A-Z]{2,5}[-/]?\d{2,6}[-/]\d{2,6}|[A-Z]{2,5}-?\d{4,8})\b/i, /contract\s*(?:no\.?|number|#|ref)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i, /\bcon[\s\-#:]*([0-9]{3,10})/i] },
  { key: "manual_contract_number", label: "Manual Contract / Bill Number", patterns: [/(?:manual|reference)\s*(?:contract|bill)\s*(?:no\.?)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i] },
  { key: "booking_number", label: "Booking Number", patterns: [/booking\s*(?:no\.?|number|ref|confirmation)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i] },
  { key: "po_number", label: "Purchase Order Number", patterns: [/(?:purchase\s*order|p\.?o\.?)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i] },
  { key: "so_number", label: "Sales Order Number", patterns: [/(?:sales\s*order|s\.?o\.?)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30})/i] },
  { key: "bl_number", label: "Bill of Lading Number", patterns: [/(?:b\/?l|bill\s*of\s*lading|awb|hbl|mbl)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{4,30})/i] },
  { key: "customs_reference", label: "Customs Reference / GD No", patterns: [/(?:gd|goods\s*declaration|bill\s*of\s*entry|customs\s*(?:ref|declaration))\s*(?:no\.?)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{3,30})/i] },
  { key: "document_date", label: "Document Date", kind: "date", patterns: [/(?:date|dated|invoice\s*date|document\s*date)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|[A-Za-z]{3,9}\.?\s+[0-3]?\d(?:st|nd|rd|th)?[.,]?\s+\d{4})/i] },
  { key: "due_date", label: "Due Date", kind: "date", patterns: [/(?:due\s*date|payment\s*due|maturity)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i] },
  { key: "eta", label: "ETA", kind: "date", patterns: [/\beta\b\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i] },
  { key: "etd", label: "ETD", kind: "date", patterns: [/\betd\b\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i] },
  { key: "currency", label: "Currency", kind: "currency", patterns: [/\b(USD|AED|PKR|AFN|INR|SAR|EUR|GBP|CNY|JPY|QAR|KWD|BHD|OMR|IRR|TRY)\b/] },
  { key: "grand_total", label: "Grand Total", kind: "amount", patterns: [/(?:grand\s*total|total\s*amount|total\s*value|contract\s*(?:value|amount)|amount\s*due|invoice\s*total|total\s*payable|net\s*payable|amount\s*(?:transferred|paid|received)|transfer\s*(?:currency\s*&?\s*amount|amount))\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,]{2,15}(?:\.\d{2})?)/i, /\bamount\s*[:.]\s*(?:[A-Z]{3}\s*)?([0-9][0-9,]{2,15}\.\d{2})/i, /\b(?:USD|AED|PKR|AFN|INR|EUR|GBP|CNY)\s?([0-9]{1,3}(?:,[0-9]{3})+\.\d{2})\b/] },
  { key: "subtotal", label: "Subtotal", kind: "amount", patterns: [/(?:sub\s*total|sub-total|net\s*amount)\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "freight_amount", label: "Freight", kind: "amount", patterns: [/(?:ocean\s*freight|freight\s*charges?|freight)\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "insurance_amount", label: "Insurance", kind: "amount", patterns: [/(?:insurance|marine\s*insurance)\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "tax_amount", label: "Tax / VAT", kind: "amount", patterns: [/(?:vat|tax|gst|sales\s*tax)\s*(?:@?\s*\d+%?)?\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "advance_amount", label: "Advance / Deposit", kind: "amount", patterns: [/(?:advance\s*(?:payment|paid|amount)?|deposit|down\s*payment)\s*(?:of\s*)?(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,]{2,15}(?:\.\d{2})?)/i, /\d{1,3}%\s*(?:deposit|advance)\s*(?:[A-Z]{3})?\s*([0-9][0-9,]{2,15}(?:\.\d{2})?)/i] },
  { key: "paid_amount", label: "Paid Amount", kind: "amount", patterns: [/(?:amount\s*paid|paid\s*amount|received)\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "balance_amount", label: "Remaining Balance", kind: "amount", patterns: [/(?:balance\s*(?:due|amount)?|remaining|outstanding)\s*[:.\-]?\s*(?:[A-Z]{3}|[$€£₹﷼])?\s*([0-9][0-9,.\s]{2,20})/i] },
  { key: "exchange_rate", label: "Exchange Rate", kind: "amount", patterns: [/(?:exchange\s*rate|rate\s*of\s*exchange|fx\s*rate|conversion\s*rate)\s*[:.\-]?\s*([0-9]+\.?[0-9]*)/i] },
  { key: "vessel", label: "Vessel", kind: "text", patterns: [/(?:vessel|ship\s*name|carrier\s*vessel)\s*(?:name)?\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9 .\-]{2,32}?)(?=\s{2,}|\s*(?:voyage|voy|b\/?l|date|$)|\n)/i] },
  { key: "voyage", label: "Voyage", kind: "text", patterns: [/(?:voyage|voy\.?)\s*(?:no\.?)?\s*[:.\-]?\s*([A-Z0-9\-]{2,15})/i] },
  { key: "port_of_loading", label: "Port of Loading", kind: "text", patterns: [/(?:port\s*of\s*loading|pol|load\s*port)\s*[:.\-]?\s*([A-Za-z][A-Za-z ,.\-]{2,32}?)(?=\s{2,}|\s*(?:port\s*of|pod|$)|\n)/i] },
  { key: "port_of_discharge", label: "Port of Discharge", kind: "text", patterns: [/(?:port\s*of\s*discharge|pod|discharge\s*port|destination\s*port)\s*[:.\-]?\s*([A-Za-z][A-Za-z ,.\-]{2,32}?)(?=\s{2,}|\s*(?:vessel|voyage|$)|\n)/i] },
  { key: "shipping_line", label: "Shipping Line", kind: "text", patterns: [/(?:shipping\s*line|carrier\s*(?:name|vessel)|line\s*name)\s*[:.\-]\s*([A-Za-z0-9][A-Za-z0-9 .\-&]{2,40})/i] },
  { key: "shipper", label: "Shipper", kind: "text", patterns: [/shipper\s*[:.\-]?\s*\n?\s*([A-Za-z0-9 .,&()\-]{4,60})/i] },
  { key: "consignee", label: "Consignee", kind: "text", patterns: [/consignee\s*[:.\-]?\s*\n?\s*([A-Za-z0-9 .,&()\-]{4,60})/i] },
  { key: "supplier_name", label: "Supplier / Seller", kind: "text", patterns: [/(?:supplier|seller|from|beneficiary|exporter)\s*[:.\-]?\s*\n?\s*([A-Za-z0-9 .,&()\-]{4,60})/i] },
  { key: "customer_name", label: "Customer / Buyer", kind: "text", patterns: [/(?:customer|buyer|bill\s*to|sold\s*to|consignee|importer)\s*[:.\-]?\s*\n?\s*([A-Za-z0-9 .,&()\-]{4,60})/i] },
  { key: "payment_terms", label: "Payment Terms", kind: "text", patterns: [/(?:payment\s*terms?|terms\s*of\s*payment)\s*[:.\-]?\s*([A-Za-z0-9 %,./\-]{3,60})/i] },
  { key: "delivery_terms", label: "Delivery Terms / Incoterm", kind: "text", patterns: [/\b(FOB|CIF|CFR|CPT|CIP|DAP|DDP|EXW|FCA|FAS)\b[ ,-]?([A-Za-z ]{0,25})/ ] },
  { key: "trn", label: "TRN / Tax Registration", kind: "text", patterns: [
      /\b(?:trn|tax\s*registration\s*(?:no\.?|number)?|vat\s*(?:reg\.?\s*)?no\.?|ntn|gst\s*(?:reg\.?\s*)?no\.?)\s*[:.\-#]*\s*([0-9][0-9\- ]{6,18}[0-9]|[0-9]{7,15})/i,
    ] },
  { key: "payment_method", label: "Payment Method", kind: "text", patterns: [/\b(cash|bank\s*transfer|telegraphic\s*transfer|wire\s*transfer|cheque|check|online\s*transfer|card|pos)\b/i] },
  { key: "cheque_number", label: "Cheque Number", kind: "text", onlyDocTypes: FINANCE_DOCS, patterns: [/(?:cheque|check)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([0-9]{4,12})/i] },
  { key: "cheque_status", label: "Cheque Status", kind: "text", onlyDocTypes: FINANCE_DOCS, patterns: [/\b(post\s*dated|pdc|cleared|honou?red|dishonou?red|bounced|returned|cancelled|stop\s*payment)\b/i] },
  { key: "bank_name", label: "Bank Name", kind: "text", patterns: [/\b((?:[A-Z][A-Za-z]+\s+){1,4}Bank(?:\s+(?:Corp(?:oration)?|Ltd|Limited|PLC|Branch|[A-Z][a-z]+\s+Branch))?)\b/] },
  { key: "value_date", label: "Value Date", kind: "date", patterns: [/(?:value\s*date|settlement\s*date)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i] },

  // ── master-data fields (Company / Customer / Bank / Contract intake) ──
  { key: "company_name", label: "Company / Entity Name", kind: "text", patterns: [
      /(?:company\s*name|legal\s*name|name\s*of\s*(?:company|entity|firm|establishment)|entity\s*name|registered\s*name)\s*[:.\-]?\s*\n?\s*([A-Za-z0-9][A-Za-z0-9 .,&()'\-]{3,70})/i,
      /\b([A-Z][A-Za-z0-9 .,&()'\-]{3,60}\s(?:LLC|L\.L\.C\.|LLP|FZE|FZ-LLC|FZCO|PLC|Pvt\.?\s*Ltd\.?|Private\s*Limited|Limited|Inc\.?|Corporation|Trading|General\s*Trading|Est(?:ablishment)?\.?))\b/,
    ] },
  { key: "company_type", label: "Legal Structure", kind: "text", patterns: [/\b(LLC|L\.L\.C\.|LLP|FZE|FZ-LLC|FZCO|Free\s*Zone\s*(?:Company|Establishment)|Sole\s*Proprietor(?:ship)?|Partnership|Private\s*Limited|Public\s*Limited|Branch\s*Office|Establishment)\b/i] },
  { key: "registration_number", label: "Registration / License No.", kind: "text", patterns: [
      /(?:trade\s*licen[sc]e|licen[sc]e|commercial\s*registration|c\.?r\.?|cr\s*no|registration\s*(?:no\.?|number)|reg\.?\s*no|incorporation\s*(?:no\.?|number)|iec\s*(?:code|no)?)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-]{3,25})/i,
    ] },
  { key: "incorporation_date", label: "Incorporation / Issue Date", kind: "date", patterns: [/(?:incorporat(?:ion|ed)|date\s*of\s*(?:incorporation|establishment|issue|registration)|issue\s*date|establishment\s*date)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|[A-Za-z]{3,9}\.?\s+[0-3]?\d(?:st|nd|rd|th)?[.,]?\s+\d{4})/i] },
  { key: "owner_name", label: "Owner / Proprietor / Manager", kind: "text", patterns: [/(?:owner|proprietor|manager|managing\s*director|authorized\s*signatory|partner|shareholder|director)\s*(?:name)?\s*[:.\-]?\s*\n?\s*([A-Za-z][A-Za-z .'\-]{4,50})/i] },
  { key: "father_name", label: "Father / Guardian Name", kind: "text", patterns: [/(?:father(?:'s)?\s*name|s\/o|son\s*of|d\/o|daughter\s*of|guardian)\s*[:.\-]?\s*([A-Za-z][A-Za-z .'\-]{3,50})/i] },
  { key: "national_id", label: "National ID / CNIC / Passport", kind: "text", patterns: [/(?:cnic|nic|national\s*id(?:entity)?(?:\s*card)?|emirates\s*id|passport\s*(?:no\.?|number)|id\s*card\s*no)\s*[:.\-]?\s*([0-9A-Z][0-9A-Z\-]{5,25})/i] },
  { key: "phone", label: "Phone / Mobile", kind: "text", patterns: [/(?:phone|tel(?:ephone)?|mobile|cell|contact\s*(?:no\.?|number))\s*[:.\-]?\s*(\+?[0-9][0-9()\s\-]{6,20}[0-9])/i] },
  { key: "email", label: "Email", kind: "text", patterns: [/(?:e-?mail)\s*[:.\-]?\s*([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/i, /\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/] },
  { key: "website", label: "Website", kind: "text", patterns: [/(?:website|web|url)\s*[:.\-]?\s*((?:https?:\/\/)?(?:www\.)?[A-Za-z0-9.\-]+\.[A-Za-z]{2,}(?:\/\S*)?)/i, /\b((?:https?:\/\/)?www\.[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/] },
  { key: "address", label: "Address", kind: "text", patterns: [/(?:address|registered\s*office|office\s*address|located\s*at|p\.?o\.?\s*box)\s*[:.\-]?\s*\n?\s*([A-Za-z0-9][A-Za-z0-9 .,#/()\-]{8,90})/i] },
  { key: "account_number", label: "Bank Account Number", kind: "text", patterns: [/(?:a\/?c\s*(?:no\.?|number)|account\s*(?:no\.?|number)|acct\s*no)\s*[:.\-]?\s*([0-9][0-9\- ]{6,28}[0-9])/i] },
  { key: "account_title", label: "Account Title / Holder", kind: "text", patterns: [/(?:account\s*(?:title|holder|name)|title\s*of\s*account|a\/?c\s*(?:title|name))\s*[:.\-]?\s*\n?\s*([A-Za-z0-9][A-Za-z0-9 .,&()'\-]{3,60})/i] },
  { key: "iban", label: "IBAN", kind: "text", patterns: [/\b(?:iban\s*[:.\-]?\s*)?([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/] },
  { key: "swift_bic", label: "SWIFT / BIC", kind: "text", patterns: [/(?:swift(?:\s*code)?|bic)\s*[:.\-]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i] },
  { key: "branch_name", label: "Bank Branch", kind: "text", patterns: [/(?:branch(?:\s*name)?|branch\s*office)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9 .,&()\-]{3,45})/i] },
  { key: "contract_start_date", label: "Contract Start / Effective Date", kind: "date", patterns: [/(?:effective\s*(?:date|from)|commencement\s*date|start\s*date|valid\s*from|w\.?e\.?f\.?|agreement\s*date)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|[A-Za-z]{3,9}\.?\s+[0-3]?\d(?:st|nd|rd|th)?[.,]?\s+\d{4})/i] },
  { key: "contract_end_date", label: "Contract End / Expiry Date", kind: "date", patterns: [/(?:expiry\s*date|expiration|end\s*date|valid\s*(?:to|until|till)|termination\s*date|renewal\s*date)\s*[:.\-]?\s*([0-3]?\d[-/. ][A-Za-z0-9]{2,9}[-/. ]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|[A-Za-z]{3,9}\.?\s+[0-3]?\d(?:st|nd|rd|th)?[.,]?\s+\d{4})/i] },
  { key: "contract_parties", label: "Contract Parties", kind: "text", patterns: [/(?:between)\s+([A-Za-z0-9][A-Za-z0-9 .,&()'\-]{3,60})\s+(?:and|&)\s+([A-Za-z0-9][A-Za-z0-9 .,&()'\-]{3,60})/i] },
];

const CONTAINER_RE = /\b([A-Z]{4}\d{7})\b/g;
const SEAL_RE = /\bseal\s*(?:no\.?)?\s*[:.\-]?\s*([A-Z0-9\-]{4,15})/gi;
// HS / tariff code: 4 digits, then a dot, then 2 digits, optionally a dot + 2-4
// more. Must NOT be preceded by a digit/comma/currency (rules out amounts like
// "250,000.00" / "USD 1234.56").
const HS_RE = /(?<![\d.,]\s?)(?<!USD |AED |PKR |EUR |GBP |INR )\b(\d{4}\.\d{2}(?:\.\d{2,4})?)\b/g;

export function extractFields(text: string, pages: OcrPage[], docTypeCode: string): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: FieldCandidate) => {
    if (seen.has(c.key)) return;
    seen.add(c.key);
    out.push(c);
  };

  for (const rule of RULES) {
    if (rule.onlyDocTypes && !rule.onlyDocTypes.includes(docTypeCode)) continue;
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (!m) continue;
      const rawGroup = rule.key === "currency" ? m[1] : (m[1] || m[0]);
      const raw = clean(rawGroup);
      if (!raw) continue;
      let normalized: string | null = raw;
      let confidence = 0.72;
      if (rule.kind === "date") { normalized = normDate(raw); confidence = normalized ? 0.8 : 0.45; }
      else if (rule.kind === "amount") { const n = parseAmount(raw); normalized = n == null ? null : String(n); confidence = n == null ? 0.4 : 0.78; }
      else if (rule.kind === "currency") { normalized = raw.toUpperCase(); confidence = CURRENCIES.includes(normalized) ? 0.9 : 0.5; }
      const status: FieldCandidate["validationStatus"] = confidence >= 0.8 ? "green" : confidence >= 0.55 ? "amber" : "red";
      push({
        key: rule.key,
        label: rule.label,
        rawValue: raw,
        normalizedValue: normalized,
        confidence,
        pageNumber: pageOf(pages, raw) ?? pageOf(pages, m[0]),
        bbox: null,
        validationStatus: status,
        validationMessage: normalized == null ? "Could not normalise the extracted value — please confirm." : null,
      });
      break;
    }
  }

  // currency from symbol fallback
  if (!seen.has("currency")) {
    for (const [sym, cur] of Object.entries(CURRENCY_SYMBOLS)) {
      if (text.includes(sym)) {
        push({ key: "currency", label: "Currency", rawValue: sym, normalizedValue: cur, confidence: 0.55, pageNumber: pageOf(pages, sym), bbox: null, validationStatus: "amber", validationMessage: "Inferred from a currency symbol — please confirm." });
        break;
      }
    }
  }

  // containers (multi)
  const containers = [...new Set([...text.matchAll(CONTAINER_RE)].map((m) => m[1]))];
  if (containers.length) {
    push({ key: "container_numbers", label: "Container Numbers", rawValue: containers.join(", "), normalizedValue: containers.join(","), confidence: 0.85, pageNumber: pageOf(pages, containers[0]), bbox: null, validationStatus: "green", validationMessage: `${containers.length} container number(s) detected.` });
  }
  const seals = [...new Set([...text.matchAll(SEAL_RE)].map((m) => clean(m[1])))].filter(Boolean);
  if (seals.length) {
    push({ key: "seal_numbers", label: "Seal Numbers", rawValue: seals.join(", "), normalizedValue: seals.join(","), confidence: 0.7, pageNumber: null, bbox: null, validationStatus: "amber", validationMessage: null });
  }
  // Only trust HS codes that are dotted (4.6.8 form) or explicitly labelled — a
  // bare 8-digit run is just as likely a phone/fax/account number.
  const hsLabelled = /\b(?:h\.?s\.?\s*code|hs\s*code|tariff\s*(?:code|heading)|commodity\s*code)\b/i.test(text);
  const hs = [...new Set([...text.matchAll(HS_RE)]
    .filter((m) => m[0].includes(".") || hsLabelled)
    .map((m) => m[1].replace(/\./g, "")))].filter((x) => x.length >= 6 && x.length <= 10);
  if (hs.length) {
    push({ key: "hs_codes", label: "HS Codes", rawValue: hs.join(", "), normalizedValue: hs.join(","), confidence: 0.62, pageNumber: null, bbox: null, validationStatus: "amber", validationMessage: null });
  }

  return out;
}

/**
 * Very light table-row heuristic for goods lines: rows that end in
 * `<qty> <unit?> <unit_price> <amount>` or contain a description + a trailing number.
 */
export function extractLineItems(text: string, pages: OcrPage[]): LineItemCandidate[] {
  const rows: LineItemCandidate[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let lineNo = 0;
  const rowRe = /^(.{4,80}?)\s+([0-9][0-9,.]*)\s*(kg|kgs|pcs|pc|ctn|cartons?|units?|mt|tons?|bags?|drums?|rolls?)?\s+([0-9][0-9,.]*)\s+([0-9][0-9,.]*)\s*$/i;
  for (const l of lines) {
    const m = l.match(rowRe);
    if (!m) continue;
    const desc = clean(m[1]);
    if (/total|subtotal|amount|balance|vat|tax|freight/i.test(desc)) continue;
    // banking / contact lines end in digit groups too — not goods rows
    if (/a[j\/]?c\s*(?:no|number)|account|beneficiary|swift|iban|routing|\bbank\b|\btel\b|\bfax\b|phone|mobile|licen[sc]e/i.test(desc)) continue;
    // reject rows that are essentially a digit string (account/ref numbers)
    if ((desc.replace(/[^0-9]/g, "").length / Math.max(desc.length, 1)) > 0.5) continue;
    lineNo += 1;
    rows.push({
      lineNo,
      description: desc,
      hsCode: (desc.match(HS_RE) || [])[0]?.replace(/\./g, "") || null,
      brand: null,
      quantity: parseAmount(m[2]),
      unit: m[3] ? m[3].toLowerCase() : null,
      packages: null,
      grossWeight: null,
      netWeight: null,
      unitPrice: parseAmount(m[4]),
      amount: parseAmount(m[5]),
      currency: null,
      confidence: 0.55,
      pageNumber: pageOf(pages, desc),
    });
    if (lineNo >= 200) break;
  }
  return rows;
}

/** Keyword-scored classification against the registry. Returns 0..1 confidence. */
export function classifyByKeywords(
  text: string,
  registry: Array<{ code: string; name: string; operational_domain: "business" | "shipping" | "both"; category: string; target_module: string | null; classifier_keywords: string[]; requires_qvc: boolean; min_confidence: number }>,
  domainHint?: "business" | "shipping" | null,
) {
  const lc = text.toLowerCase();
  const scores = registry.map((d) => {
    let hits = 0;
    for (const kw of d.classifier_keywords) if (kw && lc.includes(kw.toLowerCase())) hits += 1;
    let score = d.classifier_keywords.length ? hits / Math.max(3, d.classifier_keywords.length) : 0;
    if (domainHint && d.operational_domain !== "both" && d.operational_domain !== domainHint) score *= 0.4;
    return { code: d.code, score: Math.min(1, score), def: d };
  }).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const other = registry.find((d) => d.code === "other_document")!;
  if (!top || top.score < 0.15) {
    return {
      code: "other_document", name: other?.name ?? "Other / Unclassified", confidence: 0.2,
      domain: "both" as const, category: "other", targetModule: null, requiresQvc: true,
      scores: scores.slice(0, 5).map((s) => ({ code: s.code, score: Number(s.score.toFixed(2)) })),
    };
  }
  return {
    code: top.def.code, name: top.def.name, confidence: Number(top.score.toFixed(2)),
    domain: top.def.operational_domain, category: top.def.category, targetModule: top.def.target_module,
    requiresQvc: top.def.requires_qvc || top.score < top.def.min_confidence,
    scores: scores.slice(0, 5).map((s) => ({ code: s.code, score: Number(s.score.toFixed(2)) })),
  };
}
