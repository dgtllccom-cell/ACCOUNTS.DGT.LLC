import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name ILIKE '%branch%';
    `;
    console.log("Branch tables:\n", tables);

    // Also check enterprise_branches, country_branches etc.
    const res = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log("All tables:\n", res.map(r => r.table_name).sort());
  } finally {
    await sql.end();
  }
}

main();
