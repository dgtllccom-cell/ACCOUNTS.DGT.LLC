// Server-side / build-time only (pulls in the DB-backed translation memory).
//
// ── ERP Auto-i18n Engine ────────────────────────────────────────────────────
//
// The permanent mechanism that keeps the ERP five-language-ready *by default*.
// Whenever a new form / page / module / report / field / button / document adds
// an English UI string (or a translatable record field), this engine produces
// and stores the UR / AR / FA / PS renderings automatically — reusing the ERP's
// own approved terminology first and NEVER inventing a translation for a
// protected token (numbers, IDs, codes, currencies, {placeholders}, dates).
//
// It is a thin, opinionated layer over the existing central translator
// (`translateErp` — approved TM → curated glossary → machine memory → local
// phrase engine → optional AI tier → optional external MT). This module adds:
//   • protected-token masking so codes/amounts/placeholders survive verbatim
//   • an acceptance gate (no residual Latin in an RTL target, must differ from
//     English unless the source is itself neutral) so we never store a
//     low-confidence guess
//   • per-language provenance ({ engine, confidence }) for review / promotion
//
// Callers:  scripts/i18n-autofill.mts (UI dictionary), record-translation-sync.

import {
  ERP_LANGS,
  normalizeForMatch,
  translateErp,
  type TranslationEngine,
} from "@/lib/i18n/erp-translator";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { GlossaryDomain } from "@/lib/i18n/erp-glossary";

export type TargetLanguage = Exclude<SupportedLanguage, "en">;
export const TARGET_LANGS: TargetLanguage[] = ["ur", "ar", "fa", "ps"];

export type LangProvenance = {
  value: string;
  engine: TranslationEngine | "identity" | "protected";
  confidence: number;
};

export type FiveLanguageResult = {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
  /** per-target-language provenance; absent target === could not translate cleanly */
  provenance: Partial<Record<TargetLanguage, LangProvenance>>;
  /** targets the engine could NOT render cleanly (left as English — a human owes a translation) */
  unresolved: TargetLanguage[];
};

// ── protected tokens — NEVER translated, restored verbatim ───────────────────
// Ordered numeric/code patterns FIRST so a sentinel's own index digits can never
// be re-matched by a later (number) pattern.
const PROTECTED_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g, // ISO date / datetime
  /\b[A-Z]{2,}-?\d{2,}[A-Z0-9-]*\b/g,                      // TB-000001, DSA2025-0908
  /\b(?:USD|AED|PKR|EUR|AFN|INR|SAR|OMR|GBP|CNY)\b/g,      // currency ISO codes
  /\b\d[\d,.]*\b/g,                                        // numbers / amounts
  /\$\{[^{}]+\}/g,                                         // ${x}
  /\{[^{}]+\}/g,                                           // {count}, {name}
  /%[sd@]/g,                                               // %s %d %@
  /\bhttps?:\/\/\S+/gi,                                    // urls
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,                         // emails
  /&[a-z]+;|&#\d+;/gi,                                     // html entities
];

// Sentinel = "SYMBOL FOR UNIT SEPARATOR" + index + "SYMBOL FOR RECORD SEPARATOR".
// Category So (visible control-picture glyphs): never Latin, never Arabic, not
// matched by any pattern above, and passed through untouched by every translation
// tier. Restored positionally.
const S_OPEN = "␟";
const S_CLOSE = "␞";
const SENTINEL_RE = /␟(\d+)␞/g;

function maskProtected(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  let masked = text;
  for (const re of PROTECTED_PATTERNS) {
    masked = masked.replace(re, (m) => {
      const idx = tokens.push(m) - 1;
      return `${S_OPEN}${idx}${S_CLOSE}`;
    });
  }
  return { masked, tokens };
}

function unmask(text: string, tokens: string[]): string {
  return text.replace(SENTINEL_RE, (_, n) => tokens[Number(n)] ?? "");
}

/** Replace sentinels with a space so residual-content checks ignore protected tokens. */
function stripSentinels(text: string): string {
  return text.replace(SENTINEL_RE, " ");
}

/** True when `text` still holds every sentinel it started with (translation did not drop one). */
function sentinelsIntact(masked: string, translated: string): boolean {
  const count = (s: string) => (s.match(SENTINEL_RE) || []).length;
  return count(masked) === count(translated);
}

/** A value that is *entirely* protected tokens / punctuation — legitimately identical in every language. */
export function isNeutralValue(maskedText: string): boolean {
  const stripped = stripSentinels(maskedText).replace(/[\s\p{P}\p{S}\p{Co}\d]/gu, "");
  return stripped.length === 0;
}

const LATIN_LETTER_RUN = /[A-Za-z]{2,}/;

export type GenerateOpts = {
  domain?: GlossaryDomain;
  /** allow the external MT tier (Google). Default false — deterministic + local only. */
  allowExternal?: boolean;
  /** allow the AI tier when AI_TRANSLATE_* is configured. Default follows allowExternal. */
  allowAI?: boolean;
  /** persist accepted machine/local results back into translation memory. Default true. */
  learn?: boolean;
  /** minimum engine confidence to accept a rendering. Default 0.55. */
  minConfidence?: number;
};

/**
 * Produce UR / AR / FA / PS for one English string. Never fabricates: a target
 * the engine cannot render cleanly is returned as the English source and listed
 * in `unresolved` (the caller keeps the guard honest — a human still owes that
 * one a real translation).
 */
export async function generateFiveLanguages(
  english: string,
  opts: GenerateOpts = {},
): Promise<FiveLanguageResult> {
  const en = (english ?? "").toString();
  const minConfidence = opts.minConfidence ?? 0.55;
  const result: FiveLanguageResult = {
    en, ur: en, ar: en, fa: en, ps: en, provenance: {}, unresolved: [],
  };
  if (!en.trim()) return result;

  const { masked, tokens } = maskProtected(en);
  const neutral = isNeutralValue(masked);
  const enNorm = normalizeForMatch(en);
  const online = Boolean(opts.allowExternal || opts.allowAI);

  // Offline, the local phrase engine does word-by-word substitution — fine for a
  // term ("Purchase" → "خریداری"), unreliable for a sentence's word ORDER. So for
  // anything longer than two words we only trust a curated whole-phrase hit
  // (approved memory ≥1 / glossary-exact 0.97) unless an online tier is allowed.
  const wordCount = stripSentinels(masked).trim().split(/\s+/).filter(Boolean).length;
  const effMinConfidence = !online && wordCount > 2 ? Math.max(minConfidence, 0.92) : minConfidence;

  for (const lang of TARGET_LANGS) {
    if (neutral) {
      // e.g. "PDF", "{count}", "#", "USD 1,000" → identical across languages, by design.
      result[lang] = en;
      result.provenance[lang] = { value: en, engine: "protected", confidence: 1 };
      continue;
    }

    const t = await translateErp(masked, "en", {
      targetLang: lang,
      domain: opts.domain,
      allowExternal: opts.allowExternal ?? false,
      allowAI: opts.allowAI ?? opts.allowExternal ?? false,
      learn: opts.learn ?? true,
    });

    const rendered = unmask(t.text, tokens).trim();
    const cleanForCheck = stripSentinels(t.text);
    const accepted =
      rendered.length > 0 &&
      t.engine !== "identity" &&
      t.confidence >= effMinConfidence &&
      normalizeForMatch(rendered) !== enNorm &&
      sentinelsIntact(masked, t.text) &&
      !LATIN_LETTER_RUN.test(cleanForCheck); // no leftover English word anywhere

    if (accepted) {
      result[lang] = rendered;
      result.provenance[lang] = { value: rendered, engine: t.engine, confidence: t.confidence };
    } else {
      result[lang] = en; // keep English — do NOT store a guess
      result.unresolved.push(lang);
    }
  }

  return result;
}

/**
 * Batch helper — de-duplicates identical English strings so N keys sharing a
 * label cost one translation. Returns a map keyed by the original English.
 */
export async function generateForMany(
  englishValues: string[],
  opts: GenerateOpts = {},
): Promise<Map<string, FiveLanguageResult>> {
  const out = new Map<string, FiveLanguageResult>();
  const unique = [...new Set(englishValues.map((v) => (v ?? "").toString()))];
  for (const v of unique) out.set(v, await generateFiveLanguages(v, opts));
  return out;
}

export { ERP_LANGS };
