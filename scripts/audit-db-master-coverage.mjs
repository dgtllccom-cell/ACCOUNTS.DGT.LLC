import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

async function run() {
  console.log("==========================================================================================");
  console.log("                      DATABASE TRANSLATION AUDIT & COVERAGE MATRIX                        ");
  console.log("==========================================================================================\n");

  const tables = [
    "companies",
    "customers",
    "banks",
    "warehouses",
    "employees",
    "accounts",
    "goods",
    "countries",
    "city_branches",
    "country_branches",
    "users",
    "shipping_lines",
    "clearing_agents",
    "ports",
    "system_dictionary"
  ];

  console.log("| Entity/Table         | Total Records | EN   | UR   | PS   | FA   | AR   | Missing | Duplicates | Invalid | PASS/FAIL |");
  console.log("|----------------------|---------------|------|------|------|------|------|---------|------------|---------|-----------|");

  let grandTotalRecords = 0;
  let grandTotalTranslatable = 0;
  let grandEn = 0, grandUr = 0, grandPs = 0, grandFa = 0, grandAr = 0;
  let grandMissing = 0, grandDups = 0, grandInvalid = 0;

  for (const t of tables) {
    let totalRecords = 0;
    try {
      if (t === "system_dictionary") {
        const [r] = await sql`SELECT count(*)::int as c FROM public.record_translations WHERE record_table = 'system_dictionary' AND deleted_at IS NULL`;
        totalRecords = r.c;
      } else {
        const [r] = await sql.unsafe(`SELECT count(*)::int as c FROM public."${t}" WHERE deleted_at IS NULL`);
        totalRecords = r.c;
      }
    } catch (e) {
      totalRecords = 0;
    }

    // Get translations for this table
    const trans = await sql`
      SELECT 
        record_id, field_name, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text, translation_status
      FROM public.record_translations
      WHERE record_table = ${t} AND deleted_at IS NULL
    `;

    const totalTrans = trans.length;
    let enCount = 0, urCount = 0, psCount = 0, faCount = 0, arCount = 0;
    let dupsCount = 0, invalidCount = 0;

    // Check duplicate (record_id, field_name)
    const seen = new Set();
    for (const r of trans) {
      const key = `${r.record_id}:${r.field_name}`;
      if (seen.has(key)) dupsCount++;
      seen.add(key);

      const en = (r.english_text || r.original_text || "").trim();
      const ur = (r.urdu_text || "").trim();
      const ps = (r.pashto_text || "").trim();
      const fa = (r.persian_text || "").trim();
      const ar = (r.arabic_text || "").trim();

      if (en) enCount++;
      // genuine translation: non-empty and not equal to English placeholder (or contains non-latin/meaningful translation)
      if (ur && (ur !== en || !/[A-Za-z]/.test(ur))) urCount++;
      if (ps && (ps !== en || !/[A-Za-z]/.test(ps))) psCount++;
      if (fa && (fa !== en || !/[A-Za-z]/.test(fa))) faCount++;
      if (ar && (ar !== en || !/[A-Za-z]/.test(ar))) arCount++;

      // Check invalid: e.g. status corrupt or broken JSON
      if (r.translation_status === 'corrupted' || !r.field_name) invalidCount++;
    }

    const missing = Math.max(0, (totalRecords * 5) - (enCount + urCount + psCount + faCount + arCount));
    const status = (missing === 0 && dupsCount === 0 && invalidCount === 0 && totalRecords > 0) ? "PASS" : (totalRecords === 0 ? "N/A" : (urCount > 0 ? "PARTIAL" : "PENDING"));

    grandTotalRecords += totalRecords;
    grandTotalTranslatable += totalTrans;
    grandEn += enCount;
    grandUr += urCount;
    grandPs += psCount;
    grandFa += faCount;
    grandAr += arCount;
    grandMissing += missing;
    grandDups += dupsCount;
    grandInvalid += invalidCount;

    console.log(
      `| ${t.padEnd(20)} | ${String(totalRecords).padStart(13)} | ${String(enCount).padStart(4)} | ${String(urCount).padStart(4)} | ${String(psCount).padStart(4)} | ${String(faCount).padStart(4)} | ${String(arCount).padStart(4)} | ${String(missing).padStart(7)} | ${String(dupsCount).padStart(10)} | ${String(invalidCount).padStart(7)} | ${status.padEnd(9)} |`
    );
  }

  console.log("|----------------------|---------------|------|------|------|------|------|---------|------------|---------|-----------|");
  console.log(
    `| TOTALS               | ${String(grandTotalRecords).padStart(13)} | ${String(grandEn).padStart(4)} | ${String(grandUr).padStart(4)} | ${String(grandPs).padStart(4)} | ${String(grandFa).padStart(4)} | ${String(grandAr).padStart(4)} | ${String(grandMissing).padStart(7)} | ${String(grandDups).padStart(10)} | ${String(grandInvalid).padStart(7)} |           |`
  );

  console.log("\nActive record_translations total in database:", grandTotalTranslatable);
  await sql.end();
}

run().catch(console.error);
