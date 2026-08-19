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

console.log('=== VERIFYING ROUTES & REDIRECTS ON VPS ===');

const directPages = [
  '/dashboard/ledger',
  '/dashboard/roznamcha/cash-entry',
  '/dashboard/journal/sales-order-payment/advance',
  '/dashboard/journal/sales-order-payment/remaining',
  '/dashboard/journal/sales-order-payment/charges',
  '/dashboard/journal/sales-order-payment/history',
  '/dashboard/journal/purchase-order-payment/advance',
  '/dashboard/journal/purchase-order-payment/remaining',
  '/dashboard/journal/purchase-order-payment/charges',
  '/dashboard/journal/purchase-order-payment/history',
  '/dashboard/new-entry/users/registration',
  '/dashboard/settings/bank/new',
  '/dashboard/settings/contact-type/new',
  '/dashboard/reports/exchange-rate',
  '/api/erp/bank-roznamcha',
  '/api/erp/customers?limit=5',
  '/api/erp/accounting/ledgers?limit=5',
  '/api/branch-management/country-branches',
  '/api/branch-management/city-branches'
];

const redirectTests = [
  { from: '/dashboard/journal', expected: '/dashboard/journal/sales-order-payment/advance' },
  { from: '/dashboard/ledgers', expected: '/dashboard/ledger' },
  { from: '/dashboard/exchange-rates', expected: '/dashboard/reports/exchange-rate' },
  { from: '/dashboard/cash-entry', expected: '/dashboard/roznamcha/cash-entry' },
  { from: '/dashboard/daily-payment-entry', expected: '/dashboard/roznamcha/cash-entry' },
  { from: '/dashboard/sales/payment', expected: '/dashboard/journal/sales-order-payment/advance' },
  { from: '/dashboard/new-entry/advance', expected: '/dashboard/journal/sales-order-payment/advance' }
];

async function run() {
  console.log('\\n[1] Testing Direct Pages (Expect 200 OK):');
  let passCount = 0;
  for (const ep of directPages) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + ep, {
        headers: { 'Cookie': cookieHeader },
        redirect: 'manual'
      });
      if (res.status === 200) {
        console.log('  ✓', ep, '=> 200 OK');
        passCount++;
      } else {
        console.log('  ✗', ep, '=> Status:', res.status, res.headers.get('location') || '');
      }
    } catch (e) {
      console.log('  ✗', ep, '=> ERROR:', e.message);
    }
  }

  console.log('\\n[2] Testing Redirects (Expect 307 to Target):');
  let redCount = 0;
  for (const t of redirectTests) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + t.from, {
        headers: { 'Cookie': cookieHeader },
        redirect: 'manual'
      });
      const loc = res.headers.get('location');
      if (loc === t.expected || (res.status === 307 && loc?.includes(t.expected))) {
        console.log('  ✓', t.from, '=>', res.status, 'Location:', loc);
        redCount++;
      } else {
        console.log('  ✗', t.from, '=> Status:', res.status, 'Location:', loc, '(Expected:', t.expected, ')');
      }
    } catch (e) {
      console.log('  ✗', t.from, '=> ERROR:', e.message);
    }
  }

  console.log(\`\\nSUMMARY: \${passCount}/\${directPages.length} Pages OK, \${redCount}/\${redirectTests.length} Redirects OK\`);
}

run();
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'node --input-type=module -'], {
  input: testScript,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
