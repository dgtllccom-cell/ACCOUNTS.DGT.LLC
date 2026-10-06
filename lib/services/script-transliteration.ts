const arabicScriptMap: Record<string, string> = {
  "\u0627": "a",
  "\u0622": "aa",
  "\u0628": "b",
  "\u067e": "p",
  "\u062a": "t",
  "\u0679": "t",
  "\u062b": "s",
  "\u062c": "j",
  "\u0686": "ch",
  "\u062d": "h",
  "\u062e": "kh",
  "\u062f": "d",
  "\u0688": "d",
  "\u0630": "z",
  "\u0631": "r",
  "\u0691": "r",
  "\u0632": "z",
  "\u0698": "zh",
  "\u0633": "s",
  "\u0634": "sh",
  "\u0635": "s",
  "\u0636": "z",
  "\u0637": "t",
  "\u0638": "z",
  "\u0639": "a",
  "\u063a": "gh",
  "\u0641": "f",
  "\u0642": "q",
  "\u06a9": "k",
  "\u0643": "k",
  "\u06af": "g",
  "\u0644": "l",
  "\u0645": "m",
  "\u0646": "n",
  "\u06ba": "n",
  "\u0648": "w",
  "\u0624": "o",
  "\u06c1": "h",
  "\u06be": "h",
  "\u0621": "",
  "\u06cc": "y",
  "\u064a": "y",
  "\u06d2": "e",
  "\u0626": "y",
  "\u0629": "h",
  "\u0649": "a",
  "\u0623": "a",
  "\u0625": "i",
  "\u064e": "",
  "\u0650": "",
  "\u064f": "",
  "\u0651": "",
  "\u0652": "",
  "\u060c": ",",
  "\u06d4": ".",
  "\u061f": "?"
};

const arabicScriptPattern = /[\u0600-\u06ff]/;

export function containsArabicScript(value: string | null | undefined) {
  return arabicScriptPattern.test(String(value ?? ""));
}

export function transliterateArabicScriptToLatin(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const transliterated = Array.from(text)
    .map((char) => arabicScriptMap[char] ?? char)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();

  return transliterated || text;
}