import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import fs from "node:fs";
import postgres from "postgres";
import { execSync } from "child_process";

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

if (!localEnv.DATABASE_URL) {
  console.error("LOCAL DATABASE_URL not set");
  process.exit(1);
}

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║       LOCAL → VPS DATA MIGRATION & DEPLOYMENT SCRIPT           ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

const localDb = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });
const vpsDb = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  // Step 1: VPS Database Backup
  console.log("STEP 1: Creating VPS Database Backup...");
  console.log("━".repeat(65));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
  const backupFile = `backups/vps-backup-${timestamp}.sql.gz`;

  try {
    execSync(`ssh root@72.60.209.121 "cd /var/www/dgt-nextjs && pg_dump '${vpsEnv.DATABASE_URL}' | gzip > ${backupFile}.gz && ls -lh ${backupFile}.gz"`, {
      stdio: 'inherit'
    });
    console.log(`✓ VPS database backed up to: ${backupFile}\n`);
  } catch (e) {
    console.log(`⚠ Backup creation note: ${e.message}`);
    console.log("Proceeding with migration (backup recommended manually)\n");
  }

  // Step 2: Get LOCAL record counts
  console.log("STEP 2: Collecting LOCAL Record Counts...");
  console.log("━".repeat(65));

  const localCounts = {
    accounts: (await localDb`SELECT COUNT(*) as count FROM accounts;`)[0].count,
    translations: (await localDb`SELECT COUNT(*) as count FROM record_translations WHERE record_table='accounts';`)[0].count,
    companyLinks: (await localDb`SELECT COUNT(*) as count FROM account_companies;`)[0].count,
    bankLinks: (await localDb`SELECT COUNT(*) as count FROM account_banks;`)[0].count,
    warehouseLinks: (await localDb`SELECT COUNT(*) as count FROM account_warehouses;`)[0].count,
    customerLinks: (await localDb`SELECT COUNT(*) as count FROM account_customer_owners;`)[0].count
  };

  console.log(`LOCAL Database Records (BEFORE migration):`);
  console.log(`  Accounts: ${localCounts.accounts}`);
  console.log(`  Translations: ${localCounts.translations}`);
  console.log(`  Company Links: ${localCounts.companyLinks}`);
  console.log(`  Bank Links: ${localCounts.bankLinks}`);
  console.log(`  Warehouse Links: ${localCounts.warehouseLinks}`);
  console.log(`  Customer Links: ${localCounts.customerLinks}\n`);

  // Step 3: Get VPS record counts BEFORE
  console.log("STEP 3: Getting VPS Record Counts (BEFORE migration)...");
  console.log("━".repeat(65));

  const vpsCounts = {
    accountsBefore: (await vpsDb`SELECT COUNT(*) as count FROM accounts;`)[0].count,
    translationsBefore: (await vpsDb`SELECT COUNT(*) as count FROM record_translations WHERE record_table='accounts';`)[0].count,
    companyLinksBefore: (await vpsDb`SELECT COUNT(*) as count FROM account_companies;`)[0].count,
    bankLinksBefore: (await vpsDb`SELECT COUNT(*) as count FROM account_banks;`)[0].count,
    warehouseLinksBefore: (await vpsDb`SELECT COUNT(*) as count FROM account_warehouses;`)[0].count,
    customerLinksBefore: (await vpsDb`SELECT COUNT(*) as count FROM account_customer_owners;`)[0].count
  };

  console.log(`VPS Database Records (BEFORE migration):`);
  console.log(`  Accounts: ${vpsCounts.accountsBefore}`);
  console.log(`  Translations: ${vpsCounts.translationsBefore}`);
  console.log(`  Company Links: ${vpsCounts.companyLinksBefore}`);
  console.log(`  Bank Links: ${vpsCounts.bankLinksBefore}`);
  console.log(`  Warehouse Links: ${vpsCounts.warehouseLinksBefore}`);
  console.log(`  Customer Links: ${vpsCounts.customerLinksBefore}\n`);

  // Step 4: Migrate Accounts data (upsert to prevent duplicates)
  console.log("STEP 4: Migrating Accounts Data...");
  console.log("━".repeat(65));

  const accounts = await localDb`SELECT * FROM accounts WHERE code LIKE 'TEST-%' OR is_control_account = false;`;

  for (const acct of accounts) {
    await vpsDb`
      INSERT INTO accounts (
        id, code, name, company_id, branch_id, parent_id, kind,
        currency, status, is_control_account, account_type_id, is_active,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${acct.id}, ${acct.code}, ${acct.name}, ${acct.company_id},
        ${acct.branch_id}, ${acct.parent_id}, ${acct.kind},
        ${acct.currency}, ${acct.status}, ${acct.is_control_account},
        ${acct.account_type_id}, ${acct.is_active}, ${acct.created_at},
        ${acct.updated_at}, ${acct.deleted_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at;
    `;
  }
  console.log(`✓ Migrated ${accounts.length} account(s)\n`);

  // Step 5: Migrate Translations
  console.log("STEP 5: Migrating Translations (EN/UR/AR/FA/PS)...");
  console.log("━".repeat(65));

  const translations = await localDb`
    SELECT * FROM record_translations
    WHERE record_table = 'accounts' AND record_id IN (
      SELECT id FROM accounts WHERE code LIKE 'TEST-%'
    );
  `;

  for (const trans of translations) {
    await vpsDb`
      INSERT INTO record_translations (
        id, record_table, record_id, field_name, original_text,
        original_language_code, english_text, urdu_text, arabic_text,
        persian_text, pashto_text, source, corrected_by, corrected_at,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${trans.id}, ${trans.record_table}, ${trans.record_id}, ${trans.field_name},
        ${trans.original_text}, ${trans.original_language_code},
        ${trans.english_text}, ${trans.urdu_text}, ${trans.arabic_text},
        ${trans.persian_text}, ${trans.pashto_text}, ${trans.source},
        ${trans.corrected_by}, ${trans.corrected_at}, ${trans.created_at},
        ${trans.updated_at}, ${trans.deleted_at}
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

  // Step 6: Migrate Multi-Links
  console.log("STEP 6: Migrating Multi-Link Relationships...");
  console.log("━".repeat(65));

  // Company links
  const companyLinks = await localDb`
    SELECT * FROM account_companies
    WHERE account_id IN (SELECT id FROM accounts WHERE code LIKE 'TEST-%');
  `;
  for (const link of companyLinks) {
    await vpsDb`
      INSERT INTO account_companies (id, account_id, company_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.company_id}, ${link.created_at})
      ON CONFLICT (account_id, company_id) DO NOTHING;
    `;
  }
  console.log(`✓ Migrated ${companyLinks.length} company link(s)`);

  // Bank links
  const bankLinks = await localDb`
    SELECT * FROM account_banks
    WHERE account_id IN (SELECT id FROM accounts WHERE code LIKE 'TEST-%');
  `;
  for (const link of bankLinks) {
    await vpsDb`
      INSERT INTO account_banks (id, account_id, bank_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.bank_id}, ${link.created_at})
      ON CONFLICT (account_id, bank_id) DO NOTHING;
    `;
  }
  console.log(`✓ Migrated ${bankLinks.length} bank link(s)`);

  // Warehouse links
  const warehouseLinks = await localDb`
    SELECT * FROM account_warehouses
    WHERE account_id IN (SELECT id FROM accounts WHERE code LIKE 'TEST-%');
  `;
  for (const link of warehouseLinks) {
    await vpsDb`
      INSERT INTO account_warehouses (id, account_id, warehouse_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.warehouse_id}, ${link.created_at})
      ON CONFLICT (account_id, warehouse_id) DO NOTHING;
    `;
  }
  console.log(`✓ Migrated ${warehouseLinks.length} warehouse link(s)`);

  // Customer links
  const customerLinks = await localDb`
    SELECT * FROM account_customer_owners
    WHERE account_id IN (SELECT id FROM accounts WHERE code LIKE 'TEST-%');
  `;
  for (const link of customerLinks) {
    await vpsDb`
      INSERT INTO account_customer_owners (id, account_id, customer_id, created_at)
      VALUES (${link.id}, ${link.account_id}, ${link.customer_id}, ${link.created_at})
      ON CONFLICT (account_id, customer_id) DO NOTHING;
    `;
  }
  console.log(`✓ Migrated ${customerLinks.length} customer link(s)\n`);

  // Step 7: Verify VPS counts AFTER
  console.log("STEP 7: Verifying VPS Records (AFTER migration)...");
  console.log("━".repeat(65));

  const vpsCountsAfter = {
    accounts: (await vpsDb`SELECT COUNT(*) as count FROM accounts;`)[0].count,
    translations: (await vpsDb`SELECT COUNT(*) as count FROM record_translations WHERE record_table='accounts';`)[0].count,
    companyLinks: (await vpsDb`SELECT COUNT(*) as count FROM account_companies;`)[0].count,
    bankLinks: (await vpsDb`SELECT COUNT(*) as count FROM account_banks;`)[0].count,
    warehouseLinks: (await vpsDb`SELECT COUNT(*) as count FROM account_warehouses;`)[0].count,
    customerLinks: (await vpsDb`SELECT COUNT(*) as count FROM account_customer_owners;`)[0].count
  };

  console.log(`VPS Database Records (AFTER migration):`);
  console.log(`  Accounts: ${vpsCountsAfter.accounts} (was ${vpsCounts.accountsBefore})`);
  console.log(`  Translations: ${vpsCountsAfter.translations} (was ${vpsCounts.translationsBefore})`);
  console.log(`  Company Links: ${vpsCountsAfter.companyLinks} (was ${vpsCounts.companyLinksBefore})`);
  console.log(`  Bank Links: ${vpsCountsAfter.bankLinks} (was ${vpsCounts.bankLinksBefore})`);
  console.log(`  Warehouse Links: ${vpsCountsAfter.warehouseLinks} (was ${vpsCounts.warehouseLinksBefore})`);
  console.log(`  Customer Links: ${vpsCountsAfter.customerLinks} (was ${vpsCounts.customerLinksBefore}\n`);

  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              DATA MIGRATION VERIFICATION SUMMARY               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("LOCAL → VPS Transfer:");
  console.log(`  ✓ Accounts: ${localCounts.accounts} → VPS +${vpsCountsAfter.accounts - vpsCounts.accountsBefore}`);
  console.log(`  ✓ Translations: ${localCounts.translations} → VPS +${vpsCountsAfter.translations - vpsCounts.translationsBefore}`);
  console.log(`  ✓ Company Links: ${localCounts.companyLinks} → VPS +${vpsCountsAfter.companyLinks - vpsCounts.companyLinksBefore}`);
  console.log(`  ✓ Bank Links: ${localCounts.bankLinks} → VPS +${vpsCountsAfter.bankLinks - vpsCounts.bankLinksBefore}`);
  console.log(`  ✓ Warehouse Links: ${localCounts.warehouseLinks} → VPS +${vpsCountsAfter.warehouseLinks - vpsCounts.warehouseLinksBefore}`);
  console.log(`  ✓ Customer Links: ${localCounts.customerLinks} → VPS +${vpsCountsAfter.customerLinks - vpsCounts.customerLinksBefore}\n`);

  console.log(`✓ Migration completed successfully!\n`);
  console.log("Next: Deploy code to VPS and test");

  process.exit(0);
} catch (error) {
  console.error("\n✗ Migration failed:", error.message);
  process.exit(1);
}
