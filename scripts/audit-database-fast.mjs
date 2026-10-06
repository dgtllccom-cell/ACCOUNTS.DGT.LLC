import fs from 'fs';
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
const sql = postgres(dbUrl, { max: 5, prepare: false });

async function fastAudit() {
  console.log('=== FAST DATABASE STATS AUDIT ===\n');

  // Single fast query for all table row counts in public schema
  const stats = await sql`
    SELECT 
      relname AS table_name,
      n_live_tup AS row_estimate
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC, relname ASC;
  `;

  console.log(`Audited ${stats.length} user tables via pg_stat_user_tables.\n`);

  // Filter core active tables
  const coreTables = stats.filter(s => s.row_estimate > 0 || [
    'purchase_orders', 'sales_orders', 'ledgers', 'accounts', 'roznamcha_entries',
    'vouchers', 'journal_entries', 'countries', 'branches', 'city_branches',
    'employees', 'departments', 'currency_rates', 'enterprise_record_translations',
    'customer_orders', 'loading_records', 'ports', 'users'
  ].includes(s.table_name));

  console.log('Top Active ERP Tables with Records:');
  stats.slice(0, 25).forEach(t => {
    console.log(`- ${t.table_name}: ~${t.row_estimate} rows`);
  });

  const categorized = {
    totalTables: stats.length,
    activeTablesCount: stats.filter(s => s.row_estimate > 0).length,
    coreActiveTables: coreTables,
    allTables: stats
  };

  fs.writeFileSync('scripts/audit-db-fast.json', JSON.stringify(categorized, null, 2));
  console.log('\nAudit written to scripts/audit-db-fast.json');
  await sql.end();
}

fastAudit().catch(console.error);
