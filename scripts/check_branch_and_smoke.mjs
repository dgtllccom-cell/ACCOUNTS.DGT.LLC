import postgres from "postgres";
import fs from "fs";

let envContent = fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 2 });

async function main() {
  console.log("=== 1. CREATING 'X EXPERIMENT BRANCH' ===");
  const existing = await sql`
    SELECT id, name, code FROM city_branches WHERE name ILIKE '%experiment%' OR code ILIKE '%exp%'
  `;
  if (existing.length > 0) {
    console.log("Existing Experiment branch:", existing);
  } else {
    const [uae] = await sql`SELECT id FROM countries WHERE iso2 = 'AE' LIMIT 1`;
    const [uaeBranch] = await sql`SELECT id FROM country_branches WHERE code = 'ARE-MAIN-001' LIMIT 1`;
    const [dubaiCity] = await sql`SELECT id FROM cities WHERE country_id = ${uae.id} LIMIT 1`;

    const [created] = await sql`
      INSERT INTO city_branches (
        country_id,
        country_branch_id,
        city_id,
        name,
        city_name,
        code,
        local_currency,
        email,
        contacts,
        documents,
        permission_grants,
        is_business_branch
      ) VALUES (
        ${uae.id},
        ${uaeBranch.id},
        ${dubaiCity?.id || null},
        'X Experiment Branch',
        'Dubai',
        'ARE-EXP-001',
        'AED',
        'experiment@dgt.llc',
        ${sql.json([])},
        ${sql.json([])},
        ${sql.json([])},
        true
      )
      RETURNING id, name, code, email, local_currency
    `;
    console.log("✓ Successfully created X Experiment branch:", created);
  }

  console.log("\n=== 2. VERIFY ALL CITY BRANCHES ===");
  const allBranches = await sql`SELECT id, name, code, local_currency FROM city_branches ORDER BY code`;
  console.log(`Total City Branches: ${allBranches.length}`);
  allBranches.forEach(b => console.log(`  - [${b.code}] ${b.name} (${b.local_currency})`));

  console.log("\n=== 3. VERIFY ZERO-STATE DATABASE HEALTH & INTEGRITY ===");
  const testRoz = await sql`SELECT count(*)::int as c FROM roznamcha_entries`;
  const testRozLines = await sql`SELECT count(*)::int as c FROM roznamcha_lines`;
  const testLed = await sql`SELECT count(*)::int as c FROM ledgers`;
  const testLedBal = await sql`SELECT count(*)::int as c FROM ledger_balances`;
  const testAcc = await sql`SELECT count(*)::int as c FROM enterprise_accounts`;
  const testJobs = await sql`SELECT count(*)::int as c FROM document_intake_jobs`;
  const testCust = await sql`SELECT count(*)::int as c FROM customers`;
  const testSeq = await sql`SELECT count(*)::int as c FROM transaction_serial_sequences`;
  const testProfiles = await sql`SELECT count(*)::int as c FROM profiles`;
  const testCountries = await sql`SELECT count(*)::int as c FROM countries`;
  const testCountryBranches = await sql`SELECT count(*)::int as c FROM country_branches`;
  
  const health = {
    roznamcha_entries: testRoz[0].c,
    roznamcha_lines: testRozLines[0].c,
    ledgers: testLed[0].c,
    ledger_balances: testLedBal[0].c,
    enterprise_accounts: testAcc[0].c,
    document_intake_jobs: testJobs[0].c,
    customers: testCust[0].c,
    transaction_serial_sequences: testSeq[0].c,
    user_profiles_preserved: testProfiles[0].c,
    countries_preserved: testCountries[0].c,
    country_branches_preserved: testCountryBranches[0].c,
    city_branches_total: allBranches.length
  };
  console.table(health);

  await sql.end();
}

main().catch(console.error);
