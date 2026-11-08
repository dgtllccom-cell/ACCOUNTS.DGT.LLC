import { numberToWords } from "./number-to-words";

export type AmountWordsLang = "en" | "ur" | "ar" | "fa" | "ps";

/**
 * Amount in words for invoices and trade documents, in the document language.
 *
 * Returns the words followed by the ISO currency code, which is the shape the
 * English call sites already produce: `${numberToWords(x)} ${currency}`.
 * Call sites switch to this function and must NOT append the currency again.
 *
 * - 'en' delegates to numberToWords(), so English output is byte-identical.
 * - Cents follow the English convention: the two decimal digits of toFixed(2).
 * - Currency is the ISO code. CLAUDE.md treats currencies as data, not translated
 *   text, and the repo has no currency-name map, so no name is substituted.
 * - Unknown language values fall back to English.
 * - Non-English languages throw RangeError for non-finite amounts or |amount| >= 1e18.
 *
 * The non-English word tables are hand-written and need native-speaker review.
 */
export function amountInWordsLocalized(amount: number, currency: string, lang: AmountWordsLang): string {
  const spec = SPECS[lang];
  if (!spec) return `${numberToWords(amount)} ${currency}`;

  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e18) {
    throw new RangeError(`amountInWordsLocalized: unsupported amount ${amount}`);
  }

  const [wholeDigits, centDigits = "00"] = Math.abs(amount).toFixed(2).split(".");
  const whole = parseInt(wholeDigits, 10);
  const cents = parseInt(centDigits, 10);
  const isZero = whole === 0 && cents === 0;

  let body: string;
  if (isZero) {
    body = spec.zero;
  } else {
    const wholePhrase = whole > 0 ? integerWords(whole, spec) : "";
    const centsPhrase = cents > 0 ? `${integerWords(cents, spec)} ${spec.cent}` : "";
    body = wholePhrase && centsPhrase
      ? spec.joinCents(wholePhrase, centsPhrase)
      : wholePhrase || centsPhrase;
  }

  const sign = amount < 0 && !isZero ? `${spec.negative} ` : "";
  const words = `${sign}${body} ${spec.only}`;
  return currency ? `${words} ${currency}` : words;
}

interface LangSpec {
  zero: string;
  negative: string;
  only: string;
  cent: string;
  /** scales[k] is the noun for 1000^k. Index 0 is unused. */
  scales: readonly string[];
  /** Words for 1..999 with no scale word. */
  chunk: (n: number) => string;
  /** Words for `count` units of scale k. `words` converts any positive integer. */
  scaleGroup?: (count: number, k: number, words: (n: number) => string) => string;
  /** Joins two consecutive scale groups of the whole part. */
  join: (head: string, tail: string) => string;
  /** Joins the whole part to the cents phrase. */
  joinCents: (body: string, cents: string) => string;
}

function integerWords(n: number, spec: LangSpec): string {
  const words = (x: number): string => integerWords(x, spec);
  const maxIdx = spec.scales.length - 1;
  let k = 0;
  let p = 1;
  while (k < maxIdx && p * 1000 <= n) {
    p *= 1000;
    k++;
  }
  const top = Math.floor(n / p);
  const rest = n - top * p;

  let head: string;
  if (k === 0) head = spec.chunk(top);
  else if (spec.scaleGroup) head = spec.scaleGroup(top, k, words);
  else head = `${words(top)} ${spec.scales[k]}`;

  return rest === 0 ? head : spec.join(head, words(rest));
}

// ---------------------------------------------------------------------------
// Urdu (ur). Pakistani usage with thousand (hazaar) and million (million).
// Irregular 1-99 cardinal table, index = number.
const UR_WORDS: readonly string[] = [
  "", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو",
  "دس", "گیارہ", "بارہ", "تیرہ", "چودہ", "پندرہ", "سولہ", "سترہ", "اٹھارہ", "انیس",
  "بیس", "اکیس", "بائیس", "تیئیس", "چوبیس", "پچیس", "چھبیس", "ستائیس", "اٹھائیس", "انتیس",
  "تیس", "اکتیس", "بتیس", "تینتیس", "چونتیس", "پینتیس", "چھتیس", "سینتیس", "اڑتیس", "انتالیس",
  "چالیس", "اکتالیس", "بیالیس", "تینتالیس", "چوالیس", "پینتالیس", "چھیالیس", "سینتالیس", "اڑتالیس", "انچاس",
  "پچاس", "اکاون", "باون", "ترپن", "چون", "پچپن", "چھپن", "ستاون", "اٹھاون", "انسٹھ",
  "ساٹھ", "اکسٹھ", "باسٹھ", "ترسٹھ", "چونسٹھ", "پینسٹھ", "چھیاسٹھ", "سڑسٹھ", "اڑسٹھ", "انہتر",
  "ستر", "اکہتر", "بہتر", "تہتر", "چوہتر", "پچھتر", "چھہتر", "ستتر", "اٹھہتر", "اناسی",
  "اسی", "اکیاسی", "بیاسی", "تراسی", "چوراسی", "پچاسی", "چھیاسی", "ستاسی", "اٹھاسی", "نواسی",
  "نوے", "اکانوے", "بانوے", "ترانوے", "چورانوے", "پچانوے", "چھیانوے", "ستانوے", "اٹھانوے", "ننانوے",
];

const UR: LangSpec = {
  zero: "صفر",
  negative: "منفی",
  only: "صرف",
  cent: "سینٹ",
  scales: ["", "ہزار", "ملین", "ارب", "کھرب"],
  chunk: (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h > 0 ? `${UR_WORDS[h]} سو` : "", r > 0 ? UR_WORDS[r] : ""].filter(Boolean).join(" ");
  },
  join: (a, b) => `${a} ${b}`,
  joinCents: (a, b) => `${a} اور ${b}`,
};

// ---------------------------------------------------------------------------
// Persian (fa)
const FA_UNITS = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const FA_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const FA_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const FA_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

function faTensUnits(r: number): string {
  if (r < 10) return FA_UNITS[r];
  if (r < 20) return FA_TEENS[r - 10];
  const t = FA_TENS[Math.floor(r / 10)];
  const u = r % 10;
  return u > 0 ? `${t} و ${FA_UNITS[u]}` : t;
}

const FA: LangSpec = {
  zero: "صفر",
  negative: "منفی",
  only: "فقط",
  cent: "سنت",
  scales: ["", "هزار", "میلیون", "میلیارد", "تریلیون"],
  chunk: (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h > 0 ? FA_HUNDREDS[h] : "", r > 0 ? faTensUnits(r) : ""].filter(Boolean).join(" و ");
  },
  join: (a, b) => `${a} و ${b}`,
  joinCents: (a, b) => `${a} و ${b}`,
};

// ---------------------------------------------------------------------------
// Arabic (ar). Masculine counting forms, the default for an amount with no counted noun.
const AR_UNITS = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const AR_TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر",
  "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
// Dual and plural forms for counted thousands, millions, billions and trillions.
const AR_SCALE_FORMS: ReadonlyArray<{ one: string; two: string; plural: string }> = [
  { one: "", two: "", plural: "" },
  { one: "ألف", two: "ألفان", plural: "آلاف" },
  { one: "مليون", two: "مليونان", plural: "ملايين" },
  { one: "مليار", two: "ملياران", plural: "مليارات" },
  { one: "تريليون", two: "تريليونان", plural: "تريليونات" },
];

function arTensUnits(r: number): string {
  if (r < 10) return AR_UNITS[r];
  if (r < 20) return AR_TEENS[r - 10];
  const t = AR_TENS[Math.floor(r / 10)];
  const u = r % 10;
  return u > 0 ? `${AR_UNITS[u]} و${t}` : t;
}

const AR: LangSpec = {
  zero: "صفر",
  negative: "سالب",
  only: "فقط",
  cent: "سنت",
  scales: ["", "ألف", "مليون", "مليار", "تريليون"],
  chunk: (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h === 0) return arTensUnits(r);
    if (r === 0) return AR_HUNDREDS[h];
    return `${AR_HUNDREDS[h]} و${arTensUnits(r)}`;
  },
  scaleGroup: (count, k, words) => {
    const f = AR_SCALE_FORMS[k];
    if (count === 1) return f.one;
    if (count === 2) return f.two;
    if (count >= 3 && count <= 10) return `${words(count)} ${f.plural}`;
    return `${words(count)} ${f.one}`;
  },
  join: (a, b) => `${a} و${b}`,
  joinCents: (a, b) => `${a} و${b}`,
};

// ---------------------------------------------------------------------------
// Pashto (ps). Least certain table; needs native-speaker review first.
const PS_UNITS = ["", "یو", "دوه", "درې", "څلور", "پنځه", "شپږ", "اووه", "اته", "نهه"];
const PS_TEENS = ["لس", "یوولس", "دولس", "دیارلس", "څوارلس", "پنځلس", "شپاړس", "اویارلس", "اتیارلس", "نولس"];
const PS_TENS = ["", "", "شل", "دېرش", "څلوېښت", "پنځوس", "شپېته", "اویا", "اتیا", "نوي"];

function psTensUnits(r: number): string {
  if (r < 10) return PS_UNITS[r];
  if (r < 20) return PS_TEENS[r - 10];
  const t = PS_TENS[Math.floor(r / 10)];
  const u = r % 10;
  return u > 0 ? `${t} او ${PS_UNITS[u]}` : t;
}

const PS: LangSpec = {
  zero: "صفر",
  negative: "منفي",
  only: "یوازې",
  cent: "سنټ",
  scales: ["", "زر", "ملیون", "ملیارد", "ټریلیون"],
  chunk: (n) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundreds = h === 1 ? "سل" : h > 1 ? `${PS_UNITS[h]} سل` : "";
    return [hundreds, r > 0 ? psTensUnits(r) : ""].filter(Boolean).join(" ");
  },
  join: (a, b) => `${a} ${b}`,
  joinCents: (a, b) => `${a} او ${b}`,
};

const SPECS: Partial<Record<AmountWordsLang, LangSpec>> = { ur: UR, ar: AR, fa: FA, ps: PS };
