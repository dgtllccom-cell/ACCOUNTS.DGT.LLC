import { execSync } from 'child_process';

const checkCmd = `
echo "=== 1. VAR WWW DIRECTORIES ==="
ls -la /var/www/

echo ""
echo "=== 2. PM2 STATUS ==="
pm2 status || true

echo ""
echo "=== 3. ENVIRONMENT FILE CHECK (/var/www/dgt-nextjs/.env.local) ==="
if [ -f "/var/www/dgt-nextjs/.env.local" ]; then
  echo ".env.local exists."
  grep -E "^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL)" /var/www/dgt-nextjs/.env.local | sed 's/=.*/= [CONFIGURED]/'
else
  echo ".env.local DOES NOT EXIST in /var/www/dgt-nextjs/"
fi

if [ -f "/var/www/env_backups/.env.local.bak" ]; then
  echo "Backup env file exists in /var/www/env_backups/.env.local.bak"
fi
`;

console.log('Safe status check on VPS root@72.60.209.121 (read-only query)...');

try {
  const output = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "${checkCmd.replace(/\n/g, ' ')}"`, {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('================ VPS SAFE CHECK OUTPUT ================');
  console.log(output);
  console.log('========================================================');
} catch (err) {
  console.error('Safe check output / log:');
  if (err.stdout) console.log('STDOUT:\n', err.stdout);
  if (err.stderr) console.error('STDERR:\n', err.stderr);
}
