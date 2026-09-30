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
  const users = await sql`
    SELECT p.id, p.full_name, p.email, p.role, p.country_id, c.name as country_name, b.name as branch_name
    FROM public.profiles p
    LEFT JOIN public.countries c ON c.id = p.country_id
    LEFT JOIN public.country_branches b ON b.id = p.country_branch_id
    WHERE p.deleted_at IS NULL
    ORDER BY p.role, p.full_name
    LIMIT 20
  `;
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`- ${u.full_name} (${u.role}) | Email: ${u.email} | Country: ${u.country_name} | Branch: ${u.branch_name} | ID: ${u.id}`);
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
