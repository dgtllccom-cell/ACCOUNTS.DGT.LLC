import fs from 'node:fs';
import postgres from 'postgres';

async function applyMigrations() {
  console.log('--- Applying Document Management Phase 1 Migrations ---');
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    for (const f of ['.env.local', '.env']) {
      if (fs.existsSync(f)) {
        const c = fs.readFileSync(f, 'utf8');
        const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m);
        if (m) {
          dbUrl = m[1].trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  }

  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment, .env.local, or .env');
  }

  const masked = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`Connecting to: ${masked}`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });

  console.log('1. Applying supabase/migrations/20260825_add_office_documents_canonical_fields.sql ...');
  const sql1 = fs.readFileSync('supabase/migrations/20260825_add_office_documents_canonical_fields.sql', 'utf8');
  await sql.unsafe(sql1);
  console.log('   ✅ Canonical fields migration applied.');

  console.log('2. Applying supabase/migrations/20260825_office_documents_phase1_context.sql ...');
  const sql2 = fs.readFileSync('supabase/migrations/20260825_office_documents_phase1_context.sql', 'utf8');
  await sql.unsafe(sql2);
  console.log('   ✅ Phase 1 context migration applied.');

  console.log('3. Verifying columns on database...');
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'office_documents'
    ORDER BY ordinal_position;
  `;
  console.log(`   ✅ Total columns on office_documents: ${cols.length}`);
  console.table(cols.map(c => ({ Column: c.column_name, Type: c.data_type, Nullable: c.is_nullable })));

  await sql.end();
  console.log('🎉 Migrations successfully verified!');
}

applyMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
