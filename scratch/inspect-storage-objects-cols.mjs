import fs from 'node:fs';
import postgres from 'postgres';
function readDbUrl() { if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim(); for (const f of ['.env.local','.env']) { if (fs.existsSync(f)) { const c = fs.readFileSync(f,'utf8'); const m = c.match(/^DATABASE_URL\s*=\s*(.+)$/m); if (m) return m[1].trim().replace(/^['"]|['"]$/g,''); } } throw new Error('DATABASE_URL not found'); }
const sql = postgres(readDbUrl(), { max: 1, prepare: false });
try {
  const cols = await sql`select column_name, is_nullable from information_schema.columns where table_schema='storage' and table_name='objects' order by ordinal_position`;
  console.table(cols);
} finally { await sql.end({ timeout: 5 }); }
