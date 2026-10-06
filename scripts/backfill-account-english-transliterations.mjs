import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

const arabicScriptPattern = /[\u0600-\u06ff]/;
const arabicScriptMap = {
  "\u0627": "a", "\u0622": "aa", "\u0628": "b", "\u067e": "p", "\u062a": "t", "\u0679": "t",
  "\u062b": "s", "\u062c": "j", "\u0686": "ch", "\u062d": "h", "\u062e": "kh", "\u062f": "d",
  "\u0688": "d", "\u0630": "z", "\u0631": "r", "\u0691": "r", "\u0632": "z", "\u0698": "zh",
  "\u0633": "s", "\u0634": "sh", "\u0635": "s", "\u0636": "z", "\u0637": "t", "\u0638": "z",
  "\u0639": "a", "\u063a": "gh", "\u0641": "f", "\u0642": "q", "\u06a9": "k", "\u0643": "k",
  "\u06af": "g", "\u0644": "l", "\u0645": "m", "\u0646": "n", "\u06ba": "n", "\u0648": "w",
  "\u0624": "o", "\u06c1": "h", "\u06be": "h", "\u0621": "", "\u06cc": "y", "\u064a": "y",
  "\u06d2": "e", "\u0626": "y", "\u0629": "h", "\u0649": "a", "\u0623": "a", "\u0625": "i",
  "\u064e": "", "\u0650": "", "\u064f": "", "\u0651": "", "\u0652": "", "\u060c": ",", "\u06d4": ".", "\u061f": "?"
};

function containsArabicScript(value) {
  return arabicScriptPattern.test(String(value ?? ""));
}

function transliterate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return Array.from(text)
    .map((char) => arabicScriptMap[char] ?? char)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim() || text;
}

loadEnv();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1 });
await sql`set statement_timeout = 0`;

const rows = await sql`
  select id, original_text, english_text
  from record_translations
  where record_table = 'enterprise_accounts'
    and deleted_at is null
    and original_text ~ '[\u0600-\u06ff]'
    and (english_text is null or english_text = original_text or english_text ~ '[\u0600-\u06ff]')
`;

let updated = 0;
for (const row of rows) {
  const english = transliterate(row.original_text);
  if (!english || english === row.english_text || containsArabicScript(english)) continue;
  await sql`
    update record_translations
    set english_text = ${english}, updated_at = now()
    where id = ${row.id}
  `;
  updated += 1;
}

console.log(JSON.stringify({ scanned: rows.length, updated }, null, 2));
await sql.end();