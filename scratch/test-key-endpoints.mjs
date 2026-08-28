import { spawnSync } from 'child_process';

const testScript = `
const endpoints = [
  '/api/erp/locations/countries',
  '/api/erp/locations/cities',
  '/api/erp/customers',
  '/api/erp/accounting/ledgers',
  '/api/erp/bank-roznamcha',
  '/api/erp/users',
  '/dashboard/new-entry/users/registration',
  '/dashboard/journal/sales-order-payment/advance'
];

async function run() {
  for (const ep of endpoints) {
    try {
      const res = await fetch('http://127.0.0.1:3000' + ep, { redirect: 'manual' });
      const text = await res.text();
      console.log(ep, '=> Status:', res.status, 'Body preview:', text.substring(0, 120).replace(/\\n/g, ' '));
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
