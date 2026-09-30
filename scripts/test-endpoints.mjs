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

  const endpoints = [
    "/api/erp/clearing-agent/customer-order",
    "/api/erp/customers?limit=250",
    "/api/erp/companies?limit=250",
    "/api/erp/locations/countries",
    "/api/erp/ports",
    "/api/erp/clearing-agents?limit=200",
    "/api/erp/shipping-lines?limit=200",
    "/api/branch-management/country-branches",
    "/api/branch-management/city-branches",
    "/api/erp/user-tasks/assignees",
    "/api/erp/accounting/accounts?limit=1000",
    "/api/erp/master-data/trucks?selectable=true&limit=250",
    "/api/erp/master-data/warehouses?limit=250",
    "/api/erp/goods?limit=250"
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:3000${ep}`, {
        headers: { cookie: 'erp_session=' + token }
      });
      console.log(ep, '-> status:', res.status);
      const text = await res.text();
      try {
        JSON.parse(text);
      } catch (err) {
        console.log('JSON parse failed for', ep, 'text:', text.substring(0, 100));
      }
    } catch (err) {
      console.error('Fetch failed for', ep, err.message);
    }
  }
}

main().catch(console.error);
