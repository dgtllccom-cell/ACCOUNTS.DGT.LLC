import { withLocalPg } from './lib/db/local-postgres.js';

async function run() {
  const result = await withLocalPg(async (sql) => {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'roznamcha_entries' 
      ORDER BY ordinal_position
    `;
    return cols;
  });
  console.log('Result:', result?.map(c => `${c.column_name} (${c.data_type})`));
}

run().catch(console.error);
