import { spawnSync } from 'child_process';

const testScript = `
import { createHmac } from 'crypto';
import fs from 'fs';

const envContent = fs.readFileSync('/var/www/dgt-nextjs/.env.local', 'utf8');
let secret = '';
for (const line of envContent.split('\\n')) {
  if (line.startsWith('ERP_SESSION_SECRET=')) {
    secret = line.split('=')[1].trim();
  }
}

const sessionData = {
  v: 1,
  kind: "temp",
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'superadmin@dgt.llc',
  fullName: 'Super Admin',
  roles: ['super_admin'],
  assignments: [{ role: 'super_admin', countryId: null, countryBranchId: null, cityBranchId: null }],
  createdAt: Date.now()
};

const payloadB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
const hmac = createHmac('sha256', secret).update(payloadB64).digest('base64url');
const cookieVal = \`\${payloadB64}.\${hmac}\`;
const cookieHeader = \`erp_session=\${cookieVal}\`;

const endpoints = [
  '/dashboard',
  '/dashboard/roznamcha',
  '/dashboard/roznamcha/cash-entry',
  '/dashboard/new-entry',
  '/dashboard/new-entry/advance',
  '/dashboard/journal',
  '/dashboard/journal/sales-order-payment'
];

async function run() {
  for (const ep of endpoints) {
    const res = await fetch('http://127.0.0.1:3000' + ep, {
      headers: { 'Cookie': cookieHeader },
      redirect: 'manual'
    });
    console.log(ep, '=> Status:', res.status, 'Location:', res.headers.get('location'));
  }
}

run();
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'node --input-type=module -'], {
  input: testScript,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
