import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectPersonTables() {
  const tables = await localSql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('All local tables:', tables.map(t => t.table_name));

  const empSample = await localSql`SELECT * FROM employees LIMIT 2`;
  console.log('Sample local employee:', empSample);

  await localSql.end();
}

inspectPersonTables().catch(console.error);
