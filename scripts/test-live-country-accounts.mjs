const host = process.env.LIVE_HOST || '72.60.209.121';
const pwd = process.env.LIVE_PASSWORD || process.argv[2] || '';

async function testLive() {
  if (!pwd) {
    console.error('Usage: node scripts/test-live-country-accounts.mjs <password>');
    return;
  }
  console.log(`[TEST] Testing live VPS at http://${host}...`);

  // 1. Chaman.branch fetch
  const chamanRes = await fetch(`http://${host}/api/erp/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ identifier: 'chaman.branch@dgt.llc', password: pwd, login_type: 'branch' })
  });
  const chamanCookie = chamanRes.headers.get('set-cookie');
  const chamanAccountsRes = await fetch(`http://${host}/api/erp/accounting/reports/accounts/general?limit=200`, {
    headers: { 'Cookie': chamanCookie }
  });
  console.log('CHAMAN ACCOUNTS STATUS:', chamanAccountsRes.status);
  const chamanData = await chamanAccountsRes.json();
  const rows = chamanData?.data?.rows || [];
  console.log(`[CHAMAN TOTAL ROWS]:`, rows.length);
  const countryAccounts = rows.filter((r) => r.isCountryAccount);
  console.log(`[CHAMAN COUNTRY ACCOUNTS]:`, countryAccounts.length);
  for (const a of countryAccounts) {
    console.log(`- Code: ${a.rawAccountCode || a.accountCode} | Name: ${a.accountName} | BranchType: ${a.branchType} | SubType: ${a.subType}`);
  }
}

testLive().catch(console.error);
