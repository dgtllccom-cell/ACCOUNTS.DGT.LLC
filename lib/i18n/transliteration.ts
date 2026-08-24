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

const AUTHENTIC_NAMES_DICT: Record<string, Record<string, string>> = {
  // Islamic & Regional Names (Compounds, Singles, and Variants)
  "asmatullah": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "asmatollah": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "asmatolla": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "asmatulla": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "ismatullah": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "ismatollah": { ur: "عصمت اللہ", ar: "عصمت الله", fa: "عصمت‌الله", ps: "عصمت الله" },
  "asmat": { ur: "عصمت", ar: "عصمت", fa: "عصمت", ps: "عصمت" },
  "ismat": { ur: "عصمت", ar: "عصمت", fa: "عصمت", ps: "عصمت" },
  "tajbeefullah": { ur: "تاج حبیب اللہ", ar: "تاج حبيب الله", fa: "تاج حبیب‌الله", ps: "تاج حبیب الله" },
  "tajbeebullah": { ur: "تاج حبیب اللہ", ar: "تاج حبيب الله", fa: "تاج حبیب‌الله", ps: "تاج حبیب الله" },
  "tajhabeebullah": { ur: "تاج حبیب اللہ", ar: "تاج حبيب الله", fa: "تاج حبیب‌الله", ps: "تاج حبیب الله" },
  "tajhabibullah": { ur: "تاج حبیب اللہ", ar: "تاج حبيب الله", fa: "تاج حبیب‌الله", ps: "تاج حبیب الله" },
  "tajbeef": { ur: "تاج حبیب", ar: "تاج حبيب", fa: "تاج حبیب", ps: "تاج حبیب" },
  "tajbeeb": { ur: "تاج حبیب", ar: "تاج حبيب", fa: "تاج حبیب", ps: "تاج حبیب" },
  "taj": { ur: "تاج", ar: "تاج", fa: "تاج", ps: "تاج" },
  "fareedullah": { ur: "فرید اللہ", ar: "فريد الله", fa: "فریدالله", ps: "فرید الله" },
  "faridullah": { ur: "فرید اللہ", ar: "فريد الله", fa: "فریدالله", ps: "فرید الله" },
  "fareed": { ur: "فرید", ar: "فريد", fa: "فرید", ps: "فرید" },
  "farid": { ur: "فرید", ar: "فريد", fa: "فرید", ps: "فرید" },
  "najeebullah": { ur: "نجیب اللہ", ar: "نجيب الله", fa: "نجیب‌الله", ps: "نجیب الله" },
  "najeeb ullah": { ur: "نجیب اللہ", ar: "نجيب الله", fa: "نجیب‌الله", ps: "نجیب الله" },
  "najibullah": { ur: "نجیب اللہ", ar: "نجيب الله", fa: "نجیب‌الله", ps: "نجیب الله" },
  "najeeb": { ur: "نجیب", ar: "نجيب", fa: "نجیب", ps: "نجيب" },
  "najib": { ur: "نجیب", ar: "نجيب", fa: "نجیب", ps: "نجيب" },
  "njyb": { ur: "نجیب", ar: "نجيب", fa: "نجیب", ps: "نجيب" },
  "taseebullah": { ur: "تصیب اللہ", ar: "تصيب الله", fa: "تصیب‌الله", ps: "تصیب الله" },
  "taseeb ullah": { ur: "تصیب اللہ", ar: "تصيب الله", fa: "تصیب‌الله", ps: "تصیب الله" },
  "haseebullah": { ur: "حسیب اللہ", ar: "حسيب الله", fa: "حسیب‌الله", ps: "حسیب الله" },
  "haseeb": { ur: "حسیب", ar: "حسيب", fa: "حسیب", ps: "حسیب" },
  "naqeebullah": { ur: "نقیب اللہ", ar: "نقيب الله", fa: "نقیب‌الله", ps: "نقیب الله" },
  "naqeeb": { ur: "نقیب", ar: "نقيب", fa: "نقیب", ps: "نقیب" },
  "habeebullah": { ur: "حبیب اللہ", ar: "حبيب الله", fa: "حبیب‌الله", ps: "حبیب الله" },
  "habibullah": { ur: "حبیب اللہ", ar: "حبيب الله", fa: "حبیب‌الله", ps: "حبیب الله" },
  "habeeb": { ur: "حبیب", ar: "حبيب", fa: "حبیب", ps: "حبیب" },
  "habib": { ur: "حبیب", ar: "حبيب", fa: "حبیب", ps: "حبیب" },
  "sanaullah": { ur: "ثناء اللہ", ar: "ثناء الله", fa: "ثناءالله", ps: "ثناء الله" },
  "amanullah": { ur: "امان اللہ", ar: "أمان الله", fa: "امان‌الله", ps: "امان الله" },
  "khalilullah": { ur: "خلیل اللہ", ar: "خليل الله", fa: "خلیل‌الله", ps: "خلیل الله" },
  "matiullah": { ur: "مطیع اللہ", ar: "مطيع الله", fa: "مطیع‌الله", ps: "مطیع الله" },
  "waliullah": { ur: "ولی اللہ", ar: "ولي الله", fa: "ولی‌الله", ps: "ولی الله" },
  "hafizullah": { ur: "حفیظ اللہ", ar: "حفيظ الله", fa: "حفیظ‌الله", ps: "حفیظ الله" },
  "samieullah": { ur: "سمیع اللہ", ar: "سميع الله", fa: "سمیع‌الله", ps: "سمیع الله" },
  "samiullah": { ur: "سمیع اللہ", ar: "سميع الله", fa: "سمیع‌الله", ps: "سمیع الله" },
  "zabihullah": { ur: "ذبیح اللہ", ar: "ذبيح الله", fa: "ذبیح‌الله", ps: "ذبیح الله" },
  "zabiullah": { ur: "ذبیح اللہ", ar: "ذبيح الله", fa: "ذبیح‌الله", ps: "ذبیح الله" },
  "roohullah": { ur: "روح اللہ", ar: "روح الله", fa: "روح‌الله", ps: "روح الله" },
  "rohullah": { ur: "روح اللہ", ar: "روح الله", fa: "روح‌الله", ps: "روح الله" },
  "saifullah": { ur: "سیف اللہ", ar: "سيف الله", fa: "سیف‌الله", ps: "سیف الله" },
  "asadullah": { ur: "اسد اللہ", ar: "أسد الله", fa: "اسدالله", ps: "اسد الله" },
  "nasratullah": { ur: "نصرت اللہ", ar: "نصرت الله", fa: "نصرت‌الله", ps: "نصرت الله" },
  "qudratullah": { ur: "قدرت اللہ", ar: "قدرة الله", fa: "قدرت‌الله", ps: "قدرت الله" },
  "inayatullah": { ur: "عنایت اللہ", ar: "عناية الله", fa: "عنایت‌الله", ps: "عنایت الله" },
  "rehmatullah": { ur: "رحمت اللہ", ar: "رحمة الله", fa: "رحمت‌الله", ps: "رحمت الله" },
  "barkatullah": { ur: "برکت اللہ", ar: "بركة الله", fa: "برکت‌الله", ps: "برکت الله" },
  "fazalullah": { ur: "فضل اللہ", ar: "فضل الله", fa: "فضل‌الله", ps: "فضل الله" },
  "ziaullah": { ur: "ضیاء اللہ", ar: "ضياء الله", fa: "ضیاءالله", ps: "ضیاء الله" },
  "noorullah": { ur: "نور اللہ", ar: "نور الله", fa: "نورالله", ps: "نور الله" },
  "ullah": { ur: "اللہ", ar: "الله", fa: "الله", ps: "الله" },
  "ollah": { ur: "اللہ", ar: "الله", fa: "الله", ps: "الله" },
  "abdullah": { ur: "عبداللہ", ar: "عبد الله", fa: "عبدالله", ps: "عبد الله" },
  "abdul": { ur: "عبدال", ar: "عبد ال", fa: "عبدال", ps: "عبدال" },
  "abdel": { ur: "عبدال", ar: "عبد ال", fa: "عبدال", ps: "عبدال" },
  "abd": { ur: "عبد", ar: "عبد", fa: "عبد", ps: "عبد" },
  "muhammad": { ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  "mohammad": { ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  "saleem": { ur: "سلیم", ar: "سليم", fa: "سلیم", ps: "سلیم" },
  "salim": { ur: "سلیم", ar: "سليم", fa: "سلیم", ps: "سلیم" },
  "anees": { ur: "انیس", ar: "أنيس", fa: "انیس", ps: "انیس" },
  "anis": { ur: "انیس", ar: "أنيس", fa: "انیس", ps: "انیس" },
  "shareef": { ur: "شریف", ar: "شريف", fa: "شریف", ps: "شریف" },
  "sharif": { ur: "شریف", ar: "شريف", fa: "شریف", ps: "شریف" },
  "idrees": { ur: "ادریس", ar: "إدريس", fa: "ادریس", ps: "ادریس" },
  "idris": { ur: "ادریس", ar: "إدريس", fa: "ادریس", ps: "ادریس" },
  "haroon": { ur: "ہارون", ar: "هارون", fa: "هارون", ps: "هارون" },
  "sana": { ur: "ثناء", ar: "ثناء", fa: "ثناء", ps: "ثناء" },
  "shahbaz": { ur: "شہباز", ar: "شهباز", fa: "شهباز", ps: "شهباز" },
  "kamil": { ur: "کامل", ar: "كامل", fa: "کامل", ps: "کامل" },
  "khan": { ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  "tariq": { ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" },
  "jamil": { ur: "جمیل", ar: "جميل", fa: "جمیل", ps: "جمیل" },
  "iqbal": { ur: "اقبال", ar: "إقبال", fa: "اقبال", ps: "اقبال" },
  "ghani": { ur: "غنی", ar: "غني", fa: "غنی", ps: "غنی" },
  "rashid": { ur: "راشد", ar: "راشد", fa: "راشد", ps: "راشد" },
  "ahmad": { ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  "ahmed": { ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  "ali": { ur: "علی", ar: "علي", fa: "علی", ps: "علی" },
  "hassan": { ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  "hussain": { ur: "حسین", ar: "حسين", fa: "حسین", ps: "حسین" },
  "bilal": { ur: "بلال", ar: "بلال", fa: "بلال", ps: "بلال" },
  "usman": { ur: "عثمان", ar: "عثمان", fa: "عثمان", ps: "عثمان" },
  "osman": { ur: "عثمان", ar: "عثمان", fa: "عثمان", ps: "عثمان" },
  "othman": { ur: "عثمان", ar: "عثمان", fa: "عثمان", ps: "عثمان" },
  "umar": { ur: "عمر", ar: "عمر", fa: "عمر", ps: "عمر" },
  "omer": { ur: "عمر", ar: "عمر", fa: "عمر", ps: "عمر" },
  "malik": { ur: "ملک", ar: "مالك", fa: "ملک", ps: "ملک" },
  "syed": { ur: "سید", ar: "سيد", fa: "سید", ps: "سید" },
  "shaikh": { ur: "شیخ", ar: "شيخ", fa: "شیخ", ps: "شیخ" },
  "sheikh": { ur: "شیخ", ar: "شيخ", fa: "شیخ", ps: "شیخ" },
  "chaudhary": { ur: "چوہدری", ar: "شودري", fa: "چودهری", ps: "چوهدری" },
  "bhatti": { ur: "بھٹی", ar: "بهتي", fa: "بهتی", ps: "بهټي" },
  "niazi": { ur: "نیازی", ar: "نيازي", fa: "نیازی", ps: "نیازی" },
  "durrani": { ur: "درانی", ar: "دراني", fa: "درانی", ps: "درانی" },
  "kakar": { ur: "کاکڑ", ar: "كاكر", fa: "کاکړ", ps: "کاکړ" },
  "achakzai": { ur: "اچکزئی", ar: "أشاكزاي", fa: "اچکزی", ps: "اچکزی" },
  "tareen": { ur: "ترین", ar: "ترين", fa: "ترین", ps: "ترین" },
  "marwat": { ur: "مروت", ar: "مروات", fa: "مروت", ps: "مروت" },
  "wazir": { ur: "وزیر", ar: "وزير", fa: "وزیر", ps: "وزیر" },
  "damaan": { ur: "دامان", ar: "دامان", fa: "دامان", ps: "دامان" },
  "dgt": { ur: "ڈی جی ٹی", ar: "دي جي تي", fa: "دی جی تی", ps: "ډي جي ټي" },
  "llc": { ur: "ایل ایل سی", ar: "ذ.م.م", fa: "با مسئولیت محدود", ps: "LLC" },
  "fzco": { ur: "ایف زیڈ سی او", ar: "ش.م.ح", fa: "FZCO", ps: "FZCO" },
  "trading": { ur: "ٹریڈنگ", ar: "تجارة", fa: "تجارت", ps: "سوداګري" },
  "company": { ur: "کمپنی", ar: "شركة", fa: "شرکت", ps: "شرکت" },
  "import": { ur: "امپورٹ", ar: "استيراد", fa: "واردات", ps: "واردات" },
  "export": { ur: "ایکسپورٹ", ar: "تصدير", fa: "صادرات", ps: "صادرات" },
  "steel": { ur: "اسٹیل", ar: "فولاذ", fa: "فولاد", ps: "فولاد" },
  "purchase": { ur: "پرچیز", ar: "شراء", fa: "خرید", ps: "پیرود" },
  "united arab emirates": { ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "uae": { ur: "یو اے ای", ar: "الإمارات", fa: "امارات", ps: "امارات" },
  "dubai": { ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دوبۍ" },
  "amart dubai": { ur: "امارت دبئی", ar: "إمارة دبي", fa: "امارت دبی", ps: "دوبۍ امارت" },
  "amart": { ur: "امارت", ar: "إمارة", fa: "امارت", ps: "امارت" },
  "amarat": { ur: "امارت", ar: "إمارة", fa: "امارت", ps: "امارت" },
  "emirates": { ur: "امارات", ar: "الإمارات", fa: "امارات", ps: "امارات" },
  "deira": { ur: "دیرہ", ar: "ديرة", fa: "دیره", ps: "دیره" },
  "dyrh": { ur: "دیرہ", ar: "ديرة", fa: "دیره", ps: "دیره" },
  "al ras": { ur: "الراس", ar: "الراس", fa: "الراس", ps: "الراس" },
  "ras": { ur: "راس", ar: "رأس", fa: "راس", ps: "راس" },
  "aind": { ur: "اینڈ", ar: "و", fa: "و", ps: "او" },
  "and": { ur: "اینڈ", ar: "و", fa: "و", ps: "او" }
};

function romanizeToArabicSkeleton(word: string): string {
  const lower = word.toLowerCase();
  let out = "";
  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    let matched = false;
    for (const [seq, rep] of DIGRAPHS) {
      if (rest.startsWith(seq)) {
        out += rep;
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = lower[i];
    out += SINGLES[ch] ?? ch;
    i += 1;
  }
  return out;
}

function romanizeWord(word: string, lang: SupportedLanguage): string {
  const clean = word.toLowerCase().trim();
  if (!clean) return word;
  
  // 1. Direct whole-word dictionary lookup
  const exact = AUTHENTIC_NAMES_DICT[clean];
  if (exact && exact[lang]) return exact[lang];

  // 2. Suffix stemming for compound "ullah" / "ollah" names
  const ullahSuffixes = ["ullah", "ollah", "ulla", "olla"];
  for (const suf of ullahSuffixes) {
    if (clean.length > suf.length + 2 && clean.endsWith(suf)) {
      const base = clean.slice(0, -suf.length);
      const baseMapped = AUTHENTIC_NAMES_DICT[base]?.[lang] || romanizeWord(base, lang);
      const ullahWord = lang === "ar" ? "الله" : lang === "fa" ? "‌الله" : "اللہ";
      return `${baseMapped} ${ullahWord}`.trim();
    }
  }

  // 3. Prefix stemming for "abdul-" / "abdel-" names
  const abdulPrefixes = ["abdul", "abdel", "abd"];
  for (const pref of abdulPrefixes) {
    if (clean.length > pref.length + 2 && clean.startsWith(pref)) {
      const remainder = clean.slice(pref.length);
      const remMapped = AUTHENTIC_NAMES_DICT[remainder]?.[lang] || romanizeWord(remainder, lang);
      const abdulWord = lang === "ar" ? "عبد ال" : "عبدال";
      return `${abdulWord}${remMapped}`.trim();
    }
  }

  // 4. Fallback character skeleton with overrides
  return romanizeToArabicSkeleton(word);
}

/** Transliterate a proper noun (place/person name) into the target script. English passes through unchanged. */
export function transliterateProperNoun(text: string, lang: SupportedLanguage): string {
  const trimmed = text.trim();
  if (!trimmed || lang === "en") return trimmed;

  // Check full multi-word phrase first
  const fullKey = trimmed.toLowerCase();
  if (AUTHENTIC_NAMES_DICT[fullKey]?.[lang]) {
    return AUTHENTIC_NAMES_DICT[fullKey][lang];
  }

  // Split on words while preserving punctuation and whitespace delimiters
  const parts = trimmed.split(/([\s,;&\-\/\.\(\)]+)/);
  const mapped = parts.map((part) => {
    if (!part || /^[\s,;&\-\/\.\(\)]+$/.test(part)) {
      if (part.includes("&")) {
        const andWord = lang === "ur" ? " اور " : lang === "ar" ? " و" : " اور ";
        return part.replace("&", andWord);
      }
      return part;
    }
    return romanizeWord(part, lang);
  });

  const skeleton = mapped.join("");
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

/** Localize or transliterate any business/entity term dynamically into the target language. */
export function localizeTerm(val: string | null | undefined, lang: string = "en"): string {
  if (!val) return "";
  if (lang === "en") return val;
  return transliterateProperNoun(val, lang as SupportedLanguage);
}

