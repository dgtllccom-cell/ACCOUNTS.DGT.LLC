import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Rule-based Latin -> Perso-Arabic script transliteration.
 *
 * Purpose: proper nouns (place names, person names) registered with mode "transliterate"
 * in lib/i18n/translatable-fields.ts. These have no fixed "translation" — "Karachi" isn't
 * translated into Urdu, it's rendered phonetically as کراچی. A closed dictionary can only
 * ever cover a curated list; this produces a genuine (not English-copied) script rendering
 * for ANY Latin input, entirely offline — no external API, matching the ERP's existing
 * "local, offline" translation engine design.
 *
 * Approach: romanize the input into a single canonical Arabic-script skeleton (greedy
 * longest-match over digraphs/trigraphs, then single letters, with light vowel handling),
 * then apply small per-language letter substitutions for sounds each script represents
 * differently (Urdu/Pashto retroflex ٹ/ڈ/ڑ, Persian/Urdu/Pashto پ/چ/گ/ژ that Arabic proper
 * lacks, etc). This is a best-effort phonetic approximation, not a linguistic authority —
 * exactly like any transliteration scheme (e.g. ALA-LC, ISO 233); Super Admin can always
 * correct an individual record afterward through the existing manual-correction path.
 *
 * Not used for mode:"translate" fields — those keep using the curated dictionary only,
 * since transliterating a phrase like "Employee Reports" would produce nonsense instead of
 * translating its meaning.
 */

// Multi-character sequences first (longest match wins), then single letters.
// Base mapping targets Arabic script; per-language override table follows.
const DIGRAPHS: Array<[string, string]> = [
  ["kh", "خ"],
  ["gh", "غ"],
  ["sh", "ش"],
  ["ch", "چ"],
  ["th", "ث"],
  ["dh", "ذ"],
  ["ph", "ف"],
  ["zh", "ژ"],
  ["ck", "ک"],
  ["ng", "نگ"],
  ["oo", "و"],
  ["ee", "ی"],
  ["ea", "ی"],
  ["ou", "او"],
  ["ow", "او"],
  ["ai", "ای"],
  ["ay", "ای"],
  ["oy", "وی"],
  ["ie", "ای"],
  ["ur", "ر"],
  ["er", "ر"],
  ["ar", "ر"],
  ["or", "ور"],
  ["qu", "کو"]
];

const SINGLES: Record<string, string> = {
  a: "ا", b: "ب", c: "ک", d: "د", e: "ی", f: "ف", g: "گ", h: "ہ",
  i: "ی", j: "ج", k: "ک", l: "ل", m: "م", n: "ن", o: "و", p: "پ",
  q: "ق", r: "ر", s: "س", t: "ت", u: "و", v: "و", w: "و", x: "کس",
  y: "ی", z: "ز"
};

// Per-language letter substitutions applied to the Arabic-script skeleton above.
// Arabic itself has no پ/چ/گ/ژ — approximate with the nearest native letter.
const LANG_OVERRIDES: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  ar: { پ: "ب", چ: "تش", گ: "ج", ژ: "ز" },
  // Urdu/Persian/Pashto already use پ چ گ ژ natively — no override needed.
  ur: {},
  fa: {},
  ps: {}
};

function romanizeToArabicSkeleton(word: string): string {
  const lower = word.toLowerCase();
  let out = "";
  let i = 0;
  while (i < lower.length) {
    const ch = lower[i];
    if (!/[a-z]/.test(ch)) {
      out += ch; // keep spaces, digits, punctuation as-is
      i += 1;
      continue;
    }
    let matched = false;
    for (const [seq, rep] of DIGRAPHS) {
      if (lower.startsWith(seq, i)) {
        out += rep;
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    out += SINGLES[ch] ?? "";
    i += 1;
  }
  return out;
}

/** Transliterate a proper noun (place/person name) into the target script. English passes through unchanged. */
export function transliterateProperNoun(text: string, lang: SupportedLanguage): string {
  const trimmed = text.trim();
  if (!trimmed || lang === "en") return trimmed;

  const skeleton = trimmed
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : romanizeToArabicSkeleton(part)))
    .join("");

  const overrides = LANG_OVERRIDES[lang] ?? {};
  if (Object.keys(overrides).length === 0) return skeleton;

  let out = "";
  for (const ch of skeleton) {
    out += overrides[ch] ?? ch;
  }
  return out;
}
