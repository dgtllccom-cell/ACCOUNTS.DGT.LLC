import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

console.log("Gathering database proof directly from VPS Production (72.60.209.121)...");

const vpsScript = `
import postgres from "postgres";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
let dbHost = "";
let dbName = "";
let dbUser = "";

for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.host;
    dbName = parsed.pathname.replace(/^\\//, "");
    dbUser = parsed.username;
  } catch (e) {}
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 });

async function runProof() {
  console.log("================================================================================");
  console.log("                VPS PRODUCTION DATABASE VERIFICATION PROOF                      ");
  console.log("================================================================================");

  // 1. Target Database Identity
  const [dbIdentity] = await sql\`
    SELECT 
      inet_server_addr() as server_ip,
      inet_server_port() as server_port,
      current_database() as database_name,
      current_user as database_user,
      version() as postgres_version
  \`;

  console.log("\\n[1. EXACT TARGET DATABASE IDENTITY]");
  console.log("VPS IP:             72.60.209.121");
  console.log("VPS App Directory:  /var/www/dgt-nextjs");
  console.log("Database Host:     ", dbHost);
  console.log("Database Name:     ", dbIdentity.database_name);
  console.log("Database User:     ", dbIdentity.database_user);
  console.log("PostgreSQL Version:", dbIdentity.postgres_version.split(" on ")[0]);
  console.log("Server IP / Port:  ", (dbIdentity.server_ip ? dbIdentity.server_ip + ":" + dbIdentity.server_port : dbHost));

  // 2. Table Counts
  console.log("\\n[2. PRODUCTION TABLE ROW COUNTS]");
  const counts = {
    "countries": (await sql\`SELECT COUNT(*)::int as c FROM public.countries WHERE deleted_at IS NULL\`)[0].c,
    "states_provinces": (await sql\`SELECT COUNT(*)::int as c FROM public.states_provinces WHERE deleted_at IS NULL\`)[0].c,
    "districts": (await sql\`SELECT COUNT(*)::int as c FROM public.districts WHERE deleted_at IS NULL\`)[0].c,
    "cities": (await sql\`SELECT COUNT(*)::int as c FROM public.cities WHERE deleted_at IS NULL\`)[0].c,
    "record_translations": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE deleted_at IS NULL\`)[0].c
  };
  console.table(counts);

  // 3. Country Rows
  console.log("\\n[3. 5 CORE PRODUCTION COUNTRIES (DATABASE ROWS)]");
  const countries = await sql\`
    SELECT id, name, iso2, iso3, currency_code, phone_code, is_active, created_at, updated_at
    FROM public.countries
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  \`;
  console.table(countries);

  // 4. Sample Hierarchy Chains (Country -> State -> District -> City)
  console.log("\\n[4. HIERARCHY CHAINS ACROSS ALL 5 COUNTRIES (Country -> State -> District -> City)]");
  const hierarchy = await sql\`
    SELECT 
      c.name as country,
      c.iso2 as country_code,
      s.name as state_province,
      s.code as state_code,
      d.name as district,
      d.code as district_code,
      ct.name as city,
      ct.code as city_code,
      ct.zip_code as zip,
      ct.phone_area_code as phone_code
    FROM public.cities ct
    JOIN public.districts d ON ct.district_id = d.id
    JOIN public.states_provinces s ON ct.state_province_id = s.id
    JOIN public.countries c ON ct.country_id = c.id
    WHERE ct.deleted_at IS NULL AND d.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL
    ORDER BY c.name ASC, s.name ASC, ct.name ASC
  \`;

  console.log("Total Hierarchy Rows in DB:", hierarchy.length);
  
  // Group sample 3 rows per country
  const byCountry = {};
  for (const row of hierarchy) {
    if (!byCountry[row.country]) byCountry[row.country] = [];
    if (byCountry[row.country].length < 4) {
      byCountry[row.country].push({
        "Country": row.country + " (" + row.country_code + ")",
        "State / Province": row.state_province,
        "District": row.district,
        "City": row.city + " (" + row.city_code + ")",
        "Zip": row.zip,
        "Phone Code": row.phone_code
      });
    }
  }

  for (const [cName, rows] of Object.entries(byCountry)) {
    console.log("\\n--- Sample Hierarchy for " + cName + " ---");
    console.table(rows);
  }

  // 5. Translations Proof (5-Language Breakdown)
  console.log("\\n[5. 5-LANGUAGE TRANSLATIONS PROOF]");
  const trStats = {
    "Total Record Translations": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE deleted_at IS NULL\`)[0].c,
    "English Translations (en)": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE english_text IS NOT NULL AND english_text <> ''\`)[0].c,
    "Urdu Translations (ur)": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE urdu_text IS NOT NULL AND urdu_text <> ''\`)[0].c,
    "Arabic Translations (ar)": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE arabic_text IS NOT NULL AND arabic_text <> ''\`)[0].c,
    "Persian Translations (fa)": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE persian_text IS NOT NULL AND persian_text <> ''\`)[0].c,
    "Pashto Translations (ps)": (await sql\`SELECT COUNT(*)::int as c FROM public.record_translations WHERE pashto_text IS NOT NULL AND pashto_text <> ''\`)[0].c
  };
  console.table(trStats);

  console.log("\\n[SAMPLE RECORD_TRANSLATIONS ROWS FROM VPS DATABASE]");
  const sampleTr = await sql\`
    SELECT 
      record_table,
      original_text,
      english_text,
      urdu_text,
      arabic_text,
      persian_text,
      pashto_text,
      translation_status
    FROM public.record_translations
    WHERE record_table IN ('countries', 'states_provinces', 'cities')
    ORDER BY record_table ASC, original_text ASC
    LIMIT 20
  \`;
  console.table(sampleTr);

  await sql.end();
}

runProof().catch(err => {
  console.error("Proof Error:", err);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/vps_query_proof.mjs", vpsScript);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/vps_query_proof.mjs ${SERVER}:/var/www/dgt-nextjs/vps_query_proof.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node vps_query_proof.mjs && rm -f vps_query_proof.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("SSH Execution Error:", e.message);
}
