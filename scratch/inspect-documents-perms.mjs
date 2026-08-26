import fs from 'node:fs';
import postgres from 'postgres';

function readDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

const dbUrl = readDbUrl();
const sql = postgres(dbUrl, { max: 1, prepare: false });
try {
  const [assignments, docs, policies] = await Promise.all([
    sql`select user_id, role, country_id, country_branch_id, city_branch_id, is_active, deleted_at from public.user_role_assignments where user_id = '00000000-0000-4000-8000-000000000001'::uuid order by created_at desc`,
    sql`select count(*)::int as count from public.office_documents`,
    sql`select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' and tablename = 'office_documents' order by policyname`
  ]);
  console.log('assignments', assignments);
  console.log('docs', docs[0]);
  console.table(policies);
} finally {
  await sql.end({ timeout: 5 });
}
