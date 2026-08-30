/**
 * Seeds public.erp_translation_memory from the curated ERP glossary
 * (status 'glossary') and MULTILINGUAL_DICTIONARY (status 'machine').
 * Idempotent; never downgrades an 'approved' row. Run: npx tsx scripts/seed-erp-translation-memory.mts
 */
import fs from "node:fs";
import postgres from "postgres";
import { ERP_GLOSSARY } from "@/lib/i18n/erp-glossary";
import { MULTILINGUAL_DICTIONARY } from "@/lib/i18n/multilingual-translator";
import { normalizeForMatch } from "@/lib/i18n/erp-translator";

function envUrl() {
  const target = (process.argv.find((a) => a.startsWith("--target="))?.split("=")[1]
    || process.env.MIGRATE_TARGET || "default").toLowerCase();
  const env: Record<string, string> = {};
  for (const f of [".env", ".env.local"]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
    }
  }
  const url = target === "prod" ? (env.PROD_DATABASE_URL || process.env.PROD_DATABASE_URL || "") : (env.DATABASE_URL || process.env.DATABASE_URL || "");
  console.log(`[seed] target: ${target}`);
  return url;
}

async function main() {
  let g = 0, d = 0;
  const url = envUrl();
  if (!url) { console.error("no database URL for target"); process.exit(1); }
  const sqlClient = postgres(url, { max: 1, prepare: false, connect_timeout: 60 });
  const run = async (sql: any) => {
    for (const e of ERP_GLOSSARY) {
      const key = normalizeForMatch(e.en);
      if (!key) continue;
      await sql`
        insert into public.erp_translation_memory (source_lang, source_norm, source_text, en, ur, ar, fa, ps, domain, status, engine)
        values ('en', ${key}, ${e.en}, ${e.en}, ${e.ur}, ${e.ar}, ${e.fa}, ${e.ps}, ${e.domain}, 'glossary', 'curated')
        on conflict (source_lang, source_norm) do update set
          en=excluded.en, ur=excluded.ur, ar=excluded.ar, fa=excluded.fa, ps=excluded.ps, domain=excluded.domain,
          status = case when public.erp_translation_memory.status='approved' then 'approved' else 'glossary' end, updated_at=now()
        where public.erp_translation_memory.status <> 'approved'
      `;
      g++;
    }
    for (const e of MULTILINGUAL_DICTIONARY) {
      const key = normalizeForMatch(e.en);
      if (!key) continue;
      await sql`
        insert into public.erp_translation_memory (source_lang, source_norm, source_text, en, ur, ar, fa, ps, domain, status, engine)
        values ('en', ${key}, ${e.en}, ${e.en}, ${e.ur}, ${e.ar}, ${e.fa}, ${e.ps}, 'general', 'machine', 'dictionary')
        on conflict (source_lang, source_norm) do nothing
      `;
      d++;
    }
    const [{ n }] = (await sql`select count(*)::int n from public.erp_translation_memory`) as any;
    console.log(JSON.stringify({ ok: true, glossary_upserted: g, dictionary_processed: d, total_rows: n }, null, 2));
  };
  try { await run(sqlClient); } finally { await sqlClient.end(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
