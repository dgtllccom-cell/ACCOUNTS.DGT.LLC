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

async function categorizeAllTables() {
  console.log('=== CATEGORIZING ALL DATABASE TABLES ===\n');

  const stats = await sql`
    SELECT 
      relname AS table_name,
      n_live_tup AS row_estimate
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname ASC;
  `;

  const total = stats.length;
  console.log(`Total Database Tables in public schema: ${total}`);

  const categories = {
    coreSystem: [],
    financialAndJournals: [],
    purchasesAndSupplyChain: [],
    salesAndDistribution: [],
    roznamchaAndCashBook: [],
    ledgersAndAccounts: [],
    userSecurityAndAuth: [],
    countryBranchAndEnterprise: [],
    translationAndLanguage: [],
    printAndReporting: [],
    auditAndSecurityLogs: [],
    geoAndLocationReference: [],
    backupAndObsolete: [],
    otherMasterAndOperational: []
  };

  for (const item of stats) {
    const name = item.table_name.toLowerCase();
    const rows = Number(item.row_estimate);

    if (name.startsWith('zz_') || name.includes('bak') || name.includes('backup') || name.includes('temp_') || name.includes('tmp_')) {
      categories.backupAndObsolete.push({ name, rows });
    } else if (name.startsWith('translations_') || name.includes('translation') || name.includes('i18n') || name.includes('dictionary') || name.includes('language')) {
      categories.translationAndLanguage.push({ name, rows });
    } else if (name.includes('roznamcha')) {
      categories.roznamchaAndCashBook.push({ name, rows });
    } else if (name.includes('purchase')) {
      categories.purchasesAndSupplyChain.push({ name, rows });
    } else if (name.includes('sale') || name.includes('delivery')) {
      categories.salesAndDistribution.push({ name, rows });
    } else if (name.includes('ledger') || name.includes('account') || name.includes('balance') || name.includes('journal')) {
      categories.ledgersAndAccounts.push({ name, rows });
    } else if (name.includes('user') || name.includes('role') || name.includes('permission') || name.includes('auth') || name.includes('session') || name.includes('credential')) {
      categories.userSecurityAndAuth.push({ name, rows });
    } else if (name.includes('country') || name.includes('branch') || name.includes('company') || name.includes('enterprise')) {
      categories.countryBranchAndEnterprise.push({ name, rows });
    } else if (name.includes('audit') || name.includes('log')) {
      categories.auditAndSecurityLogs.push({ name, rows });
    } else if (name.includes('print') || name.includes('report') || name.includes('invoice_template') || name.includes('statement')) {
      categories.printAndReporting.push({ name, rows });
    } else if (name.includes('city') || name.includes('district') || name.includes('state') || name.includes('province') || name.includes('port') || name.includes('country_location')) {
      categories.geoAndLocationReference.push({ name, rows });
    } else if (name.includes('currency') || name.includes('payment') || name.includes('voucher') || name.includes('transaction') || name.includes('bank') || name.includes('financial')) {
      categories.financialAndJournals.push({ name, rows });
    } else if (name.includes('system') || name.includes('config') || name.includes('setting') || name.includes('metadata') || name.includes('feature')) {
      categories.coreSystem.push({ name, rows });
    } else {
      categories.otherMasterAndOperational.push({ name, rows });
    }
  }

  console.log('\n--- CATEGORY BREAKDOWN ---');
  for (const [cat, list] of Object.entries(categories)) {
    console.log(`- ${cat}: ${list.length} tables`);
  }

  fs.writeFileSync('scripts/audit-db-categorized.json', JSON.stringify({ total, categories }, null, 2));
  console.log('\nSaved categorized inventory to scripts/audit-db-categorized.json');
  await sql.end();
}

categorizeAllTables().catch(console.error);
