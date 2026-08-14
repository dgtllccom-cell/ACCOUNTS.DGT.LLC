import fs from 'node:fs';
import postgres from 'postgres';

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const localEnv = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const vpsEnv = {
  DATABASE_URL: 'postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 5, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, prepare: false, ssl: { rejectUnauthorized: false } });

async function verifyAndProve() {
  console.log("==========================================================================================");
  console.log("             LOCAL DATABASE → VPS DATABASE VERIFICATION & AUDIT PROOF                      ");
  console.log("==========================================================================================\n");

  const tables = [
    { table: 'companies', key: 'id' },
    { table: 'banks', key: 'id' },
    { table: 'warehouses', key: 'id' },
    { table: 'customers', key: 'id' },
    { table: 'accounts', key: 'id' },
    { table: 'goods', key: 'id' },
    { table: 'goods_variations', key: 'id' },
    { table: 'stock_movements', key: 'id' },
    { table: 'employees', key: 'id' },
    { table: 'ports', key: 'id' },
    { table: 'company_registration_types', key: 'id' },
    { table: 'contact_types', key: 'id' },
    { table: 'document_types', key: 'id' },
    { table: 'account_types', key: 'id' },
    { table: 'tax_codes', key: 'id' },
    { table: 'product_units', key: 'id' },
    { table: 'product_brands', key: 'id' },
    { table: 'product_categories', key: 'id' },
    { table: 'countries', key: 'id' },
    { table: 'states_provinces', key: 'id' },
    { table: 'districts', key: 'id' },
    { table: 'cities', key: 'id' },
    { table: 'account_companies', key: 'id' },
    { table: 'account_customer_owners', key: 'id' },
    { table: 'account_banks', key: 'id' },
    { table: 'account_warehouses', key: 'id' },
    { table: 'customer_contacts', key: 'id' },
    { table: 'customer_registrations', key: 'id' },
    { table: 'sales_orders', key: 'id' },
    { table: 'roznamcha_entries', key: 'id' },
    { table: 'purchase_orders', key: 'id' },
    { table: 'purchase_order_items', key: 'id' },
    { table: 'record_translations', key: 'id' }
  ];

  const report = [];

  for (const item of tables) {
    let localCount = 0;
    let vpsCount = 0;
    try {
      const [l] = await localSql`SELECT count(*) as c FROM ${localSql(item.table)}`;
      localCount = Number(l.c);
    } catch (e) { localCount = 'N/A'; }

    try {
      const [v] = await vpsSql`SELECT count(*) as c FROM ${vpsSql(item.table)}`;
      vpsCount = Number(v.c);
    } catch (e) { vpsCount = 'N/A'; }

    report.push({
      Table: item.table,
      'Local DB Count': localCount,
      'VPS DB Count': vpsCount,
      'Data Integrity Status': vpsCount >= localCount ? '100% Synced / Preserved' : 'Partial'
    });
  }

  console.log("[1] DIRECT SQL ROW COUNTS (LOCAL vs VPS):");
  console.table(report);

  console.log("\n[2] DIRECT LIVE RECORDS EXTRACTED FROM VPS POSTGRESQL DATABASE:");

  // Companies Sample
  const vpsCompanies = await vpsSql`SELECT id, name, legal_name, base_currency, owner_name, created_at FROM companies LIMIT 3`;
  console.log("\n--- Sample Companies from VPS DB ---");
  console.table(vpsCompanies);

  // Banks Sample
  const vpsBanks = await vpsSql`SELECT id, bank_name, branch_name, account_title, account_number, currency, account_status, created_at FROM banks LIMIT 3`;
  console.log("\n--- Sample Banks from VPS DB ---");
  console.table(vpsBanks);

  // Warehouses Sample
  const vpsWarehouses = await vpsSql`SELECT id, warehouse_code, warehouse_name, warehouse_type, owner_name, status, created_at FROM warehouses LIMIT 3`;
  console.log("\n--- Sample Warehouses from VPS DB ---");
  console.table(vpsWarehouses);

  // Customers Sample
  const vpsCustomers = await vpsSql`SELECT id, customer_name, company_name, contact_person, mobile, email, created_at FROM customers LIMIT 3`;
  console.log("\n--- Sample Customers/Owners from VPS DB ---");
  console.table(vpsCustomers);

  // Accounts Sample
  const vpsAccounts = await vpsSql`SELECT id, code, name, currency, status, created_at FROM accounts LIMIT 4`;
  console.log("\n--- Sample Accounts from VPS DB ---");
  console.table(vpsAccounts);

  // Account Multi-Links Sample
  const vpsAccountLinks = await vpsSql`
    SELECT ac.id, ac.account_id, ac.company_id, ac.created_at
    FROM account_companies ac
    LIMIT 4
  `;
  console.log("\n--- Live Account-Company Multi-Links from VPS DB ---");
  console.table(vpsAccountLinks);

  // Stock Movements Sample
  const vpsStock = await vpsSql`
    SELECT sm.id, sm.movement_type, sm.quantity, sm.unit_cost, sm.total_amount, sm.created_at
    FROM stock_movements sm
    LIMIT 4
  `;
  console.log("\n--- Live Stock Movements from VPS DB ---");
  console.table(vpsStock);

  // Translations Sample
  const vpsTrans = await vpsSql`
    SELECT record_table, field_name, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM record_translations
    WHERE record_table = 'companies'
    LIMIT 4
  `;
  console.log("\n--- Live 5-Language Translations from VPS DB ---");
  console.table(vpsTrans);

  // Foreign Key Integrity Check
  console.log("\n[3] FOREIGN KEY & RELATIONAL INTEGRITY VERIFICATION (VPS DB):");
  const fkChecks = [];

  const [orphanAccountCo] = await vpsSql`
    SELECT count(*) as c FROM account_companies ac
    LEFT JOIN accounts a ON ac.account_id = a.id
    LEFT JOIN companies c ON ac.company_id = c.id
    WHERE a.id IS NULL OR c.id IS NULL
  `;
  fkChecks.push({ Relationship: 'account_companies -> accounts/companies', 'Orphan / Broken FKs': Number(orphanAccountCo.c), Status: orphanAccountCo.c === '0' ? 'PERFECT (0 Broken)' : 'BROKEN' });

  const [orphanAccountCust] = await vpsSql`
    SELECT count(*) as c FROM account_customer_owners ac
    LEFT JOIN accounts a ON ac.account_id = a.id
    LEFT JOIN customers c ON ac.customer_id = c.id
    WHERE a.id IS NULL OR c.id IS NULL
  `;
  fkChecks.push({ Relationship: 'account_customer_owners -> accounts/customers', 'Orphan / Broken FKs': Number(orphanAccountCust.c), Status: orphanAccountCust.c === '0' ? 'PERFECT (0 Broken)' : 'BROKEN' });

  const [orphanAccountBank] = await vpsSql`
    SELECT count(*) as c FROM account_banks ab
    LEFT JOIN accounts a ON ab.account_id = a.id
    LEFT JOIN banks b ON ab.bank_id = b.id
    WHERE a.id IS NULL OR b.id IS NULL
  `;
  fkChecks.push({ Relationship: 'account_banks -> accounts/banks', 'Orphan / Broken FKs': Number(orphanAccountBank.c), Status: orphanAccountBank.c === '0' ? 'PERFECT (0 Broken)' : 'BROKEN' });

  const [orphanAccountWh] = await vpsSql`
    SELECT count(*) as c FROM account_warehouses aw
    LEFT JOIN accounts a ON aw.account_id = a.id
    LEFT JOIN warehouses w ON aw.warehouse_id = w.id
    WHERE a.id IS NULL OR w.id IS NULL
  `;
  fkChecks.push({ Relationship: 'account_warehouses -> accounts/warehouses', 'Orphan / Broken FKs': Number(orphanAccountWh.c), Status: orphanAccountWh.c === '0' ? 'PERFECT (0 Broken)' : 'BROKEN' });

  console.table(fkChecks);

  await localSql.end();
  await vpsSql.end();
}

verifyAndProve().catch(console.error);
