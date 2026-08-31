import type { InquiryDraft, InquirySource } from "./types";

/**
 * AI voice/text entry for Customer Inquiries — 100% LOCAL heuristic extractor
 * (same philosophy as the Document Intake engine: deterministic rules, no
 * external LLM, no API key). The user speaks or types free-form meeting notes;
 * this turns them into the structured draft they Preview & Confirm before Save.
 *
 * Voice is captured client-side with the browser SpeechRecognition API and the
 * transcript is fed here as plain text.
 */

const RTL_LANGS = new Set(["ur", "ps", "fa", "ar"]);

export function detectInquiryLanguage(text: string): string {
  const t = (text || "").slice(0, 4000);
  const hasArabicScript = /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(t);
  if (!hasArabicScript) return "en";
  if (/[ټۍږښڼگڅ]/u.test(t)) return "ps";
  if (/[ٹڑڈںے]/u.test(t)) return "ur";
  if (/[پچژگ]/u.test(t) && !/[ٹڑڈ]/u.test(t)) return "fa";
  return "ar";
}

export function isRtlLang(lang: string): boolean {
  return RTL_LANGS.has(lang);
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// international (+92 300 1234567) or local (03001234567 / 0300-1234567) or UAE (+971 50 ...)
const PHONE_RE = /(\+?\d[\d\s().-]{6,16}\d)/g;

const BUSINESS_TYPES: { key: string; words: string[] }[] = [
  { key: "Import / Export", words: ["import", "export", "importer", "exporter", "trading company", "trade"] },
  { key: "Wholesale / Distribution", words: ["wholesale", "distribution", "distributor", "supplier"] },
  { key: "Retail", words: ["retail", "shop", "store", "outlet"] },
  { key: "Manufacturing", words: ["manufactur", "factory", "production", "mill", "plant"] },
  { key: "Construction / Real Estate", words: ["construction", "builder", "contractor", "real estate", "property", "developer"] },
  { key: "Agriculture / Food", words: ["agricultur", "farm", "food", "grain", "rice", "wheat", "sugar", "produce", "dry fruit", "kernel"] },
  { key: "Textiles / Garments", words: ["textile", "garment", "fabric", "cloth", "apparel", "yarn"] },
  { key: "Electronics / IT", words: ["electronic", "mobile", "computer", "software", "hardware", " it ", "technology"] },
  { key: "Logistics / Shipping", words: ["logistic", "shipping", "freight", "cargo", "transport", "clearing", "customs"] },
  { key: "Automotive", words: ["auto", "car", "vehicle", "spare part", "tyre", "tire"] },
  { key: "Chemicals / Pharma", words: ["chemical", "pharma", "medicine", "drug", "fertiliz", "fertilizer"] },
  { key: "Services / Consulting", words: ["service", "consult", "agency", "solution"] },
];

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/[ \t]+/g, " ").trim();
}

function pickFirst<T>(...xs: (T | null | undefined | "")[]): T | null {
  for (const x of xs) if (x) return x as T;
  return null;
}

/** relative & absolute follow-up dates → YYYY-MM-DD */
function extractFollowUpDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (/\btomorrow\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + 1); return iso(d); }
  if (/\bday after tomorrow\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + 2); return iso(d); }
  if (/\bnext week\b/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + 7); return iso(d); }
  if (/\bnext month\b/.test(t)) { const d = new Date(now); d.setMonth(d.getMonth() + 1); return iso(d); }

  let m = t.match(/\bin (\d{1,3}) (day|days|week|weeks|month|months)\b/);
  if (m) {
    const n = Number(m[1]);
    const d = new Date(now);
    if (m[2].startsWith("day")) d.setDate(d.getDate() + n);
    else if (m[2].startsWith("week")) d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    return iso(d);
  }
  m = t.match(/\b(after|in) (a|one|two|three) (day|days|week|weeks|month|months)\b/);
  if (m) {
    const map: Record<string, number> = { a: 1, one: 1, two: 2, three: 3 };
    const n = map[m[2]] ?? 1;
    const d = new Date(now);
    if (m[3].startsWith("day")) d.setDate(d.getDate() + n);
    else if (m[3].startsWith("week")) d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    return iso(d);
  }

  // absolute: yyyy-mm-dd | dd/mm/yyyy | dd Mon yyyy | Mon dd, yyyy
  m = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  m = text.match(/\b(\d{1,2})[ -]?([A-Za-z]{3,9})[ ,-]?(\d{4})\b/);
  if (m) {
    const mi = months.indexOf(m[2].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[.,]?\s+(\d{4})\b/);
  if (m) {
    const mi = months.indexOf(m[1].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function labelledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-–]\\s*([^\\n,;]+)`, "i");
    const m = text.match(re);
    if (m) return clean(m[1]);
  }
  return null;
}

function detectSource(text: string): InquirySource | null {
  const t = text.toLowerCase();
  if (/\bwhats\s?app\b/.test(t)) return "whatsapp";
  if (/\bwalk[- ]?in\b/.test(t)) return "walk_in";
  if (/\bexhibition|expo|fair\b/.test(t)) return "exhibition";
  if (/\breferr?al|referred by\b/.test(t)) return "referral";
  if (/\bemail\b/.test(t)) return "email";
  if (/\b(phone|call|called|dialed)\b/.test(t)) return "phone";
  if (/\bonline|website|web form|portal\b/.test(t)) return "online";
  if (/\bmeeting|met with|visited|visit\b/.test(t)) return "meeting";
  return null;
}

function detectBusinessType(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const bt of BUSINESS_TYPES) {
    if (bt.words.some((w) => t.includes(w))) return bt.key;
  }
  return null;
}

function extractRequirements(text: string): string | null {
  const cues = ["require", "requirement", "need", "needs", "wants", "want", "looking for", "interested in", "quantity", "budget", "quote for", "supply of", "purchase"];
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const hits = sentences.filter((s) => cues.some((c) => s.toLowerCase().includes(c)));
  if (hits.length) return hits.join(" ");
  const lbl = labelledValue(text, ["requirement", "requirements", "needs?"]);
  return lbl;
}

const NAME_STOPWORDS = new Set(["from", "of", "at", "is", "the", "and", "for", "with", "to", "who", "he", "she", "they", "we", "regarding", "about", "wants", "needs", "said", "called", "was", "will"]);

function trimNameStopwords(name: string): string {
  const parts = clean(name).split(/\s+/);
  while (parts.length > 1 && NAME_STOPWORDS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts.join(" ");
}

function extractPersonName(text: string): string | null {
  const lbl = labelledValue(text, ["name", "customer name", "customer", "client", "contact person", "contact"]);
  if (lbl) return trimNameStopwords(lbl);
  // "Met Mr Ahmed Khan" / "met with Ahmed Khan from ..." / "spoke to Ali Raza"
  // The cue words are case-insensitive; the captured name stays case-sensitive (Title Case).
  const cue = "(?:[Mm]et|[Mm]eeting|[Ss]poke|[Ss]peaking|[Tt]alked|[Cc]all(?:ed)? (?:from|by)|[Ii]nquiry from|[Vv]isit(?:ed)?(?: by)?)";
  const honor = "(?:[Mm]r\\.?\\s+|[Mm]s\\.?\\s+|[Mm]rs\\.?\\s+|[Dd]r\\.?\\s+|[Hh]aji\\s+|[Hh]ajji\\s+|[Ee]ngr\\.?\\s+)?";
  const m = text.match(new RegExp(`\\b${cue}\\s+(?:with\\s+|to\\s+|by\\s+)?${honor}([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})`));
  return m ? trimNameStopwords(m[1]) : null;
}

function extractCompany(text: string): string | null {
  const lbl = labelledValue(text, ["company", "company name", "firm", "business", "organisation", "organization"]);
  if (lbl) return lbl;
  // "from ABC Trading LLC" / "of XYZ Enterprises"
  const m = text.match(/\b(?:from|of|for|represents?|representing)\s+((?:[A-Z][\w&.]*\s+){0,4}(?:LLC|L\.L\.C|Pvt|Private|Ltd|Limited|Trading|Traders|Enterprises?|Industries|Group|International|Impex|Corporation|Corp|Co\.?|Company|Est\.?|Establishment|FZE|FZC))\b/);
  return m ? clean(m[1]) : null;
}

/**
 * Turn free-form meeting notes / a voice transcript into a structured draft.
 * `customerMatches` is filled by the service (needs a DB lookup).
 */
export function extractInquiryDraft(rawInput: string): Omit<InquiryDraft, "customerMatches"> {
  const text = clean(rawInput);
  const detectedLanguage = detectInquiryLanguage(text);

  const emails = text.match(EMAIL_RE);
  const phonesRaw = [...(text.matchAll(PHONE_RE))].map((m) => m[1].replace(/[^\d+]/g, "")).filter((p) => p.replace(/\D/g, "").length >= 8);
  const phones = [...new Set(phonesRaw)];

  const customer_name = extractPersonName(text);
  const company_name = extractCompany(text);
  const contact_person = labelledValue(text, ["contact person", "attention", "attn"]) || customer_name;
  const mobile = pickFirst(labelledValue(text, ["mobile", "phone", "cell", "number", "tel"]), phones[0]);
  const whatsapp = pickFirst(labelledValue(text, ["whatsapp", "whats app"]), /\bwhats\s?app\b/i.test(text) ? phones[1] || phones[0] : null);
  const email = pickFirst(labelledValue(text, ["email", "e-mail", "mail"]), emails?.[0] ?? null);
  const address = labelledValue(text, ["address", "location", "office", "based in", "city"]);
  const business_type = detectBusinessType(text);
  const requirements = extractRequirements(text);
  const follow_up_date = extractFollowUpDate(text);
  const source = detectSource(text);

  // a one-line summary + the remaining prose as meeting notes
  const firstSentence = (text.split(/(?<=[.!?])\s+|\n+/)[0] || text).slice(0, 180);
  const inquiry_summary =
    (customer_name || company_name ? `${company_name || customer_name} — ${business_type || "inquiry"}` : firstSentence) || null;
  const meeting_notes = text.length > 0 ? text : null;

  const filled = { customer_name, company_name, contact_person, mobile, email, business_type, requirements, follow_up_date, source };
  const unmatched = Object.entries(filled).filter(([, v]) => !v).map(([k]) => k);

  // confidence = share of the key fields we could fill, lightly weighted
  const total = Object.keys(filled).length;
  const got = total - unmatched.length;
  const confidence = Math.round((0.25 + 0.75 * (got / total)) * 1000) / 1000;

  return {
    customer_name,
    company_name,
    contact_person,
    mobile: mobile ?? null,
    whatsapp: whatsapp ?? null,
    email: email ?? null,
    address,
    business_type,
    inquiry_summary,
    meeting_notes,
    requirements,
    source: source ?? null,
    follow_up_date,
    confidence,
    unmatched,
    detectedLanguage,
  };
}
