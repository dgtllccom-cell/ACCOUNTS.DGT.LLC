import { execSync } from 'child_process';

const script = `
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('/var/www/dgt-nextjs/.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const sb = createClient(url, key);

async function run() {
  const { data: cb, error: cbErr } = await sb.from('country_branches').select('id, name, country_id');
  if (cbErr) console.error('cbErr:', cbErr);
  console.log('BRANCHES:', JSON.stringify(cb, null, 2));
  const { data: accs, error: accErr } = await sb.from('accounts').select('id, code, name, country_branch_id').limit(10);
  if (accErr) console.error('accErr:', accErr);
  console.log('ACCOUNTS:', JSON.stringify(accs, null, 2));
}
run();
`;

const b64 = Buffer.from(script).toString('base64');
const out = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "echo '${b64}' | base64 -d > /tmp/check_branches.js ; cd /var/www/dgt-nextjs ; NODE_PATH=/var/www/dgt-nextjs/node_modules node /tmp/check_branches.js"`, { encoding: 'utf8' });
console.log(out);
