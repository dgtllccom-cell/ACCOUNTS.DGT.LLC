import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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
  DATABASE_URL: resolveDbUrl("prod")
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function debugCust() {
  const rows = await localSql`SELECT * FROM public.customers LIMIT 5`;
  const colsInfo = await vpsSql`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'customers' AND table_schema = 'public'`;
  const writableCols = new Set(colsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name));
  const defaultVpsCountryId = (await vpsSql`SELECT id FROM public.countries LIMIT 1`)[0].id;

  const cleanRows = rows.map(r => {
    const mapped = { ...r, country_id: defaultVpsCountryId, created_by: null, state_province_id: null, city_id: null, district_id: null, area_location_id: null };
    if (!mapped.original_language_code) mapped.original_language_code = "en";
    const res = {};
    for (const col of Object.keys(mapped)) {
      if (writableCols.has(col) && mapped[col] !== undefined) res[col] = mapped[col];
    }
    return res;
  });

  try {
    await vpsSql`INSERT INTO public.customers ${vpsSql(cleanRows)} ON CONFLICT DO NOTHING`;
    console.log("Chunk batch insert succeeded!");
  } catch (err) {
    console.error("Chunk error:", err.message);
  }
  process.exit(0);
}

debugCust();
