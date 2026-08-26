import fs from 'fs';
import postgres from 'postgres';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const sql = postgres(getDbUrl(), { max: 2 });

async function inspectAccountsColumns() {
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'accounts'
    ORDER BY column_name;
  `;
  console.log("Accounts table columns:", columns.map(c => `${c.column_name} (${c.data_type})`));
  
  const sample = await sql`SELECT * FROM accounts LIMIT 2;`;
  console.log("\nSample account row:", sample[0]);
  await sql.end();
}

inspectAccountsColumns().catch(console.error);
