import fs from 'node:fs';
import postgres from 'postgres';

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const newPassword = process.argv[2] || 'Daman@2026!';

async function updateDb(url, name) {
  if (!url) return;
  console.log(`Updating Superadmin password on [${name}]...`);
  const sql = postgres(url);
  try {
    const res = await sql`
      UPDATE profiles
      SET raw_password = ${newPassword},
          updated_at = NOW()
      WHERE user_code = 'SUPERADMIN'
         OR id = '00000000-0000-4000-8000-000000000001'
      RETURNING id, user_code, full_name, raw_password;
    `;
    console.log(`✅ [${name}] Updated successfully:`, res);
  } catch (err) {
    console.error(`❌ [${name}] Error:`, err.message);
  } finally {
    await sql.end();
  }
}

async function main() {
  const localUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;
  const prodUrl = env.PROD_DATABASE_URL;

  await updateDb(localUrl, 'LOCAL / CURRENT DB');
  if (prodUrl && prodUrl !== localUrl) {
    await updateDb(prodUrl, 'PROD DB');
  }

  console.log(`\nNew Super Admin Password set to: ${newPassword}`);
}

main().catch(console.error);
