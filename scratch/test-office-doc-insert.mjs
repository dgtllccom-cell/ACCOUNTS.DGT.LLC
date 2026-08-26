import fs from 'node:fs';
import postgres from 'postgres';
function readDbUrl() { if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim(); for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { const c = fs.readFileSync(f,'utf8'); const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m); if (m) return m[1].trim().replace(/^['"]|['"]$/g,''); } } throw new Error('DATABASE_URL not found'); }
const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const tempUser = '00000000-0000-4000-8000-000000000001';
  const out = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${tempUser}, true)`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: tempUser, role: 'authenticated' })}, true)`;
    const uid = await tx`select auth.uid() as uid, public.is_super_admin() as is_super_admin`;
    console.log('session', uid[0]);
    const test = await tx`
      insert into public.office_documents (title, file_name, file_url, file_type, module_type, created_by)
      values ('RLS TEST', 'rls-test.txt', 'local://rls-test.txt', 'txt', 'Documents', 'Super Admin')
      returning id, title`;
    return test[0];
  });
  console.log('inserted', out);
} finally { await sql.end({ timeout: 5 }); }
