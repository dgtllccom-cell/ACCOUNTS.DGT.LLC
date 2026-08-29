import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};

const localDb = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });
const vpsDb = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║    LOCAL → VPS COMPREHENSIVE DATA MIGRATION (SAFE UPSERT)      ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

try {
  console.log("STEP 1: Getting TEST account with company reference...");
  const testAccounts = await localDb`
    SELECT id, code, name, company_id, branch_id, kind, currency, is_active
    FROM accounts WHERE code = 'TEST-ACC-001' LIMIT 1;
  `;

  if (testAccounts.length === 0) {
    console.error("✗ No TEST-ACC-001 found in LOCAL database");
    process.exit(1);
  }

  const testAcct = testAccounts[0];
  console.log(`✓ Found TEST-ACC-001 (references company: ${testAcct.company_id})\n`);

  // Get the company the account references
  console.log("STEP 2: Migrating referenced Company...");
  const company = await localDb`
    SELECT * FROM companies WHERE id = ${testAcct.company_id} LIMIT 1;
  `;

  if (company.length > 0) {
    const c = company[0];
    await vpsDb`
      INSERT INTO companies (
        id, legal_name, name, account_id, is_active, created_at, updated_at
      ) VALUES (
        ${c.id}, ${c.legal_name || null}, ${c.name}, ${c.account_id || null},
        ${c.is_active !== false}, ${c.created_at || new Date().toISOString()},
        ${c.updated_at || new Date().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        name = EXCLUDED.name,
        updated_at = EXCLUDED.updated_at;
    `;
    console.log(`✓ Migrated company: ${c.name}\n`);
  }

  // Migrate the account
  console.log("STEP 3: Migrating TEST account...");
  await vpsDb`
    INSERT INTO accounts (
      id, code, name, company_id, branch_id, kind,
      currency, is_active, created_at, updated_at
    ) VALUES (
      ${testAcct.id}, ${testAcct.code}, ${testAcct.name}, ${testAcct.company_id},
      ${testAcct.branch_id || null}, ${testAcct.kind || 'asset'},
      ${testAcct.currency || 'USD'}, ${testAcct.is_active !== false},
      ${testAcct.created_at || new Date().toISOString()},
      ${testAcct.updated_at || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at;
  `;
  console.log(`✓ Migrated account: ${testAcct.code}\n`);

  // Migrate translations
  console.log("STEP 4: Migrating 5-language translations...");
  const translations = await localDb`
    SELECT * FROM record_translations
    WHERE record_table = 'accounts' AND record_id = ${testAcct.id};
  `;

  for (const trans of translations) {
    await vpsDb`
      INSERT INTO record_translations (
        id, record_table, record_id, field_name, original_text,
        original_language_code, english_text, urdu_text, arabic_text,
        persian_text, pashto_text, source, created_at, updated_at
      ) VALUES (
        ${trans.id}, ${trans.record_table}, ${trans.record_id},
        ${trans.field_name}, ${trans.original_text},
        ${trans.original_language_code}, ${trans.english_text},
        ${trans.urdu_text}, ${trans.arabic_text}, ${trans.persian_text},
        ${trans.pashto_text}, ${trans.source},
        ${trans.created_at || new Date().toISOString()},
        ${trans.updated_at || new Date().toISOString()}
      )
      ON CONFLICT (id) DO UPDATE SET
        english_text = EXCLUDED.english_text,
        urdu_text = EXCLUDED.urdu_text,
        arabic_text = EXCLUDED.arabic_text,
        persian_text = EXCLUDED.persian_text,
        pashto_text = EXCLUDED.pashto_text,
        updated_at = EXCLUDED.updated_at;
    `;
  }
  console.log(`✓ Migrated ${translations.length} translation record(s)\n`);

  // Migrate multi-links
  console.log("STEP 5: Migrating multi-link relationships...");

  const companyLinks = await localDb`
    SELECT * FROM account_companies WHERE account_id = ${testAcct.id};
  `;
  for (const link of companyLinks) {
    await vpsDb`
      INSERT INTO account_companies (id, account_id, company_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.company_id},
              ${link.created_at || new Date().toISOString()})
      ON CONFLICT (account_id, company_id) DO NOTHING;
    `;
  }
  console.log(`  ✓ Company links: ${companyLinks.length}`);

  const bankLinks = await localDb`
    SELECT * FROM account_banks WHERE account_id = ${testAcct.id};
  `;
  for (const link of bankLinks) {
    await vpsDb`
      INSERT INTO account_banks (id, account_id, bank_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.bank_id},
              ${link.created_at || new Date().toISOString()})
      ON CONFLICT (account_id, bank_id) DO NOTHING;
    `;
  }
  console.log(`  ✓ Bank links: ${bankLinks.length}`);

  const warehouseLinks = await localDb`
    SELECT * FROM account_warehouses WHERE account_id = ${testAcct.id};
  `;
  for (const link of warehouseLinks) {
    await vpsDb`
      INSERT INTO account_warehouses (id, account_id, warehouse_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.warehouse_id},
              ${link.created_at || new Date().toISOString()})
      ON CONFLICT (account_id, warehouse_id) DO NOTHING;
    `;
  }
  console.log(`  ✓ Warehouse links: ${warehouseLinks.length}`);

  const customerLinks = await localDb`
    SELECT * FROM account_customer_owners WHERE account_id = ${testAcct.id};
  `;
  for (const link of customerLinks) {
    await vpsDb`
      INSERT INTO account_customer_owners (id, account_id, customer_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.customer_id},
              ${link.created_at || new Date().toISOString()})
      ON CONFLICT (account_id, customer_id) DO NOTHING;
    `;
  }
  console.log(`  ✓ Customer links: ${customerLinks.length}\n`);

  // Verification
  console.log("STEP 6: Verification...");
  const vpsAccount = await vpsDb`
    SELECT id, code, name, is_active FROM accounts WHERE code = 'TEST-ACC-001' LIMIT 1;
  `;
  console.log(`✓ VPS Account: ${vpsAccount[0]?.code} (${vpsAccount[0]?.name})`);

  const vpsTranslations = await vpsDb`
    SELECT english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM record_translations WHERE record_table = 'accounts'
    AND record_id = ${testAcct.id} LIMIT 1;
  `;

  if (vpsTranslations.length > 0) {
    const t = vpsTranslations[0];
    console.log(`✓ Translations: EN=${t.english_text}, UR=${t.urdu_text}, AR=${t.arabic_text}, FA=${t.persian_text}, PS=${t.pashto_text}`);
  }

  const vpsLinks = await vpsDb`
    SELECT
      (SELECT COUNT(*) FROM account_companies WHERE account_id = ${testAcct.id}) as companies,
      (SELECT COUNT(*) FROM account_banks WHERE account_id = ${testAcct.id}) as banks,
      (SELECT COUNT(*) FROM account_warehouses WHERE account_id = ${testAcct.id}) as warehouses,
      (SELECT COUNT(*) FROM account_customer_owners WHERE account_id = ${testAcct.id}) as customers;
  `;

  if (vpsLinks.length > 0) {
    const l = vpsLinks[0];
    console.log(`✓ Multi-links: ${l.companies} companies, ${l.banks} banks, ${l.warehouses} warehouses, ${l.customers} customers`);
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                     MIGRATION SUCCESSFUL ✓                     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log("\nNext: Deploy code to VPS and test");

  process.exit(0);
} catch (error) {
  console.error("\n✗ Migration failed:", error.message);
  process.exit(1);
}
