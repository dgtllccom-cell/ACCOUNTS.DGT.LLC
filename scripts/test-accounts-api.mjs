import fetch from 'node-fetch';
import { createHmac } from 'node:crypto';

const SESSION_SECRET = 'add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f';

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"],
    assignments: [
      {
        role: "super_admin",
        countryId: null,
        countryBranchId: null,
        cityBranchId: null,
        operationalDomain: "both",
        mobileProfile: "standard"
      }
    ],
    createdAt: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function test() {
  const token = buildSessionToken();
  const res1 = await fetch('http://72.60.209.121/api/erp/accounting/accounts?countryBranchId=89bf01e5-9245-4099-b78c-b4476e7bd96b', {
    headers: {
      Cookie: `erp_session=${token}`
    }
  });
  const json1 = await res1.json();
  console.log('Accounts for UAE branch:', (json1.data?.accounts || json1.accounts || []).length);

  const res2 = await fetch('http://72.60.209.121/api/erp/accounting/accounts?countryBranchId=d3412c07-9bd4-4a43-8858-8ca20864aa66', {
    headers: {
      Cookie: `erp_session=${token}`
    }
  });
  const json2 = await res2.json();
  console.log('Accounts for AF branch d3412c07:', (json2.data?.accounts || json2.accounts || []).length);

  const res3 = await fetch('http://72.60.209.121/api/erp/accounting/accounts?countryBranchId=4af1410e-e8a6-4246-9d7b-82ed17394211', {
    headers: {
      Cookie: `erp_session=${token}`
    }
  });
  const json3 = await res3.json();
  console.log('Accounts for AF branch 4af1410e:', (json3.data?.accounts || json3.accounts || []).length);
}

test();
