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

async function ensure4CountryLedgers() {
  console.log("Checking and ensuring 4 Main Country Hub Master Accounts...");

  const countries = await sql`SELECT id, name, iso2, currency_code FROM countries;`;
  const uae = countries.find(c => c.name.toLowerCase().includes('emirates') || c.iso2 === 'AE');
  const pak = countries.find(c => c.name.toLowerCase().includes('pakistan') || c.iso2 === 'PK');
  const afg = countries.find(c => c.name.toLowerCase().includes('afghanistan') || c.iso2 === 'AF');
  const chn = countries.find(c => c.name.toLowerCase().includes('china') || c.iso2 === 'CN');

  const hubs = [
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
    }
  ];

  for (const hub of hubs) {
    let [existing] = await sql`SELECT id, code, name FROM enterprise_accounts WHERE code = ${hub.code};`;
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
          ${hub.code},
          ${hub.name},
          ${hub.account_number},
          ${hub.customer_number},
          ${hub.account_serial_number},
          ${hub.country_serial_number},
          ${hub.branch_serial_number},
          ${hub.branch_code},
          ${hub.branch_account_sequence},
          NOW(),
          ${hub.manual_ref},
          ${hub.currency},
          ${hub.country_id},
          null,
          null,
          ${hub.scope},
          ${hub.kind},
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
        SET name = ${hub.name},
            manual_reference_number = ${hub.manual_ref},
            currency = ${hub.currency},
            country_id = COALESCE(country_id, ${hub.country_id}),
            country_branch_id = null,
            city_branch_id = null,
            scope = 'country',
            status = 'active'
        WHERE id = ${existing.id};
      `;
      console.log(`Updated Enterprise Account: ${hub.code} - ${hub.name}`);
    }

    // Ensure linked ledger
    const [existingLedger] = await sql`SELECT id FROM ledgers WHERE enterprise_account_id = ${existing.id} OR code = ${hub.code};`;
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
          ${hub.code},
          ${hub.name},
          ${hub.currency},
          'country',
          ${hub.country_id},
          true
        );
      `;
    }
  }

  // Fetch final 4 accounts
  const final4 = await sql`
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
    WHERE ea.code IN ('UAE-CORP-GEN-001', 'PAK-CORP-GEN-001', 'AFG-CORP-GEN-001', 'CHN-CORP-GEN-001')
    ORDER BY ea.manual_reference_number;
  `;
  console.log("\n4 Main Country Ledgers successfully active in database:");
  console.table(final4);

  await sql.end();
}

ensure4CountryLedgers().catch(console.error);
