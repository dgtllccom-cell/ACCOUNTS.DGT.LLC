import fs from 'fs';
import postgres from 'postgres';

function getDbUrl() {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const match = fs.readFileSync(f, 'utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const sql = postgres(getDbUrl(), { max: 1 });

async function seedMasterAccounts() {
  console.log("Checking and ensuring Super Admin & Country Hub Master Accounts...");

  const countries = await sql`SELECT * FROM countries;`;
  let uae = countries.find(c => (c.name || '').toLowerCase().includes('emirates') || c.code === 'AE' || c.code === 'UAE' || c.country_code === 'AE');
  let pak = countries.find(c => (c.name || '').toLowerCase().includes('pakistan') || c.code === 'PK' || c.code === 'PAK' || c.country_code === 'PK');
  let afg = countries.find(c => (c.name || '').toLowerCase().includes('afghanistan') || c.code === 'AF' || c.code === 'AFG' || c.country_code === 'AF');
  let chn = countries.find(c => (c.name || '').toLowerCase().includes('china') || c.code === 'CN' || c.code === 'CHN' || c.country_code === 'CN');
  let ind = countries.find(c => (c.name || '').toLowerCase().includes('india') || c.code === 'IN' || c.code === 'IND' || c.country_code === 'IN');

  if (!chn) {
    const [newChn] = await sql`
      INSERT INTO countries (name, code, is_active)
      VALUES ('China', 'CN', true)
      ON CONFLICT DO NOTHING
      RETURNING id, name, code;
    `;
    chn = newChn || (await sql`SELECT id, name, code FROM countries WHERE code = 'CN' OR name ILIKE '%China%' LIMIT 1;`)[0];
  }

  if (!ind) {
    const [newInd] = await sql`
      INSERT INTO countries (name, code, is_active)
      VALUES ('India', 'IN', true)
      ON CONFLICT DO NOTHING
      RETURNING id, name, code;
    `;
    ind = newInd || (await sql`SELECT id, name, code FROM countries WHERE code = 'IN' OR name ILIKE '%India%' LIMIT 1;`)[0];
  }

  // Check India main branch
  let [indMainBranch] = await sql`SELECT id, name, country_id FROM country_branches WHERE country_id = ${ind?.id} LIMIT 1;`;
  if (!indMainBranch && ind?.id) {
    const [createdBranch] = await sql`
      INSERT INTO country_branches (country_id, name, code, is_main, is_active)
      VALUES (${ind.id}, 'India Main Branch', 'BR-DEL-001', true, true)
      RETURNING id, name, country_id;
    `;
    indMainBranch = createdBranch;
  }

  const masterAccounts = [
    // 0. Super Admin Master Capital Account
    {
      code: 'SA-CAP-0001',
      account_number: '0000001',
      customer_number: 'CUST-SA-0001',
      account_serial_number: 1,
      country_serial_number: 1,
      branch_serial_number: 1,
      branch_code: 'BR-GLOBAL-001',
      branch_account_sequence: 1,
      manual_ref: '0000-SA-CAP',
      name: 'Haji Abdullah Jan Accounts',
      currency: 'USD',
      country_id: uae?.id || null,
      scope: 'super_admin',
      kind: 'equity'
    },
    // 1. UAE Main Clearing
    {
      code: 'UAE-CORP-GEN-001',
      account_number: '1000001',
      customer_number: 'CUST-UAE-0001',
      account_serial_number: 1000001,
      country_serial_number: 1000001,
      branch_serial_number: 1,
      branch_code: 'BR-DXB-001',
      branch_account_sequence: 1,
      manual_ref: '0001-UAE-HUB',
      name: 'United Arab Emirates Main Country Clearing Ledger',
      currency: 'AED',
      country_id: uae?.id,
      scope: 'country',
      kind: 'asset'
    },
    // 2. Pakistan Main Clearing
    {
      code: 'PAK-CORP-GEN-001',
      account_number: '2000001',
      customer_number: 'CUST-PAK-0001',
      account_serial_number: 2000001,
      country_serial_number: 2000001,
      branch_serial_number: 1,
      branch_code: 'BR-KHI-001',
      branch_account_sequence: 1,
      manual_ref: '0002-PAK-HUB',
      name: 'Pakistan National Central Clearing Ledger',
      currency: 'PKR',
      country_id: pak?.id,
      scope: 'country',
      kind: 'asset'
    },
    // 3. Afghanistan Main Clearing
    {
      code: 'AFG-CORP-GEN-001',
      account_number: '3000001',
      customer_number: 'CUST-AFG-0001',
      account_serial_number: 3000001,
      country_serial_number: 3000001,
      branch_serial_number: 1,
      branch_code: 'BR-KBL-001',
      branch_account_sequence: 1,
      manual_ref: '0003-AFG-HUB',
      name: 'Afghanistan National Central Clearing Ledger',
      currency: 'AFN',
      country_id: afg?.id,
      scope: 'country',
      kind: 'asset'
    },
    // 4. China Main Clearing
    {
      code: 'CHN-CORP-GEN-001',
      account_number: '4000001',
      customer_number: 'CUST-CHN-0001',
      account_serial_number: 4000001,
      country_serial_number: 4000001,
      branch_serial_number: 1,
      branch_code: 'BR-BJS-001',
      branch_account_sequence: 1,
      manual_ref: '0004-CHN-HUB',
      name: 'China & International Trade Clearing Ledger',
      currency: 'USD',
      country_id: chn?.id,
      scope: 'country',
      kind: 'asset'
    },
    // 5. India Main Clearing
    {
      code: 'IND-CORP-GEN-001',
      account_number: '5000001',
      customer_number: 'CUST-IND-0001',
      account_serial_number: 5000001,
      country_serial_number: 5000001,
      branch_serial_number: 1,
      branch_code: 'BR-DEL-001',
      branch_account_sequence: 1,
      manual_ref: '0005-IND-HUB',
      name: 'India National Central Clearing Ledger',
      currency: 'INR',
      country_id: ind?.id,
      scope: 'country',
      kind: 'asset'
    }
  ];

  for (const acc of masterAccounts) {
    let [existing] = await sql`SELECT id, code, name FROM enterprise_accounts WHERE code = ${acc.code} OR manual_reference_number = ${acc.manual_ref};`;
    if (!existing) {
      const [inserted] = await sql`
        INSERT INTO enterprise_accounts (
          code,
          name,
          account_number,
          customer_number,
          account_serial_number,
          country_serial_number,
          branch_serial_number,
          branch_code,
          branch_account_sequence,
          creation_date,
          manual_reference_number,
          currency,
          country_id,
          country_branch_id,
          city_branch_id,
          scope,
          kind,
          status,
          is_control_account,
          opening_balance,
          current_balance
        ) VALUES (
          ${acc.code},
          ${acc.name},
          ${acc.account_number},
          ${acc.customer_number},
          ${acc.account_serial_number},
          ${acc.country_serial_number},
          ${acc.branch_serial_number},
          ${acc.branch_code},
          ${acc.branch_account_sequence},
          NOW(),
          ${acc.manual_ref},
          ${acc.currency},
          ${acc.country_id},
          null,
          null,
          ${acc.scope},
          ${acc.kind},
          'active',
          true,
          0,
          0
        ) RETURNING id, code, name;
      `;
      existing = inserted;
      console.log(`Created Enterprise Account: ${inserted.code} - ${inserted.name}`);
    } else {
      await sql`
        UPDATE enterprise_accounts
        SET name = ${acc.name},
            manual_reference_number = ${acc.manual_ref},
            currency = ${acc.currency},
            country_id = COALESCE(country_id, ${acc.country_id}),
            scope = ${acc.scope},
            kind = ${acc.kind},
            status = 'active'
        WHERE id = ${existing.id};
      `;
      console.log(`Updated Enterprise Account: ${acc.code} - ${acc.name}`);
    }

    // Ensure linked ledger
    const [existingLedger] = await sql`SELECT id FROM ledgers WHERE enterprise_account_id = ${existing.id} OR code = ${acc.code};`;
    if (!existingLedger) {
      await sql`
        INSERT INTO ledgers (
          enterprise_account_id,
          code,
          name,
          currency,
          scope,
          country_id,
          is_active
        ) VALUES (
          ${existing.id},
          ${acc.code},
          ${acc.name},
          ${acc.currency},
          ${acc.scope},
          ${acc.country_id},
          true
        );
      `;
    }
  }

  // Fetch final list of accounts
  const finalList = await sql`
    SELECT 
      ea.manual_reference_number as manual_ref,
      ea.code as account_code,
      ea.name as account_name,
      c.name as country,
      ea.currency,
      ea.current_balance as balance,
      ea.scope,
      ea.status
    FROM enterprise_accounts ea
    LEFT JOIN countries c ON c.id = ea.country_id
    WHERE ea.code IN ('SA-CAP-0001', 'UAE-CORP-GEN-001', 'PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'CHN-CORP-GEN-001', 'IND-CORP-GEN-001')
    ORDER BY ea.manual_reference_number;
  `;
  console.log("\nMaster Accounts successfully active in database:");
  console.table(finalList);

  await sql.end();
}

seedMasterAccounts().catch(console.error);
