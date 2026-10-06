/**
 * Conversation Intelligence — local deterministic signal-detection rules.
 *
 * 100% local, regex-based (no network calls), following the exact precedent
 * of lib/document-intelligence/contract-clause-rules.ts. Each rule answers a
 * yes/no "is this signal present in the call transcript?" question and, when
 * present, returns the matched transcript substring as evidence.
 *
 * English gets full breadth (5-8 phrases per signal). Non-English (ur/ps/fa/ar)
 * gets a smaller, honestly-partial keyword subset — the gap is disclosed in
 * the UI (deterministic_only && language !== 'en'), not hidden, and is closed
 * by the optional AI tier (call-intelligence-ai.ts) when configured. This is
 * the same disclosed trade-off already made for Contract Intelligence.
 *
 * This is the tier that works with ZERO AI configuration — always runs, and
 * is never replaced (only enriched) by the optional AI tier.
 */

export type SignalType =
  | "unresolved_issue"
  | "repeated_contact"
  | "churn_risk"
  | "sales_objection"
  | "buying_intent"
  | "upsell_opportunity"
  | "missed_commitment"
  | "complaint"
  | "dispute"
  | "service_failure"
  | "frustration";

export type SignalRule = {
  type: SignalType;
  patterns: RegExp[];
};

// English-first, honest multilingual augmentation (not full parity — see file header).
export const SIGNAL_RULES: SignalRule[] = [
  {
    type: "churn_risk",
    patterns: [
      /switch(ing)?\s+to\s+(a\s+|your\s+)?competitor/i,
      /cancel(l?ing)?\s+(my|the)\s+(account|service|order|contract)/i,
      /(not going to|won'?t|will not)\s+(order|buy|work)\s+(from|with)\s+you\s+again/i,
      /looking\s+(at|for)\s+(other|another)\s+(supplier|company|vendor)/i,
      /take\s+(my|our)\s+business\s+elsewhere/i,
      /میں\s+منسوخ\s+کر/i, // ur: "I will cancel"
    ],
  },
  {
    type: "complaint",
    patterns: [
      /this\s+is\s+(not|un)acceptable/i,
      /(very|really|so)\s+(disappointed|unhappy|dissatisfied)/i,
      /I\s+(want|need)\s+to\s+(complain|report)/i,
      /(bad|poor|terrible)\s+(service|experience)/i,
      /nobody\s+(helped|responded|called back)/i,
      /شکایت/i, // ur/fa/ps/ar: "complaint"
    ],
  },
  {
    type: "dispute",
    patterns: [
      /that'?s\s+not\s+what\s+(we|I)\s+agreed/i,
      /I\s+(never|did not)\s+agree(d)?\s+to\s+(this|that)/i,
      /(wrong|incorrect)\s+(amount|charge|invoice|bill)/i,
      /dispute\s+(this|the)\s+(charge|invoice|amount)/i,
      /this\s+(charge|amount)\s+is\s+wrong/i,
    ],
  },
  {
    type: "service_failure",
    patterns: [
      /(order|shipment|delivery)\s+(never|hasn'?t)\s+arrived/i,
      /(damaged|broken|defective)\s+(goods|items|product)/i,
      /missed\s+the\s+(deadline|delivery)/i,
      /(still|again)\s+waiting\s+for/i,
      /nothing\s+(was|has been)\s+done/i,
    ],
  },
  {
    type: "unresolved_issue",
    patterns: [
      /(still|again)\s+(not|hasn'?t been)\s+(fixed|resolved|solved)/i,
      /same\s+(problem|issue)\s+(again|as before)/i,
      /this\s+is\s+the\s+(third|fourth|fifth|\d+(th|rd|nd)?)\s+time/i,
      /no\s+one\s+(has\s+)?(fixed|resolved|called)/i,
    ],
  },
  {
    type: "sales_objection",
    patterns: [
      /(too|very)\s+expensive/i,
      /(price|cost)\s+is\s+(too\s+)?high/i,
      /can'?t\s+afford/i,
      /need\s+(a\s+)?(discount|better\s+price)/i,
      /(let me|I'll)\s+think\s+about\s+it/i,
      /not\s+(interested|sure)\s+(right now|at this time)/i,
    ],
  },
  {
    type: "buying_intent",
    patterns: [
      /(I|we)\s+(want|would like)\s+to\s+(order|buy|purchase)/i,
      /how\s+(much|many)\s+(does|do|would)\s+.*\s+cost/i,
      /(send|share)\s+(me\s+)?(a\s+)?(quote|quotation|price list)/i,
      /ready\s+to\s+(order|proceed|buy)/i,
      /place\s+an?\s+order/i,
    ],
  },
  {
    type: "upsell_opportunity",
    patterns: [
      /do\s+you\s+(also|have)\s+.*\?/i,
      /(interested|looking)\s+in\s+(more|additional|other)\s+(products|items|services)/i,
      /(can|could)\s+(you|we)\s+add\s+more/i,
      /increase\s+(the\s+)?(order|quantity)/i,
      /expand(ing)?\s+(our|the)\s+(order|business)/i,
    ],
  },
  {
    type: "missed_commitment",
    patterns: [
      /you\s+(promised|said)\s+.*(would|will)/i,
      /(was|were)\s+supposed\s+to\s+(call|deliver|send|fix)/i,
      /still\s+(haven'?t|has not)\s+(received|got|heard)/i,
      /nobody\s+(called|followed up)\s+back/i,
    ],
  },
  {
    type: "frustration",
    patterns: [
      /(so|very|extremely)\s+frustrat(ed|ing)/i,
      /this\s+is\s+ridiculous/i,
      /I'?m\s+(fed up|tired of this)/i,
      /(third|fourth|multiple)\s+time\s+(I'?m|I am)\s+calling/i,
      /waste\s+of\s+(my\s+)?time/i,
    ],
  },
];

const SENTIMENT_NEGATIVE = [
  /disappoint/i, /unhappy/i, /angry/i, /upset/i, /frustrat/i, /unacceptable/i, /terrible/i, /worst/i, /never again/i,
];
const SENTIMENT_POSITIVE = [
  /thank you/i, /great service/i, /happy with/i, /appreciate/i, /excellent/i, /very satisfied/i,
];

export function detectSentiment(text: string): "positive" | "neutral" | "negative" | "frustrated" {
  const frustrationHit = SIGNAL_RULES.find((r) => r.type === "frustration")!.patterns.some((p) => p.test(text));
  if (frustrationHit) return "frustrated";
  const negHits = SENTIMENT_NEGATIVE.filter((p) => p.test(text)).length;
  const posHits = SENTIMENT_POSITIVE.filter((p) => p.test(text)).length;
  if (negHits > posHits && negHits > 0) return "negative";
  if (posHits > negHits && posHits > 0) return "positive";
  return "neutral";
}

function excerptAround(text: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + matchLength + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function detectSignals(text: string): Array<{ type: SignalType; present: boolean; evidence: string | null; confidence: number }> {
  return SIGNAL_RULES.map((rule) => {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match && typeof match.index === "number") {
        return { type: rule.type, present: true, evidence: excerptAround(text, match.index, match[0].length), confidence: 0.75 };
      }
    }
    return { type: rule.type, present: false, evidence: null, confidence: 0 };
  });
}

// ── payment-promise / commitment extraction ──────────────────────────────────

const CURRENCY_AMOUNT = /(USD|AED|PKR|AFN|INR|EUR|GBP|\$|€|£)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
function parseAbsoluteDate(s: string, referenceDate: Date): string | null {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/\b(\d{1,2})[ -]?([A-Za-z]{3,9})[ ,-]?(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function nextWeekday(from: Date, targetDow: number): Date {
  const d = new Date(from);
  const diff = (targetDow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseRelativeDate(s: string, referenceDate: Date): string | null {
  const lower = s.toLowerCase();
  if (/\btoday\b/.test(lower)) return referenceDate.toISOString().slice(0, 10);
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const nextWeekMatch = lower.match(/next\s+week/);
  if (nextWeekMatch) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (lower.includes(WEEKDAYS[i])) {
      const isNext = /next\s+/.test(lower);
      const d = nextWeekday(referenceDate, i);
      if (isNext) d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function extractPaymentPromise(text: string, referenceDate: Date = new Date()): { amount: number; currency: string; date: string | null; confidence: number; extraction_basis: string } | null {
  const promiseCue = /(I'?ll|I will|we'?ll|we will)\s+pay|payment\s+(will be|is)\s+(made|sent)|(will|can)\s+(pay|send|transfer)/i;
  if (!promiseCue.test(text)) return null;
  const amountMatch = text.match(CURRENCY_AMOUNT);
  if (!amountMatch) return null;
  const currencyRaw = amountMatch[1].toUpperCase();
  const currency = currencyRaw === "$" ? "USD" : currencyRaw === "€" ? "EUR" : currencyRaw === "£" ? "GBP" : currencyRaw;
  const amount = Number(amountMatch[2].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const windowStart = Math.max(0, (amountMatch.index ?? 0) - 20);
  const windowEnd = Math.min(text.length, (amountMatch.index ?? 0) + 80);
  const window = text.slice(windowStart, windowEnd);
  const date = parseAbsoluteDate(window, referenceDate) || parseRelativeDate(window, referenceDate);

  return {
    amount,
    currency,
    date,
    confidence: date ? 0.85 : 0.6,
    extraction_basis: excerptAround(text, amountMatch.index ?? 0, amountMatch[0].length),
  };
}

export function extractCommitments(text: string): Array<{ description: string; party: "customer" | "agent"; due_date: string | null; status: "open"; evidence: string }> {
  const commitments: Array<{ description: string; party: "customer" | "agent"; due_date: string | null; status: "open"; evidence: string }> = [];
  const patterns: Array<{ re: RegExp; party: "customer" | "agent" }> = [
    { re: /I'?ll\s+(call|send|check|follow up|get back)[^.]{0,60}/gi, party: "agent" },
    { re: /(I|we)\s+will\s+(send|provide|arrange|confirm)[^.]{0,60}/gi, party: "customer" },
  ];
  for (const { re, party } of patterns) {
    let match: RegExpExecArray | null;
    const localRe = new RegExp(re.source, re.flags);
    while ((match = localRe.exec(text)) !== null) {
      commitments.push({
        description: match[0].trim(),
        party,
        due_date: parseRelativeDate(text.slice(match.index, match.index + 100), new Date()),
        status: "open",
        evidence: match[0].trim(),
      });
      if (commitments.length >= 10) break;
    }
  }
  return commitments;
}

// Small controlled vocabulary for Top Topics — matched against transcript + intent.
export const TOPIC_KEYWORDS: Record<string, RegExp[]> = {
  billing: [/invoice/i, /bill(ing)?/i, /payment/i, /charge/i],
  delivery: [/deliver(y|ed)?/i, /shipment/i, /shipping/i, /arrived?/i],
  order_status: [/order status/i, /where is my order/i, /track(ing)?/i],
  product_quality: [/damaged/i, /defective/i, /broken/i, /quality/i],
  pricing: [/price/i, /discount/i, /cost/i, /quote/i],
  complaint: [/complain/i, /unacceptable/i, /disappoint/i],
  account: [/account/i, /balance/i, /statement/i],
  new_order: [/new order/i, /place an order/i, /buy/i, /purchase/i],
};

export function detectTopics(text: string): string[] {
  const found: string[] = [];
  for (const [topic, patterns] of Object.entries(TOPIC_KEYWORDS)) {
    if (patterns.some((p) => p.test(text))) found.push(topic);
  }
  return found;
}
