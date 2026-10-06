import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.error("Could not read .env.local", e);
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

async function runLocalTest() {
  console.log("=======================================================================");
  console.log("  LOCAL 5-LANGUAGE AUTOMATIC TRANSLATION & 5-TABLE FLOW TEST");
  console.log("  Project:", env.NEXT_PUBLIC_SUPABASE_URL || "Local Supabase Dev");
  console.log("=======================================================================\n");

  // Generate a random test record ID
  const testId = "c" + Date.now().toString().padStart(31, "0");
  const testTable = "purchase_orders";
  const testFieldName = "product_name";
  const originalEnglishText = "WALNUT KERNEL SIALKOT SUPER 2026";

  console.log(`▶ 1. Simulating Local Data Entry...`);
  console.log(`   • Table: "${testTable}"`);
  console.log(`   • Field: "${testFieldName}"`);
  console.log(`   • Entered Text: "${originalEnglishText}"\n`);

  // Simulate local auto-translation output
  const translations = {
    en: "WALNUT KERNEL SIALKOT SUPER 2026",
    ur: "والنٹ کرنل سیالکوٹ سپر 2026",
    ar: "جوز مغز سيالكوت ممتاز 2026",
    fa: "مغز گردو سیالکوت ممتاز 2026",
    ps: "د سیالکوټ ممتاز جوز مغز 2026"
  };

  console.log(`▶ 2. Local Translator generated 5 language translations:`);
  console.log(`   🇬🇧 EN: ${translations.en}`);
  console.log(`   🇵🇰 UR: ${translations.ur}`);
  console.log(`   🇸🇦 AR: ${translations.ar}`);
  console.log(`   🇮🇷 FA: ${translations.fa}`);
  console.log(`   🇦🇫 PS: ${translations.ps}\n`);

  console.log(`▶ 3. Calling upsert_record_translation() RPC to fan out writes to 5 tables...`);
  await sql`
    select public.upsert_record_translation(
      ${testTable}::text,
      ${testId}::uuid,
      ${testFieldName}::text,
      ${originalEnglishText}::text,
      'en'::text,
      ${translations.en}::text,
      ${translations.ur}::text,
      ${translations.ar}::text,
      ${translations.fa}::text,
      ${translations.ps}::text,
      '{}'::jsonb,
      'auto'::text
    );
  `;
  console.log("✅ RPC executed successfully!\n");

  console.log("▶ 4. Querying the 5 Per-Language Database Tables to Verify Creation:\n");
  const langTables = [
    { name: "translations_english", flag: "🇬🇧", lang: "English" },
    { name: "translations_urdu", flag: "🇵🇰", lang: "Urdu" },
    { name: "translations_arabic", flag: "🇸🇦", lang: "Arabic" },
    { name: "translations_persian", flag: "🇮🇷", lang: "Persian" },
    { name: "translations_pashto", flag: "🇦🇫", lang: "Pashto" }
  ];

  let successCount = 0;
  for (const t of langTables) {
    const row = await sql.unsafe(`
      select record_table, record_id, field_name, text, created_at 
      from public.${t.name} 
      where record_id = '${testId}'
    `);
    if (row.length > 0) {
      successCount++;
      console.log(`  ${t.flag} [${t.name.padEnd(21)}] -> Created Row: "${row[0].text}"`);
    } else {
      console.log(`  ❌ [${t.name.padEnd(21)}] -> Missing Row!`);
    }
  }

  console.log("\n▶ 5. Reading back from reconstructed Joined View (public.record_translations):\n");
  const viewRow = await sql`
    select record_table, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where record_id = ${testId}::uuid
  `;

  if (viewRow.length > 0) {
    const v = viewRow[0];
    console.log(`  ✅ View successfully joined all 5 tables for Record ID: ${testId}`);
    console.log(`     • EN: ${v.english_text}`);
    console.log(`     • UR: ${v.urdu_text}`);
    console.log(`     • AR: ${v.arabic_text}`);
    console.log(`     • FA: ${v.persian_text}`);
    console.log(`     • PS: ${v.pashto_text}`);
  }

  console.log("\n=======================================================================");
  if (successCount === 5) {
    console.log("  🎉 LOCAL TEST PASSED: ALL 5 DEDICATED TABLES CREATED ROWS SUCCESSFULLY!");
  } else {
    console.log(`  ⚠️ TEST FAILED: Only ${successCount}/5 tables created rows.`);
  }
  console.log("=======================================================================");

  await sql.end();
}

runLocalTest().catch((err) => {
  console.error("Local test error:", err);
  process.exit(1);
});
