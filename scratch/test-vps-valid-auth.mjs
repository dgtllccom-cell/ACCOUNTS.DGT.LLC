import { spawnSync } from 'child_process';

const testScript = `
import { createHmac } from 'crypto';
import fs from 'fs';

// Read secret from .env.local
const envContent = fs.readFileSync('/var/www/dgt-nextjs/.env.local', 'utf8');
let secret = '';
for (const line of envContent.split('\\n')) {
  if (line.startsWith('ERP_SESSION_SECRET=')) {
    secret = line.split('=')[1].trim();
  }
}

// Generate valid temp erp_session cookie (payload.hmac)
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

console.log('Testing with properly signed ERP_SESSION cookie...');

const endpoints = [
  '/dashboard',
  '/dashboard/ledger',
  '/dashboard/roznamcha',
  '/dashboard/journal/sales-order-payment/advance',
  '/dashboard/new-entry/users/registration',
  '/dashboard/new-entry/advance',
  '/dashboard/journal/sales-order-payment',
  '/dashboard/journal/sales-order-payment/remaining',
  '/dashboard/journal/sales-order-payment/charges',
  '/dashboard/journal/sales-order-payment/history',
  '/api/erp/users',
  '/api/erp/bank-roznamcha',
  '/api/erp/customers?limit=10',
  '/api/erp/accounting/ledgers',
  '/api/erp/locations/cities',
  '/api/erp/locations/countries'
];

async function run() {
  for (const ep of endpoints) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + ep, {
        headers: { 'Cookie': cookieHeader },
        redirect: 'manual'
      });
      const text = await res.text();
      console.log(ep, '=> Status:', res.status, 'Preview:', text.substring(0, 80).replace(/\\n/g, ' '));
    } catch (e) {
      console.log(ep, '=> ERROR:', e.message);
    }
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
