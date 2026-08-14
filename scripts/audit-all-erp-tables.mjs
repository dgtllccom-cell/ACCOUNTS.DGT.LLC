import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function main() {
  console.log("=== CHECKING ALL TABLES AND TRANSLATIONS ON VPS ===");
  const tables = await vpsSql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log(`Found ${tables.length} tables in database.`);

  const [tCount] = await vpsSql`SELECT count(*) as c FROM record_translations WHERE deleted_at IS NULL`;
  console.log(`Total Active Translations on VPS: ${tCount.c}`);

  const byTable = await vpsSql`
    SELECT record_table, count(*) as count 
    FROM record_translations 
    WHERE deleted_at IS NULL 
    GROUP BY record_table 
    ORDER BY count DESC
  `;
  console.log("\n--- Translations grouped by record_table ---");
  console.table(byTable);

  await vpsSql.end();
  console.log("\nAudit finished cleanly!");
}

main().catch(console.error);
