// Bootstrap the central Local Translator dictionary (record_translations, record_table=
// 'system_dictionary') from the built-in APPROVED 5-language value/header dictionaries.
// These are already-verified business/UI terms in EN/UR/AR/FA/PS. Idempotent (UUIDv5 key).
//   node scripts/seed-system-dictionary.mjs --vps
import crypto from "node:crypto";
import postgres from "postgres";

const VPS = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const url = process.argv.includes("--vps") ? VPS : process.env.DATABASE_URL;
const { VALUE_TRANSLATIONS } = await import("../lib/i18n/table-values.ts");
const { HEADER_TRANSLATIONS } = await import("../lib/i18n/table-headers.ts");

const NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function uuid5(n) { const nb = Buffer.from(NS.replace(/-/g, ""), "hex"); const h = crypto.createHash("sha1").update(Buffer.concat([nb, Buffer.from(n)])).digest(); const b = Buffer.from(h.subarray(0, 16)); b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80; const x = b.toString("hex"); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`; }

// Merge both dictionaries; VALUE (business values) wins over HEADER (UI labels) on conflict.
const merged = { ...HEADER_TRANSLATIONS, ...VALUE_TRANSLATIONS };
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
let ins = 0, upd = 0;
for (const [en, t] of Object.entries(merged)) {
  const rid = uuid5(`system_dictionary:${en.toLowerCase()}`);
  const res = await sql`
    insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
      english_text, urdu_text, pashto_text, persian_text, arabic_text, source, translation_status, created_at, updated_at)
    values ('system_dictionary', ${rid}, 'term', ${en}, 'en',
      ${en}, ${t.ur || null}, ${t.ps || null}, ${t.fa || null}, ${t.ar || null}, 'manual', 'complete', now(), now())
    on conflict (record_table, record_id, field_name) where deleted_at is null
    do update set urdu_text=excluded.urdu_text, pashto_text=excluded.pashto_text, persian_text=excluded.persian_text,
      arabic_text=excluded.arabic_text, translation_status='complete', updated_at=now()
    returning (xmax=0) as inserted`;
  if (res[0]?.inserted) ins++; else upd++;
}
const total = await sql`select count(*)::int c from record_translations where record_table='system_dictionary' and deleted_at is null`;
console.log(`Seeded system_dictionary from built-in approved dictionary: inserted=${ins} updated=${upd}`);
console.log(`Total approved system_dictionary terms now: ${total[0].c}`);
process.exit(0);
