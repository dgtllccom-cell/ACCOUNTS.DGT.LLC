/**
 * Account Master / Chart-of-Accounts table extractor.
 *
 * Takes the OCR / text-layer output of a "khaata" / account-directory document
 * (PDF, Excel-exported CSV, or a scanned table) and returns ONE ROW PER ACCOUNT
 * — never one document = one account.
 *
 * 100 % local + deterministic. No external calls. Every row carries the raw
 * source line + a per-field confidence so the review UI can flag uncertain
 * cells instead of inventing data.
 */

export type ExtractedAccountRow = {
  rowIndex: number;
  accountCode: string | null;
  accountName: string | null;
  category: string | null;
  branch: string | null;
  companyName: string | null;
  businessName: string | null;
  city: string | null;
  address: string | null;
  mobile: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  /** fields the extractor is unsure about — surfaced for human review */
  uncertainFields: string[];
  sourceLine: string;
};

export type AccountTableExtractionResult = {
  rows: ExtractedAccountRow[];
  detectedFormat: "delimited" | "columnar" | "labelled" | "none";
  headerFound: boolean;
  totalLinesScanned: number;
  warnings: string[];
};

const CATEGORY_WORDS = ["asset", "liability", "capital", "equity", "expense", "income", "revenue", "receivable", "payable", "bank", "cash"];
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s\-()]{6,}\d)/;
const CODE_RE = /^[A-Z]{0,4}[-/]?\d{2,8}(?:[-/]\d{1,4})?$/i;

const HEADER_HINTS = [
  "account code", "a/c code", "acc code", "code", "account no", "account number",
  "account name", "account title", "name", "title",
  "category", "type", "class", "group",
  "branch", "division", "office",
  "company", "company name", "business", "business name", "firm",
  "city", "town", "address", "location",
  "mobile", "cell", "whatsapp", "wa", "phone", "tel", "telephone",
  "email", "e-mail", "mail",
];

const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
const nullIfEmpty = (s: string): string | null => (s && s.length ? s : null);

/** map a header cell to our canonical field key */
function headerToKey(h: string): keyof ExtractedAccountRow | null {
  const t = h.toLowerCase().replace(/[^a-z\s/]/g, "").trim();
  if (/\b(a\/c\s*code|acc(?:ount)?\s*code|gl\s*code|ledger\s*code|^code$|account\s*(?:no|number))\b/.test(t)) return "accountCode";
  if (/\b(account\s*(?:name|title)|^name$|^title$|khaata\s*name)\b/.test(t)) return "accountName";
  if (/\b(category|type|class(?:ification)?|group)\b/.test(t)) return "category";
  if (/\b(branch|division|office|location)\b/.test(t)) return "branch";
  if (/\b(company(?:\s*name)?|parent\s*company)\b/.test(t)) return "companyName";
  if (/\b(business(?:\s*name)?|firm|trade\s*name)\b/.test(t)) return "businessName";
  if (/\b(city|town)\b/.test(t)) return "city";
  if (/\b(address|addr)\b/.test(t)) return "address";
  if (/\b(whats\s*app|^wa$)\b/.test(t)) return "whatsapp";
  if (/\b(mobile|cell)\b/.test(t)) return "mobile";
  if (/\b(phone|tel(?:ephone)?|land\s*line)\b/.test(t)) return "phone";
  if (/\b(e-?mail|mail)\b/.test(t)) return "email";
  return null;
}

function blankRow(idx: number, sourceLine: string): ExtractedAccountRow {
  return {
    rowIndex: idx,
    accountCode: null, accountName: null, category: null, branch: null,
    companyName: null, businessName: null, city: null, address: null,
    mobile: null, whatsapp: null, phone: null, email: null,
    uncertainFields: [], sourceLine,
  };
}

/** normalise a free-text category to a canonical account kind label */
export function normaliseCategory(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (/(receivable|debtor)/.test(t)) return "Asset";
  if (/(payable|creditor)/.test(t)) return "Liability";
  if (/(bank|cash|stock|inventory|fixed\s*asset|current\s*asset)/.test(t)) return "Asset";
  if (/(loan|liabilit)/.test(t)) return "Liability";
  if (/(capital|equity|owner)/.test(t)) return "Capital";
  if (/(expense|cost|purchase)/.test(t)) return "Expense";
  if (/(income|revenue|sales)/.test(t)) return "Income";
  for (const w of CATEGORY_WORDS) if (t.includes(w)) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return raw.length <= 24 ? norm(raw) : null;
}

/** classify a loose token so columnar rows without a header can still be mapped */
function guessField(token: string): keyof ExtractedAccountRow | null {
  const t = norm(token);
  if (!t) return null;
  if (EMAIL_RE.test(t)) return "email";
  if (CODE_RE.test(t) && /\d/.test(t)) return "accountCode";
  if (CATEGORY_WORDS.some((w) => t.toLowerCase() === w || t.toLowerCase().startsWith(w))) return "category";
  if (PHONE_RE.test(t) && t.replace(/\D/g, "").length >= 7) return "phone";
  return null;
}

function splitDelimited(line: string): string[] | null {
  if (line.includes("\t")) return line.split("\t").map(norm);
  // CSV — respect simple quoted fields
  if ((line.match(/,/g) || []).length >= 3) {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(norm(cur)); cur = ""; continue; }
      cur += c;
    }
    out.push(norm(cur));
    return out;
  }
  // pipe-separated (common in text-rendered tables)
  if ((line.match(/\|/g) || []).length >= 3) return line.split("|").map(norm).filter((_, i, a) => !(i === 0 && a[0] === "") && !(i === a.length - 1 && a[i] === ""));
  // 2+ space columns
  if (/\S {2,}\S/.test(line)) {
    const cols = line.split(/\s{2,}/).map(norm).filter(Boolean);
    if (cols.length >= 3) return cols;
  }
  return null;
}

export function extractAccountTable(fullText: string): AccountTableExtractionResult {
  const warnings: string[] = [];
  const lines = (fullText || "").split(/\r?\n/).map((l) => l.replace(/ /g, " ").trimEnd()).filter((l) => l.trim().length > 0);
  const rows: ExtractedAccountRow[] = [];

  if (lines.length === 0) {
    return { rows, detectedFormat: "none", headerFound: false, totalLinesScanned: 0, warnings: ["Document produced no readable text."] };
  }

  // 1. locate a header row
  let headerIdx = -1;
  let headerMap: (keyof ExtractedAccountRow | null)[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitDelimited(lines[i]);
    if (!cells || cells.length < 3) continue;
    const lc = lines[i].toLowerCase();
    const hits = HEADER_HINTS.filter((h) => lc.includes(h)).length;
    const mapped = cells.map(headerToKey);
    const mappedCount = mapped.filter(Boolean).length;
    if (hits >= 2 && mappedCount >= 2) {
      headerIdx = i;
      headerMap = mapped;
      break;
    }
  }

  const headerFound = headerIdx >= 0;
  let detectedFormat: AccountTableExtractionResult["detectedFormat"] = "none";

  if (headerFound) {
    detectedFormat = "delimited";
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      // stop at obvious footer / totals
      if (/^\s*(total|grand\s*total|page\s*\d|signature|prepared\s*by|generated\s*by)\b/i.test(line)) continue;
      const cells = splitDelimited(line);
      if (!cells || cells.length < 2) continue;
      const row = blankRow(rows.length + 1, line);
      let filled = 0;
      for (let c = 0; c < cells.length && c < headerMap.length; c++) {
        const key = headerMap[c];
        const val = norm(cells[c]);
        if (!key || !val) continue;
        if (key === "category") { (row as any)[key] = normaliseCategory(val); }
        else { (row as any)[key] = val; }
        filled++;
      }
      // a data row needs at least a code or a name
      if (!row.accountCode && !row.accountName) continue;
      if (filled < 2) row.uncertainFields.push("row");
      // per-field sanity
      if (row.email && !EMAIL_RE.test(row.email)) { row.uncertainFields.push("email"); }
      if (row.accountCode && !/\d/.test(row.accountCode)) { row.uncertainFields.push("accountCode"); }
      if (!row.category) row.uncertainFields.push("category");
      rows.push(row);
    }
  } else {
    // 2. no header — try columnar / labelled fallback
    // labelled blocks:  "Account Code: 1001\nName: Cash\n..."
    const labelBlockRe = /account\s*(?:code|name|title)/i;
    if (lines.filter((l) => labelBlockRe.test(l)).length >= 2) {
      detectedFormat = "labelled";
      let cur: ExtractedAccountRow | null = null;
      const flush = () => { if (cur && (cur.accountCode || cur.accountName)) rows.push(cur); cur = null; };
      for (const line of lines) {
        const m = line.match(/^\s*([A-Za-z /]{2,30})\s*[:\-]\s*(.+?)\s*$/);
        if (!m) continue;
        const key = headerToKey(m[1]);
        if (key === "accountCode" && cur) flush();
        if (!cur) cur = blankRow(rows.length + 1, line);
        if (key) {
          if (key === "category") cur.category = normaliseCategory(m[2]);
          else (cur as any)[key] = norm(m[2]);
        }
      }
      flush();
    } else {
      // columnar guess: split each line, classify tokens
      detectedFormat = "columnar";
      const CAT_ANCHOR = /\b(asset|liability|capital|equity|expense|income|revenue|receivable|payable)\b/i;
      for (const line of lines) {
        if (/\b(account\s*code|account\s*name|category)\b/i.test(line)) continue; // skip stray header

        // Strategy A — single-space table row anchored on a leading code + a
        // category keyword: "1001 Cash in Hand - Quetta  Asset  Quetta Office  Quetta"
        const lead = line.match(/^\s*([A-Z]{0,4}[-/]?\d{2,8}(?:[-/]\d{1,4})?)\s+(.+)$/i);
        // pick the LAST category-word occurrence whose trailing text reads like
        // "branch [city]" (≤ 40 chars, mostly title-case) — this skips a category
        // word that is really part of the account name ("… Receivable - …").
        const catMatches = [...line.matchAll(new RegExp(CAT_ANCHOR.source, "gi"))];
        const catM = catMatches.reverse().find((m) => {
          if (typeof m.index !== "number") return false;
          const after = line.slice(m.index + m[0].length).trim();
          const before = line.slice((lead?.[1].length ?? 0), m.index).trim();
          return before.length >= 2 && after.length > 0 && after.length <= 44 && !CAT_ANCHOR.test(after);
        });
        if (lead && catM && typeof catM.index === "number") {
          const codeTok = lead[1];
          const beforeCat = line.slice(codeTok.length, catM.index).trim().replace(/[\s|]+$/, "");
          const afterCat = line.slice(catM.index + catM[0].length).trim();
          const name = norm(beforeCat).replace(/^[-:|]\s*/, "");
          if (name && /[A-Za-z]{3,}/.test(name)) {
            const row = blankRow(rows.length + 1, line);
            row.accountCode = codeTok;
            row.accountName = name;
            row.category = normaliseCategory(catM[1]);
            // afterCat = branch [+ city]; last token = city if it repeats or is a single word
            const tailTokens = afterCat.split(/\s{2,}|\s(?=[A-Z])/).map(norm).filter(Boolean);
            if (tailTokens.length >= 2) {
              row.city = tailTokens[tailTokens.length - 1];
              row.branch = tailTokens.slice(0, -1).join(" ");
            } else if (tailTokens.length === 1) {
              row.branch = tailTokens[0];
            }
            const em = line.match(EMAIL_RE); if (em) row.email = em[0];
            const ph = afterCat.match(PHONE_RE); if (ph) row.phone = ph[0];
            rows.push(row);
            continue;
          }
        }

        const cells = splitDelimited(line);
        if (!cells || cells.length < 3) continue;
        const row = blankRow(rows.length + 1, line);
        const unclaimed: string[] = [];
        for (const cell of cells) {
          const f = guessField(cell);
          if (f && !(row as any)[f]) {
            (row as any)[f] = f === "category" ? normaliseCategory(cell) : norm(cell);
          } else {
            unclaimed.push(norm(cell));
          }
        }
        // first unclaimed alpha token → name, longest → address
        const alphaTokens = unclaimed.filter((t) => /[A-Za-z]{3,}/.test(t));
        if (!row.accountName && alphaTokens.length) row.accountName = alphaTokens[0];
        if (!row.address && alphaTokens.length > 1) {
          const longest = alphaTokens.slice().sort((a, b) => b.length - a.length)[0];
          if (longest && longest.length > 15) row.address = longest;
        }
        if (!row.accountCode && !row.accountName) continue;
        row.uncertainFields.push("auto-mapped");
        rows.push(row);
      }
      if (rows.length) warnings.push("No header row detected — columns were auto-mapped and every row needs review.");
    }
  }

  if (rows.length === 0) {
    warnings.push("No account rows could be extracted. The document may not be a chart-of-accounts table, or the scan quality is too low.");
  }

  // de-dupe identical source lines
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${r.accountCode ?? ""}|${r.accountName ?? ""}`.toLowerCase();
    if (k === "|" ) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((r, i) => ({ ...r, rowIndex: i + 1 }));

  return { rows: deduped, detectedFormat, headerFound, totalLinesScanned: lines.length, warnings };
}
