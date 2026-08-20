import postgres from 'postgres';
import fs from 'fs';

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

const dbUrl = getDbUrl();
const sql = postgres(dbUrl, { max: 2, prepare: false });

async function checkCols() {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'roznamcha_lines'`;
  console.log('Columns:', cols.map(c => c.column_name));
  await sql.end();
}

checkCols();
