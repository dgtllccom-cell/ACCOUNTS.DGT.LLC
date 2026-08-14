// Audit record_translations: report genuine vs placeholder(==English)/empty per language,
// and per master table. READ-ONLY. Run: node scripts/audit-translations.mjs [--vps]
import fs from "node:fs";
import postgres from "postgres";

function pe(f) { const e = {}; if (!fs.existsSync(f)) return e; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i > -1) e[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, ""); } return e; }
const env = { ...pe(".env"), ...pe(".env.local") };
const VPS = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const url = process.argv.includes("--vps") ? VPS : env.DATABASE_URL;
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });

const MASTER = ["companies", "customers", "banks", "warehouses", "employees", "accounts", "goods", "countries", "city_branches", "country_branches"];

const tot = await sql`select count(*)::int c from record_translations where deleted_at is null`;
console.log(`TOTAL active record_translations: ${tot[0].c}\n`);
for (const [col, label] of [["urdu_text", "UR"], ["arabic_text", "AR"], ["persian_text", "FA"], ["pashto_text", "PS"]]) {
  const r = await sql.unsafe(`select
    count(*) filter (where "${col}" is null or btrim("${col}")='')::int as empty,
    count(*) filter (where "${col}" is not null and btrim("${col}")<>'' and btrim("${col}")=btrim(coalesce(english_text,original_text)))::int as placeholder,
    count(*) filter (where "${col}" is not null and btrim("${col}")<>'' and btrim("${col}")<>btrim(coalesce(english_text,original_text)))::int as genuine
    from record_translations where deleted_at is null`);
  console.log(`${label}: empty=${r[0].empty} placeholder(==EN)=${r[0].placeholder} genuine=${r[0].genuine}`);
}
console.log("\nPer-table (UR):");
for (const t of MASTER) {
  const r = await sql.unsafe(`select count(*)::int total,
    count(*) filter (where urdu_text is null or btrim(urdu_text)='' or btrim(urdu_text)=btrim(coalesce(english_text,original_text)))::int needs,
    count(*) filter (where urdu_text is not null and btrim(urdu_text)<>'' and btrim(urdu_text)<>btrim(coalesce(english_text,original_text)))::int genuine
    from record_translations where deleted_at is null and record_table=$1`, [t]);
  if (r[0].total > 0) console.log(`  ${t.padEnd(18)} total=${r[0].total} needs_approval=${r[0].needs} genuine=${r[0].genuine}`);
}
const rev = await sql`select count(*)::int c from record_translations where translation_status='needs_review' and deleted_at is null`;
console.log(`\nFlagged needs_review (review queue): ${rev[0].c}`);
process.exit(0);
