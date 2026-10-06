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

function loadEnv() {
  return { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
}

const env = loadEnv();
const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/accounts_dgt_llc";
const sql = postgres(dbUrl);

async function run() {
  console.log("Checking customer PER-00000015 or Shms...");
  const rows = await sql`
    SELECT c.id, c.customer_name, c.father_name, c.country_id, c.state_province_id, c.city_id, c.address, c.notes,
           cnt.name as country_name, sp.name as state_name, ct.name as city_name
    FROM public.customers c
    LEFT JOIN public.countries cnt ON c.country_id = cnt.id
    LEFT JOIN public.states_provinces sp ON c.state_province_id = sp.id
    LEFT JOIN public.cities ct ON c.city_id = ct.id
    WHERE c.customer_name ILIKE '%Shms%' OR c.person_code = 'PER-00000015'
  `;
  console.log("Found rows:", JSON.stringify(rows, null, 2));

  // Get Pakistan, Balochistan, Quetta IDs
  const [pak] = await sql`SELECT id FROM public.countries WHERE name ILIKE '%Pakistan%' LIMIT 1`;
  const [bal] = await sql`SELECT id FROM public.states_provinces WHERE country_id = ${pak.id} AND name ILIKE '%Balochistan%' LIMIT 1`;
  const [qta] = await sql`SELECT id FROM public.cities WHERE (country_id = ${pak.id} OR state_province_id = ${bal?.id}) AND name ILIKE '%Quetta%' LIMIT 1`;

  console.log("Resolved PK IDs:", { pakId: pak?.id, balId: bal?.id, qtaId: qta?.id });

  if (rows.length > 0 && pak?.id) {
    for (const r of rows) {
      await sql`
        UPDATE public.customers
        SET
          country_id = ${pak.id},
          state_province_id = ${bal?.id ?? null},
          city_id = ${qta?.id ?? null},
          updated_at = now()
        WHERE id = ${r.id}
      `;
      console.log(`Updated customer ${r.id} (${r.customer_name}) to Pakistan / Balochistan / Quetta!`);
    }
  }

  await sql.end();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
