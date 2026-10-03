/**
 * Trade-contract / commercial-document parser (deterministic, local, no AI).
 *
 * Reads the text layer (or OCR text) of a sales / purchase contract and returns the structured trade
 * facts: seller, buyer, original contract number + date, the goods table (qty × unit price = amount),
 * totals, terms, weights, transport refs and the beneficiary bank block.
 *
 * It deliberately does NOT decide "who is our supplier": a contract says Seller / Buyer; whether that is
 * OUR purchase or OUR sale is decided by the module the user picked (see intake-modules.ts).
 */

export type ParsedGoodsLine = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number | null;
  currency: string | null;
  hsCode: string | null;
  /** qty × unit price == amount (within 0.5 %); null when it cannot be checked */
  consistent: boolean | null;
};

export type ParsedBank = {
  beneficiary: string | null;
  bankName: string | null;
  branch: string | null;
  accountNo: string | null;
  iban: string | null;
  swift: string | null;
  address: string | null;
};

export type ContractParse = {
  isTradeContract: boolean;
  sellerName: string | null;
  sellerCountry: string | null;
  buyerName: string | null;
  buyerCountry: string | null;
  contractNo: string | null;
  contractDate: string | null;
  goods: ParsedGoodsLine[];
  currency: string | null;
  /** stated = printed on the document; lines = sum of the goods lines; calculated = qty × price */
  total: { amount: number; source: "stated" | "lines" | "calculated" } | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  incoterm: string | null;
  deliveryPlace: string | null;
  quality: string | null;
  packing: string | null;
  hsCode: string | null;
  lotNo: string | null;
  variety: string | null;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  truckNo: string | null;
  containerNos: string[];
  blNo: string | null;
  bank: ParsedBank;
  warnings: string[];
};

const CUR = "USD|AED|PKR|AFN|INR|SAR|EUR|GBP|CNY|RMB|JPY|QAR|KWD|BHD|OMR|IRR|TRY";
const UNIT = "MT|M\\.?T\\.?|KGS?|TONS?|TONNES?|PCS?|BAGS?|CTNS?|CARTONS?|DRUMS?|ROLLS?|UNITS?|LBS?|CBM";
const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

const clean = (s: string | null | undefined) => (s ?? "").replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, " ").trim();

export function parseNumber(raw: string | null | undefined): number | null {
  const m = clean(raw).replace(/[^0-9.,-]/g, "");
  if (!m) return null;
  let v = m;
  // 1.234,56 (EU) vs 1,234.56 (US) vs 1,234 vs 1234,5
  if (/,\d{1,2}$/.test(v) && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(v)) v = v.replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normaliseDate(raw: string | null | undefined): string | null {
  const s = clean(raw);
  let m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[ -]?([A-Za-z]{3,9})\.?[ ,-]*(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[.,]?\s+(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

/** value after `Label:` on the same line (or the next line when the label ends the line). */
function labelled(text: string, labels: string, stopAt?: RegExp): string | null {
  const re = new RegExp(`(?:^|[\\n\\r]|\\s{2,}|\\b)(?:${labels})\\s*[:：]\\s*([^\\n\\r]*)(?:\\r?\\n\\s*([^\\n\\r:：]{3,90}))?`, "i");
  const m = text.match(re);
  if (!m) return null;
  let v = clean(m[1]);
  if (!v && m[2]) v = clean(m[2]);
  if (!v) return null;
  if (stopAt) v = clean(v.split(stopAt)[0]);
  // two or more spaces usually separate a second label/column on the same visual row
  v = clean(v.split(/\s{3,}/)[0]);
  return v || null;
}

function splitCountry(name: string | null): { name: string | null; country: string | null } {
  if (!name) return { name: null, country: null };
  const m = name.match(/^(.*?)[\s,]*\(\s*([A-Za-z][A-Za-z .]{1,30})\s*\)\s*$/);
  if (m) return { name: clean(m[1]).replace(/[,;]+$/, ""), country: clean(m[2]) };
  return { name: name.replace(/[,;]+$/, ""), country: null };
}

const NUM = "[0-9][0-9,]*(?:\\.\\d+)?";

function parseGoods(text: string): { goods: ParsedGoodsLine[]; totalRow: { quantity: number | null; amount: number | null } | null; currency: string | null; unit: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, " ").trim());
  let currency: string | null = null;
  let unit: string | null = null;
  const goods: ParsedGoodsLine[] = [];
  let totalRow: { quantity: number | null; amount: number | null } | null = null;

  // 1. Table form: header row naming DESCRIPTION / QUANTITY / UNIT PRICE / AMOUNT.
  const hi = lines.findIndex((l) => /descri|goods|commodity|item/i.test(l) && /quantity|qty/i.test(l) && /(unit\s*price|price|rate)/i.test(l));
  if (hi >= 0) {
    const header = lines.slice(hi, hi + 2).join(" ");
    const cm = header.match(new RegExp(`\\b(${CUR})\\b`, "i"));
    if (cm) currency = cm[1].toUpperCase() === "RMB" ? "CNY" : cm[1].toUpperCase();
    const um = header.match(new RegExp(`(?:quantity|qty)\\s*\\(\\s*(${UNIT})\\s*\\)`, "i"));
    if (um) unit = um[1].toUpperCase().replace(/\./g, "");
    for (let i = hi + 1; i < Math.min(lines.length, hi + 40); i++) {
      const l = lines[i];
      if (!l) continue;
      const row = l.match(new RegExp(`^(.*?\\S)\\s+(${NUM})\\s*(${UNIT})?\\s+(?:${CUR}\\s*)?(${NUM})\\s*(?:/\\s*(?:${UNIT}))?\\s+(?:${CUR}\\s*)?(${NUM})\\s*$`, "i"));
      if (!row) {
        // header continuation lines such as "(MT) (USD/MT) (USD)"
        if (/^[()A-Za-z/ ]{0,40}$/.test(l) && /\(\s*[A-Za-z/]+\s*\)/.test(l)) {
          const cm2 = l.match(new RegExp(`\\b(${CUR})\\b`, "i"));
          if (cm2 && !currency) currency = cm2[1].toUpperCase();
          const um2 = l.match(new RegExp(`\\(\\s*(${UNIT})\\s*\\)`, "i"));
          if (um2 && !unit) unit = um2[1].toUpperCase();
          continue;
        }
        if (goods.length && /^(?:\d+\.|payment|delivery|terms|quality|packing|the\s+seller|bank|remarks)/i.test(l)) break;
        continue;
      }
      const desc = clean(row[1]);
      const qty = parseNumber(row[2]);
      const price = parseNumber(row[4]);
      const amt = parseNumber(row[5]);
      if (/^total\b/i.test(desc)) {
        totalRow = { quantity: qty, amount: amt };
        break;
      }
      const rowUnit = row[3] ? row[3].toUpperCase().replace(/\./g, "") : unit;
      goods.push({
        description: desc,
        quantity: qty,
        unit: rowUnit,
        unitPrice: price,
        amount: amt,
        currency,
        hsCode: null,
        consistent: qty != null && price != null && amt != null ? Math.abs(qty * price - amt) <= Math.max(0.5, Math.abs(amt) * 0.005) : null,
      });
    }
  }

  // 2. Key/value form: "Description: X  Quantity: 50 MT  Unit Price: USD 1,200  Total Amount: USD 60,000".
  if (!goods.length) {
    const desc = labelled(text, "description(?:\\s+of\\s+goods)?|commodity|goods|product|name\\s+of\\s+commodity", /\s+(?:quantity|qty)\b/i);
    const q = text.match(new RegExp(`(?:quantity|qty)\\s*[:：]?\\s*(${NUM})\\s*(${UNIT})?`, "i"));
    const p = text.match(new RegExp(`(?:unit\\s*price|price)\\s*[:：]?\\s*(?:(${CUR})\\s*)?(${NUM})(?:\\s*/\\s*(${UNIT}))?`, "i"));
    const a = text.match(new RegExp(`(?:total\\s*(?:amount|value|price)|contract\\s*(?:value|amount)|amount)\\s*[:：]?\\s*(?:(${CUR})\\s*)?(${NUM})`, "i"));
    // inline: "50 MT x USD 1,200/MT = USD 60,000"
    const inline = text.match(new RegExp(`(${NUM})\\s*(${UNIT})\\s*[x×*@]\\s*(?:(${CUR})\\s*)?(${NUM})(?:\\s*/\\s*(?:${UNIT}))?(?:\\s*=\\s*(?:(?:${CUR})\\s*)?(${NUM}))?`, "i"));
    const qty = q ? parseNumber(q[1]) : inline ? parseNumber(inline[1]) : null;
    const price = p ? parseNumber(p[2]) : inline ? parseNumber(inline[4]) : null;
    const amt = a ? parseNumber(a[2]) : inline && inline[5] ? parseNumber(inline[5]) : null;
    const cur = (p?.[1] || a?.[1] || inline?.[3] || null)?.toUpperCase() ?? null;
    if (desc && (qty != null || price != null || amt != null)) {
      if (cur) currency = cur === "RMB" ? "CNY" : cur;
      const u = (q?.[2] || p?.[3] || inline?.[2] || null)?.toUpperCase().replace(/\./g, "") ?? null;
      goods.push({
        description: desc,
        quantity: qty,
        unit: u,
        unitPrice: price,
        amount: amt,
        currency,
        hsCode: null,
        consistent: qty != null && price != null && amt != null ? Math.abs(qty * price - amt) <= Math.max(0.5, Math.abs(amt) * 0.005) : null,
      });
      unit = u;
    }
  }
  return { goods, totalRow, currency, unit };
}

export function parseTradeContract(text: string): ContractParse {
  const t = (text ?? "").replace(/\r/g, "");
  const warnings: string[] = [];

  const sellerRaw = labelled(t, "(?:the\\s+)?seller|supplier|exporter|party\\s*a", /\s+(?:the\\s+)?buyer\s*[:：]/i);
  const buyerRaw = labelled(t, "(?:the\\s+)?buyer|purchaser|importer|party\\s*b", /\s+(?:the\\s+)?seller\s*[:：]/i);
  const seller = splitCountry(sellerRaw);
  const buyer = splitCountry(buyerRaw);

  const contractNoM = t.match(/contract\s*(?:no\.?|number|#)\s*[:：.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{1,30})/i);
  const contractNo = contractNoM ? contractNoM[1].replace(/[.,;]+$/, "") : null;
  let contractDate: string | null = null;
  for (const dm of t.matchAll(/(?:^|\s)(?:contract\s*)?date\s*[:：]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}|[0-3]?\d(?:st|nd|rd|th)?[ -][A-Za-z]{3,9}\.?[ ,-]*\d{4}|[A-Za-z]{3,9}\.?\s+[0-3]?\d(?:st|nd|rd|th)?[.,]?\s+\d{4})/gim)) {
    const before = t.slice(Math.max(0, (dm.index ?? 0) - 14), dm.index ?? 0).toLowerCase();
    if (/(due|ship|delivery|expiry|valid|issue|loading|payment)\s*$/.test(before)) continue;
    contractDate = normaliseDate(dm[1]);
    if (contractDate) break;
  }

  const { goods, totalRow, currency: tblCur } = parseGoods(t);

  // currency: table header → explicit "Total Amount: USD" → first currency code in the document
  let currency = tblCur;
  if (!currency) {
    const cm = t.match(new RegExp(`\\b(${CUR})\\b`));
    if (cm) currency = cm[1] === "RMB" ? "CNY" : cm[1];
  }
  for (const g of goods) if (!g.currency) g.currency = currency;

  // HS code (dotted or explicitly labelled)
  let hsCode: string | null = null;
  const hsLab = t.match(/(?:h\.?s\.?\s*code|hs\s*code|tariff\s*code|commodity\s*code)\s*[:：]?\s*(\d{4}(?:[.\s]?\d{2}){1,3}|\d{6,10})/i);
  if (hsLab) hsCode = hsLab[1].replace(/[.\s]/g, "");
  else {
    const hsDot = t.match(/(?<![\d.,])(\d{4}\.\d{2}(?:\.\d{2,4})?)(?![\d,])/);
    if (hsDot) hsCode = hsDot[1].replace(/\./g, "");
  }
  if (hsCode) for (const g of goods) g.hsCode = g.hsCode || hsCode;

  // total: stated > lines > calculated
  let total: ContractParse["total"] = null;
  const statedM = t.match(new RegExp(`(?:grand\\s*total|total\\s*(?:amount|value|price|contract\\s*value)|contract\\s*(?:value|amount))\\s*[:：]?\\s*(?:(?:${CUR})\\s*|[$€£¥]\\s*)?(${NUM})`, "i"));
  const stated = totalRow?.amount ?? (statedM ? parseNumber(statedM[1]) : null);
  if (stated != null && stated > 0) total = { amount: stated, source: "stated" };
  else if (goods.length && goods.every((g) => g.amount != null)) {
    total = { amount: goods.reduce((s, g) => s + (g.amount as number), 0), source: "lines" };
  } else if (goods.length && goods.every((g) => g.quantity != null && g.unitPrice != null)) {
    total = { amount: goods.reduce((s, g) => s + (g.quantity as number) * (g.unitPrice as number), 0), source: "calculated" };
  }
  if (total && goods.length) {
    const sum = goods.reduce((s, g) => s + (g.amount ?? (g.quantity != null && g.unitPrice != null ? g.quantity * g.unitPrice : 0)), 0);
    if (sum > 0 && Math.abs(sum - total.amount) > Math.max(0.5, total.amount * 0.005)) {
      warnings.push(`Printed total ${total.amount} differs from the sum of the goods lines ${sum}.`);
    }
  }
  for (const g of goods) {
    if (g.consistent === false) warnings.push(`Line "${g.description}": quantity × unit price does not equal the printed amount.`);
  }

  // terms
  const paymentTerms = labelled(t, "payment\\s*terms?|terms\\s*of\\s*payment|payment");
  let deliveryRaw = labelled(t, "delivery\\s*terms?|terms\\s*of\\s*delivery|trade\\s*terms?|incoterms?|price\\s*terms?");
  if (!deliveryRaw) {
    const im = t.match(/\b(FOB|CIF|CFR|CPT|CIP|DAP|DDP|EXW|FCA|FAS)\b[ ,-]*([A-Za-z][A-Za-z .]{0,30})?/);
    if (im) deliveryRaw = clean(`${im[1]} ${im[2] ?? ""}`);
  }
  const incM = deliveryRaw?.match(/\b(FOB|CIF|CFR|CPT|CIP|DAP|DDP|EXW|FCA|FAS)\b\s*[,:-]?\s*(.*)$/i);

  const quality = labelled(t, "quality(?:\\s*(?:standard|spec(?:ification)?))?|specification");
  const packing = labelled(t, "packing|packaging");
  const lotNo = labelled(t, "lot\\s*(?:no\\.?|number)?|batch\\s*(?:no\\.?|number)?");
  const variety = labelled(t, "variety|grade|brand");

  const wnum = (label: string) => {
    const m = t.match(new RegExp(`${label}\\s*(?:weight|wt\\.?)?\\s*[:：]?\\s*(${NUM})\\s*(?:${UNIT})?`, "i"));
    return m ? parseNumber(m[1]) : null;
  };
  const grossWeight = wnum("gross");
  const tareWeight = wnum("tare");
  const netWeight = wnum("net");
  if (grossWeight != null && tareWeight != null && netWeight != null && Math.abs(grossWeight - tareWeight - netWeight) > Math.max(0.01, grossWeight * 0.001)) {
    warnings.push("Gross − tare does not equal the printed net weight.");
  }

  const truckNo = labelled(t, "truck\\s*(?:no\\.?|number)?|vehicle\\s*(?:no\\.?|number)|lorry\\s*no\\.?");
  const blNo = labelled(t, "b\\/?l\\s*(?:no\\.?|number)?|bill\\s*of\\s*lading\\s*(?:no\\.?|number)?");
  const containerNos = [...new Set([...t.matchAll(/\b([A-Z]{4}\d{7})\b/g)].map((m) => m[1]))];

  const bank: ParsedBank = {
    beneficiary: labelled(t, "beneficiary(?:\\s*name)?|account\\s*(?:name|title|holder)|a\\/c\\s*(?:name|title)"),
    bankName: labelled(t, "beneficiary(?:'s)?\\s*bank|bank\\s*name|bank"),
    branch: labelled(t, "bank\\s*branch|branch"),
    accountNo: (() => {
      const m = t.match(/(?:a\/?c\s*(?:no\.?|number)|account\s*(?:no\.?|number)|acct\.?\s*no\.?)\s*[:：]?\s*([0-9][0-9\- ]{5,30}[0-9])/i);
      return m ? clean(m[1]) : null;
    })(),
    iban: (() => {
      const m = t.match(/\bIBAN\s*[:：]?\s*([A-Z]{2}\d{2}[A-Z0-9 ]{10,34})/i);
      return m ? clean(m[1]).replace(/\s+/g, "") : null;
    })(),
    swift: (() => {
      const m = t.match(/(?:swift(?:\s*code)?|bic)\s*[:：]?\s*([A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i);
      return m ? m[1].toUpperCase() : null;
    })(),
    address: labelled(t, "bank\\s*address"),
  };
  // "Bank: X" can capture the beneficiary line label; ignore a bank name that equals the seller.
  if (bank.bankName && seller.name && bank.bankName.toLowerCase() === seller.name.toLowerCase()) bank.bankName = null;

  const isTradeContract = Boolean(seller.name && buyer.name) && /contract|agreement|order|proforma|invoice/i.test(t);

  return {
    isTradeContract,
    sellerName: seller.name,
    sellerCountry: seller.country,
    buyerName: buyer.name,
    buyerCountry: buyer.country,
    contractNo,
    contractDate,
    goods,
    currency,
    total,
    paymentTerms,
    deliveryTerms: deliveryRaw,
    incoterm: incM ? incM[1].toUpperCase() : null,
    deliveryPlace: incM && incM[2] ? clean(incM[2]) || null : null,
    quality,
    packing,
    hsCode,
    lotNo,
    variety,
    grossWeight,
    tareWeight,
    netWeight,
    truckNo,
    containerNos,
    blNo,
    bank,
    warnings,
  };
}

