import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false } });

async function checkTables() {
  const tables = await vpsSql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  console.log("=== ALL PUBLIC TABLES ON DATABASE ===");
  console.log(tables.map(t => t.table_name));

  // Check account linking tables
  const accountTables = tables.filter(t => t.table_name.includes('account') || t.table_name.includes('link'));
  console.log("\nAccount & Linking Tables:", accountTables.map(t => t.table_name));

  // Check inventory tables
  const inventoryTables = tables.filter(t => t.table_name.includes('stock') || t.table_name.includes('inventory') || t.table_name.includes('goods'));
  console.log("\nInventory & Stock Tables:", inventoryTables.map(t => t.table_name));

  await vpsSql.end();
}

checkTables().catch(console.error);
