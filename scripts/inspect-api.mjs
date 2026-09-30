import { createHmac } from 'node:crypto';

async function main() {
  const SESSION_SECRET = 'c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d';
  const payload = {
    v: 1, kind: 'temp', userId: '00000000-0000-4000-8000-000000000001',
    email: 'superadmin@dgt.llc', fullName: 'Super Admin',
    roles: ['super_admin'], isSuperAdmin: true,
    assignments: [{ role: 'super_admin' }], createdAt: Date.now()
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  const token = b64 + '.' + sig;
  const res = await fetch('http://localhost:3000/api/erp/clearing-agent/customer-order', {
    headers: { cookie: 'erp_session=' + token }
  });
  const json = await res.json();
  console.log('Status:', res.status, 'Keys:', Object.keys(json), 'isArray:', Array.isArray(json));
  if (json.data) console.log('json.data isArray:', Array.isArray(json.data), 'len:', json.data.length);
  if (json.orders) console.log('json.orders isArray:', Array.isArray(json.orders), 'len:', json.orders.length);
}

main().catch(console.error);
