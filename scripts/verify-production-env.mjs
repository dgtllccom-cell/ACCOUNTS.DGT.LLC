import fs from "node:fs";
import path from "node:path";

const PROD_REF = "inmayhrxucimxqhgseqi";

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function apiRef(url = "") {
  return url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]?.toLowerCase() || null;
}

function databaseRef(url = "") {
  return url.match(/@db\.([a-z0-9]+)\.supabase\./i)?.[1]?.toLowerCase()
    || url.match(/\/\/postgres\.([a-z0-9]+):/i)?.[1]?.toLowerCase()
    || null;
}

const root = process.cwd();
const env = {
  ...readEnv(path.join(root, ".env")),
  ...readEnv(path.join(root, ".env.local")),
  ...process.env,
};
const errors = [];
const selectedApiRef = apiRef(env.NEXT_PUBLIC_SUPABASE_URL);
const selectedDatabaseRef = databaseRef(env.DATABASE_URL);

if (env.APP_ENV !== "production") errors.push("APP_ENV must equal production");
if (selectedApiRef !== PROD_REF) errors.push(`NEXT_PUBLIC_SUPABASE_URL must target ${PROD_REF}`);
if (selectedDatabaseRef !== PROD_REF) errors.push(`DATABASE_URL must target ${PROD_REF}`);
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || /PLACEHOLDER|YOUR_/i.test(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or still a placeholder");
}
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!serviceKey || /PLACEHOLDER|YOUR_|<PROD_/i.test(serviceKey) || serviceKey.startsWith("sb_publishable_")) {
  errors.push("Supabase service-role/secret key is missing, invalid, or still a placeholder");
}

if (errors.length) {
  console.error("[PRODUCTION ENV GUARD] Refusing deployment:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`[PRODUCTION ENV GUARD] Verified production project ${PROD_REF}.`);