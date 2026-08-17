import fs from "fs";
import path from "path";
import postgres from "postgres";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

const root = process.cwd();
const env = { ...parseEnv(path.join(root, ".env")), ...parseEnv(path.join(root, ".env.local")) };
const sql = postgres(env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1, prepare: false });

try {
  const idx = await sql`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename in (
        'translations_english',
        'translations_urdu',
        'translations_arabic',
        'translations_persian',
        'translations_pashto',
        'record_translations'
      )
    order by tablename, indexname
  `;
  console.log(JSON.stringify(idx, null, 2));

  const fn = await sql`
    select pg_get_functiondef(
      'public.upsert_record_translation(text,uuid,text,text,text,text,text,text,text,text,jsonb,text,text,text,uuid)'::regprocedure
    ) as def
  `;
  console.log("FUNCTION:");
  console.log(fn[0].def);
} finally {
  await sql.end({ timeout: 5 });
}
