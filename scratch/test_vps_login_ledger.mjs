import { execSync } from 'child_process';

const bashScript = `
node << 'NODEOF'
async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/erp/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@damaan.com', password: 'Admin@123' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status, 'Cookie:', cookie ? 'Received' : 'None');

  const res = await fetch('http://127.0.0.1:3000/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=2000&language=en', {
    headers: { 'Cookie': cookie || '' }
  });
  console.log('Ledger API status:', res.status, 'Type:', res.headers.get('content-type'));
  const json = await res.json();
  console.log('Ledgers returned count:', json?.data?.ledgers?.length, 'OK:', json?.ok);
  if (json?.data?.ledgers?.length > 0) {
    console.log('First 2 ledgers:', JSON.stringify(json.data.ledgers.slice(0, 2), null, 2));
  } else {
    console.log('Response body:', JSON.stringify(json, null, 2));
  }
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
