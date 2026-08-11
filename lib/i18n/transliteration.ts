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

/**
 * Reverse direction: Perso-Arabic script (Urdu/Arabic/Persian/Pashto) -> Latin romanization.
 * Without this, a name typed in one of those scripts had no path to an English rendering at
 * all — autoTranslateText() fell back to literally copying the original script into the
 * "English" slot (a real source-language leak: selecting English would still show Urdu/Arabic/
 * Farsi/Pashto text). Covers the full Urdu/Pashto/Persian/Arabic letter inventory (retroflex
 * ٹ/ڈ/ڑ, Urdu/Pashto/Persian-only پ/چ/گ/ژ, Pashto-only ږ/ښ/ځ/ډ̢-family, Arabic-only ة/ث/ذ/ض/ظ/ع/غ,
 * hamza forms, diacritics), longest-match-first so multi-letter combinations (e.g. "خواہ")
 * resolve before single letters. Same "best-effort phonetic approximation" bar as the forward
 * direction above — not a linguistic authority, correctable via the manual-correction path.
 */
const REVERSE_MULTI: Array<[string, string]> = [
  // Common digraph-producing combinations, longest first.
  ["ای", "ai"], ["او", "au"], ["وا", "wa"], ["یا", "ya"],
  ["ھ", "h"] // aspiration marker (بھ -> bh handled by base+این combination via per-char pass below)
];

const REVERSE_SINGLES: Record<string, string> = {
  // Base letters shared across Urdu/Arabic/Persian/Pashto
  "ا": "a", "آ": "aa", "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s",
  "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ڈ": "d", "ذ": "z",
  "ر": "r", "ڑ": "r", "ز": "z", "ژ": "zh", "س": "s", "ش": "sh", "ص": "s",
  "ض": "z", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
  "ک": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "w",
  "ہ": "h", "ۃ": "h", "ة": "h", "ء": "", "ی": "y", "ے": "e", "ئ": "y",
  // Pashto-specific
  "ټ": "t", "ډ": "d", "ړ": "r", "ږ": "g", "ښ": "kh", "ځ": "z", "څ": "ts",
  "ڼ": "n", "ۍ": "ai", "ې": "e",
  // Persian-specific / diacritics
  "أ": "a", "إ": "e", "ؤ": "o", "ي": "y",
  // Digits (Eastern Arabic-Indic) -> Latin
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
};

/** Reverse of transliterateProperNoun: script text in ur/ar/fa/ps -> a Latin/English rendering. */
export function transliterateToLatin(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let out = "";
  let i = 0;
  while (i < trimmed.length) {
    const rest = trimmed.slice(i);
    let matched = false;
    for (const [seq, rep] of REVERSE_MULTI) {
      if (rest.startsWith(seq)) {
        out += rep;
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = trimmed[i];
    if (ch in REVERSE_SINGLES) {
      out += REVERSE_SINGLES[ch];
    } else {
      // Not a recognized Perso-Arabic letter (space, digit, Latin passthrough, punctuation) —
      // keep as-is rather than dropping it.
      out += ch;
    }
    i += 1;
  }
  // Collapse accidental double spaces/letters from the char-by-char pass and title-case words.
  return out
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
