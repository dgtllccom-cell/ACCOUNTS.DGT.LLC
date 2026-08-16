import { withLocalPg } from "../lib/db/local-postgres.ts";
import { createClient } from "@supabase/supabase-js";
import { autoTranslate5Languages, detectScriptType } from "../lib/i18n/multilingual-translator.ts";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function runPgBackfill() {
  const pgResult = await withLocalPg(async (sql) => {
    console.log("Connected to PostgreSQL via DATABASE_URL.");

    // 1. enterprise_accounts
    const accounts = await sql`
      SELECT id, name FROM enterprise_accounts WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) != ''
    `;
    console.log(`Found ${accounts.length} enterprise_accounts in Postgres.`);

    for (const acc of accounts) {
      const isArabic = detectScriptType(acc.name) === "arabic";
      const srcLang = isArabic ? "ur" : "en";
      const trans = autoTranslate5Languages(acc.name, srcLang);

      await sql`
        INSERT INTO record_translations (
          record_table, record_id, field_name, original_text, original_language_code,
          english_text, urdu_text, arabic_text, persian_text, pashto_text,
          language_texts, translation_source, translation_status, translated_by_engine,
          updated_at
        ) VALUES (
          'enterprise_accounts', ${acc.id}, 'name', ${acc.name}, ${srcLang},
          ${trans.en}, ${trans.ur}, ${trans.ar}, ${trans.fa}, ${trans.ps},
          ${sql.json(trans)}, 'auto', 'complete', 'local_dictionary',
          NOW()
        )
        ON CONFLICT (record_table, record_id, field_name) WHERE deleted_at IS NULL
        DO UPDATE SET
          original_text = EXCLUDED.original_text,
          original_language_code = EXCLUDED.original_language_code,
          english_text = EXCLUDED.english_text,
          urdu_text = EXCLUDED.urdu_text,
          arabic_text = EXCLUDED.arabic_text,
          persian_text = EXCLUDED.persian_text,
          pashto_text = EXCLUDED.pashto_text,
          language_texts = EXCLUDED.language_texts,
          translation_status = 'complete',
          translated_by_engine = 'local_dictionary',
          updated_at = NOW();
      `;
      console.log(`✓ Account ${acc.id}: "${acc.name}" -> EN: "${trans.en}", UR: "${trans.ur}"`);
    }

    // 2. ledgers
    const ledgers = await sql`
      SELECT id, name FROM ledgers WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) != ''
    `;
    console.log(`Found ${ledgers.length} ledgers in Postgres.`);

    for (const led of ledgers) {
      const isArabic = detectScriptType(led.name) === "arabic";
      const srcLang = isArabic ? "ur" : "en";
      const trans = autoTranslate5Languages(led.name, srcLang);

      await sql`
        INSERT INTO record_translations (
          record_table, record_id, field_name, original_text, original_language_code,
          english_text, urdu_text, arabic_text, persian_text, pashto_text,
          language_texts, translation_source, translation_status, translated_by_engine,
          updated_at
        ) VALUES (
          'ledgers', ${led.id}, 'name', ${led.name}, ${srcLang},
          ${trans.en}, ${trans.ur}, ${trans.ar}, ${trans.fa}, ${trans.ps},
          ${sql.json(trans)}, 'auto', 'complete', 'local_dictionary',
          NOW()
        )
        ON CONFLICT (record_table, record_id, field_name) WHERE deleted_at IS NULL
        DO UPDATE SET
          original_text = EXCLUDED.original_text,
          original_language_code = EXCLUDED.original_language_code,
          english_text = EXCLUDED.english_text,
          urdu_text = EXCLUDED.urdu_text,
          arabic_text = EXCLUDED.arabic_text,
          persian_text = EXCLUDED.persian_text,
          pashto_text = EXCLUDED.pashto_text,
          language_texts = EXCLUDED.language_texts,
          translation_status = 'complete',
          translated_by_engine = 'local_dictionary',
          updated_at = NOW();
      `;
      console.log(`✓ Ledger ${led.id}: "${led.name}" -> EN: "${trans.en}", UR: "${trans.ur}"`);
    }

    // 3. accounts table
    try {
      const rawAccounts = await sql`
        SELECT id, name FROM accounts WHERE deleted_at IS NULL AND name IS NOT NULL AND TRIM(name) != ''
      `;
      console.log(`Found ${rawAccounts.length} accounts in Postgres.`);
      for (const acc of rawAccounts) {
        const isArabic = detectScriptType(acc.name) === "arabic";
        const srcLang = isArabic ? "ur" : "en";
        const trans = autoTranslate5Languages(acc.name, srcLang);

        await sql`
          INSERT INTO record_translations (
            record_table, record_id, field_name, original_text, original_language_code,
            english_text, urdu_text, arabic_text, persian_text, pashto_text,
            language_texts, translation_source, translation_status, translated_by_engine,
            updated_at
          ) VALUES (
            'accounts', ${acc.id}, 'name', ${acc.name}, ${srcLang},
            ${trans.en}, ${trans.ur}, ${trans.ar}, ${trans.fa}, ${trans.ps},
            ${sql.json(trans)}, 'auto', 'complete', 'local_dictionary',
            NOW()
          )
          ON CONFLICT (record_table, record_id, field_name) WHERE deleted_at IS NULL
          DO UPDATE SET
            original_text = EXCLUDED.original_text,
            original_language_code = EXCLUDED.original_language_code,
            english_text = EXCLUDED.english_text,
            urdu_text = EXCLUDED.urdu_text,
            arabic_text = EXCLUDED.arabic_text,
            persian_text = EXCLUDED.persian_text,
            pashto_text = EXCLUDED.pashto_text,
            language_texts = EXCLUDED.language_texts,
            translation_status = 'complete',
            translated_by_engine = 'local_dictionary',
            updated_at = NOW();
        `;
        console.log(`✓ Account ${acc.id}: "${acc.name}" -> EN: "${trans.en}", UR: "${trans.ur}"`);
      }
    } catch {
      // accounts table optional
    }

    return true;
  });

  if (pgResult) {
    console.log("\n=== PostgreSQL Backfill Completed Successfully! ===");
    return;
  }

  // Fallback to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("No DATABASE_URL or Supabase Service Key available.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: accounts } = await supabase.from("enterprise_accounts").select("id, name").is("deleted_at", null);
  for (const acc of accounts || []) {
    if (!acc.name) continue;
    const isArabic = detectScriptType(acc.name) === "arabic";
    const srcLang = isArabic ? "ur" : "en";
    const trans = autoTranslate5Languages(acc.name, srcLang);

    await supabase.rpc("upsert_record_translation", {
      p_record_table: "enterprise_accounts",
      p_record_id: acc.id,
      p_field_name: "name",
      p_original_text: acc.name,
      p_original_language_code: srcLang,
      p_english: trans.en,
      p_urdu: trans.ur,
      p_arabic: trans.ar,
      p_persian: trans.fa,
      p_pashto: trans.ps,
      p_language_texts: trans,
      p_source: "auto",
      p_status: "complete",
      p_engine: "local_dictionary",
      p_actor_id: null
    });
  }

  const { data: ledgers } = await supabase.from("ledgers").select("id, name").is("deleted_at", null);
  for (const led of ledgers || []) {
    if (!led.name) continue;
    const isArabic = detectScriptType(led.name) === "arabic";
    const srcLang = isArabic ? "ur" : "en";
    const trans = autoTranslate5Languages(led.name, srcLang);

    await supabase.rpc("upsert_record_translation", {
      p_record_table: "ledgers",
      p_record_id: led.id,
      p_field_name: "name",
      p_original_text: led.name,
      p_original_language_code: srcLang,
      p_english: trans.en,
      p_urdu: trans.ur,
      p_arabic: trans.ar,
      p_persian: trans.fa,
      p_pashto: trans.ps,
      p_language_texts: trans,
      p_source: "auto",
      p_status: "complete",
      p_engine: "local_dictionary",
      p_actor_id: null
    });
  }

  console.log("\n=== Supabase Backfill Completed Successfully! ===");
}

runPgBackfill();
