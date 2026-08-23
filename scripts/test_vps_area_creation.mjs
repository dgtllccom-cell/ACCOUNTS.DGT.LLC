import postgres from "postgres";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 });

async function runTest() {
  console.log("=== Testing Location Hierarchy & Area Creation on VPS DB ===");

  // 1. Fetch Pakistan, Balochistan & Quetta
  const [pakistan] = await sql`SELECT id, name, iso2 FROM public.countries WHERE iso2 = 'PK' LIMIT 1`;
  console.log("Pakistan Record:", pakistan);

  const [balochistan] = await sql`SELECT id, name, code FROM public.states_provinces WHERE country_id = ${pakistan.id} AND name ILIKE '%Balochistan%' LIMIT 1`;
  console.log("Balochistan Record:", balochistan);

  const [quetta] = await sql`SELECT id, name, code, state_province_id, district_id, zip_code FROM public.cities WHERE country_id = ${pakistan.id} AND name ILIKE '%Quetta%' LIMIT 1`;
  console.log("Quetta City Record:", quetta);

  // 2. Test inserting Area / Road under Quetta
  const testAreaName = "Airport Road";
  const testAreaCode = "000";
  const testZip = "86000";

  // Check if exists or insert
  const [existingArea] = await sql`
    SELECT id, name, code, postal_code, country_id, state_province_id, district_id, city_id
    FROM public.areas_locations
    WHERE city_id = ${quetta.id} AND name = ${testAreaName}
  `;

  let areaId = existingArea?.id;
  if (!existingArea) {
    const [inserted] = await sql`
      INSERT INTO public.areas_locations (
        country_id, state_province_id, district_id, city_id, name, code, postal_code, is_active, created_at, updated_at
      ) VALUES (
        ${pakistan.id},
        ${quetta.state_province_id},
        ${quetta.district_id},
        ${quetta.id},
        ${testAreaName},
        ${testAreaCode},
        ${testZip},
        true,
        NOW(),
        NOW()
      )
      RETURNING id, name, code, postal_code, country_id, state_province_id, district_id, city_id
    `;
    areaId = inserted.id;
    console.log("Inserted New Area Record:", inserted);
  } else {
    console.log("Existing Area Record found:", existingArea);
  }

  // 3. Verify Foreign Keys and Hierarchy
  const [areaVerification] = await sql`
    SELECT 
      a.id AS area_id,
      a.name AS area_name,
      a.code AS area_code,
      a.postal_code,
      c.name AS country_name,
      c.iso2 AS country_iso,
      s.name AS state_name,
      ct.name AS city_name
    FROM public.areas_locations a
    JOIN public.countries c ON c.id = a.country_id
    LEFT JOIN public.states_provinces s ON s.id = a.state_province_id
    JOIN public.cities ct ON ct.id = a.city_id
    WHERE a.id = ${areaId}
  `;
  console.log("\nVerified Full Hierarchy in DB:");
  console.table([areaVerification]);

  // 4. Save 5-language translations
  const langTexts = {
    en: "Airport Road",
    ur: "ائیرپورٹ روڈ",
    ar: "طريق المطار",
    fa: "سرک میدان هوایی",
    ps: "د هوایی ډګر سړک"
  };

  const [existingTrans] = await sql`
    SELECT id FROM public.record_translations
    WHERE record_table = 'areas_locations' AND record_id = ${areaId} AND field_name = 'name'
    LIMIT 1
  `;

  if (existingTrans) {
    await sql`
      UPDATE public.record_translations
      SET english_text = ${langTexts.en},
          urdu_text = ${langTexts.ur},
          arabic_text = ${langTexts.ar},
          persian_text = ${langTexts.fa},
          pashto_text = ${langTexts.ps},
          language_texts = ${sql.json(langTexts)},
          translation_status = 'approved',
          deleted_at = NULL,
          updated_at = NOW()
      WHERE id = ${existingTrans.id}
    `;
  } else {
    await sql`
      INSERT INTO public.record_translations (
        record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text,
        language_texts, source, translation_status, created_at, updated_at
      )
      VALUES (
        'areas_locations', ${areaId}, 'name', ${testAreaName}, 'en',
        ${langTexts.en}, ${langTexts.ur}, ${langTexts.ar}, ${langTexts.fa}, ${langTexts.ps},
        ${sql.json(langTexts)}, 'manual', 'approved', NOW(), NOW()
      )
    `;
  }

  // 5. Query Translation Proof
  const [trans] = await sql`
    SELECT record_table, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM public.record_translations
    WHERE record_table = 'areas_locations' AND record_id = ${areaId}
  `;
  console.log("\nVerified 5-Language Translations in DB:");
  console.table([trans]);

  await sql.end();
}

runTest().catch(console.error);
