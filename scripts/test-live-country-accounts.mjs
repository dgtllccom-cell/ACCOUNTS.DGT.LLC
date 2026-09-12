async function testLive() {
  const host = '72.60.209.121';

  // 1. Login with chaman.branch@dgt.llc / Chaman@9090
  const loginRes = await fetch(`http://${host}/api/erp/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      identifier: 'chaman.branch@dgt.llc',
      password: 'Chaman@9090',
      login_type: 'branch'
    })
  });

  const cookieHeader = loginRes.headers.get('set-cookie');

  // 2. Fetch General Accounts report as chaman.branch
  const accountsRes = await fetch(`http://${host}/api/erp/accounting/reports/accounts/general?limit=200`, {
    headers: {
      'Cookie': cookieHeader
    }
  });

  const accountsData = await accountsRes.json();
  console.log('[accountsData.data KEYS]:', accountsData.data ? Object.keys(accountsData.data) : typeof accountsData.data);
  const rows = Array.isArray(accountsData.data) 
    ? accountsData.data 
    : (accountsData.data?.rows || accountsData.data?.items || []);
  console.log('[ROW COUNT]:', rows.length);

  const countryAccounts = rows.filter(r => 
    r.isCountryAccount || 
    r.code?.startsWith('CT-INTER-') || 
    r.code?.startsWith('PAK-CORP-') ||
    r.code?.startsWith('UAE-CORP-') ||
    r.code?.startsWith('AFG-CORP-') ||
    r.code?.startsWith('IND-CORP-') ||
    r.name?.toLowerCase().includes('country') ||
    r.name?.toLowerCase().includes('clearing')
  );

  console.log(`\n======================================================`);
  console.log(`[VERIFICATION] Country Accounts Found for chaman.branch: ${countryAccounts.length}`);
  console.log(`======================================================`);
  for (const acc of countryAccounts) {
    console.log(`- Code: ${acc.code} | Name: ${acc.name} | isCountryAccount: ${acc.isCountryAccount} | branchType: ${acc.branchType}`);
  }

  // 3. Test superadmin login
  const adminRes = await fetch(`http://${host}/api/erp/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin', password: 'Chaman@9090' })
  });
  console.log(`\n[SUPERADMIN] Login status:`, adminRes.status);
  const adminData = await adminRes.json();
  console.log(`[SUPERADMIN] Result:`, adminData);
}

testLive().catch(console.error);
