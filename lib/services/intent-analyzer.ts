/**
 * Intent Analyzer Service
 *
 * Analyzes transcribed voice/text to extract:
 * - Intent (what the user wants to do: payment, order, inquiry, etc.)
 * - Entities (structured fields: amount, account, party, date, etc.)
 * - Confidence scores
 *
 * Language-aware: understands terms in EN, UR, PS, FA, AR
 */

import type { SupportedLanguage } from "@/lib/i18n/languages";

export type Intent =
  | "make_payment"
  | "record_purchase"
  | "record_sale"
  | "file_inquiry"
  | "check_balance"
  | "request_information"
  | "unknown";

export type ExtractedEntity = {
  type: "amount" | "account" | "party" | "date" | "goods_code" | "currency" | "custom";
  value: string | number | Date;
  confidence: number;
  source_text: string; // The raw text this was extracted from
};

export type IntentAnalysisResult = {
  intent: Intent;
  intentConfidence: number;
  entities: ExtractedEntity[];
  raw_transcript: string;
  language: SupportedLanguage;
  processingTimeMs: number;
};

// Multilingual keyword patterns for intent detection
const INTENT_KEYWORDS: Record<Intent, Record<SupportedLanguage, string[]>> = {
  make_payment: {
    en: ["pay", "payment", "transfer", "send", "remit", "invoice"],
    ur: ["ادائیگی", "رقم", "بھیجیں", "منتقل", "حوالہ"],
    ps: ["پرداخت", "رقم", "لیږل", "انتقال"],
    fa: ["پرداخت", "پول", "فرستادن", "انتقال"],
    ar: ["دفع", "تحويل", "إرسال", "فاتورة"],
  },
  record_purchase: {
    en: ["purchase", "buy", "order", "supplier", "vendor"],
    ur: ["خریداری", "خریدیں", "آرڈر", "سپلائی", "فروخت"],
    ps: ["خریدل", "امر", "رسندوی"],
    fa: ["خریداری", "سفارش", "تامین کننده"],
    ar: ["شراء", "أمر", "مورد"],
  },
  record_sale: {
    en: ["sale", "sell", "customer", "revenue", "invoice"],
    ur: ["فروخت", "بیچیں", "گاہک", "رسید"],
    ps: ["فروخت", "پيل", "موسیقار"],
    fa: ["فروش", "فاتورة", "مشتری"],
    ar: ["بيع", "بيع", "عميل", "فاتورة"],
  },
  file_inquiry: {
    en: ["inquiry", "question", "ask", "check", "status"],
    ur: ["استفسار", "سوال", "پوچھیں", "چیک"],
    ps: ["پوپ", "سوال", "درغواستی"],
    fa: ["پرسش", "سؤال", "بررسی"],
    ar: ["استفسار", "سؤال", "حالة"],
  },
  check_balance: {
    en: ["balance", "amount due", "outstanding", "account balance"],
    ur: ["بیلنس", "رقم", "بقایا", "حساب"],
    ps: ["بیلنس", "رقم", "نه شوي"],
    fa: ["موجودي", "بدهي", "حساب"],
    ar: ["رصيد", "المبلغ المستحق", "الرصيد"],
  },
  request_information: {
    en: ["info", "information", "tell", "explain", "details"],
    ur: ["معلومات", "بتایا", "تفصیلات", "وضاحت"],
    ps: ["معلومات", "وايي", "تفصيل"],
    fa: ["اطلاعات", "توضيح", "جزئيات"],
    ar: ["معلومات", "بيانات", "تفاصيل"],
  },
  unknown: {
    en: [],
    ur: [],
    ps: [],
    fa: [],
    ar: [],
  },
};

// Patterns for extracting amounts
const AMOUNT_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  en: [
    /(\d+(?:[,.]?\d+)*)\s*(thousand|million|lakh|crore|rupee|dollar|dirham|pound)?/gi,
    /\b(fifty|hundred|thousand|million)\b/gi,
  ],
  ur: [
    /(\d+(?:[,.]?\d+)*)\s*(ہزار|لاکھ|کروڑ|روپے)?/gi,
    /\b(پچاس|سو|ہزار|لاکھ|کروڑ)\b/gi,
  ],
  ps: [
    /(\d+(?:[,.]?\d+)*)\s*(زره|لاک|کروڑ|روپۍ)?/gi,
    /\b(پنجاه|سل|زره|لاک)\b/gi,
  ],
  fa: [
    /(\d+(?:[,.]?\d+)*)\s*(تومان|میلیون|میلیارد|ریال)?/gi,
    /\b(پنجاه|صد|هزار|میلیون)\b/gi,
  ],
  ar: [
    /(\d+(?:[,.]?\d+)*)\s*(ريال|دينار|دولار|ألف|مليون)?/gi,
    /\b(خمسين|مائة|ألف|مليون)\b/gi,
  ],
};

// Patterns for extracting dates
const DATE_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  en: [
    /\b(today|tomorrow|yesterday|next\s+\w+|last\s+\w+)\b/gi,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/g,
  ],
  ur: [
    /\b(آج|کل|کسی دن|اگلے ہفتے|پچھلے ماہ)\b/gi,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/g,
  ],
  ps: [
    /\b(نن|سهال|تیره|راتلنې)\b/gi,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/g,
  ],
  fa: [
    /\b(امروز|فردا|دیروز|هفته آينده|ماه گذشته)\b/gi,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/g,
  ],
  ar: [
    /\b(اليوم|غدا|أمس|الأسبوع القادم|الشهر الماضي)\b/gi,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/g,
  ],
};

/**
 * Detect intent from transcribed text.
 * Returns the detected intent and confidence score.
 */
export function detectIntent(
  transcript: string,
  language: SupportedLanguage,
): { intent: Intent; confidence: number } {
  const text = transcript.toLowerCase().trim();

  // Score each intent based on keyword matches
  const scores: Record<Intent, number> = {
    make_payment: 0,
    record_purchase: 0,
    record_sale: 0,
    file_inquiry: 0,
    check_balance: 0,
    request_information: 0,
    unknown: 0,
  };

  // Count keyword matches for each intent
  for (const intent of Object.keys(scores) as Intent[]) {
    const keywords = INTENT_KEYWORDS[intent]?.[language] || [];
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b${keyword}\\b`, "gi");
      const matches = text.match(pattern) || [];
      scores[intent] += matches.length * 0.3; // Weight: 0.3 per keyword match
    }
  }

  // Find intent with highest score
  let maxScore = 0;
  let topIntent: Intent = "unknown";

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topIntent = intent as Intent;
    }
  }

  // Normalize confidence to 0-1 range
  const confidence = Math.min(maxScore / 2, 1);

  return {
    intent: maxScore > 0 ? topIntent : "unknown",
    confidence: Math.max(confidence, 0.3), // Minimum confidence 0.3
  };
}

/**
 * Extract entities (amount, date, party, etc.) from text.
 */
export function extractEntities(
  transcript: string,
  language: SupportedLanguage,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const text = transcript.trim();

  // Extract amounts
  const amountPatterns = AMOUNT_PATTERNS[language] || [];
  for (const pattern of amountPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const numStr = match[1]?.replace(/,/g, "") || "0";
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        entities.push({
          type: "amount",
          value: num,
          confidence: 0.9,
          source_text: match[0],
        });
      }
    }
  }

  // Extract dates
  const datePatterns = DATE_PATTERNS[language] || [];
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const dateStr = match[0];
      // Try to parse as date
      const parsed = parseRelativeDate(dateStr, language);
      if (parsed) {
        entities.push({
          type: "date",
          value: parsed,
          confidence: 0.85,
          source_text: dateStr,
        });
      }
    }
  }

  // Extract currency codes (simplified)
  const currencyKeywords: Record<SupportedLanguage, { [key: string]: string }> = {
    en: { rupee: "PKR", dollar: "USD", dirham: "AED", pound: "GBP" },
    ur: { روپے: "PKR", ڈالر: "USD", درہم: "AED" },
    ps: { روپۍ: "PKR", ډالر: "USD" },
    fa: { تومان: "IRR", دولار: "USD", درهم: "AED" },
    ar: { ريال: "SAR", دولار: "USD", دينار: "KWD" },
  };

  const currencyCodes = currencyKeywords[language] || {};
  for (const [keyword, code] of Object.entries(currencyCodes)) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      entities.push({
        type: "currency",
        value: code,
        confidence: 0.95,
        source_text: keyword,
      });
    }
  }

  return entities;
}

/**
 * Parse relative date strings like "today", "tomorrow", etc.
 */
function parseRelativeDate(dateStr: string, language: SupportedLanguage): Date | null {
  const lower = dateStr.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // English
  if (language === "en") {
    if (lower.includes("today")) return new Date(today);
    if (lower.includes("tomorrow")) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    if (lower.includes("yesterday")) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
  }

  // Urdu
  if (language === "ur") {
    if (lower.includes("آج")) return new Date(today);
    if (lower.includes("کل")) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
  }

  // Try to parse numeric date (dd/mm/yyyy)
  const numericPattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/;
  const match = dateStr.match(numericPattern);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // 0-indexed
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;

    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Main entry point: analyze transcript and extract all information.
 */
export function analyzeTranscript(
  transcript: string,
  language: SupportedLanguage,
): IntentAnalysisResult {
  const startTime = Date.now();

  const { intent, confidence: intentConfidence } = detectIntent(transcript, language);
  const entities = extractEntities(transcript, language);

  return {
    intent,
    intentConfidence,
    entities,
    raw_transcript: transcript,
    language,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Batch analyze multiple transcripts (for bulk processing).
 */
export function batchAnalyzeTranscripts(
  transcripts: Array<{ text: string; language: SupportedLanguage }>,
): IntentAnalysisResult[] {
  return transcripts.map(({ text, language }) => analyzeTranscript(text, language));
}
