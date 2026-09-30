import fs from 'node:fs';
import postgres from 'postgres';

function parseEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const sql = postgres(env.DATABASE_URL, { max: 1 });

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE 'clearing_%')
    ORDER BY table_name
  `;
  console.log('All clearing_* tables:', tables.map(t => t.table_name));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
