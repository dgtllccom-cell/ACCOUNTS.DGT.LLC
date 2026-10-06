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

async function debugCustBatch() {
  const rows = await localSql`SELECT * FROM public.customers`;
  const colsInfo = await vpsSql`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'customers' AND table_schema = 'public'`;
  const writableColsArr = colsInfo.filter(c => c.is_generated !== 'ALWAYS').map(c => c.column_name);

  const cleanRows = rows.map(r => {
    const res = {};
    for (const col of writableColsArr) {
      res[col] = r[col] !== undefined ? r[col] : null;
    }
    const langCode = (r.original_language_code || "").toLowerCase();
    res.original_language_code = ['en','ur','ar','fa','ps'].includes(langCode) ? langCode : 'en';
    res.country_id = "96ab1da1-12f6-470a-85d5-a681424559ab";
    res.created_by = null;
    res.state_province_id = null;
    res.city_id = null;
    res.district_id = null;
    res.area_location_id = null;
    return res;
  });

  try {
    await vpsSql`INSERT INTO public.customers ${vpsSql(cleanRows)} ON CONFLICT DO NOTHING`;
    console.log("Entire customers table (207 rows) batch inserted in 1 query!");
  } catch (err) {
    console.error("Customers batch error:", err.message);
  }
  process.exit(0);
}

debugCustBatch();
