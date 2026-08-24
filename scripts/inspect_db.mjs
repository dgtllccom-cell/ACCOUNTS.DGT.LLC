import postgres from "postgres";
import fs from "fs";

function parseEnv(file) {
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

const env = { ...parseEnv(".env"), ...parseEnv(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function run() {
  const custs = await sql`select id, customer_name, first_name, last_name, contact_person, company_name from customers where customer_name ilike '%asmat%' or first_name ilike '%asmat%' or contact_person ilike '%asmat%'`;
  console.log("CUSTOMERS MATCHING ASMAT (count: " + custs.length + "):");
  console.log(custs);

  const comps = await sql`select id, name, legal_name, owner_name from companies where name ilike '%damaan%' or owner_name ilike '%asmat%'`;
  console.log("COMPANIES MATCHING (count: " + comps.length + "):");
  console.log(comps);
  await sql.end();
}

run().catch(console.error);
