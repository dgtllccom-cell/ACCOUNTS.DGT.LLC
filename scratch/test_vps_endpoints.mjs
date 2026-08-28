import { execSync } from 'child_process';

const bashScript = `
node << 'NODEOF'
async function run() {
  // Test 1: Fetch without cookie
  const res1 = await fetch('http://127.0.0.1:3000/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=2000&language=en');
  console.log('Without cookie status:', res1.status, 'Type:', res1.headers.get('content-type'));
  const body1 = await res1.text();
  console.log('Body 1:', body1.slice(0, 300));

  // Test 2: Login as Super Admin and fetch
  const loginRes = await fetch('http://127.0.0.1:3000/api/erp/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@damaan.com', password: 'password123' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status, 'Cookie:', cookie ? 'Received' : 'None');

  const res2 = await fetch('http://127.0.0.1:3000/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=2000&language=en', {
    headers: { 'Cookie': cookie || '' }
  });
  console.log('With cookie status:', res2.status, 'Type:', res2.headers.get('content-type'));
  const body2 = await res2.text();
  console.log('Body 2:', body2.slice(0, 500));
}
run();
NODEOF
`;

try {
  const res = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "bash -s"`, {
    input: bashScript,
    encoding: 'utf8'
  });
  console.log(res);
} catch (e) {
  console.error("Test Error:", e.message);
}
