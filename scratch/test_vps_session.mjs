async function test() {
  const loginRes = await fetch('http://72.60.209.121/api/erp/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin@damaan.com', password: 'Admin@123' })
  });
  console.log("Status:", loginRes.status);
  const data = await loginRes.json();
  console.log("Data:", data);
  const setCookie = loginRes.headers.getSetCookie();
  console.log("Set-Cookie:", setCookie);

  const cookieHeader = setCookie.map(c => c.split(';')[0]).join('; ');
  console.log("Cookie header to send:", cookieHeader);

  const sessionRes = await fetch('http://72.60.209.121/api/erp/auth/session', {
    headers: { Cookie: cookieHeader }
  });
  const sessionData = await sessionRes.json();
  console.log("Session Data from /api/erp/auth/session:", sessionData);

  const ledgersRes = await fetch('http://72.60.209.121/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=100', {
    headers: { Cookie: cookieHeader }
  });
  const ledgersData = await ledgersRes.json();
  console.log("Ledgers Data:", ledgersData);
}

test().catch(console.error);
