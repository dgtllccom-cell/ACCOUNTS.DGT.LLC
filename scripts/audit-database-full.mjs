import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const dbUrl = getDbUrl();
if (!dbUrl) {
  console.error('DATABASE_URL not found!');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 2, prepare: false });

async function auditDatabase() {
  console.log('--- 1. AUDITING POSTGRES DATABASE TABLES & RECORD COUNTS ---');

  // List all tables in public schema
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;

  console.log(`Total Tables Found: ${tables.length}`);

  const tableStats = [];

  for (const t of tables) {
    const tableName = t.table_name;
    try {
      const countRes = await sql.unsafe(`SELECT count(*) as count FROM "${tableName}"`);
      const count = Number(countRes[0]?.count || 0);

      // Get columns
      const cols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position ASC
      `;

      tableStats.push({
        table: tableName,
        count,
        columnCount: cols.length,
        columns: cols.map(c => c.column_name)
      });
    } catch (e) {
      tableStats.push({
        table: tableName,
        count: 'ERROR',
        error: e.message
      });
    }
  }

  console.log(`Audited ${tableStats.length} tables successfully.`);
  fs.writeFileSync('scripts/audit-db-tables.json', JSON.stringify(tableStats, null, 2));

  // Check Multilingual Translations in DB
  console.log('\n--- 2. AUDITING TRANSLATIONS & MULTILINGUAL DATA ---');
  try {
    const transCount = await sql`SELECT count(*) as count FROM enterprise_record_translations`;
    console.log(`enterprise_record_translations count: ${transCount[0]?.count || 0}`);
  } catch (e) {
    console.log(`enterprise_record_translations query: ${e.message}`);
  }

  // Check Journals / Roznamcha entries
  console.log('\n--- 3. AUDITING JOURNAL ENTRIES & FINANCIAL RECORDS ---');
  try {
    const roznamcha = await sql`SELECT count(*) as count FROM roznamcha_entries`;
    console.log(`roznamcha_entries count: ${roznamcha[0]?.count || 0}`);
  } catch (e) {
    console.log(`roznamcha_entries query: ${e.message}`);
  }

  try {
    const vouchers = await sql`SELECT count(*) as count FROM vouchers`;
    console.log(`vouchers count: ${vouchers[0]?.count || 0}`);
  } catch (e) {
    console.log(`vouchers query: ${e.message}`);
  }

  try {
    const journalEntries = await sql`SELECT count(*) as count FROM journal_entries`;
    console.log(`journal_entries count: ${journalEntries[0]?.count || 0}`);
  } catch (e) {
    console.log(`journal_entries query: ${e.message}`);
  }

  await sql.end();
}

auditDatabase().catch(console.error);
