import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const sql = postgres(env.DATABASE_URL, { ssl: 'require' });

async function run() {
  try {
    console.log("Connecting to Database...");
    
    const countries = await sql`SELECT id, name, phone_code FROM public.countries WHERE deleted_at IS NULL`;
    console.log("\n--- Countries ---");
    console.table(countries);

    const statesCount = await sql`SELECT count(*) FROM public.states_provinces WHERE deleted_at IS NULL`;
    console.log("\nStates/Provinces count:", statesCount[0].count);

    const districtsCount = await sql`SELECT count(*) FROM public.districts WHERE deleted_at IS NULL`;
    console.log("Districts count:", districtsCount[0].count);

    const citiesCount = await sql`SELECT count(*) FROM public.cities WHERE deleted_at IS NULL`;
    console.log("Cities count:", citiesCount[0].count);

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await sql.end();
  }
}

run();
