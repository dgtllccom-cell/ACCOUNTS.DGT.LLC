import fs from 'fs';
import postgres from 'postgres';

// Read DATABASE_URL from the environment or a local .env file — never hardcode
// credentials in a tracked file.
function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const match = fs.readFileSync(f, 'utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const url = getDbUrl();
if (!url) {
  console.error('No DATABASE_URL found (set the env var or add it to .env).');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require', max: 2 });

async function main() {
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log(`Total public tables: ${rows.length}`);
  console.log(rows.map((r) => r.table_name).join('\n'));
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
