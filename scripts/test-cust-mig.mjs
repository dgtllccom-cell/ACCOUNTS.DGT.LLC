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

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30, ssl: { rejectUnauthorized: false } });

async function testCustomers() {
  const rows = await localSql`SELECT * FROM public.customers LIMIT 10`;
  const defaultCountryId = (await vpsSql`SELECT id FROM public.countries LIMIT 1`)[0].id;
  const colsInfo = await vpsSql`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'customers' AND table_schema = 'public'`;
  const writableCols = new Set(colsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name));

  for (const r of rows) {
    const mapped = { ...r, country_id: defaultCountryId, created_by: null, state_province_id: null, city_id: null, district_id: null, area_location_id: null };
    const filtered = {};
    for (const col of Object.keys(mapped)) {
      if (writableCols.has(col) && mapped[col] !== undefined) filtered[col] = mapped[col];
    }
    try {
      await vpsSql`INSERT INTO public.customers ${vpsSql([filtered])} ON CONFLICT DO NOTHING`;
      console.log(`✓ Inserted customer: ${r.customer_name || r.name}`);
    } catch (err) {
      console.error(`❌ Customer insert error:`, err.message);
    }
  }
  process.exit(0);
}

testCustomers();
