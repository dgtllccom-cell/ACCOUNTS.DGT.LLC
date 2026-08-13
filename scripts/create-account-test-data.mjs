import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  console.log("=== CREATING ACCOUNT TEST DATA ===\n");

  // Get some existing master data to link
  const companies = await sql`SELECT id FROM companies LIMIT 5`;
  const banks = await sql`SELECT id FROM banks LIMIT 5`;
  const warehouses = await sql`SELECT id FROM warehouses LIMIT 5`;
  const customers = await sql`SELECT id FROM customers LIMIT 5`;
  const defaultCompany = await sql`SELECT id FROM companies LIMIT 1`;

  if (companies.length === 0 || banks.length === 0 || warehouses.length === 0 || defaultCompany.length === 0) {
    console.error("Not enough master data. Need at least 5 of each: companies, banks, warehouses");
    process.exit(1);
  }

  // Create a test account (must provide company_id, kind, currency as they are NOT NULL)
  const testAccount = await sql`
    INSERT INTO accounts (code, name, company_id, kind, currency, is_active)
    VALUES ('TEST-ACC-001', 'Test Cash Account', ${defaultCompany[0].id}, 'asset', 'USD', true)
    RETURNING id, code, name;
  `;

  const accountId = testAccount[0].id;
  console.log(`✓ Created account: ${testAccount[0].code} (${accountId})\n`);

  // Create translation record for the account name
  const translation = await sql`
    INSERT INTO record_translations
    (record_table, record_id, field_name, original_text, original_language_code,
     english_text, urdu_text, arabic_text, persian_text, pashto_text, source)
    VALUES
    ('accounts', ${accountId}, 'name', 'Test Cash Account', 'en',
     'Test Cash Account',
     'ٹیسٹ کیش اکاؤنٹ',
     'حساب النقد الاختبار',
     'حساب نقد آزمایشی',
     'د کیش حساب ټیسٹ',
     'manual')
    RETURNING id;
  `;

  console.log("✓ Created translations for account name (EN|UR|AR|FA|PS)\n");

  // Link companies
  console.log("Linking Companies:");
  for (let i = 0; i < Math.min(4, companies.length); i++) {
    await sql`
      INSERT INTO account_companies (account_id, company_id)
      VALUES (${accountId}, ${companies[i].id})
      ON CONFLICT (account_id, company_id) DO NOTHING;
    `;
    console.log(`  ✓ Linked company ${i + 1}`);
  }

  // Link banks
  console.log("\nLinking Banks:");
  for (let i = 0; i < Math.min(4, banks.length); i++) {
    await sql`
      INSERT INTO account_banks (account_id, bank_id)
      VALUES (${accountId}, ${banks[i].id})
      ON CONFLICT (account_id, bank_id) DO NOTHING;
    `;
    console.log(`  ✓ Linked bank ${i + 1}`);
  }

  // Link warehouses
  console.log("\nLinking Warehouses:");
  for (let i = 0; i < Math.min(4, warehouses.length); i++) {
    await sql`
      INSERT INTO account_warehouses (account_id, warehouse_id)
      VALUES (${accountId}, ${warehouses[i].id})
      ON CONFLICT (account_id, warehouse_id) DO NOTHING;
    `;
    console.log(`  ✓ Linked warehouse ${i + 1}`);
  }

  // Link customers
  console.log("\nLinking Customers/Owners:");
  for (let i = 0; i < Math.min(4, customers.length); i++) {
    await sql`
      INSERT INTO account_customer_owners (account_id, customer_id)
      VALUES (${accountId}, ${customers[i].id})
      ON CONFLICT (account_id, customer_id) DO NOTHING;
    `;
    console.log(`  ✓ Linked customer ${i + 1}`);
  }

  // Verify links in database
  console.log("\n=== VERIFICATION ===\n");

  const accountData = await sql`SELECT * FROM accounts WHERE id = ${accountId}`;
  console.log("Account Record:");
  console.log(`  ID: ${accountData[0].id}`);
  console.log(`  Code: ${accountData[0].code}`);
  console.log(`  Name: ${accountData[0].name}`);
  console.log(`  is_active: ${accountData[0].is_active}`);

  const translations_all = await sql`
    SELECT field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM record_translations
    WHERE record_table = 'accounts' AND record_id = ${accountId};
  `;

  console.log("\nTranslation Records (5 languages):");
  translations_all.forEach(t => {
    console.log(`  Field: ${t.field_name}`);
    console.log(`    EN: ${t.english_text}`);
    console.log(`    UR: ${t.urdu_text}`);
    console.log(`    AR: ${t.arabic_text}`);
    console.log(`    FA: ${t.persian_text}`);
    console.log(`    PS: ${t.pashto_text}`);
  });

  const companyLinks = await sql`SELECT COUNT(*) as count FROM account_companies WHERE account_id = ${accountId}`;
  const bankLinks = await sql`SELECT COUNT(*) as count FROM account_banks WHERE account_id = ${accountId}`;
  const warehouseLinks = await sql`SELECT COUNT(*) as count FROM account_warehouses WHERE account_id = ${accountId}`;
  const customerLinks = await sql`SELECT COUNT(*) as count FROM account_customer_owners WHERE account_id = ${accountId}`;

  console.log("\nLinked Records:");
  console.log(`  Companies: ${companyLinks[0].count}`);
  console.log(`  Banks: ${bankLinks[0].count}`);
  console.log(`  Warehouses: ${warehouseLinks[0].count}`);
  console.log(`  Customers: ${customerLinks[0].count}`);

  console.log("\n✓ Test data created successfully!");
  console.log(`Account ID for testing: ${accountId}`);

  process.exit(0);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
