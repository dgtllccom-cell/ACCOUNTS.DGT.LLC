// One-time repair for legacy-seeded auth.users rows whose raw_user_meta_data
// was written as a JSON-encoded STRING instead of a real jsonb object (and/or
// raw_app_meta_data left NULL), which makes Supabase's GoTrue Admin API fail
// with "Database error loading user" on ANY read/update of that row.
//
// Scope: only rows for ACTIVE (non-deleted) ERP profiles, and only where the
// column is actually malformed (jsonb_typeof = 'string') / null - never
// touches an already-correct row. TEST DB only.
import fs from "node:fs";
import postgres from "postgres";

function loadEnvFile(p) { if (!fs.existsSync(p)) return {}; return Object.fromEntries(fs.readFileSync(p, "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })); }
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };

const TEST_PROJECT_REF = "csesvyxxjivnkkozgopt";
if (!env.DATABASE_URL || !env.DATABASE_URL.includes(TEST_PROJECT_REF)) {
  console.error(`Refusing to run: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF}).`);
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
try {
  const metaFixed = await sql`
    update auth.users u
    set raw_user_meta_data = (u.raw_user_meta_data #>> '{}')::jsonb
    from public.profiles p
    where p.id = u.id and p.deleted_at is null and jsonb_typeof(u.raw_user_meta_data) = 'string'
    returning u.id, u.email
  `;
  console.log(`Fixed raw_user_meta_data (string -> object) for ${metaFixed.length} user(s):`);
  for (const r of metaFixed) console.log(` - ${r.email}`);

  const appMetaFixed = await sql`
    update auth.users u
    set raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
    from public.profiles p
    where p.id = u.id and p.deleted_at is null and u.raw_app_meta_data is null
    returning u.id, u.email
  `;
  console.log(`\nFixed raw_app_meta_data (null -> default) for ${appMetaFixed.length} user(s):`);
  for (const r of appMetaFixed) console.log(` - ${r.email}`);
} finally {
  await sql.end();
}
