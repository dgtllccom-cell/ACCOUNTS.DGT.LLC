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

async function inspect() {
  console.log("=======================================================================");
  console.log("  5 DEDICATED PER-LANGUAGE TABLES DATA INSPECTOR");
  console.log("  Project:", env.NEXT_PUBLIC_SUPABASE_URL || "Supabase");
  console.log("=======================================================================\n");

  // Sample entities to inspect across business modules
  const sampleEntities = [
    { table: "purchase_orders", field: "product_name", orig: "WALNUT KERNEL PREMIUM 20/22" },
    { table: "companies", field: "name", orig: "KABUL DRY FRUITS WHOLESALE LTD" },
    { table: "accounts", field: "name", orig: "Kabul Purchase Account (DR)" },
    { table: "products", field: "product_name", orig: "PISTACHIO SHELLED EXTRA FINE" },
    { table: "countries", field: "name", orig: "United Arab Emirates" }
  ];

  for (const entity of sampleEntities) {
    const testRecordId = "b" + entity.table.slice(0, 7).padStart(31, "0");
    const autoEn = entity.orig;
    const autoUr = entity.orig === "United Arab Emirates" ? "متحدہ عرب امارات" : entity.orig === "PISTACHIO SHELLED EXTRA FINE" ? "پستہ شیلڈ ایکسٹرا فائن" : entity.orig === "KABUL DRY FRUITS WHOLESALE LTD" ? "کابل ڈرائی فروٹس ہول سیل لمیٹڈ" : "والنٹ کرنل پریمیم 20/22";
    const autoAr = entity.orig === "United Arab Emirates" ? "الإمارات العربية المتحدة" : entity.orig === "PISTACHIO SHELLED EXTRA FINE" ? "فستق مقشر ممتاز" : entity.orig === "KABUL DRY FRUITS WHOLESALE LTD" ? "شركة كابل للفواكه الجافة" : "جوز مغز ممتازة 20/22";
    const autoFa = entity.orig === "United Arab Emirates" ? "امارات متحده عربی" : entity.orig === "PISTACHIO SHELLED EXTRA FINE" ? "پسته مغز شده ممتاز" : entity.orig === "KABUL DRY FRUITS WHOLESALE LTD" ? "شرکت خشکبار کابل" : "مغز گردو ممتاژ 20/22";
    const autoPs = entity.orig === "United Arab Emirates" ? "د متحدو عربي اماراتو" : entity.orig === "PISTACHIO SHELLED EXTRA FINE" ? "د پستې مغز ممتاز" : entity.orig === "KABUL DRY FRUITS WHOLESALE LTD" ? "د کابل وچې میوې لمیټډ" : "د جوز مغز ممتاز 20/22";

    await sql`
      select public.upsert_record_translation(
        ${entity.table}::text,
        ${testRecordId}::uuid,
        ${entity.field}::text,
        ${entity.orig}::text,
        'en'::text,
        ${autoEn}::text,
        ${autoUr}::text,
        ${autoAr}::text,
        ${autoFa}::text,
        ${autoPs}::text,
        '{}'::jsonb,
        'auto'::text
      );
    `;
  }

  const tables = [
    { name: "translations_english", label: "English Table (Base)", col: "text" },
    { name: "translations_urdu", label: "Urdu Table", col: "text" },
    { name: "translations_arabic", label: "Arabic Table", col: "text" },
    { name: "translations_persian", label: "Persian Table", col: "text" },
    { name: "translations_pashto", label: "Pashto Table", col: "text" }
  ];

  for (const t of tables) {
    console.log(`=======================================================================`);
    console.log(` 📋 TABLE: public.${t.name} (${t.label})`);
    console.log(`=======================================================================`);

    const rows = await sql.unsafe(`
      select record_table, record_id, field_name, text, created_at
      from public.${t.name}
      where deleted_at is null
      order by created_at desc
      limit 10
    `);

    if (!rows || rows.length === 0) {
      console.log(" (No rows populated yet)\n");
    } else {
      console.log(`| ${"Record Table".padEnd(18)} | ${"Field Name".padEnd(20)} | ${"Translated Text"} |`);
      console.log(`|--------------------+----------------------+--------------------------------------------------|`);
      for (const r of rows) {
        console.log(`| ${String(r.record_table).padEnd(18)} | ${String(r.field_name).padEnd(20)} | ${String(r.text).padEnd(48)} |`);
      }
      console.log("");
    }
  }

  console.log("=======================================================================");
  console.log(" 🔍 SQL VIEW OUTPUT (public.record_translations Reconstructed Joined View)");
  console.log("=======================================================================\n");

  const viewRows = await sql`
    select record_table, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where deleted_at is null
    order by created_at desc
    limit 5
  `;

  for (const v of viewRows) {
    console.log(`❖ Table: [ ${v.record_table} ] | Field: [ ${v.field_name} ]`);
    console.log(`   🇬🇧 EN: ${v.english_text}`);
    console.log(`   🇵🇰 UR: ${v.urdu_text}`);
    console.log(`   🇸🇦 AR: ${v.arabic_text}`);
    console.log(`   🇮🇷 FA: ${v.persian_text}`);
    console.log(`   🇦🇫 PS: ${v.pashto_text}`);
    console.log("-----------------------------------------------------------------------");
  }

  await sql.end();
}

inspect().catch((err) => {
  console.error("Inspection error:", err);
  process.exit(1);
});
