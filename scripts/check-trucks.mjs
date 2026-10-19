import { withLocalPg, getDbUrl } from '../lib/db/local-postgres.js';

async function main() {
  const cols = await withLocalPg(async (sql) => {
    return sql`select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'trucks' order by ordinal_position`;
  });
  console.log('Truck columns:', cols.map(c => c.column_name).join(', '));
}




main().catch(err => {
  console.error(err);
  process.exit(1);
});

