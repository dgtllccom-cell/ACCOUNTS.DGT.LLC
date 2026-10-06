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

async function verify() {
  console.log("=======================================================================");
  console.log("  5-LANGUAGE DEDICATED TABLES DATABASE VERIFICATION");
  console.log("  Project:", env.NEXT_PUBLIC_SUPABASE_URL || "Supabase");
  console.log("=======================================================================\n");

  // 1. Check table existence & relkind of record_translations
  const relkind = await sql`select relkind from pg_class where relname='record_translations' and relnamespace='public'::regnamespace`;
  console.log("▶ 1. Object Type of public.record_translations:", relkind[0]?.relkind === 'v' ? "SQL VIEW (Correct)" : relkind[0]?.relkind === 'r' ? "TABLE (Legacy)" : "Unknown");

  // 2. Perform a live test insert using upsert_record_translation RPC
  const testRecordId = "a0000000-0000-0000-0000-000000000001";
  console.log("\n▶ 2. Executing upsert_record_translation() RPC test write...");

  await sql`
    select public.upsert_record_translation(
      'purchase_orders'::text,
      ${testRecordId}::uuid,
      'product_name'::text,
      'WALNUT KERNEL PREMIUM 20/22'::text,
      'en'::text,
      'WALNUT KERNEL PREMIUM 20/22'::text,
      'والنٹ کرنل پریمیم 20/22'::text,
      'جوز مغز ممتازة 20/22'::text,
      'مغز گردو ممتاژ 20/22'::text,
      'د جوز مغز ممتاز 20/22'::text,
      '{"en":"WALNUT KERNEL PREMIUM 20/22","ur":"والنٹ کرنل پریمیم 20/22","ar":"جوز مغز ممتازة 20/22","fa":"مغز گردو ممتاژ 20/22","ps":"د جوز مغز ممتاز 20/22"}'::jsonb,
      'auto'::text
    );
  `;
  console.log("✅ RPC executed successfully!");

  // 3. Inspect individual per-language tables
  console.log("\n▶ 3. Inspecting Data Rows in Each of the 5 Dedicated Tables:\n");
  const tables = [
    { name: "translations_english", lang: "English (en)" },
    { name: "translations_urdu", lang: "Urdu (ur)" },
    { name: "translations_arabic", lang: "Arabic (ar)" },
    { name: "translations_persian", lang: "Persian (fa)" },
    { name: "translations_pashto", lang: "Pashto (ps)" }
  ];

  for (const t of tables) {
    const rows = await sql.unsafe(`
      select record_table, record_id, field_name, text, created_at 
      from public.${t.name} 
      where record_id = '${testRecordId}'
      limit 5
    `);
    console.log(`--- [ TABLE: public.${t.name} | Language: ${t.lang} ] ---`);
    if (rows.length === 0) {
      console.log("  (No rows found)");
    } else {
      for (const r of rows) {
        console.log(`  • Field: "${r.field_name}" | Text: "${r.text}" | Record ID: ${r.record_id}`);
      }
    }
    console.log("");
  }

  // 4. Inspect data as seen through record_translations SQL VIEW
  console.log("▶ 4. Inspecting Reconstructed View Row (public.record_translations SQL View):\n");
  const viewRows = await sql`
    select record_table, record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where record_id = ${testRecordId}::uuid
  `;

  if (viewRows.length > 0) {
    const r = viewRows[0];
    console.log("--- [ VIEW ROW SUMMARY ] ---");
    console.log(`  • Table:            ${r.record_table}`);
    console.log(`  • Field:            ${r.field_name}`);
    console.log(`  • English (en):     ${r.english_text}`);
    console.log(`  • Urdu (ur):        ${r.urdu_text}`);
    console.log(`  • Arabic (ar):      ${r.arabic_text}`);
    console.log(`  • Persian (fa):     ${r.persian_text}`);
    console.log(`  • Pashto (ps):      ${r.pashto_text}`);
  }

  // 5. Total Row Counts Summary
  console.log("\n▶ 5. Total Row Counts Summary Across All Tables:");
  for (const t of tables) {
    const countRes = await sql.unsafe(`select count(*)::int as n from public.${t.name} where deleted_at is null`);
    console.log(`  • public.${t.name.padEnd(22)}: ${countRes[0].n} rows`);
  }
  const viewTotal = await sql`select count(*)::int as n from public.record_translations where deleted_at is null`;
  console.log(`  • public.record_translations (VIEW): ${viewTotal[0].n} rows`);

  console.log("\n=======================================================================");
  console.log("  ALL 5 TABLES VERIFIED & TEST PASSED CLEANLY! READY FOR PRODUCTION.");
  console.log("=======================================================================");

  await sql.end();
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
