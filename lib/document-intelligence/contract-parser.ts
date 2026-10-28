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
  /** specification lines printed under the goods name (grade, crop, moisture, origin …) */
  specification: string | null;
  quantity: number | null;
  /** "amount_div_price" = the quantity cell was not readable; it is the printed amount ÷ the printed unit price */
  quantitySource: "printed" | "amount_div_price" | null;
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
  /** the seller's name in Chinese as printed on the letterhead next to the English name, e.g. 大连赛恩进出口有限公司 */
  sellerNameLocal: string | null;
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
  portOfLoading: string | null;
  portOfDestination: string | null;
  /** the shipment period exactly as printed, e.g. "Before December 15, 2023" */
  shipmentTime: string | null;
  countryOfOrigin: string | null;
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
  awbNo: string | null;
  railRef: string | null;
  /** every distinct currency code the document mentions (more than one = the purchase currency needs confirming) */
  currencies: string[];
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

// a Chinese label printed next to the English one: "Seller 卖方:", "Port of Loading 装运港:", "Buyer (买方):"
const CJK_LABEL = "(?:\\s*[(（]?\\s*[\\u3400-\\u9fff]{1,10}\\s*[)）]?)?";
// another "Label:" further along the same line ends the value ("0806.20 Country of Origin 原产国: CHINA")
const NEXT_LABEL = new RegExp(`\\s+(?:(?:[A-Z][A-Za-z'’]*|of|the|and|for|to|&)\\s+){0,5}[A-Z][A-Za-z'’]+${CJK_LABEL}\\s*[:：]`);

/** value after `Label:` on the same line (or the next line when the label ends the line). */
function labelled(text: string, labels: string, stopAt?: RegExp): string | null {
  const re = new RegExp(`(?:^|[\\n\\r]|\\s{2,}|\\b)(?:${labels})${CJK_LABEL}\\s*[:：]\\s*([^\\n\\r]*)(?:\\r?\\n\\s*([^\\n\\r:：]{3,90}))?`, "i");
  const m = text.match(re);
  if (!m) return null;
  // three or more spaces separate a second label / column on the same visual row — split BEFORE the spaces are collapsed
  let v = clean((m[1] ?? "").split(/\s{3,}/)[0]);
  if (!v && m[2]) v = clean(m[2].split(/\s{3,}/)[0]);
  if (!v) return null;
  if (stopAt) v = clean(v.split(stopAt)[0]);
  v = clean(v.split(NEXT_LABEL)[0]);
  return v || null;
}

const KNOWN_COUNTRIES: Record<string, string> = {
    UAE: "United Arab Emirates", UNITEDARABEMIRATES: "United Arab Emirates", PRC: "China", PRCHINA: "China", CHINA: "China",
    PEOPLESREPUBLICOFCHINA: "China", PAKISTAN: "Pakistan", AFGHANISTAN: "Afghanistan", INDIA: "India", IRAN: "Iran",
    SAUDIARABIA: "Saudi Arabia", KSA: "Saudi Arabia", OMAN: "Oman", QATAR: "Qatar", KUWAIT: "Kuwait", BAHRAIN: "Bahrain",
    TURKEY: "Turkey", TURKIYE: "Turkey", USA: "United States", UK: "United Kingdom", UZBEKISTAN: "Uzbekistan",
    TAJIKISTAN: "Tajikistan", KAZAKHSTAN: "Kazakhstan",
};

/** The master spelling of a country name / abbreviation the parser knows ("U.A.E." → "United Arab Emirates"), else null. */
export function knownCountry(raw: string | null | undefined): string | null {
  return KNOWN_COUNTRIES[clean(raw).toUpperCase().replace(/[^A-Z]/g, "")] ?? null;
}

/** A country written the way the location masters spell it ("CHINA" → "China", "U.A.E." → "United Arab Emirates"). */
export function normaliseCountry(raw: string | null | undefined): string | null {
  const v = clean(raw).replace(/[.,;]+$/, "");
  if (!v) return null;
  return knownCountry(v) ?? v.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function splitCountry(name: string | null): { name: string | null; country: string | null } {
  if (!name) return { name: null, country: null };
  const m = name.match(/^(.*?)[\s,]*\(\s*([A-Za-z][A-Za-z .]{1,30})\s*\)\s*$/);
  if (m) return { name: clean(m[1]).replace(/[,;]+$/, ""), country: clean(m[2]) };
  return { name: name.replace(/[,;]+$/, ""), country: null };
}

const NUM = "[0-9][0-9,]*(?:\\.\\d+)?";

/**
 * One goods row read by meaning, not by column position: the unit price is the money "per unit" ("USD 5,267.00 /MT"), the
 * amount the last money on the row, the quantity a number + unit that is not packing ("10 KG net carton"). When the quantity
 * cell is unreadable it is the printed amount ÷ the printed unit price, and marked as such (never invented).
 */
function semanticGoodsRow(line: string, following: string[], headerUnit: string | null): ParsedGoodsLine | null {
  const priceM = line.match(new RegExp(`(?:(${CUR})\\s*)?(${NUM})\\s*(?:(${CUR})\\s*)?(?:/|per)\\s*(${UNIT})\\b`, "i"));
  const moneys = [...line.matchAll(new RegExp(`\\b(${CUR})\\s*(${NUM})`, "gi"))].map((m) => ({ cur: m[1].toUpperCase(), value: parseNumber(m[2]), index: m.index ?? 0 }));
  if (!priceM && moneys.length < 1) return null;
  const unitPrice = priceM ? parseNumber(priceM[2]) : null;
  const priceIndex = priceM ? (priceM.index ?? -1) : -1;
  const amountM = [...moneys].reverse().find((m) => m.index > priceIndex && m.value !== unitPrice) ?? null;
  if (unitPrice == null || amountM == null) return null;
  const currency = (priceM?.[1] || priceM?.[3] || amountM.cur || "").toUpperCase().replace("RMB", "CNY") || null;
  const priceUnit = priceM ? priceM[4].toUpperCase().replace(/\./g, "") : null;

  // description: the text before the first number / currency on the row
  const firstNum = line.search(new RegExp(`\\s(?:(?:${CUR})\\s*)?\\d`, "i"));
  const description = clean(firstNum > 0 ? line.slice(0, firstNum) : line).replace(/[,;:]+$/, "");
  if (!/[A-Za-z㐀-鿿]{3,}/.test(description)) return null;

  let quantity: number | null = null;
  let unit: string | null = priceUnit || headerUnit;
  let quantitySource: ParsedGoodsLine["quantitySource"] = null;
  for (const qm of line.matchAll(new RegExp(`(?<![\\d.,/])(${NUM})\\s*(${UNIT})\\b(?!\\s*(?:/|net|gross|per|each|carton|bag|pack))`, "gi"))) {
    if ((qm.index ?? 0) >= priceIndex) break;
    const u = qm[2].toUpperCase().replace(/\./g, "");
    if (priceUnit && u !== priceUnit && !(u.startsWith("TON") && priceUnit === "MT")) continue;
    quantity = parseNumber(qm[1]);
    unit = priceUnit || u;
    quantitySource = "printed";
    break;
  }
  const amount = amountM.value;
  if (quantity == null && unitPrice && amount) {
    const q = amount / unitPrice;
    if (Math.abs(q - Math.round(q * 1000) / 1000) < 1e-6) { quantity = Math.round(q * 1000) / 1000; quantitySource = "amount_div_price"; }
  }
  // specification lines printed under the goods name ("GRADE A, CROP 2023", "Moisture: 18% max", "Origin: China")
  const spec: string[] = [];
  for (const f of following) {
    const part = clean((f ?? "").split(/\s{3,}/)[0]);
    if (!part) continue;
    if (/^total\b/i.test(part) || new RegExp(`\\b(?:${CUR})\\s*${NUM}`, "i").test(part)) break;
    if (/^[㐀-鿿\s]+$/.test(part)) continue;
    if (/^(?:\d+\.|payment|delivery|terms|packing|the\s+seller|bank|remarks|say\b)/i.test(part)) break;
    if (!/[A-Za-z]{2,}/.test(part)) continue;
    spec.push(part);
    if (spec.length >= 4) break;
  }
  return {
    description,
    specification: spec.length ? spec.join("; ") : null,
    quantity,
    quantitySource,
    unit,
    unitPrice,
    amount,
    currency,
    hsCode: null,
    consistent: quantity != null && amount != null && quantitySource === "printed"
      ? Math.abs(quantity * unitPrice - amount) <= Math.max(0.5, Math.abs(amount) * 0.005) : null,
  };
}

function parseGoods(text: string): { goods: ParsedGoodsLine[]; totalRow: { quantity: number | null; amount: number | null } | null; currency: string | null; unit: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, " ").trim());
  // "|" / "¦" are OCR'd table rulings, not text
  for (let k = 0; k < lines.length; k++) lines[k] = lines[k].replace(/\s*[|¦]\s*/g, "   ").trim();
  let currency: string | null = null;
  let unit: string | null = null;
  const goods: ParsedGoodsLine[] = [];
  let totalRow: { quantity: number | null; amount: number | null } | null = null;

  // 1. Table form: header row naming DESCRIPTION / QUANTITY / UNIT PRICE / AMOUNT.
  const hi = lines.findIndex((l) => (/descri|goods|commodity|item/i.test(l) && /quantity|qty/i.test(l) && /(unit\s*price|price|rate)/i.test(l))
    || (/品名|货物/.test(l) && /数量/.test(l) && /单价/.test(l)));
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
      // a scanned table loses cells (often the quantity): read the row by meaning
      const semantic = row ? null : semanticGoodsRow(l, lines.slice(i + 1, i + 6), unit);
      if (semantic) {
        if (/^total\b/i.test(semantic.description)) { totalRow = { quantity: semantic.quantity, amount: semantic.amount }; break; }
        if (semantic.currency && !currency) currency = semantic.currency;
        goods.push({ ...semantic, currency: semantic.currency ?? currency });
        continue;
      }
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
        specification: null,
        quantity: qty,
        quantitySource: qty == null ? null : "printed",
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
        specification: null,
        quantity: qty,
        quantitySource: qty == null ? null : "printed",
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
  const currencies = [...new Set([...t.matchAll(new RegExp(`\\b(${CUR})\\b`, "g"))].map((m) => (m[1] === "RMB" ? "CNY" : m[1])))];

  const sellerRaw = labelled(t, "(?:the\\s+)?seller|supplier|exporter|party\\s*a|卖方|供方|出口商", /\s+(?:the\s+)?buyer\s*[:：]/i);
  const buyerRaw = labelled(t, "(?:the\\s+)?buyer|purchaser|importer|party\\s*b|买方|需方|进口商", /\s+(?:the\s+)?seller\s*[:：]/i);
  const seller = splitCountry(sellerRaw);
  const buyer = splitCountry(buyerRaw);

  const contractNoM = t.match(/contract\s*(?:no\.?|number|#)\s*[:：.]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{1,30})/i)
    ?? t.match(/(?:合同编号|合同号)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9/\-_.]{1,30})/);
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
  // "TOTAL VALUE: SAY U.S. DOLLARS ONE MILLION … ONLY. (USD 1,158,740.00)" — the money in the sentence after the label
  let statedInWords: number | null = null;
  if (!statedM) {
    const lab = t.match(/(?:grand\s*total|total\s*(?:amount|value|price|contract\s*value)|contract\s*(?:value|amount)|总值|总金额|合计金额)\s*[:：]?/i);
    if (lab) {
      const from = (lab.index ?? 0) + lab[0].length;
      const mm = t.slice(from, from + 320).match(new RegExp(`(?:\\b(?:${CUR})|US\\$|[$€£¥])\\s*(${NUM})`, "i"));
      if (mm) statedInWords = parseNumber(mm[1]);
    }
  }
  const stated = totalRow?.amount ?? (statedM ? parseNumber(statedM[1]) : statedInWords);
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
  if (currencies.length > 1) warnings.push(`More than one currency appears in the document (${currencies.join(", ")}) - confirm the purchase currency.`);
  for (const g of goods) {
    if (g.consistent === false) warnings.push(`Line "${g.description}": quantity × unit price does not equal the printed amount.`);
  }

  // terms
  const paymentTerms = labelled(t, "payment\\s*terms?|terms\\s*of\\s*payment|payment|付款条件|付款方式|支付方式");
  let deliveryRaw = labelled(t, "delivery\\s*terms?|terms\\s*of\\s*delivery|trade\\s*terms?|incoterms?|price\\s*terms?");
  if (!deliveryRaw) {
    const im = t.match(/\b(FOB|CIF|CFR|CPT|CIP|DAP|DDP|EXW|FCA|FAS)\b[ ,-]*([A-Za-z][A-Za-z .]{0,30})?/);
    if (im) deliveryRaw = clean(`${im[1]} ${im[2] ?? ""}`);
  }
  const incM = deliveryRaw?.match(/\b(FOB|CIF|CFR|CPT|CIP|DAP|DDP|EXW|FCA|FAS)\b\s*[,:-]?\s*(.*)$/i);

  const quality = labelled(t, "quality(?:\\s*(?:standard|spec(?:ification)?))?|specification|品质|质量");
  const packing = labelled(t, "packing|packaging|包装");
  const portOfLoading = labelled(t, "port\\s*of\\s*(?:loading|shipment)|loading\\s*port|place\\s*of\\s*loading|装运港|起运港|装货港");
  const portOfDestination = labelled(t, "port\\s*of\\s*(?:destination|discharge)|destination\\s*port|discharge\\s*port|place\\s*of\\s*delivery|目的港|卸货港");
  // the shipment period is the first sentence ("Before December 15, 2023. Partial shipment allowed." → "Before December 15, 2023")
  const shipmentTime = labelled(t, "time\\s*of\\s*shipment|shipment\\s*(?:date|time|period)|latest\\s*(?:date\\s*of\\s*)?shipment|date\\s*of\\s*shipment|装运期|装运时间|交货期")
    ?.split(/\.\s+(?=[A-Z])/)[0].replace(/\.$/, "") ?? null;
  const originRaw = labelled(t, "country\\s*of\\s*origin|origin|原产国|原产地|产地");
  const countryOfOrigin = normaliseCountry(originRaw ? originRaw.replace(/^made\s+in\s+/i, "") : null);
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
  const awbNo = labelled(t, "awb\\s*(?:no\\.?|number)?|air\\s*waybill(?:\\s*(?:no\\.?|number))?");
  const railRef = labelled(t, "rail(?:way)?\\s*(?:receipt|consignment|wagon|waybill)?\\s*(?:no\\.?|number)|wagon\\s*(?:no\\.?|number)");
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

  const isTradeContract = Boolean(seller.name && buyer.name) && /contract|agreement|order|proforma|invoice|合同|订单|发票/i.test(t);

  // the seller's name in Chinese: the company line printed with the seller's English name on the letterhead
  let sellerNameLocal: string | null = null;
  if (seller.name) {
    const head = t.split(/\n/).slice(0, 40);
    const key = seller.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
    for (let i = 0; i < head.length && !sellerNameLocal && key; i++) {
      if (!head[i].toUpperCase().replace(/[^A-Z]/g, "").includes(key)) continue;
      for (const near of head.slice(Math.max(0, i - 1), i + 3)) {
        const cm = near.match(/([㐀-鿿]{2,30}(?:有限公司|股份公司|公司|集团|厂|商行))/);
        if (cm) { sellerNameLocal = cm[1]; break; }
      }
    }
  }

  return {
    isTradeContract,
    sellerName: seller.name,
    sellerNameLocal,
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
    portOfLoading,
    portOfDestination,
    shipmentTime,
    countryOfOrigin,
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
    awbNo,
    railRef,
    currencies,
    bank,
    warnings,
  };
}

