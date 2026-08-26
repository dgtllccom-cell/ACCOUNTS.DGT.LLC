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
console.log('Connecting to:', dbUrl.replace(/:[^:@]+@/, ':****@'));
const sql = postgres(dbUrl, { max: 1, prepare: false });
try {
  const migration = fs.readFileSync('supabase/migrations/20260826_office_documents_storage_bucket.sql', 'utf8');
  await sql.unsafe(migration);
  console.log('Applied office documents storage bucket + RLS migration.');

  const bucket = await sql`select id, name, public from storage.buckets where id = 'erp-documents'`;
  console.log('Bucket:', bucket[0]);

  const policies = await sql`
    select schemaname, tablename, policyname, roles, cmd
    from pg_policies
    where (schemaname = 'storage' and tablename = 'objects' and policyname like 'office_documents_bucket_%')
       or (schemaname = 'public' and tablename = 'office_documents' and policyname like 'office_documents_scope_%')
    order by schemaname, tablename, policyname;
  `;
  console.table(policies);
} finally {
  await sql.end({ timeout: 5 });
}
