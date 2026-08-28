import postgres from 'postgres';
import fs from 'fs';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const content = fs.readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

async function detailedDatabaseAudit() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  try {
    console.log("=== STEP 2: Detailed Table-by-Table Translation Coverage Analysis ===");
    
    // Group record_translations by record_table
    const tableBreakdown = await sql`
      SELECT 
        record_table,
        count(*)::int as total_records,
        count(case when english_text is not null and english_text != '' then 1 end)::int as en_count,
        count(case when urdu_text is not null and urdu_text != '' then 1 end)::int as ur_count,
        count(case when pashto_text is not null and pashto_text != '' then 1 end)::int as ps_count,
        count(case when persian_text is not null and persian_text != '' then 1 end)::int as fa_count,
        count(case when arabic_text is not null and arabic_text != '' then 1 end)::int as ar_count
      FROM record_translations
      WHERE deleted_at IS NULL
      GROUP BY record_table
      ORDER BY total_records DESC;
    `;

    console.log("Record Translations Table Breakdown:\n", JSON.stringify(tableBreakdown, null, 2));

    // Check for duplicate translations (same record_table, record_id, field_name)
    const duplicates = await sql`
      SELECT record_table, record_id, field_name, count(*)::int as dup_count
      FROM record_translations
      WHERE deleted_at IS NULL
      GROUP BY record_table, record_id, field_name
      HAVING count(*) > 1;
    `;
    console.log("Duplicate record translations found:", duplicates.length);

    // Check translation keys & values system
    const translationKeys = await sql`
      SELECT count(*)::int as c FROM translation_keys WHERE deleted_at IS NULL;
    `;
    const translationValues = await sql`
      SELECT language_code, count(*)::int as c 
      FROM translation_values 
      WHERE deleted_at IS NULL 
      GROUP BY language_code;
    `;
    console.log("Translation Keys Count:", translationKeys[0]?.c);
    console.log("Translation Values by Language:", translationValues);

    const detailedSummary = {
      recordTranslationsTotal: 9634,
      tableBreakdown,
      duplicatesCount: duplicates.length,
      translationKeysCount: translationKeys[0]?.c || 0,
      translationValuesByLanguage: translationValues
    };

    fs.writeFileSync('scratch/db_detailed_coverage.json', JSON.stringify(detailedSummary, null, 2), 'utf8');
    console.log("Saved detailed breakdown to scratch/db_detailed_coverage.json");
  } catch (err) {
    console.error("Detailed audit error:", err);
  } finally {
    await sql.end();
  }
}

detailedDatabaseAudit();
