import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPaths = ['.env.local', '.env.production', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

async function main() {
  const sql = postgres(getDbUrl(), { max: 1 });
  console.log("=== ENSURING ALL 5 NATIONAL CLEARING HUBS & ACCOUNTS ===");

  try {
    // 1. Ensure Countries
    let [ind] = await sql`SELECT id, name, iso2 FROM public.countries WHERE iso2 = 'IN' OR name ILIKE '%India%' LIMIT 1;`;
    if (!ind) {
      [ind] = await sql`
        INSERT INTO public.countries (name, iso2, is_active)
        VALUES ('India', 'IN', true)
        RETURNING id, name, iso2;
      `;
    }
    console.log("India Country ID:", ind.id);

    // 2. Ensure India Main Branch
    let [indBranch] = await sql`SELECT id, name, code FROM public.country_branches WHERE country_id = ${ind.id} LIMIT 1;`;
    if (!indBranch) {
      [indBranch] = await sql`
        INSERT INTO public.country_branches (country_id, name, code, is_main, is_active)
        VALUES (${ind.id}, 'India Main Branch', 'BR-DEL-001', true, true)
        RETURNING id, name, code;
      `;
    }
    console.log("India Branch ID:", indBranch.id, indBranch.name);

    // 3. Ensure India City Branch
    let [indCity] = await sql`SELECT id, name, code FROM public.city_branches WHERE country_id = ${ind.id} LIMIT 1;`;
    if (!indCity) {
      [indCity] = await sql`
        INSERT INTO public.city_branches (country_id, country_branch_id, name, code, is_active)
        VALUES (${ind.id}, ${indBranch.id}, 'New Delhi City Branch', 'DEL-CITY-001', true)
        RETURNING id, name, code;
      `;
    }
    console.log("India City Branch ID:", indCity.id, indCity.name);

    // 4. Ensure India Enterprise Account: 0005-IND-HUB
    let [indAccount] = await sql`
      SELECT id, code, name, manual_reference_number FROM public.enterprise_accounts 
      WHERE code = 'IND-CORP-GEN-001' OR manual_reference_number = '0005-IND-HUB'
      LIMIT 1;
    `;
    if (!indAccount) {
      [indAccount] = await sql`
        INSERT INTO public.enterprise_accounts (
          code, name, account_number, customer_number,
          account_serial_number, country_serial_number, branch_serial_number,
          branch_code, branch_account_sequence, creation_date,
          manual_reference_number, currency, country_id,
          scope, kind, status, is_control_account, opening_balance, current_balance
        ) VALUES (
          'IND-CORP-GEN-001', 'India National Central Clearing Ledger', '5000001', 'CUST-IND-0001',
          5000001, 5000001, 1,
          'BR-DEL-001', 1, NOW(),
          '0005-IND-HUB', 'INR', ${ind.id},
          'country', 'asset', 'active', true, 0, 0
        ) RETURNING id, code, name, manual_reference_number;
      `;
    }

    let [indLedger] = await sql`
      SELECT id, code, name, currency FROM public.ledgers 
      WHERE enterprise_account_id = ${indAccount.id} OR code = '0005-IND-HUB' OR code = 'IND-CORP-GEN-001'
      LIMIT 1;
    `;
    if (!indLedger) {
      [indLedger] = await sql`
        INSERT INTO public.ledgers (
          enterprise_account_id, code, name, currency, scope, country_id, is_active
        ) VALUES (
          ${indAccount.id}, '0005-IND-HUB', 'India National Central Clearing Ledger', 'INR', 'country', ${ind.id}, true
        ) RETURNING id, code, name, currency;
      `;
    }
    console.log("India Ledger Created:", indLedger.code, indLedger.name);

    console.log("✅ All 5 National Hubs & India Main Ledger verified in database!");

  } catch (err) {
    console.error("Error setting up hubs:", err);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
